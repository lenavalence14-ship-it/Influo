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

async function fetchEntreprises() {
  const { data } = await supabase
    .from('profils_client')
    .select('id, user_id, bio, users(nom_complet, photo_url)')
    .limit(30)
  return data || []
}

async function fetchUtilisateurs() {
  // utilisateur_simple n'a pas de table de profil dédiée : on part directement de
  // public.users, filtré sur le rôle.
  const { data } = await supabase
    .from('users')
    .select('id, nom_complet, photo_url')
    .eq('role', 'utilisateur_simple')
    .limit(30)
  return data || []
}

const TABS = [
  { key: 'influenceurs', label: 'Influenceurs' },
  { key: 'entreprises', label: 'Entreprises' },
  { key: 'utilisateurs', label: 'Utilisateurs' },
]

export default function Search() {
  const [tab, setTab] = useState('influenceurs')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()

  const { data: influenceurs = [], isLoading: loadingInf } = useQuery({
    queryKey: ['recherche-influenceurs'],
    queryFn: fetchInfluencers,
  })
  const { data: entreprises = [], isLoading: loadingEnt } = useQuery({
    queryKey: ['recherche-entreprises'],
    queryFn: fetchEntreprises,
  })
  const { data: utilisateurs = [], isLoading: loadingUtil } = useQuery({
    queryKey: ['recherche-utilisateurs'],
    queryFn: fetchUtilisateurs,
  })

  const loading = tab === 'influenceurs' ? loadingInf : tab === 'entreprises' ? loadingEnt : loadingUtil

  const filteredInfluenceurs = influenceurs.filter((r) =>
    r.users?.nom_complet?.toLowerCase().includes(query.toLowerCase())
  )
  const filteredEntreprises = entreprises.filter((r) =>
    r.users?.nom_complet?.toLowerCase().includes(query.toLowerCase())
  )
  const filteredUtilisateurs = utilisateurs.filter((r) =>
    r.nom_complet?.toLowerCase().includes(query.toLowerCase())
  )

  const placeholders = {
    influenceurs: 'Chercher un influenceur...',
    entreprises: 'Chercher une entreprise...',
    utilisateurs: 'Chercher un utilisateur...',
  }

  return (
    <div>
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-h1 mb-4">Recherche</h1>
        <div className="glass rounded-full px-4 py-3 flex items-center gap-2 mb-4">
          <SearchIcon size={18} className="text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholders[tab]}
            className="flex-1 bg-transparent outline-none text-body"
          />
        </div>

        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-full text-caption-medium transition-colors ${
                tab === t.key
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'glass text-[var(--text-secondary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tab === 'influenceurs' &&
              filteredInfluenceurs.map((inf) => (
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

            {tab === 'entreprises' &&
              filteredEntreprises.map((ent) => (
                <div
                  key={ent.id}
                  onClick={() => navigate(`/entreprise/${ent.user_id}`)}
                  className="glass-strong rounded-2xl p-4 cursor-pointer"
                >
                  <img
                    src={ent.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${ent.id}`}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover mb-3"
                  />
                  <p className="text-body-medium truncate">{ent.users?.nom_complet}</p>
                  {ent.bio && <p className="text-caption mt-1 line-clamp-2">{ent.bio}</p>}
                </div>
              ))}

            {tab === 'utilisateurs' &&
              filteredUtilisateurs.map((u) => (
                <div
                  key={u.id}
                  onClick={() => navigate(`/utilisateur/${u.id}`)}
                  className="glass-strong rounded-2xl p-4 cursor-pointer"
                >
                  <img
                    src={u.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${u.id}`}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover mb-3"
                  />
                  <p className="text-body-medium truncate">{u.nom_complet}</p>
                </div>
              ))}

            {tab === 'influenceurs' && filteredInfluenceurs.length === 0 && (
              <div className="col-span-2 py-16 text-center text-[var(--text-secondary)] text-body">Aucun résultat.</div>
            )}
            {tab === 'entreprises' && filteredEntreprises.length === 0 && (
              <div className="col-span-2 py-16 text-center text-[var(--text-secondary)] text-body">Aucun résultat.</div>
            )}
            {tab === 'utilisateurs' && filteredUtilisateurs.length === 0 && (
              <div className="col-span-2 py-16 text-center text-[var(--text-secondary)] text-body">Aucun résultat.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
