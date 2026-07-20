import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { Search as SearchIcon } from 'lucide-react'
import { useActiveStories } from '../../hooks/useActiveStories'

async function fetchInfluencers() {
  const { data } = await supabase
    .from('profils_influenceur')
    .select('id, bio, verifie, users(nom_complet, photo_url)')
    .limit(30)
  return data || []
}

export default function Search() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()

  const { data: results = [], isLoading: loading } = useQuery({
    queryKey: ['influenceurs-search'],
    queryFn: fetchInfluencers,
  })

  const filtered = results.filter((r) =>
    r.users?.nom_complet?.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-h1 mb-4">Recherche</h1>
        <div className="glass rounded-full px-4 py-3 flex items-center gap-2">
          <SearchIcon size={18} className="text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un influenceur..."
            className="flex-1 bg-transparent outline-none text-body"
          />
        </div>
      </header>

      <div className="px-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((inf) => (
              <div
                key={inf.id}
                onClick={() => navigate(`/influenceur/${inf.id}`)}
                className="glass-strong rounded-2xl p-4 cursor-pointer"
              >
                {activeStoryIds.has(inf.id) ? (
                  <div className="w-14 h-14 rounded-full p-[2.5px] mb-3" style={{ background: 'linear-gradient(to bottom right, #4f0c2d, #7a1240)' }}>
                    <div className="w-full h-full rounded-full bg-[var(--bg-primary)] p-[2px]">
                      <img
                        src={inf.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${inf.id}`}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <img
                    src={inf.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${inf.id}`}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover mb-3"
                  />
                )}
                <div className="flex items-center gap-2">
                  <p className="text-body-medium truncate">{inf.users?.nom_complet}</p>
                  {inf.verifie && <VerifiedBadge size={14} />}
                </div>
                {inf.bio && <p className="text-caption mt-1 line-clamp-2">{inf.bio}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}