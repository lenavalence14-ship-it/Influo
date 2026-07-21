import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { LogOut, X, Grid3x3, Video, ArrowLeft } from 'lucide-react'
import PostCard from '../feed/PostCard'
import { useFollow } from '../../hooks/useFollow'

// Profil "utilisateur normal" (role = utilisateur_simple) : volontairement minimal.
// Pas de bio/ville (ce rôle n'a pas de table de profil dédiée en base), pas de badge
// vérifié, pas de "collaboration vérifiée" (ça n'a de sens que pour une entreprise qui
// commande une prestation). Seule chose affichée : les publications de l'utilisateur,
// en grille photo/carrousel ou en grille vidéo, centrées au milieu de l'écran.
export default function SimpleUserProfile() {
  const { user, profile, signOut } = useAuth()
  const { followersCount } = useFollow(user?.id)
  const [subTab, setSubTab] = useState('grille')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    let cancelled = false

    const load = async () => {
      // Un utilisateur normal ne publie pas via profils_influenceur : ses posts sont
      // rattachés directement à son user_id via client_id (même colonne que pour les
      // entreprises, réutilisée ici faute de colonne dédiée "auteur simple").
      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          id, legende, crop_format, created_at, type, filtre,
          post_medias(media_url, media_type, thumbnail_url, position)
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

  const filteredPosts = posts.filter((p) => (subTab === 'video' ? p.type === 'video' : p.type !== 'video'))

  return (
    <div>
      {/* barre du haut, identique aux autres profils */}
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

      {/* header profil : photo + nom + nombre de publications centrés, pas de bio/ville */}
      <div className="px-5 pt-4 pb-4 flex flex-col items-center text-center">
        <img
          src={profile?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${user?.id}`}
          alt=""
          className="w-24 h-24 rounded-full object-cover mb-3"
        />
        <h1 className="text-h2 font-bold mb-1">{profile?.nom_complet}</h1>
        <div className="flex gap-4 justify-center mb-4">
          <span className="text-small">
            <span className="font-bold text-[var(--text-primary)]">{posts.length}</span>{' '}
            <span className="text-[var(--text-secondary)]">publications</span>
          </span>
          <span className="text-small">
            <span className="font-bold text-[var(--text-primary)]">{followersCount.toLocaleString()}</span>{' '}
            <span className="text-[var(--text-secondary)]">abonnés</span>
          </span>
        </div>

        <Button variant="glass" shape="rect" onClick={() => navigate('/profil/modifier')} className="w-full max-w-xs">
          Modifier le profil
        </Button>
      </div>

      {/* sous-barre grille / vidéo, centrée, sans onglet "collaboration vérifiée" */}
      <div className="flex border-t border-b border-[var(--border)]">
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
