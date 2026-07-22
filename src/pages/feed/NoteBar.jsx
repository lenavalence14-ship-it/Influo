import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import NoteViewer from './NoteViewer'
import StoryRing from './StoryRing'

// Remplace StoryBar : plus de story photo/vidéo, seulement des notes texte 24h.
//
// ALGORITHME (façon WhatsApp statuts texte) :
// - Chaque note (originale OU repost) est un ITEM autonome et reste affichée
//   jusqu'à expiration (24h) ou suppression manuelle par son auteur — une
//   nouvelle note ne remplace JAMAIS une note existante, elle s'ajoute.
// - Dans la barre horizontale, il y a UN SEUL cercle par personne (peu
//   importe qu'elle ait 1 ou 10 notes actives). Cliquer dessus ouvre le
//   viewer sur le PREMIER groupe = cette personne, avec autant de segments
//   dans la barre de progression que de notes actives pour elle.
// - Un repost compte comme un item À PART pour le republieur (double anneau
//   auteur original + republieur), mais dans SON groupe à lui, mélangé
//   chronologiquement avec ses éventuelles notes personnelles.
// - MA note à moi (mes propres notes, éventuellement plusieurs) est toujours
//   à part, en premier, avec le bouton "+" qui reste visible en permanence :
//   il ouvre toujours l'écran de création (ça AJOUTE une note, ne remplace
//   rien).
// - Le viewer navigue GROUPE PAR GROUPE (= personne par personne), et à
//   l'intérieur d'un groupe, SEGMENT PAR SEGMENT (= note par note de cette
//   personne), exactement comme les statuts texte WhatsApp.
// - Tri des groupes : le plus récent d'abord (basé sur la note la plus
//   récente de chaque personne), notes expirées à la fin.
// - TOUT LE MONDE inscrit sur l'app apparaît dans la barre, y compris ceux
//   qui n'ont jamais posté de note ou dont la note a expiré depuis longtemps
//   — simplement sans anneau coloré autour (anneau neutre).
async function fetchAllUsers() {
  const { data } = await supabase.from('users').select('id, nom_complet, photo_url, role').neq('role', 'admin')
  return data || []
}

async function fetchNotes() {
  const { data } = await supabase
    .from('notes')
    .select('id, user_id, contenu, created_at, expire_at, repost_of, users(id, nom_complet, photo_url, role)')
    .order('created_at', { ascending: true }) // ascendant : dans un groupe, les segments défilent du plus ancien au plus récent
  return data || []
}

function isExpired(note) {
  return new Date(note.expire_at).getTime() <= Date.now()
}

