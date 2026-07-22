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
// ALGORITHME (validé) :
// - MA note à moi est toujours à part, en premier, avec le bouton "+" qui
//   reste visible en permanence : appuyer dessus ouvre toujours l'écran de
//   création (même si j'ai déjà une note active — ça la remplace).
// - Chaque note ORIGINALE (non-repost) = 1 item, propriétaire seul dessus.
// - Chaque REPOST = 1 item SÉPARÉ (pas fusionné avec l'original ni avec les
//   autres reposts de la même note) : affiche l'auteur original + LE
//   republieur de cet item précis, en double-anneau. Si 6 personnes
//   republient la même note, ça fait 6 items distincts, un par republieur,
//   dans l'ordre où ils ont republié.
// - Le republieur n'a PAS le "+" sur cet item de repost (c'est un item
//   dédié à la collaboration, pas à lui) — le "+" n'existe que sur SON
//   propre item personnel s'il en a un.
// - Tri : notes/reposts actifs d'abord (plus récent -> plus ancien), puis
//   notes/reposts expirés (plus récent expiré -> plus ancien expiré).
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
    .order('created_at', { ascending: true }) // ascendant : le premier republieur reste en tête de son groupe
  return data || []
}

function isExpired(note) {
  return new Date(note.expire_at).getTime() <= Date.now()
}

export default function NoteBar() {
  const [viewerIndex, setViewerIndex] = useState(null)
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

  // Items "note" : chaque note originale ET chaque repost est SA PROPRE entrée.
  const noteItems = rawNotes
    .filter((n) => n.user_id !== user?.id) // ma note à moi est traitée à part, en tête
    .map((n) => {
      const isRepost = !!n.repost_of
      const original = isRepost ? originalById.get(n.repost_of) : n
      return {
        kind: isRepost ? 'repost' : 'original',
        entry: n,
        original: original || n, // auteur affiché au centre
        reposter: isRepost ? n.users : null, // republieur affiché en second anneau (uniquement sur un item repost)
      }
    })
    .filter((it) => it.original) // sécurité : si l'original a été supprimé entre-temps, on ignore le repost orphelin

  const usersWithNoteItem = new Set(noteItems.map((it) => it.entry.user_id))
  usersWithNoteItem.add(user?.id)

  // Utilisateurs sans aucune note/repost actif ou passé récemment listé ci-dessus :
  // ils apparaissent quand même, sans anneau coloré.
  const usersWithoutNote = allUsers.filter((u) => u.id !== user?.id && !usersWithNoteItem.has(u.id))

  const activeItems = noteItems.filter((it) => !isExpired(it.entry)).sort((a, b) => new Date(b.entry.created_at) - new Date(a.entry.created_at))
  const expiredItems = noteItems.filter((it) => isExpired(it.entry)).sort((a, b) => new Date(b.entry.created_at) - new Date(a.entry.created_at))

  const sortedOthers = [...activeItems, ...expiredItems]

  const myNote = rawNotes.find((n) => n.user_id === user?.id && !n.repost_of)
  const hasMyNote = !!myNote && !isExpired(myNote)

  // Liste complète utilisée par le viewer (ma note si j'en ai une + tous les items + les gens sans note)
  const viewerEntries = [
    ...(myNote ? [{ kind: 'original', entry: myNote, original: myNote, reposter: null }] : []),
    ...sortedOthers,
  ]

  const myPhotoUrl = profile?.photo_url

  const openViewerAt = (entryId) => {
    setViewerIndex(viewerEntries.findIndex((e) => e.entry.id === entryId))
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
        {/* Mon item : le "+" reste TOUJOURS visible, que j'aie une note ou non.
            Cliquer sur le cercle (si j'ai une note) l'ouvre ; cliquer sur le "+" crée/remplace. */}
        <div className="flex flex-col items-center gap-2 shrink-0 relative">
          <div className="relative cursor-pointer" onClick={() => hasMyNote && openViewerAt(myNote.id)}>
            <StoryRing
              layoutId="note-ring-mine"
              photoUrl={myPhotoUrl}
              fallbackSeed={user?.id}
              hasStory={hasMyNote}
              rotate={tilts.mine || 0}
            />
          </div>
          <button
            onClick={() => navigate('/notes/nouvelle')}
            className="absolute bottom-5 right-0 w-5 h-5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center"
            aria-label={hasMyNote ? 'Remplacer ma note' : 'Ajouter une note'}
          >
            <Plus size={12} className="text-white" strokeWidth={3} />
          </button>
          <span className="text-caption max-w-[72px] truncate">Ta note</span>
        </div>

        {sortedOthers.map((it) => (
          <div
            key={it.entry.id}
            data-note-key={it.entry.id}
            className="flex flex-col items-center gap-2 shrink-0 cursor-pointer"
            onClick={() => openViewerAt(it.entry.id)}
          >
            <div className="relative">
              <StoryRing
                layoutId={`note-ring-${it.entry.id}`}
                photoUrl={it.original.users?.photo_url}
                fallbackSeed={it.original.user_id}
                hasStory={!isExpired(it.entry)}
                rotate={tilts[it.entry.id] || 0}
              />
              {/* item de repost : second petit anneau avec le republieur, superposé */}
              {it.kind === 'repost' && it.reposter && (
                <img
                  src={it.reposter.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${it.reposter.id}`}
                  alt=""
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full object-cover border-2"
                  style={{ borderColor: 'var(--bg-primary)' }}
                />
              )}
            </div>
            <span className="text-caption max-w-[72px] truncate">
              {it.kind === 'repost'
                ? `${it.original.users?.nom_complet?.split(' ')[0]} & ${it.reposter?.nom_complet?.split(' ')[0]}`
                : it.original.users?.nom_complet?.split(' ')[0]}
            </span>
          </div>
        ))}

        {/* Tout le monde d'autre, sans note active ni jamais postée : anneau neutre, pas de couleur */}
        {usersWithoutNote.map((u) => (
          <div key={u.id} className="flex flex-col items-center gap-2 shrink-0 cursor-default opacity-70">
            <StoryRing photoUrl={u.photo_url} fallbackSeed={u.id} hasStory={false} />
            <span className="text-caption max-w-[72px] truncate">{u.nom_complet?.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {viewerIndex !== null && (
          <NoteViewer
            key="note-viewer"
            entries={viewerEntries}
            startIndex={viewerIndex}
            onClose={() => {
              setViewerIndex(null)
              queryClient.invalidateQueries({ queryKey: ['notes'] })
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
