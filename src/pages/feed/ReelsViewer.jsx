import { memo, useEffect, useRef, useState } from 'react'
import { Heart, MessageCircle, Send, MoreVertical, Video, ArrowLeft, Plus, Volume2, VolumeX } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import CommentsSheet from './CommentsSheet'
import { getFilterCss } from './editor/FilterPicker'
import HlsVideo from '../../components/HlsVideo'

const REELS_PAGE_SIZE = 20

// Fond noir + spinner violet (couleur de marque), affiché à la place de l'icône
// play grise moche que le navigateur montre par défaut quand une vidéo n'a pas
// encore de première image ni de miniature à afficher.
function ReelLoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="w-10 h-10 rounded-full border-2 border-white/20 animate-spin" style={{ borderTopColor: '#4f0c2d' }} />
    </div>
  )
}

async function fetchReels(userId) {
  const { data } = await supabase
    .from('posts')
    .select(`
      id, legende, created_at, filtre, client_id,
      post_medias(media_url, media_type, thumbnail_url, position, hls_status, hls_playlist_url),
      profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
      client:client_id(id, nom_complet, photo_url)
    `)
    .eq('type', 'video')
    .order('created_at', { ascending: false })
    .limit(REELS_PAGE_SIZE)

  const postIds = (data || []).map((p) => p.id)
  const [{ data: likes }, { data: commentCounts }] = await Promise.all([
    postIds.length
      ? supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
      : Promise.resolve({ data: [] }),
    postIds.length
      ? supabase.from('post_comments').select('post_id').in('post_id', postIds)
      : Promise.resolve({ data: [] }),
  ])

  return (data || []).map((p) => ({
    ...p,
    like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
    liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === userId) || false,
    comment_count: commentCounts?.filter((c) => c.post_id === p.id).length || 0,
  }))
}

