import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { X, Grid3x3, Video, ArrowLeft } from 'lucide-react'
import PostCard from '../feed/PostCard'

// Profil entreprise vu par un visiteur (influenceur, utilisateur normal, ou une autre
// entreprise) — distinct de ClientProfile.jsx qui est réservé au propriétaire du compte
// (boutons Modifier/Dashboard/Déconnexion). Ici : pas d'actions de gestion, seulement
// des actions sociales (suivre, contacter) qui dépendent du rôle du visiteur.
//
// Le bouton "Suivre" est affiché mais pas encore fonctionnel : le système de suivi
// (table follows, compteur d'abonnés plateforme) arrive dans un lot séparé. Le bouton
// est en place pour ne pas avoir à retoucher cette page à ce moment-là.
export default function ClientProfileView() {
  const { id } = useParams() // id = public.users.id de l'entreprise consultée
  const { profile: viewerProfile } = useAuth()
  const navigate = useNavigate()

  const [entreprise, setEntreprise] = useState(null)
  const [clientProfile, setClientProfile] = useState(null)
  const [subTab, setSubTab] = useState('grille')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      const [{ data: userRow }, { data: cliRow }, { data: postsData }] = await Promise.all([
        supabase.from('users').select('id, nom_complet, photo_url').eq('id', id).maybeSingle(),
        supabase.from('profils_client').select('*').eq('user_id', id).maybeSingle(),
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

      const postIds = (postsData || []).map((p) => p.id)
      const { data: likes } = postIds.length
        ? await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
        : { data: [] }

      if (cancelled) return

      setEntreprise(userRow || null)
      setClientProfile(cliRow || null)
      setPosts(
        (postsData || []).map((p) => ({
          ...p,
          like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
          liked_by_me: false,
        }))
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

  if (!entreprise) {
    return (
      <div className="px-5 pt-6 text-center text-[var(--text-secondary)]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-caption mb-6">
          <ArrowLeft size={16} /> Retour
        </button>
        Profil introuvable.
      </div>
    )
  }

  // Un utilisateur normal envoie un message, une entreprise "entre en contact" avec
  // une autre entreprise via le même canal de messagerie — le libellé change seulement
  // pour rester cohérent avec le vocabulaire utilisé côté influenceur/entreprise.
  const contactLabel = viewerProfile?.role === 'client' ? 'Entrer en contact' : 'Envoyer un message'

  const filteredPosts = posts.filter((p) => (subTab === 'video' ? p.type === 'video' : p.type !== 'video'))

  return (
    <div>
      <div className="flex items-center px-3 pt-4 pb-1">
        <button onClick={() => navigate(-1)} aria-label="Retour" className="w-9 h-9 flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center gap-5">
          <img
            src={entreprise.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${entreprise.id}`}
            alt=""
            className="w-20 h-20 rounded-full object-cover shrink-0"
          />
          <div className="flex-1 pt-1">
            <h1 className="text-h2 font-bold mb-2">{entreprise.nom_complet}</h1>
            <div className="flex gap-4">
              <span className="text-small">
                <span className="font-bold">{posts.length}</span>{' '}
                <span className="text-[var(--text-secondary)]">publications</span>
              </span>
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
          {/* Suivre : UI en place, branchement fonctionnel dans le lot "système de suivi" */}
          <Button variant="glass" shape="rect" fullWidth disabled title="Bientôt disponible">
            Suivre
          </Button>
          <Button
            variant="primary"
            shape="rect"
            fullWidth
            disabled
            title="Bientôt disponible"
          >
            {contactLabel}
          </Button>
        </div>
      </div>

      <div className="flex border-t border-[var(--border)] sticky top-0 bg-[var(--bg-primary)]/90 backdrop-blur-xl z-20">
        <button
          onClick={() => setSubTab('grille')}
          aria-label="Grille"
          className={`flex-1 py-3 flex items-center justify-center border-b-2 transition-colors ${
            subTab === 'grille' ? 'border-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'
          }`}
        >
          <Grid3x3 size={20} />
        </button>
        <button
          onClick={() => setSubTab('video')}
          aria-label="Vidéo"
          className={`flex-1 py-3 flex items-center justify-center border-b-2 transition-colors ${
            subTab === 'video' ? 'border-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'
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
