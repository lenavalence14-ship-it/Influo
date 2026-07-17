import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function StoryBar() {
  const [stories, setStories] = useState([])
  const { profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const loadStories = async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, influenceur_id, profils_influenceur(id, user_id, users(nom_complet, photo_url), verifie)')
        .eq('type', 'story')
        .gt('expire_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      setStories(data || [])
    }
    loadStories()
  }, [])

  // dédupliquer par influenceur
  const uniqueByInfluencer = Object.values(
    stories.reduce((acc, s) => {
      acc[s.influenceur_id] = s
      return acc
    }, {})
  )

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
      {profile?.role === 'influenceur' && (
        <div
          className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
          onClick={() => navigate('/publier?type=story')}
        >
          <div className="w-16 h-16 rounded-full glass flex items-center justify-center">
            <Plus size={22} />
          </div>
          <span className="text-xs text-[var(--text-secondary)]">Ta story</span>
        </div>
      )}

      {uniqueByInfluencer.map((s) => (
        <div key={s.influenceur_id} className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-white/60 via-white/20 to-white/60">
            <div className="w-full h-full rounded-full bg-[var(--bg-base)] p-[2px]">
              <img
                src={s.profils_influenceur?.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${s.influenceur_id}`}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            </div>
          </div>
          <span className="text-xs text-[var(--text-secondary)] max-w-[64px] truncate">
            {s.profils_influenceur?.users?.nom_complet?.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  )
}