export default function ReelsViewer() {
  const { user } = useAuth()
  const { postId } = useParams()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const videoRefs = useRef([])
  const hasScrolledToStart = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)

  const { data: reels = [], isLoading: loading } = useQuery({
    queryKey: ['reels', user?.id],
    queryFn: () => fetchReels(user?.id),
    enabled: !!user,
  })

  // scrolle instantanément vers le réel demandé par l'URL, une seule fois au chargement
  useEffect(() => {
    if (!reels.length || hasScrolledToStart.current) return
    if (!postId) { hasScrolledToStart.current = true; return }

    const idx = reels.findIndex((r) => r.id === postId)
    if (idx <= 0) { hasScrolledToStart.current = true; return }

    setActiveIndex(idx)
    const container = containerRef.current
    const slide = container?.querySelector(`[data-index="${idx}"]`)
    if (slide) {
      slide.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
    hasScrolledToStart.current = true
  }, [reels, postId])

  // observe quelle vidéo est visible à l'écran pour l'autoplay
  useEffect(() => {
    if (!reels.length) return
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.dataset.index)
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(idx)
          }
        })
      },
      { root: container, threshold: [0, 0.6, 1] }
    )

    const slides = container.querySelectorAll('[data-index]')
    slides.forEach((s) => observer.observe(s))

    return () => observer.disconnect()
  }, [reels])

  // joue uniquement la vidéo active, met en pause toutes les autres.
  // Cet effet remplace la logique précédente qui pilotait play/pause directement
  // depuis l'IntersectionObserver ; il centralise la décision sur activeIndex,
  // ce qui est nécessaire maintenant que seules activeIndex-1..activeIndex+1
  // sont montées dans le DOM (voir shouldMount plus bas).
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (!video) return
      if (idx === activeIndex) {
        video.currentTime = 0
        video.muted = muted
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    })
  }, [activeIndex, muted])

  // applique immédiatement mute/unmute à la vidéo en cours de lecture
  useEffect(() => {
    const video = videoRefs.current[activeIndex]
    if (video) video.muted = muted
  }, [muted, activeIndex])

  if (loading) {
    return (
      <div className="fixed inset-0 z-30 bg-black flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (reels.length === 0) {
    return (
      <div className="fixed inset-0 z-30 bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/50 px-8 text-center">
          <Video size={40} />
          <p className="text-body">Aucun réel pour le moment.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 right-0 bottom-0 z-30 bg-black overflow-y-scroll snap-y snap-mandatory"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      <div
        className="fixed top-0 left-0 right-0 z-30 flex items-center px-2 pt-3 pb-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        {postId ? (
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="w-9 h-9 flex items-center justify-center text-white pointer-events-auto"
          >
            <ArrowLeft size={22} />
          </button>
        ) : (
          <button
            onClick={() => navigate('/publier')}
            aria-label="Importer un réel"
            className="w-9 h-9 flex items-center justify-center text-white pointer-events-auto"
          >
            <Plus size={22} />
          </button>
        )}
        <p className="absolute left-1/2 -translate-x-1/2 text-white text-body-medium">Réel collab</p>
      </div>
      {reels.map((reel, i) => (
        <ReelSlide
          key={reel.id}
          reel={reel}
          index={i}
          // Précharge uniquement la vidéo visible et la suivante (comportement demandé) :
          // on monte la balise <video> pour activeIndex-1, activeIndex et activeIndex+1.
          // Le reste du flux n'affiche que sa miniature (poster), donc pas de téléchargement
          // vidéo tant que le slide n'est pas sur le point d'être atteint.
          // Montée dans le DOM : active-1, active, active+1, active+2. On monte un cran
          // plus loin que le preload réseau (ci-dessous) pour que la balise <video> de
          // active+2 existe déjà quand son tour de précharger arrive, sans démontage/
          // remontage au moment du swipe.
          shouldMount={i >= activeIndex - 1 && i <= activeIndex + 2}
          // Préchargement réseau réel : vidéo active, suivante (i+1) ET suivante+1 (i+2),
          // comme demandé — TikTok précharge sur 2 crans d'avance pour absorber les swipes
          // rapides. Sur réseau instable, ce 3e niveau (i+2) charge en 'metadata' seul plutôt
          // qu'en entier pour ne pas saturer la bande passante déjà utilisée par i et i+1.
          shouldPreload={i === activeIndex || i === activeIndex + 1}
          shouldPrefetchMeta={i === activeIndex + 2}
          isActive={i === activeIndex}
          setVideoRef={(el) => (videoRefs.current[i] = el)}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
        />
      ))}
    </div>
  )
}

