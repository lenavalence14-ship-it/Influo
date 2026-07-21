import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import Button from '../../components/ui/Button'
import { LogOut, Plus, X, Link2, Grid3x3, Video, ArrowLeft } from 'lucide-react'
import { InstagramIcon, TikTokIcon, FacebookIcon, YouTubeIcon, XIcon, SnapchatIcon } from '../../components/ui/SocialIcons'

const PLATFORM_ICONS = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
  youtube: YouTubeIcon,
  x: XIcon,
  snapchat: SnapchatIcon,
}
import PostCard from '../feed/PostCard'
import { useActiveStories } from '../../hooks/useActiveStories'
import { useFollow } from '../../hooks/useFollow'

export default function InfluencerProfile() {
  const { id } = useParams() // id du profils_influenceur ; si absent, c'est "mon" profil
  const { user, profile, influencerProfile, signOut } = useAuth()
  const [target, setTarget] = useState(null)
  const [tab, setTab] = useState('publications')
  const [subTab, setSubTab] = useState('grille')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [offres, setOffres] = useState([])
  const [reseaux, setReseaux] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()

  const targetId = id || influencerProfile?.id
  const isMe = !id || id === influencerProfile?.id
  // useFollow travaille sur des public.users.id, pas des profils_influenceur.id :
  // target.user_id n'est connu qu'après le chargement, donc le hook reçoit undefined
  // le temps du premier rendu puis se réhydrate normalement une fois `target` posé.
  const { followersCount, isFollowing, toggleFollow, pending: followPending } = useFollow(target?.user_id)

  const reloadOffres = async () => {
    const offresQuery = supabase.from('offres').select('*').eq('influenceur_id', targetId).order('created_at', { ascending: false })
    const { data } = isMe ? await offresQuery : await offresQuery.eq('actif', true)
    setOffres(data || [])
  }

  const offresAffichees = isMe ? offres : offres.filter((o) => o.actif)

  useEffect(() => {
    if (!targetId) { setLoading(false); return }
    let cancelled = false

    const load = async () => {
      // Toutes les requêtes indépendantes (profil, posts, offres, réseaux) partent
      // en parallèle plutôt qu'en chaîne séquentielle : le temps total d'ouverture
      // du profil devient le max des requêtes, pas leur somme.
      const offresQuery = supabase.from('offres').select('*').eq('influenceur_id', targetId).order('created_at', { ascending: false })

      const [{ data: prof }, { data: postsData }, { data: offresData }, { data: reseauxData }] = await Promise.all([
        supabase
          .from('profils_influenceur')
          .select('*, users(nom_complet, photo_url, email)')
          .eq('id', targetId)
          .maybeSingle(),
        supabase
          .from('posts')
          .select(`
            id, legende, crop_format, created_at, type, filtre,
            post_medias(media_url, media_type, thumbnail_url, position),
            profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url))
          `)
          .eq('influenceur_id', targetId)
          .in('type', ['photo', 'carrousel', 'video'])
          .order('created_at', { ascending: false })
          .limit(60),
        isMe ? offresQuery : offresQuery.eq('actif', true),
        supabase.from('reseaux_sociaux').select('*').eq('influenceur_id', targetId),
      ])

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

      setTarget(prof)
      setPosts(enrichedPosts)
      setOffres(offresData || [])
      setReseaux(reseauxData || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [targetId])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (!target) {
    return (
      <div className="p-6 text-center text-[var(--text-secondary)]">
        Profil introuvable.
      </div>
    )
  }

  // "abonnés" au centre du header = abonnés Influo (table follows), pas la somme des
  // followers Instagram/TikTok/etc déclarés par l'influenceur. Ces derniers restent
  // affichés plus bas, à côté de chaque icône de réseau, où ils ont plus de sens.

  return (
    <div>
      {/* barre du haut, façon Instagram : flèche retour, "Influo", icône de déconnexion */}
      {isMe && (
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
      )}

      {/* header profil */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {activeStoryIds.has(target.id) ? (
              <div className="w-20 h-20 rounded-full p-[2.5px]" style={{ background: 'linear-gradient(to bottom right, #4f0c2d, #7a1240)' }}>
                <div className="w-full h-full rounded-full bg-[var(--bg-primary)] p-[2px]">
                  <img
                    src={target.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${target.id}`}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <img
                src={target.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${target.id}`}
                alt=""
                className="w-20 h-20 rounded-full object-cover"
              />
            )}
            {isMe && (
              <button
                onClick={() => navigate('/publier?type=story')}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center"
                aria-label="Ajouter une story"
              >
                <Plus size={15} className="text-white" strokeWidth={3} />
              </button>
            )}
          </div>
          <div className="flex-1 pt-1">
            <div className="flex items-center gap-1.5 mb-2">
              <h1 className="text-h2 font-bold">{target.users?.nom_complet}</h1>
              {target.verifie && <VerifiedBadge size={16} />}
            </div>
            <div className="flex gap-4">
              <span className="text-small">
                <span className="font-bold">{posts.length}</span>{' '}
                <span className="text-[var(--text-secondary)]">publications</span>
              </span>
              <span className="text-small">
                <span className="font-bold">{followersCount.toLocaleString()}</span>{' '}
                <span className="text-[var(--text-secondary)]">abonnés</span>
              </span>
              <span className="text-small">
                <span className="font-bold">{offres.length}</span>{' '}
                <span className="text-[var(--text-secondary)]">offres</span>
              </span>
            </div>
          </div>
        </div>

        {target.bio && <p className="text-small mt-4">{target.bio}</p>}
        {(target.pays || target.ville) && (
          <p className="text-caption mt-1">
            {[target.ville, target.pays].filter(Boolean).join(', ')}
          </p>
        )}

        {/* réseaux sociaux : icône + chiffre, à plat, accumulés à côté les uns des autres */}
        {reseaux.length > 0 && (
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {reseaux.map((r) => {
              const Icon = PLATFORM_ICONS[r.plateforme?.toLowerCase()]
              return (
                <a
                  key={r.id}
                  href={r.lien_profil}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-caption text-[var(--text-secondary)]"
                >
                  {Icon ? <Icon size={13} /> : <Link2 size={13} />}
                  {r.nombre_abonnes?.toLocaleString()}
                </a>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {isMe ? (
            <>
              <Button variant="glass" shape="rect" fullWidth onClick={() => navigate('/profil/modifier')}>
                Modifier le profil
              </Button>
              <Button variant="glass" shape="rect" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
            </>
          ) : (
            <>
              <Button
                shape="rect"
                fullWidth
                variant={isFollowing ? 'glass' : 'primary'}
                disabled={followPending}
                onClick={toggleFollow}
              >
                {isFollowing ? 'Abonné' : 'Suivre'}
              </Button>
              {/* Un utilisateur normal ne voit que "Suivre" face à un influenceur ;
                  seule une entreprise peut aussi entrer en contact avec lui. */}
              {profile?.role === 'client' && (
                <Button variant="glass" shape="rect" fullWidth onClick={() => navigate(`/messages/nouveau?influenceur=${target.id}`)}>
                  Contacter
                </Button>
              )}
            </>
          )}
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
          onClick={() => setTab('offres')}
          className={`flex-1 py-3 text-body-medium border-b-2 transition-colors ${
            tab === 'offres' ? 'border-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'
          }`}
        >
          Offre
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
                          // Pas de thumbnail générée (ancien post) : on n'affiche jamais le fichier
                          // vidéo complet ici (ça téléchargerait toute la vidéo juste pour peupler
                          // une case de grille). On garde le fond neutre avec une icône vidéo discrète.
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
        <div className="p-4 space-y-4">
          {isMe && (
            <button
              onClick={() => navigate('/offre/nouvelle')}
              className="glass rounded-2xl px-4 py-3 text-body-medium w-full"
            >
              + Nouvelle offre
            </button>
          )}
          {offresAffichees.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-secondary)] text-body">
              Aucune offre disponible.
            </div>
          ) : (
            offresAffichees.map((o) => (
              <OfferCard key={o.id} offre={o} editable={isMe} onChange={reloadOffres} />
            ))
          )}
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

function OfferCard({ offre, editable, onChange }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleToggleActive = async (e) => {
    e.stopPropagation()
    await supabase.from('offres').update({ actif: !offre.actif }).eq('id', offre.id)
    setMenuOpen(false)
    onChange?.()
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!window.confirm('Supprimer cette offre définitivement ?')) return
    await supabase.from('offres').delete().eq('id', offre.id)
    setMenuOpen(false)
    onChange?.()
  }

  const handleEdit = (e) => {
    e.stopPropagation()
    navigate(`/offre/${offre.id}/modifier`)
  }

  return (
    <div
      className="glass-strong rounded-2xl overflow-hidden cursor-pointer relative"
      onClick={() => navigate(`/offre/${offre.id}`)}
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-white/10 to-transparent">
        {offre.photo_url ? (
          <img src={offre.photo_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] text-body">
            Aucune image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {!offre.actif && (
          <div className="absolute top-3 left-3 glass rounded-full px-3 py-1 text-caption text-white">
            Désactivée
          </div>
        )}

        {editable && (
          <div className="absolute top-3 right-3">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((m) => !m) }}
              className="glass rounded-full p-2 text-white"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 glass-strong rounded-2xl overflow-hidden w-40 z-10">
                <button onClick={handleEdit} className="block w-full text-left px-4 py-3 text-body text-white hover:bg-white/10">
                  Modifier
                </button>
                <button onClick={handleToggleActive} className="block w-full text-left px-4 py-3 text-body text-white hover:bg-white/10">
                  {offre.actif ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={handleDelete} className="block w-full text-left px-4 py-3 text-body text-red-400 hover:bg-white/10">
                  Supprimer
                </button>
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-white text-h1">{offre.titre}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white font-semibold">{offre.prix} €</span>
            <span className="text-white/70 text-body">{offre.delai_jours}j de délai</span>
          </div>
        </div>
      </div>
    </div>
  )
}