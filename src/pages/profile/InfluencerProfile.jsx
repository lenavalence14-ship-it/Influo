import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as profileApi from '../../api/profile'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import Button from '../../components/ui/Button'
import { LogOut, Plus, Link2, Grid3x3, Video, ArrowLeft } from 'lucide-react'
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
import { useActiveNotes } from '../../hooks/useActiveNotes'
import { useProfileNoteLauncher } from '../feed/ProfileNoteLauncher'
import { useFollow } from '../../hooks/useFollow'

export default function InfluencerProfile() {
  const { id } = useParams() // id du profils_influenceur ; si absent, c'est "mon" profil
  const { user, profile, influencerProfile, signOut } = useAuth()
  const [target, setTarget] = useState(null)
  const [tab, setTab] = useState('publications')
  const [subTab, setSubTab] = useState('grille')
  // Même pattern que feedMuted dans Feed.jsx : état partagé par toutes les
  // PostCard de cette page, pour un comportement cohérent avec le feed
  // (au lieu du fallback localMuted indépendant par carte).
  const [profileMuted, setProfileMuted] = useState(true)
  const [brandCircles, setBrandCircles] = useState([])
  const [posts, setPosts] = useState([])
  const [offres, setOffres] = useState([])
  const [reseaux, setReseaux] = useState([])
  const [collabCount, setCollabCount] = useState(0)
  const [collabPhotoCount, setCollabPhotoCount] = useState(0)
  const [collabVideoCount, setCollabVideoCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const activeNoteUserIds = useActiveNotes()
  const { openNote, viewer: noteViewer } = useProfileNoteLauncher(target?.user_id)

  const targetId = id || influencerProfile?.id
  const isMe = !id || id === influencerProfile?.id
  // useFollow travaille sur des public.users.id, pas des profils_influenceur.id :
  // target.user_id n'est connu qu'après le chargement, donc le hook reçoit undefined
  // le temps du premier rendu puis se réhydrate normalement une fois `target` posé.
  const { followersCount, followingCount, isFollowing, toggleFollow, pending: followPending } = useFollow(target?.user_id)

  const reloadOffres = async () => {
    const data = await profileApi.fetchInfluencerOffres(targetId, !isMe)
    setOffres(data)
  }

  const offresAffichees = isMe ? offres : offres.filter((o) => o.actif)

  useEffect(() => {
    if (!targetId) { setLoading(false); return }
    let cancelled = false

    const load = async () => {
      const result = await profileApi.fetchInfluencerProfilePage({ targetId, isMe, currentUserId: user?.id })
      if (cancelled) return

      setBrandCircles(result.brandCircles)
      setTarget(result.target)
      setPosts(result.posts)
      setOffres(result.offres)
      setReseaux(result.reseaux)
      setCollabCount(result.collabCount)
      setCollabPhotoCount(result.collabPhotoCount)
      setCollabVideoCount(result.collabVideoCount)
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
            style={{ fontFamily: 'var(--font-logo)', color: 'var(--accent)' }}
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

      {/* Profil d'un AUTRE influenceur : pas de logo ni déconnexion, juste la
          flèche retour pour pouvoir quitter cet écran (sinon on est bloqué
          sans moyen visuel de revenir en arrière). */}
      {!isMe && (
        <div className="flex items-center px-3 pt-4 pb-1">
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="w-9 h-9 flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
      )}

      {/* header profil */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {activeNoteUserIds.has(target.user_id) ? (
              <div
                className="w-20 h-20 rounded-full p-[2.5px] cursor-pointer"
                style={{ background: 'linear-gradient(to bottom right, var(--accent), var(--accent))' }}
                onClick={openNote}
              >
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
                onClick={() => navigate('/notes/nouvelle')}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center"
                aria-label="Ajouter une note"
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
              <button
                onClick={() => target?.user_id && navigate(`/profil/${target.user_id}/abonnes?tab=followers`)}
                className="text-small"
              >
                <span className="font-bold">{followersCount.toLocaleString()}</span>{' '}
                <span className="text-[var(--text-secondary)]">abonnés</span>
              </button>
              <button
                onClick={() => target?.user_id && navigate(`/profil/${target.user_id}/abonnes?tab=following`)}
                className="text-small"
              >
                <span className="font-bold">{followingCount.toLocaleString()}</span>{' '}
                <span className="text-[var(--text-secondary)]">abonnements</span>
              </button>
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
              <Button variant="glass" shape="rect" className="flex-1" onClick={() => navigate('/profil/modifier')}>
                Modifier
              </Button>
              <Button variant="glass" shape="rect" className="flex-1" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="glass" shape="rect" className="flex-1" onClick={() => navigate('/profil/media-kit', { state: { reseaux } })}>
                Media Kit
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
              {/* Une entreprise peut contacter un influenceur (canal existant) ; un
                  influenceur peut aussi contacter un autre influenceur, maintenant
                  que conversations_influenceur existe pour ce cas. */}
              {profile?.role === 'client' && (
                <Button variant="glass" shape="rect" fullWidth onClick={() => navigate(`/messages/nouveau?influenceur=${target.id}`)}>
                  Contacter
                </Button>
              )}
              {profile?.role === 'influenceur' && target?.user_id && (
                <Button variant="glass" shape="rect" fullWidth onClick={() => navigate(`/messages/influenceur/nouveau?utilisateur=${target.user_id}`)}>
                  Contacter
                </Button>
              )}
            </>
          )}
        </div>

      </div>

      {/* cercles des marques ayant collaboré, la plus fréquente en premier */}
      <div className="flex gap-4 px-4 py-3 overflow-x-auto">
        {brandCircles.length > 0 ? (
          brandCircles.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-1 shrink-0 w-16">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-[var(--bg-secondary)] flex items-center justify-center">
                {c.photo_url ? (
                  <img src={c.photo_url} alt={c.nom_complet} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-caption text-[var(--text-secondary)]">{c.nom_complet?.[0]}</span>
                )}
              </div>
              <span className="text-caption text-[var(--text-secondary)] truncate w-full text-center">
                {c.nom_complet}
              </span>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-1 shrink-0 w-16">
            <div className="w-14 h-14 rounded-full bg-[var(--accent)]" />
          </div>
        )}
      </div>

      {/* onglets */}
      <div className="flex sticky top-0 bg-[var(--bg-primary)]/90 backdrop-blur-xl z-20">
        <button
          onClick={() => setTab('publications')}
          className={`flex-1 py-3 text-body-medium border-b-2 transition-colors ${
            tab === 'publications' ? 'border-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'
          }`}
        >
          Collaboration vérifiée ({collabCount})
        </button>
        <button
          onClick={() => setTab('offres')}
          className={`flex-1 py-3 text-body-medium border-b-2 transition-colors ${
            tab === 'offres' ? 'border-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'
          }`}
        >
          Offre ({offres.length})
        </button>
      </div>

      {/* contenu onglet */}
      {tab === 'publications' ? (
        (() => {
          const filteredPosts = posts.filter((p) =>
            subTab === 'video' ? p.type === 'video' : p.type !== 'video'
          )
          return (
            <div className="pt-0">
              {/* sous-onglets grille/vidéo : la logique de filtre existait déjà
                  (subTab, setSubTab) mais aucun bouton ne l'appelait */}
              <div className="flex justify-center gap-8 py-3 border-b border-[var(--border-color,rgba(255,255,255,0.1))]">
                <button
                  onClick={() => setSubTab('grille')}
                  className={subTab === 'grille' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}
                  aria-label="Grille"
                >
                  <Grid3x3 size={20} />
                </button>
                <button
                  onClick={() => setSubTab('video')}
                  className={subTab === 'video' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}
                  aria-label="Vidéos"
                >
                  <Video size={20} />
                </button>
              </div>
              {filteredPosts.length === 0 ? (
                <div className="py-16 text-center text-[var(--text-secondary)] text-body">
                  {subTab === 'video' ? 'Aucune vidéo.' : 'Aucune publication.'}
                </div>
              ) : (
                filteredPosts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    muted={profileMuted}
                    onToggleMute={() => setProfileMuted((m) => !m)}
                    onDeleted={(id) => setPosts((ps) => ps.filter((post) => post.id !== id))}
                  />
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

      {noteViewer}
    </div>
  )
}

function OfferCard({ offre, editable, onChange }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleToggleActive = async (e) => {
    e.stopPropagation()
    await profileApi.toggleOffreActive(offre.id, !offre.actif)
    setMenuOpen(false)
    onChange?.()
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!window.confirm('Supprimer cette offre définitivement ?')) return
    await profileApi.deleteOffreFromProfile(offre.id)
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