const ReelSlide = memo(function ReelSlide({ reel, index, shouldMount, shouldPreload, shouldPrefetchMeta, isActive, setVideoRef, muted, onToggleMute }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(reel.liked_by_me)
  const [likeCount, setLikeCount] = useState(reel.like_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(reel.comment_count || 0)
  // Devient true dès que le navigateur a chargé assez de données pour peindre la
  // première image de la vidéo (événement natif "loadeddata") : à ce moment-là,
  // le spinner de secours (utilisé quand thumbnailUrl est vide) n'a plus lieu d'être.
  const [videoReady, setVideoReady] = useState(false)

  const influencer = reel.profils_influenceur
  const media = reel.post_medias?.[0]
  const mediaUrl = media?.media_url
  const thumbnailUrl = media?.thumbnail_url
  // HLS utilisé uniquement si le transcodage est bien allé au bout (voir
  // hls_status côté service de transcodage). Sinon, repli silencieux sur le
  // MP4 classique déjà uploadé à la publication — l'utilisateur ne voit jamais
  // d'erreur, juste une qualité fixe au lieu d'adaptative.
  const hlsPlaylistUrl = media?.hls_status === 'ready' ? media?.hls_playlist_url : null

  const toggleLike = async () => {
    if (!user) return
    if (liked) {
      setLiked(false)
      setLikeCount((c) => c - 1)
      await supabase.from('post_likes').delete().match({ post_id: reel.id, user_id: user.id })
    } else {
      setLiked(true)
      setLikeCount((c) => c + 1)
      await supabase.from('post_likes').insert({ post_id: reel.id, user_id: user.id })
    }
  }

  return (
    <div
      data-index={index}
      className="relative w-full snap-start snap-always"
      style={{ height: '100dvh' }}
    >
      {/* miniature réelle affichée tant que la vidéo n'est pas montée : jamais d'icône
          vidéo grise, jamais d'écran noir vide pendant le chargement. */}
      {!shouldMount && (
        <img
          src={thumbnailUrl || undefined}
          alt=""
          className="absolute inset-0 w-full h-full object-cover bg-black"
          style={{ filter: getFilterCss(reel.filtre) }}
        />
      )}
      {shouldMount && (
        <HlsVideo
          videoRef={(el) => setVideoRef(el)}
          hlsPlaylistUrl={hlsPlaylistUrl}
          fallbackMp4Url={mediaUrl}
          poster={thumbnailUrl || undefined}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted={muted}
          // 3 niveaux de préchargement réseau, du plus prioritaire au moins prioritaire :
          // - active/suivante (shouldPreload) : 'auto', téléchargement complet immédiat
          // - suivante+1 (shouldPrefetchMeta) : 'metadata' seul, juste assez pour un
          //   démarrage rapide si l'utilisateur swipe vite sans saturer la data mobile
          // - le reste (celle qu'on vient de quitter) : 'metadata' aussi, pas de re-fetch
          preload={shouldPreload ? 'auto' : shouldPrefetchMeta ? 'metadata' : 'metadata'}
          onLoadedData={() => setVideoReady(true)}
          style={{ filter: getFilterCss(reel.filtre) }}
        />
      )}

      {/* Si aucune miniature n'existe en base (vidéos publiées avant la génération
          automatique de thumbnail), le navigateur affiche par défaut une grosse icône
          play floue tant que la vidéo n'a pas assez chargé pour peindre sa première
          image. On masque ça avec un fond uni + spinner, nettement plus propre, jusqu'à
          ce que la vidéo ait sa première image prête. */}
      {shouldMount && !thumbnailUrl && !videoReady && <ReelLoadingOverlay />}

      {/* dégradés pour lisibilité de l'UI */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

      {/* colonne d'actions à droite */}
      <div
        className="absolute right-3 flex flex-col items-center gap-5 z-10 text-white"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom) + 16px)' }}
      >
        <button onClick={toggleLike} className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200">
          <Heart size={27} className={liked ? 'fill-red-500 text-red-500' : ''} strokeWidth={2} />
          {likeCount > 0 && <span className="text-[11px] font-medium">{likeCount}</span>}
        </button>
        <button
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200"
        >
          <MessageCircle size={26} strokeWidth={2} />
          {commentCount > 0 && <span className="text-[11px] font-medium">{commentCount}</span>}
        </button>
        <button className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200">
          <Send size={24} strokeWidth={2} />
        </button>
        <button className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200">
          <MoreVertical size={24} strokeWidth={2} />
        </button>
        <button
          onClick={onToggleMute}
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200"
        >
          {muted ? <VolumeX size={24} strokeWidth={2} /> : <Volume2 size={24} strokeWidth={2} />}
        </button>
      </div>

      {/* bas : profil, nom, légende */}
      <div
        className="absolute left-3 right-16 z-10"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom) + 12px)' }}
      >
        <Link to={`/influenceur/${influencer?.id}`} className="flex items-center gap-2.5 mb-2">
          <img
            src={influencer?.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${influencer?.id}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
          <span className="text-white text-body-medium flex items-center gap-1.5 truncate">
            {influencer?.users?.nom_complet}
            {influencer?.verifie && <VerifiedBadge size={14} />}
          </span>
        </Link>
        {reel.client && (
          <Link to={`/entreprise/${reel.client.id}`} className="flex items-center gap-2 mb-2 -mt-1">
            <img
              src={reel.client.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${reel.client.nom_complet}`}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-6 h-6 rounded-full object-cover shrink-0"
            />
            <span className="text-white/80 text-small truncate">{reel.client.nom_complet}</span>
          </Link>
        )}
        {reel.legende && (
          <p className="text-white text-body line-clamp-2">{reel.legende}</p>
        )}
      </div>

      {showComments && (
        <CommentsSheet postId={reel.id} onClose={() => setShowComments(false)} />
      )}
    </div>
  )
})