export default function NoteBar() {
  const [viewerGroupIndex, setViewerGroupIndex] = useState(null)
  const [tilts, setTilts] = useState({})
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scrollRef = useRef(null)
  const rafRef = useRef(null)

  const { data: rawNotes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,
    staleTime: 15_000,
  })
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-notebar'],
    queryFn: fetchAllUsers,
    staleTime: 60_000,
  })

  const originalById = new Map(rawNotes.filter((n) => !n.repost_of).map((n) => [n.id, n]))

  // Chaque note (originale ou repost) devient un "item" enrichi.
  const allItems = rawNotes
    .map((n) => {
      const isRepost = !!n.repost_of
      const original = isRepost ? originalById.get(n.repost_of) : n
      if (!original) return null // original supprimé entre-temps : repost orphelin ignoré
      return {
        kind: isRepost ? 'repost' : 'original',
        entry: n,
        original,
        reposter: isRepost ? n.users : null,
      }
    })
    .filter(Boolean)

  // Regroupement PAR PERSONNE : la personne qui "possède" l'item dans la
  // barre est toujours n.user_id (l'auteur du texte affiché dans son propre
  // groupe, ou le republieur pour un item de repost).
  const groupsByUser = new Map()
  for (const it of allItems) {
    if (it.entry.user_id === user?.id) continue // ma note à moi est traitée à part, en tête
    const key = it.entry.user_id
    if (!groupsByUser.has(key)) groupsByUser.set(key, [])
    groupsByUser.get(key).push(it)
  }

  // Un groupe = { userId, displayUser, items[] } ; items déjà triés du plus
  // ancien au plus récent (ordre de fetchNotes), donc le défilement dans le
  // groupe se fait naturellement dans cet ordre.
  const otherGroups = [...groupsByUser.entries()].map(([userId, items]) => {
    const mostRecent = items[items.length - 1]
    const displayUser = mostRecent.kind === 'repost' ? mostRecent.reposter : mostRecent.original.users
    const hasActive = items.some((it) => !isExpired(it.entry))
    const lastActiveTs = Math.max(...items.map((it) => new Date(it.entry.created_at).getTime()))
    return { userId, displayUser, items, hasActive, lastActiveTs }
  })

  const usersWithGroup = new Set(otherGroups.map((g) => g.userId))
  usersWithGroup.add(user?.id)
  const usersWithoutNote = allUsers.filter((u) => u.id !== user?.id && !usersWithGroup.has(u.id))

  const activeGroups = otherGroups.filter((g) => g.hasActive).sort((a, b) => b.lastActiveTs - a.lastActiveTs)
  const expiredGroups = otherGroups.filter((g) => !g.hasActive).sort((a, b) => b.lastActiveTs - a.lastActiveTs)
  const sortedOtherGroups = [...activeGroups, ...expiredGroups]

  // Mon groupe à moi : toutes mes notes personnelles actives ou expirées,
  // jamais de repost dedans (un repost que je fais apparaît dans mon groupe
  // "autre" ? Non : mon repost à moi, dans MA propre barre, n'a pas de sens
  // -> il apparaît dans la barre des AUTRES pour eux, avec moi en republieur.
  // Moi je vois juste mes propres notes personnelles ici.
  const myItems = rawNotes
    .filter((n) => n.user_id === user?.id && !n.repost_of)
    .map((n) => ({ kind: 'original', entry: n, original: n, reposter: null }))
  const hasMyActiveNote = myItems.some((it) => !isExpired(it.entry))

  const myGroup = myItems.length
    ? { userId: user?.id, displayUser: profile, items: myItems, hasActive: hasMyActiveNote, lastActiveTs: 0 }
    : null

  // Liste complète des groupes utilisée par le viewer (moi en premier si j'ai des notes).
  const viewerGroups = [...(myGroup ? [myGroup] : []), ...sortedOtherGroups]

  const myPhotoUrl = profile?.photo_url

  const openViewerForUser = (userId) => {
    const idx = viewerGroups.findIndex((g) => g.userId === userId)
    if (idx !== -1) setViewerGroupIndex(idx)
  }

  const handleScroll = () => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const container = scrollRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const next = {}
      container.querySelectorAll('[data-note-key]').forEach((el) => {
        const key = el.getAttribute('data-note-key')
        const elRect = el.getBoundingClientRect()
        const elCenter = elRect.left + elRect.width / 2
        const offset = (elCenter - centerX) / (rect.width / 2)
        const clamped = Math.max(-1, Math.min(1, offset))
        next[key] = clamped * 6
      })
      setTilts(next)
    })
  }

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto px-4 pt-4 pb-3"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Mon item : le "+" reste TOUJOURS visible. Cliquer sur le "+" AJOUTE
            une nouvelle note (ne remplace jamais une note existante).
            Cliquer sur le cercle (si j'ai au moins une note) ouvre mon groupe. */}
        <div className="flex flex-col items-center gap-2 shrink-0 relative">
          <div className="relative cursor-pointer" onClick={() => myGroup && openViewerForUser(user?.id)}>
            <StoryRing
              layoutId="note-ring-mine"
              photoUrl={myPhotoUrl}
              fallbackSeed={user?.id}
              hasStory={hasMyActiveNote}
              rotate={tilts.mine || 0}
            />
          </div>
          <button
            onClick={() => navigate('/notes/nouvelle')}
            className="absolute bottom-5 right-0 w-5 h-5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center"
            aria-label="Ajouter une note"
          >
            <Plus size={12} className="text-white" strokeWidth={3} />
          </button>
          <span className="text-caption max-w-[72px] truncate">Ta note</span>
        </div>

        {sortedOtherGroups.map((g) => {
          const lastItem = g.items[g.items.length - 1]
          return (
            <div
              key={g.userId}
              data-note-key={g.userId}
              className="flex flex-col items-center gap-2 shrink-0 cursor-pointer"
              onClick={() => openViewerForUser(g.userId)}
            >
              <div className="relative">
                <StoryRing
                  layoutId={`note-ring-${g.userId}`}
                  photoUrl={g.displayUser?.photo_url}
                  fallbackSeed={g.userId}
                  hasStory={g.hasActive}
                  rotate={tilts[g.userId] || 0}
                />
                {/* si le dernier item de ce groupe est un repost, petit anneau
                    de l'auteur original superposé pour signaler la collab */}
                {lastItem.kind === 'repost' && (
                  <img
                    src={lastItem.original.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${lastItem.original.user_id}`}
                    alt=""
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full object-cover border-2"
                    style={{ borderColor: 'var(--bg-primary)' }}
                  />
                )}
              </div>
              <span className="text-caption max-w-[72px] truncate">
                {g.displayUser?.nom_complet?.split(' ')[0]}
              </span>
            </div>
          )
        })}

        {/* Tout le monde d'autre, sans note active ni jamais postée : anneau neutre, pas de couleur */}
        {usersWithoutNote.map((u) => (
          <div key={u.id} className="flex flex-col items-center gap-2 shrink-0 cursor-default opacity-70">
            <StoryRing photoUrl={u.photo_url} fallbackSeed={u.id} hasStory={false} />
            <span className="text-caption max-w-[72px] truncate">{u.nom_complet?.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {viewerGroupIndex !== null && (
          <NoteViewer
            key="note-viewer"
            groups={viewerGroups}
            startGroupIndex={viewerGroupIndex}
            onClose={() => {
              setViewerGroupIndex(null)
              queryClient.invalidateQueries({ queryKey: ['notes'] })
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
