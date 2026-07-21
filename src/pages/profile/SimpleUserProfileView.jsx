import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { X, Grid3x3, Video, ArrowLeft } from 'lucide-react'
import PostCard from '../feed/PostCard'
import { useFollow } from '../../hooks/useFollow'

// Profil "utilisateur normal" vu par un visiteur (influenceur ou entreprise).
// Aujourd'hui un utilisateur_simple ne peut pas encore publier (décision produit :
// "profil vide pour l'instant"), donc la grille sera vide tant que ce n'est pas
// ajouté séparément — le composant est prêt à afficher du contenu dès que ce sera le cas.
export default function SimpleUserProfileView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { followersCount, isFollowing, toggleFollow, pending: followPending } = useFollow(id)

  const [utilisateur, setUtilisateur] = useState(null)
  const [subTab, setSubTab] = useState('grille')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      const [{ data: userRow }, { data: postsData }] = await Promise.all([
        supabase.from('users').select('id, nom_complet, photo_url').eq('id', id).maybeSingle(),
        supabase
          .from('posts')
          .select(`
            id, legende, crop_format, created_at, type, filtre, commande_id,
            post_medias(media_url, media_type, thumbnail_url, position),
            profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
            client:client_id(id, nom_complet, photo_url),
            commandes!posts_commande_id_fkey(lien_instagram, lien_tiktok)
          `)
          .eq('client_id', id)
          .in('type', ['photo', 'carrousel', 'video'])
          .order('created_at', { ascending: false })
          .limit(60),
      ])

      if (cancelled) return

      setUtilisateur(userRow || null)
      setPosts(
        (postsData || []).map((p) => ({ ...p, like_count: 0, liked_by_me: false }))
      )
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (!utilisateur) {
    return (
      <div className="px-5 pt-6 text-center text-[var(--text-secondary)]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-caption mb-6">
          <ArrowLeft size={16} /> Retour
        </button>
        Profil introuvable.
      </div>
    )
  }

  const filteredPosts = posts.filter((p) => (subTab === 'video' ? p.type === 'video' : p.type !== 'video'))

  return (
    <div>
      <div className="flex items-center px-3 pt-4 pb-1">
        <button onClick={() => navigate(-1)} aria-label="Retour" className="w-9 h-9 flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="px-5 pt-2 pb-4 flex flex-col items-center text-center">
        <img
          src={utilisateur.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${utilisateur.id}`}
          alt=""
          className="w-20 h-20 rounded-full object-cover mb-3"
        />
        <h1 className="text-h2 font-bold mb-1">{utilisateur.nom_complet}</h1>
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

        {/* Un utilisateur normal ou une entreprise qui visite un autre utilisateur normal
            ne voit que "Suivre" — la messagerie utilisateur↔utilisateur n'est pas prévue. */}
        <Button
          shape="rect"
          variant={isFollowing ? 'glass' : 'primary'}
          disabled={followPending}
          onClick={toggleFollow}
          className="w-full max-w-xs"
        >
          {isFollowing ? 'Abonné' : 'Suivre'}
        </Button>
      </div>

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
            <button onClick={() => setSelectedPost(null)} aria-label="Fermer" className="w-11 h-11 -ml-2 flex items-center justify-center">
              <X size={22} />
            </button>
          </div>
          <div className="px-4 pb-6">
            <PostCard post={selectedPost} onDeleted={() => setSelectedPost(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
