import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { LogOut, X, Grid3x3, Video, ArrowLeft } from 'lucide-react'
import PostCard from '../feed/PostCard'
import { useFollow } from '../../hooks/useFollow'

// Profil client : même disposition que le profil influenceur (header, photo + stats,
// bio/localisation, boutons Modifier/Dashboard, onglets), sans les éléments propres
// aux influenceurs (badge vérifié, anneau de story, bouton "+" pour publier une story,
// réseaux sociaux, offres). "Collaboration vérifiée" affiche les mêmes publications
// que celles générées automatiquement côté influenceur quand une prestation est validée
// (la table posts porte à la fois influenceur_id et client_id sur ces posts).
export default function ClientProfile() {
  const { user, profile, clientProfile, signOut } = useAuth()
  const { followersCount, followingCount } = useFollow(user?.id)
  const [tab, setTab] = useState('publications')
  const [subTab, setSubTab] = useState('grille')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    let cancelled = false

    const load = async () => {
      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          id, legende, crop_format, created_at, type, filtre,
          post_medias(media_url, media_type, thumbnail_url, position),
          profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url))
        `)
        .eq('client_id', user.id)
        .in('type', ['photo', 'carrousel', 'video'])
        .order('created_at', { ascending: false })
        .limit(60)

      if (cancelled) return

      const postIds = (postsData || []).map((p) => p.id)
      const { data: likes } = postIds.length
        ? await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
        : { data: [] }

      if (cancelled) return

      const enrichedPosts = (postsData || []).map((p) => ({
        ...p,
        like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
        liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === user?.id) || false,
      }))

      setPosts(enrichedPosts)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* barre du haut, identique à celle du profil influenceur */}
      <div className="flex items-center justify-between px-3 pt-4 pb-1">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="w-9 h-9 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <h1
          className="text-xl"
          style={{ fontFamily: 'var(--font-logo)', color: '#4f0c2d' }}
        >
          Influo
        </h1>
        <button
          onClick={async () => { await signOut(); navigate('/connexion') }}
          aria-label="Se déconnecter"
          className="w-9 h-9 flex items-center justify-center"
        >
          <LogOut size={20} className="text-red-400" />
        </button>
      </div>

      {/* header profil */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center gap-5">
          {/* Pas d'anneau story, pas de bouton "+" : un client ne publie jamais de story */}
          <img
            src={profile?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${profile?.id}`}
            alt=""
            className="w-20 h-20 rounded-full object-cover shrink-0"
          />
          <div className="flex-1 pt-1">
            <div className="flex items-center gap-1.5 mb-2">
              {/* Pas de badge vérifié pour un client */}
              <h1 className="text-h2 font-bold">{profile?.nom_complet}</h1>
            </div>
            <div className="flex gap-4">
              <span className="text-small">
                <span className="font-bold">{posts.length}</span>{' '}
                <span className="text-[var(--text-secondary)]">publications</span>
              </span>
              <button
                onClick={() => user?.id && navigate(`/profil/${user.id}/abonnes?tab=followers`)}
                className="text-small"
              >
                <span className="font-bold">{followersCount.toLocaleString()}</span>{' '}
                <span className="text-[var(--text-secondary)]">abonnés</span>
              </button>
              <button
                onClick={() => user?.id && navigate(`/profil/${user.id}/abonnes?tab=following`)}
                className="text-small"
              >
                <span className="font-bold">{followingCount.toLocaleString()}</span>{' '}
                <span className="text-[var(--text-secondary)]">abonnements</span>
              </button>
            </div>
          </div>
        </div>

        {clientProfile?.bio && <p className="text-small mt-4">{clientProfile.bio}</p>}
        {(clientProfile?.pays || clientProfile?.ville) && (
          <p className="text-caption mt-1">
            {[clientProfile.ville, clientProfile.pays].filter(Boolean).join(', ')}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="glass" shape="rect" fullWidth onClick={() => navigate('/profil/modifier')}>
            Modifier le profil
          </Button>
          <Button variant="glass" shape="rect" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </div>

      {/* onglets */}
      <div className="flex border-t border-[var(--border)] sticky top-0 bg-[var(--bg-primary)]/90 backdrop-blur-xl z-20">
        <button
          onClick={() => setTab('publications')}
          className={`flex-1 py-3 text-body-medium border-b-2 transition-colors ${
            tab === 'publications' ? 'border-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'
          }`}
        >
          Collaboration vérifiée
        </button>
        <button
          onClick={() => setTab('a_venir')}
          className={`flex-1 py-3 text-body-medium border-b-2 transition-colors ${
            tab === 'a_venir' ? 'border-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'
          }`}
        >
          Publications
        </button>
      </div>

      {/* sous-barre grille / vidéo, uniquement dans l'onglet Collaboration vérifiée */}
      {tab === 'publications' && (
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setSubTab('grille')}
            aria-label="Grille"
            className={`flex-1 py-2.5 flex items-center justify-center ${
              subTab === 'grille' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Grid3x3 size={20} />
          </button>
          <button
            onClick={() => setSubTab('video')}
            aria-label="Vidéo"
            className={`flex-1 py-2.5 flex items-center justify-center ${
              subTab === 'video' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Video size={20} />
          </button>
        </div>
      )}

      {/* contenu onglet */}
      {tab === 'publications' ? (
        (() => {
          const filteredPosts = posts.filter((p) =>
            subTab === 'video' ? p.type === 'video' : p.type !== 'video'
          )
          return (
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {filteredPosts.length === 0 ? (
                <div className="col-span-3 py-16 text-center text-[var(--text-secondary)] text-body">
                  {subTab === 'video' ? 'Aucune vidéo.' : 'Aucune publication.'}
                </div>
              ) : (
                filteredPosts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => (p.type === 'video' ? navigate(`/video/${p.id}`) : setSelectedPost(p))}
                    className="aspect-[4/5] bg-black/20 relative"
                  >
                    {p.post_medias?.[0]?.media_url && (
                      p.type === 'video' ? (
                        p.post_medias[0].thumbnail_url ? (
                          <img
                            src={p.post_medias[0].thumbnail_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-black/30">
                            <Video size={20} className="text-white/40" />
                          </div>
                        )
                      ) : (
                        <img
                          src={p.post_medias[0].media_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      )
                    )}
                  </button>
                ))
              )}
            </div>
          )
        })()
      ) : (
        // Onglet "Publications" (feed personnel côté client) : pas encore disponible.
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
          <Grid3x3 size={40} />
          <p className="text-body">Bientôt disponible</p>
        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)] overflow-y-auto">
          <div className="flex items-center px-4 py-3 sticky top-0 bg-[var(--bg-primary)]/90 backdrop-blur-xl z-10">
            <button
              onClick={() => setSelectedPost(null)}
              aria-label="Fermer"
              className="w-11 h-11 -ml-2 flex items-center justify-center"
            >
              <X size={22} />
            </button>
          </div>
          <div className="px-4 pb-6">
            <PostCard
              post={selectedPost}
              onDeleted={(id) => {
                setPosts((ps) => ps.filter((p) => p.id !== id))
                setSelectedPost(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}