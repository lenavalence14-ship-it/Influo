import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import * as notesApi from '../../api/notes'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, MoreHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import NoteViewer from './NoteViewer'
import { profileRoute } from '../../lib/profileRoute'

// Version grille (2 colonnes) de NoteBar, pour l'écran /amis.
// Même logique de données que NoteBar (groupes, reposts, tri actif/expiré),
// mais présentation en grille façon "moments" au lieu de la barre horizontale
// de cercles. Le menu "..." est affiché mais non fonctionnel pour l'instant.
//
// Ordre des cases :
// 1) toujours "Ajouter à ta note" (photo de profil + bouton +)
// 2) MA note (si j'en ai une active/postée), sinon les autres commencent ici
// 3) notes des autres (actives d'abord, plus récent d'abord), puis reposts
// 4) utilisateurs sans aucune note (anneau neutre)
function isExpired(note) {
  return new Date(note.expire_at).getTime() <= Date.now()
}

export default function NoteGrid() {
  const [viewerGroupIndex, setViewerGroupIndex] = useState(null)
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: rawNotes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: notesApi.fetchActiveNotes,
    staleTime: 15_000,
  })
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-notebar'],
    queryFn: notesApi.fetchAllUsersForNoteBar,
    staleTime: 60_000,
  })

  const originalById = new Map(rawNotes.filter((n) => !n.repost_of).map((n) => [n.id, n]))

  const allItems = rawNotes
    .map((n) => {
      const isRepost = !!n.repost_of
      const original = isRepost ? originalById.get(n.repost_of) : n
      if (!original) return null
      return {
        kind: isRepost ? 'repost' : 'original',
        entry: n,
        original,
        reposter: isRepost ? n.users : null,
      }
    })
    .filter(Boolean)

  const personalGroupsByUser = new Map()
  const repostGroups = []
  for (const it of allItems) {
    if (it.entry.user_id === user?.id) continue
    if (it.kind === 'repost') {
      repostGroups.push({
        userId: `repost:${it.entry.id}`,
        displayUser: it.reposter,
        items: [it],
        hasActive: !isExpired(it.entry),
        lastActiveTs: new Date(it.entry.created_at).getTime(),
        isRepostGroup: true,
      })
    } else {
      const key = it.entry.user_id
      if (!personalGroupsByUser.has(key)) personalGroupsByUser.set(key, [])
      personalGroupsByUser.get(key).push(it)
    }
  }

  const personalGroups = [...personalGroupsByUser.entries()].map(([userId, items]) => {
    const displayUser = items[items.length - 1].original.users
    const hasActive = items.some((it) => !isExpired(it.entry))
    const lastActiveTs = Math.max(...items.map((it) => new Date(it.entry.created_at).getTime()))
    return { userId, displayUser, items, hasActive, lastActiveTs, isRepostGroup: false }
  })

  const otherGroups = [...personalGroups, ...repostGroups]

  const usersWithGroup = new Set(personalGroups.map((g) => g.userId))
  usersWithGroup.add(user?.id)
  const usersWithoutNote = allUsers.filter((u) => u.id !== user?.id && !usersWithGroup.has(u.id))

  const activeGroups = otherGroups.filter((g) => g.hasActive).sort((a, b) => b.lastActiveTs - a.lastActiveTs)
  const expiredGroups = otherGroups.filter((g) => !g.hasActive).sort((a, b) => b.lastActiveTs - a.lastActiveTs)
  const sortedOtherGroups = [...activeGroups, ...expiredGroups]

  const myItems = rawNotes
    .filter((n) => n.user_id === user?.id && !n.repost_of)
    .map((n) => ({ kind: 'original', entry: n, original: n, reposter: null }))
  const hasMyActiveNote = myItems.some((it) => !isExpired(it.entry))

  const myGroup = myItems.length
    ? { userId: user?.id, displayUser: profile, items: myItems, hasActive: hasMyActiveNote, lastActiveTs: 0, isRepostGroup: false }
    : null

  const myRepostItems = rawNotes
    .filter((n) => n.user_id === user?.id && n.repost_of)
    .map((n) => {
      const original = originalById.get(n.repost_of)
      return original ? { kind: 'repost', entry: n, original, reposter: profile } : null
    })
    .filter(Boolean)
  const myRepostGroups = myRepostItems.map((it) => ({
    userId: `repost:${it.entry.id}`,
    displayUser: profile,
    items: [it],
    hasActive: !isExpired(it.entry),
    lastActiveTs: new Date(it.entry.created_at).getTime(),
    isRepostGroup: true,
  }))

  const allOtherPlusMine = [...sortedOtherGroups, ...myRepostGroups]
  const activeFinal = allOtherPlusMine.filter((g) => g.hasActive).sort((a, b) => b.lastActiveTs - a.lastActiveTs)
  const expiredFinal = allOtherPlusMine.filter((g) => !g.hasActive).sort((a, b) => b.lastActiveTs - a.lastActiveTs)
  const finalOtherGroups = [...activeFinal, ...expiredFinal]

  const viewerGroups = [...(myGroup ? [myGroup] : []), ...finalOtherGroups]

  const myPhotoUrl = profile?.photo_url

  const openViewerForUser = (userId) => {
    const idx = viewerGroups.findIndex((g) => g.userId === userId)
    if (idx !== -1) setViewerGroupIndex(idx)
  }

  // Vignette d'un groupe : photo de la dernière note si elle en a une, sinon photo de profil de l'auteur.
  function thumbFor(g) {
    const lastItem = g.items[g.items.length - 1]
    return lastItem.entry.photo_url || g.displayUser?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${g.userId}`
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-x-1 gap-y-3 px-1 pt-1">
        {/* Case 1 : toujours "Ajouter à ta note" */}
        <div className="flex flex-col">
          <div
            className="relative aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer"
            onClick={() => navigate('/notes/nouvelle')}
          >
            <img
              src={myPhotoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${user?.id}`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30" />
            <button
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[var(--accent)] border-2 border-white flex items-center justify-center"
              aria-label="Ajouter une note"
            >
              <Plus size={14} className="text-white" strokeWidth={3} />
            </button>
            <span className="absolute bottom-2 left-2 right-2 text-white text-caption font-medium truncate">
              Ajouter à ta note
            </span>
          </div>
          <div className="flex justify-end pt-1">
            <MoreHorizontal size={16} className="text-[var(--text-secondary)]" />
          </div>
        </div>

        {/* Case 2 (si j'ai une note) : MA note */}
        {myGroup && (
          <div className="flex flex-col">
            <div
              className="relative aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer"
              onClick={() => openViewerForUser(user?.id)}
            >
              <img src={thumbFor(myGroup)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2 right-2 text-white text-caption font-medium truncate">
                Ta note
              </span>
            </div>
            <div className="flex justify-end pt-1">
              <MoreHorizontal size={16} className="text-[var(--text-secondary)]" />
            </div>
          </div>
        )}

        {/* Notes des autres */}
        {finalOtherGroups.map((g) => (
          <div key={g.userId} className="flex flex-col">
            <div
              className="relative aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer"
              onClick={() => openViewerForUser(g.userId)}
            >
              <img src={thumbFor(g)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2 right-2 text-white text-caption font-medium truncate">
                {g.isRepostGroup
                  ? `${g.items[0].original.users?.nom_complet?.split(' ')[0]} & ${g.displayUser?.nom_complet?.split(' ')[0]}`
                  : g.displayUser?.nom_complet?.split(' ')[0]}
              </span>
            </div>
            <div className="flex justify-end pt-1">
              <MoreHorizontal size={16} className="text-[var(--text-secondary)]" />
            </div>
          </div>
        ))}

        {/* Utilisateurs sans note : renvoie vers leur profil */}
        {usersWithoutNote.map((u) => (
          <div key={u.id} className="flex flex-col">
            <div
              className="relative aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer opacity-70"
              onClick={() => navigate(profileRoute(u.id, u.role))}
            >
              <img
                src={u.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${u.id}`}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2 right-2 text-white text-caption font-medium truncate">
                {u.nom_complet?.split(' ')[0]}
              </span>
            </div>
            <div className="flex justify-end pt-1">
              <MoreHorizontal size={16} className="text-[var(--text-secondary)]" />
            </div>
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
