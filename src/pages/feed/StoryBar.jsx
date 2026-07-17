import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import StoryViewer from './StoryViewer'

export default function StoryBar() {
  const [rawStories, setRawStories] = useState([])
  const [viewerGroupIndex, setViewerGroupIndex] = useState(null)
  const { profile, influencerProfile } = useAuth()
  const navigate = useNavigate()

  const loadStories = async () => {
    const { data } = await supabase
      .from('posts')
      .select(
        'id, influenceur_id, media_url:post_medias(media_url), texte_overlay, texte_x, texte_y, texte_couleur, texte_police, texte_taille, created_at, profils_influenceur(id, user_id, users(nom_complet, photo_url))'
      )
      .eq('type', 'story')
      .gt('expire_at', new Date().toISOString())
      .order('created_at', { ascending: true })
    setRawStories(data || [])
  }

  useEffect(() => {
    loadStories()
  }, [])

  // grouper par influenceur, dans l'ordre chronologique de leurs stories
  const groupsMap = new Map()
  for (const s of rawStories) {
    const infId = s.influenceur_id
    if (!groupsMap.has(infId)) {
      groupsMap.set(infId, {
        influenceurId: infId,
        nom: s.profils_influenceur?.users?.nom_complet,
        photoUrl: s.profils_influenceur?.users?.photo_url,
        stories: [],
      })
    }
    groupsMap.get(infId).stories.push({
      id: s.id,
      media_url: s.media_url?.[0]?.media_url,
      texte_overlay: s.texte_overlay,
      texte_x: s.texte_x,
      texte_y: s.texte_y,
      texte_couleur: s.texte_couleur,
      texte_police: s.texte_police,
      texte_taille: s.texte_taille,
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
      <div className="flex gap-4 overflow-x-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
        {profile?.role === 'influenceur' && (
          <div className="flex flex-col items-center gap-2 shrink-0 cursor-pointer" onClick={handleClickMine}>
            <div
              className={`relative w-16 h-16 rounded-full ${
                hasMyStory ? 'p-[2px] bg-gradient-to-br from-purple-600 via-violet-500 to-fuchsia-400' : ''
              }`}
            >
              <div className={`w-full h-full rounded-full ${hasMyStory ? 'bg-[var(--bg-primary)] p-[2px]' : ''}`}>
                <img
                  src={myPhotoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${myInfluencerId}`}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              {!hasMyStory && (
                <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center">
                  <Plus size={12} className="text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            <span className="text-caption max-w-[64px] truncate">
              {hasMyStory ? 'Ta story' : 'Ton story'}
            </span>
          </div>
        )}

        {otherGroups.map((g) => (
          <div
            key={g.influenceurId}
            className="flex flex-col items-center gap-2 shrink-0 cursor-pointer"
            onClick={() => setViewerGroupIndex(groups.findIndex((x) => x.influenceurId === g.influenceurId))}
          >
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-purple-600 via-violet-500 to-fuchsia-400">
              <div className="w-full h-full rounded-full bg-[var(--bg-primary)] p-[2px]">
                <img
                  src={g.photoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${g.influenceurId}`}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
            <span className="text-caption max-w-[64px] truncate">
              {g.nom?.split(' ')[0]}
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
            loadStories()
          }}
        />
      )}
    </>
  )
}