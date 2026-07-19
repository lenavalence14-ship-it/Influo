import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import StoryViewer from './StoryViewer'
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

export default function StoryBar() {
  const [viewerGroupIndex, setViewerGroupIndex] = useState(null)
  const { profile, influencerProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // React Query : mis en cache et partagé avec useActiveStories via la même donnée sous-jacente
  // n'est pas nécessaire ici (clés différentes), mais bénéficie du staleTime pour éviter un
  // refetch à chaque navigation retour vers le feed.
  const { data: rawStories = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: fetchStories,
    staleTime: 15_000,
  })

  // grouper par influenceur, dans l'ordre chronologique de leurs stories
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
  const myName = profile?.nom_complet

  const handleClickMine = () => {
    if (hasMyStory) {
      setViewerGroupIndex(groups.findIndex((g) => g.influenceurId === myInfluencerId))
    } else {
      navigate('/publier?type=story')
    }
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto px-4 pt-4 pb-3" style={{ scrollbarWidth: 'none' }}>
        {profile?.role === 'influenceur' && (
          <div className="flex flex-col items-center gap-2 shrink-0 cursor-pointer" onClick={handleClickMine}>
            <div
              className={`relative w-[72px] h-[72px] rounded-full ${
                hasMyStory ? 'p-[2.5px] bg-gradient-to-br from-purple-600 via-violet-500 to-fuchsia-400' : ''
              }`}
            >
              <div className={`w-full h-full rounded-full ${hasMyStory ? 'bg-[var(--bg-primary)] p-[2px]' : ''}`}>
                <img
                  src={myPhotoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${myInfluencerId}`}
                  alt=""
                  loading="eager"
                  decoding="async"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              {!hasMyStory && (
                <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center">
                  <Plus size={12} className="text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            <span className="text-caption max-w-[72px] truncate">
              {hasMyStory ? 'Ta story' : 'Ton story'}
            </span>
          </div>
        )}

        {otherGroups.map((g, i) => (
          <div
            key={g.influenceurId}
            className="flex flex-col items-center gap-2 shrink-0 cursor-pointer"
            onClick={() => setViewerGroupIndex(groups.findIndex((x) => x.influenceurId === g.influenceurId))}
          >
            <div className="w-[72px] h-[72px] rounded-full p-[2.5px] bg-gradient-to-br from-purple-600 via-violet-500 to-fuchsia-400">
              <div className="w-full h-full rounded-full bg-[var(--bg-primary)] p-[2px]">
                <img
                  src={g.photoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${g.influenceurId}`}
                  alt=""
                  loading={i < 4 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
            <span className="text-caption max-w-[72px] truncate flex items-center gap-1">
              {g.nom?.split(' ')[0]}
              {g.verifie && <VerifiedBadge size={11} />}
            </span>
          </div>
        ))}
      </div>

      {viewerGroupIndex !== null && (
        <StoryViewer
          groups={groups}
          startGroupIndex={viewerGroupIndex}
          myInfluencerId={myInfluencerId}
          onClose={() => {
            setViewerGroupIndex(null)
            queryClient.invalidateQueries({ queryKey: ['stories'] })
          }}
        />
      )}
    </>
  )
}
