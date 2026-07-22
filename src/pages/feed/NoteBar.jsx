import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import NoteViewer from './NoteViewer'
import StoryRing from './StoryRing'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

// Remplace StoryBar : il n'y a plus de story (photo/vidéo 24h), seulement des
// notes texte (façon Facebook/Messenger "Nouvelle note", 24h aussi).
// Une note peut être republiée par n'importe qui : chaque republication crée
// une nouvelle ligne `notes` avec repost_of = note originale, et remonte donc
// dans le tri comme une entrée à part entière. Visuellement, chaque entrée
// affiche l'auteur ORIGINAL au centre + les avatars des republieurs group\u00e9s
// autour (cluster), tel que validé.
async function fetchNotes() {
  const { data } = await supabase
    .from('notes')
    .select(
      'id, user_id, contenu, created_at, expire_at, repost_of, users(id, nom_complet, photo_url, role)'
    )
    .order('created_at', { ascending: false })
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

  // Chaque note (originale ou repost) est SA PROPRE entrée dans le tri —
  // c'est ce qui permet à un repost de "remonter" indépendamment de l'originale.
  // Pour l'affichage on rattache à chaque entrée le cluster des republieurs
  // de la note originale correspondante (auteur au centre + avatars autour).
  const originalById = new Map(rawNotes.filter((n) => !n.repost_of).map((n) => [n.id, n]))
  const repostsByOriginal = new Map()
  for (const n of rawNotes) {
    if (n.repost_of) {
      if (!repostsByOriginal.has(n.repost_of)) repostsByOriginal.set(n.repost_of, [])
      repostsByOriginal.get(n.repost_of).push(n)
    }
  }

  const entries = rawNotes.map((n) => {
    const original = n.repost_of ? originalById.get(n.repost_of) : n
    const reposters = original ? (repostsByOriginal.get(original.id) || []).map((r) => r.users) : []
    return {
      entry: n, // la ligne qui détermine la position dans le tri (note ou repost)
      original: original || n, // celui affiché au centre du cercle
      reposters, // avatars groupés autour
    }
  })

  const active = entries.filter((e) => !isExpired(e.entry)).sort((a, b) => new Date(b.entry.created_at) - new Date(a.entry.created_at))
  const expired = entries.filter((e) => isExpired(e.entry)).sort((a, b) => new Date(b.entry.created_at) - new Date(a.entry.created_at))
  const sorted = [...active, ...expired]

  const myEntry = sorted.find((e) => e.entry.user_id === user?.id)
  const hasMyNote = !!myEntry
  const otherEntries = sorted.filter((e) => e.entry.user_id !== user?.id)

  const myPhotoUrl = profile?.photo_url
  const openViewerFor = (entryId) => {
    setViewerIndex(sorted.findIndex((e) => e.entry.id === entryId))
  }

  const handleClickMine = () => {
    if (hasMyNote) {
      openViewerFor(myEntry.entry.id)
    } else {
      navigate('/notes/nouvelle')
    }
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
        <div className="flex flex-col items-center gap-2 shrink-0 cursor-pointer" onClick={handleClickMine}>
          {hasMyNote ? (
            <div data-note-key="mine">
              <StoryRing
                layoutId={`note-ring-${myEntry.entry.id}`}
                photoUrl={myPhotoUrl}
                fallbackSeed={user?.id}
                hasStory={!isExpired(myEntry.entry)}
                rotate={tilts.mine || 0}
              />
            </div>
          ) : (
            <div className="relative w-[72px] h-[72px] rounded-full">
              <img
                src={myPhotoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${user?.id}`}
                alt=""
                loading="eager"
                decoding="async"
                className="w-full h-full rounded-full object-cover"
              />
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center">
                <Plus size={12} className="text-white" strokeWidth={3} />
              </div>
            </div>
          )}
          <span className="text-caption max-w-[72px] truncate">
            {hasMyNote ? 'Ta note' : 'Ta note'}
          </span>
        </div>

        {otherEntries.map((e) => (
          <div
            key={e.entry.id}
            data-note-key={e.entry.id}
            className="flex flex-col items-center gap-2 shrink-0 cursor-pointer relative"
            onClick={() => openViewerFor(e.entry.id)}
          >
            <div className="relative">
              <StoryRing
                layoutId={`note-ring-${e.entry.id}`}
                photoUrl={e.original.users?.photo_url}
                fallbackSeed={e.original.user_id}
                hasStory={!isExpired(e.entry)}
                rotate={tilts[e.entry.id] || 0}
              />
              {/* cluster des republieurs, groupés en petits avatars superposés autour du cercle principal */}
              {e.reposters.length > 0 && (
                <div className="absolute -bottom-1 -right-1 flex">
                  {e.reposters.slice(0, 3).map((r, i) => (
                    <img
                      key={r?.id || i}
                      src={r?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${r?.id}`}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover border-2"
                      style={{ borderColor: 'var(--bg-primary)', marginLeft: i === 0 ? 0 : -8 }}
                    />
                  ))}
                </div>
              )}
            </div>
            <span className="text-caption max-w-[72px] truncate flex items-center gap-1">
              {e.original.users?.nom_complet?.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {viewerIndex !== null && (
          <NoteViewer
            key="note-viewer"
            entries={sorted}
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
