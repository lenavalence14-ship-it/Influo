import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import StoryViewer from './StoryViewer'
import StoryRing from './StoryRing'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

async function fetchStories() {
  const { data } = await supabase
    .from('posts')
    .select(
      'id, influenceur_id, crop_format, media_url:post_medias(media_url, media_type), texte_overlay, texte_x, texte_y, texte_couleur, texte_police, texte_taille, elements, filtre, dessin_url, created_at, profils_influenceur(id, user_id, verifie, users(nom_complet, photo_url))'
    )
    .eq('type', 'story')
    .gt('expire_at', new Date().toISOString())
    .order('created_at', { ascending: true })
  return data || []
}

// Rotation organique max appliquée à un cercle pendant le scroll, en degrés.
// Volontairement subtile (cf. spec : "l'utilisateur doit ressentir la différence
// sans forcément la remarquer consciemment").
const MAX_TILT_DEG = 6

export default function StoryBar() {
  const [viewerGroupIndex, setViewerGroupIndex] = useState(null)
  const [tilts, setTilts] = useState({}) // { [key]: degrees }
  const { profile, influencerProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scrollRef = useRef(null)
  const rafRef = useRef(null)

  const { data: rawStories = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: fetchStories,
    staleTime: 15_000,
  })

  const groupsMap = new Map()
  for (const s of rawStories) {
    const infId = s.influenceur_id
    if (!groupsMap.has(infId)) {
      groupsMap.set(infId, {
        influenceurId: infId,
        nom: s.profils_influenceur?.users?.nom_complet,
        photoUrl: s.profils_influenceur?.users?.photo_url,
        verifie: s.profils_influenceur?.verifie,
        stories: [],
      })
    }
    groupsMap.get(infId).stories.push({
      id: s.id,
      media_url: s.media_url?.[0]?.media_url,
      media_type: s.media_url?.[0]?.media_type,
      crop_format: s.crop_format,
      texte_overlay: s.texte_overlay,
      texte_x: s.texte_x,
      texte_y: s.texte_y,
      texte_couleur: s.texte_couleur,
      elements: Array.isArray(s.elements) ? s.elements : [],
      filtre: s.filtre,
      dessin_url: s.dessin_url,
      texte_police: s.texte_police,
      texte_taille: s.texte_taille,
      created_at: s.created_at,
    })
  }
  const groups = Array.from(groupsMap.values())

  const myInfluencerId = influencerProfile?.id
  const myGroupIndex = groups.findIndex((g) => g.influenceurId === myInfluencerId)
  const hasMyStory = myGroupIndex !== -1
  const otherGroups = groups.filter((g) => g.influenceurId !== myInfluencerId)

  const myPhotoUrl = profile?.photo_url
  const openViewerFor = (influenceurId) => {
    setViewerGroupIndex(groups.findIndex((g) => g.influenceurId === influenceurId))
  }

  const handleClickMine = () => {
    if (hasMyStory) {
      openViewerFor(myInfluencerId)
    } else {
      navigate('/publier?type=story')
    }
  }

  // Calcule une légère inclinaison par cercle selon sa distance au centre du
  // conteneur visible, recalculée à chaque frame de scroll (throttlé via rAF).
  const handleScroll = () => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const container = scrollRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const next = {}
      container.querySelectorAll('[data-story-key]').forEach((el) => {
        const key = el.getAttribute('data-story-key')
        const elRect = el.getBoundingClientRect()
        const elCenter = elRect.left + elRect.width / 2
        const offset = (elCenter - centerX) / (rect.width / 2) // ~-1..1
        const clamped = Math.max(-1, Math.min(1, offset))
        next[key] = clamped * MAX_TILT_DEG
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
        {profile?.role === 'influenceur' && (
          <div className="flex flex-col items-center gap-2 shrink-0 cursor-pointer" onClick={handleClickMine}>
            {hasMyStory ? (
              <div data-story-key="mine">
                <StoryRing
                  layoutId={`story-ring-${myInfluencerId}`}
                  photoUrl={myPhotoUrl}
                  fallbackSeed={myInfluencerId}
                  hasStory
                  rotate={tilts.mine || 0}
                />
              </div>
            ) : (
              <div className="relative w-[72px] h-[72px] rounded-full">
                <img
                  src={myPhotoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${myInfluencerId}`}
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
              {hasMyStory ? 'Ta story' : 'Ton story'}
            </span>
          </div>
        )}

        {otherGroups.map((g) => (
          <div
            key={g.influenceurId}
            data-story-key={g.influenceurId}
            className="flex flex-col items-center gap-2 shrink-0 cursor-pointer"
            onClick={() => openViewerFor(g.influenceurId)}
          >
            <StoryRing
              layoutId={`story-ring-${g.influenceurId}`}
              photoUrl={g.photoUrl}
              fallbackSeed={g.influenceurId}
              hasStory
              rotate={tilts[g.influenceurId] || 0}
            />
            <span className="text-caption max-w-[72px] truncate flex items-center gap-1">
              {g.nom?.split(' ')[0]}
              {g.verifie && <VerifiedBadge size={11} />}
            </span>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {viewerGroupIndex !== null && (
          <StoryViewer
            key="story-viewer"
            groups={groups}
            startGroupIndex={viewerGroupIndex}
            myInfluencerId={myInfluencerId}
            onClose={() => {
              setViewerGroupIndex(null)
              queryClient.invalidateQueries({ queryKey: ['stories'] })
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
