import { memo, useEffect, useRef, useState } from 'react'
import { Heart, MessageCircle, Send, MoreVertical, Video, ArrowLeft, Plus, Volume2, VolumeX, Play, Repeat2, Bookmark, Music2 } from 'lucide-react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import CommentsSheet from './CommentsSheet'
import { getFilterCss } from './editor/FilterPicker'
import HlsVideo from '../../components/HlsVideo'
import { getCropTransformStyle } from '../../lib/mediaCrop'
import { getFontStyle } from './PhotoNoteEditor'

function getMediaCropStyle(media, cropFormat) {
  return getCropTransformStyle({
    naturalWidth: media?.natural_width,
    naturalHeight: media?.natural_height,
    cropFormat,
    zoom: media?.zoom,
    offsetX: media?.offset_x,
    offsetY: media?.offset_y,
  })
}

// Même rendu qu'en feed (PostCard.jsx) : texte overlay en lecture seule,
// positionné en % ancré au centre, identique à ce que l'utilisateur a validé
// dans l'éditeur.
function TextOverlay({ media }) {
  if (!media?.texte_overlay) return null
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
      style={{ left: `${media.texte_x ?? 50}%`, top: `${media.texte_y ?? 50}%` }}
    >
      <p
        className="text-center px-3 max-w-[80vw] whitespace-pre-wrap"
        style={{ color: media.texte_couleur || '#ffffff', fontSize: 28, textShadow: '0 1px 6px rgba(0,0,0,0.5)', ...getFontStyle(media.texte_police) }}
      >
        {media.texte_overlay}
      </p>
    </div>
  )
}

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
      id, legende, created_at, filtre, client_id, crop_format,
      post_medias(media_url, media_type, thumbnail_url, position, hls_status, hls_playlist_url, zoom, offset_x, offset_y, natural_width, natural_height),
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
  const location = useLocation()
  const containerRef = useRef(null)
  const videoRefs = useRef([])
  const hasScrolledToStart = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(false)
  const [pausedSlides, setPausedSlides] = useState(() => new Set())

  const toggleSlidePaused = (index) => {
    setPausedSlides((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

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
  // au changement de slide active : reset au début et retire toute pause manuelle
  // héritée d'une session de lecture précédente sur cette même vidéo
  useEffect(() => {
    const video = videoRefs.current[activeIndex]
    if (video) video.currentTime = 0
    setPausedSlides((prev) => {
      if (!prev.has(activeIndex)) return prev
      const next = new Set(prev)
      next.delete(activeIndex)
      return next
    })
  }, [activeIndex])

  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (!video) return
      if (idx === activeIndex) {
        if (!pausedSlides.has(idx)) {
          video.muted = muted
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      } else {
        video.pause()
      }
    })
  }, [activeIndex, muted, pausedSlides])

  // applique immédiatement mute/unmute à la vidéo en cours de lecture
  useEffect(() => {
    const video = videoRefs.current[activeIndex]
    if (video) video.muted = muted
  }, [muted, activeIndex])

  // Coupe la vidéo active dès que l'onglet Réels quitte l'écran, y compris
  // quand ce n'est pas un vrai démontage : la route /video est gardée en vie
  // par KeepAliveTabs (display:none au lieu d'être démontée), donc sans ceci
  // la vidéo et son son continuaient de tourner en arrière-plan — que ce
  // soit après avoir quitté l'app (onglet navigateur/app masqué) OU après
  // avoir simplement basculé sur un autre onglet interne (Feed, Recherche…)
  // sans changer de tab navigateur, cas que visibilitychange seul ne couvre
  // pas puisque le document reste visible.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        videoRefs.current.forEach((video) => video?.pause())
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (location.pathname !== '/video' && !location.pathname.startsWith('/video/')) {
      videoRefs.current.forEach((video) => video?.pause())
    }
  }, [location.pathname])

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
          isPaused={pausedSlides.has(i)}
          onTogglePause={() => toggleSlidePaused(i)}
        />
      ))}
    </div>
  )
}

const ReelSlide = memo(function ReelSlide({ reel, index, shouldMount, shouldPreload, shouldPrefetchMeta, isActive, setVideoRef, muted, onToggleMute, isPaused, onTogglePause }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(reel.liked_by_me)
  const [likeCount, setLikeCount] = useState(reel.like_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(reel.comment_count || 0)
  // Devient true dès que le navigateur a chargé assez de données pour peindre la
  // première image de la vidéo (événement natif "loadeddata") : à ce moment-là,
  // le spinner de secours (utilisé quand thumbnailUrl est vide) n'a plus lieu d'être.
  const [videoReady, setVideoReady] = useState(false)
  const [showBigHeart, setShowBigHeart] = useState(false)
  const lastTapRef = useRef(0)
  const tapTimeoutRef = useRef(null)
  // Ref locale vers l'élément <video>, en plus du setVideoRef transmis au
  // parent (qui gère play/pause centralisé) : nécessaire pour lire
  // currentTime/duration et permettre le drag sur la barre de progression
  // sans dupliquer la logique de lecture déjà gérée par ReelsViewer.
  const videoElRef = useRef(null)
  const [progress, setProgress] = useState(0) // 0 à 1
  const [isDragging, setIsDragging] = useState(false)
  const progressBarRef = useRef(null)

  const influencer = reel.profils_influenceur
  const media = reel.post_medias?.[0]
  const mediaUrl = media?.media_url
  const thumbnailUrl = media?.thumbnail_url
  // Le cadrage (zoom/pan) choisi dans l'éditeur pour le feed s'applique
  // TOUJOURS en Reels, qu'importe le format -- sinon un élément volontairement
  // coupé au cadrage (ex: watermark d'une autre app) réapparaîtrait en Reels,
  // ce qui viderait le cadrage de son utilité. Seul le POSITIONNEMENT à
  // l'écran change selon le format : le cadre déjà recadré est soit étalé en
  // plein écran (vertical), soit centré avec bandes noires (paysage) -- mais
  // dans les deux cas c'est le MÊME rectangle cadré qu'on affiche, jamais la
  // vidéo brute non recadrée.
  const isLandscape = reel.crop_format === 'horizontal'
  const cropStyle = getMediaCropStyle(media, reel.crop_format)
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

  const likeOnly = async () => {
    if (!user || liked) return
    setLiked(true)
    setLikeCount((c) => c + 1)
    await supabase.from('post_likes').insert({ post_id: reel.id, user_id: user.id })
  }

  const triggerBigHeart = () => {
    setShowBigHeart(true)
    window.clearTimeout(triggerBigHeart._t)
    triggerBigHeart._t = window.setTimeout(() => setShowBigHeart(false), 700)
  }

  const handleVideoTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // double-tap : like uniquement, ne touche pas à play/pause
      window.clearTimeout(tapTimeoutRef.current)
      lastTapRef.current = 0
      likeOnly()
      triggerBigHeart()
      return
    }
    lastTapRef.current = now
    tapTimeoutRef.current = window.setTimeout(() => {
      // tap simple confirmé (pas suivi d'un second tap) : play/pause.
      // Contrairement à avant, l'overlay ne disparaît plus après un délai fixe :
      // il reste affiché tant que isPaused est vrai (comportement Instagram),
      // et se cache automatiquement dès que la lecture reprend (voir le style
      // de l'overlay plus bas, piloté directement par isPaused).
      onTogglePause()
    }, 300)
  }

  // Suit la progression de lecture pour remplir la barre, sauf pendant un
  // drag actif (sinon la vidéo qui avance re-désynchronise la position du
  // doigt de l'utilisateur pendant qu'il glisse).
  useEffect(() => {
    const video = videoElRef.current
    if (!video) return
    const onTimeUpdate = () => {
      if (isDragging) return
      if (!video.duration) return
      setProgress(video.currentTime / video.duration)
    }
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [isDragging])

  // Calcule un ratio 0-1 à partir d'une position X (souris ou tactile) par
  // rapport à la largeur de la barre.
  const ratioFromClientX = (clientX) => {
    const bar = progressBarRef.current
    if (!bar) return 0
    const rect = bar.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.min(1, Math.max(0, ratio))
  }

  const seekToRatio = (ratio) => {
    const video = videoElRef.current
    if (!video || !video.duration) return
    video.currentTime = ratio * video.duration
    setProgress(ratio)
  }

  const handleProgressPointerDown = (e) => {
    e.stopPropagation() // ne pas déclencher le tap play/pause de la vidéo
    setIsDragging(true)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    seekToRatio(ratioFromClientX(clientX))
  }

  const handleProgressPointerMove = (e) => {
    if (!isDragging) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    seekToRatio(ratioFromClientX(clientX))
  }

  const handleProgressPointerUp = () => {
    setIsDragging(false)
  }

  return (
    <div
      data-index={index}
      className="relative w-full bg-black snap-start snap-always"
      style={{ height: '100dvh' }}
    >
      {/* miniature réelle affichée tant que la vidéo n'est pas montée : jamais d'icône
          vidéo grise, jamais d'écran noir vide pendant le chargement. Paysage : le
          cadre cadré (16:9) est centré dans l'écran, bandes noires au-dessus/dessous.
          Vertical : le cadre cadré remplit tout l'écran. Dans les deux cas, c'est le
          MÊME cadrage (zoom/pan) que celui choisi dans l'éditeur pour le feed. */}
      {isLandscape ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="relative w-full aspect-video overflow-hidden">
            {/* la miniature reste affichée tant que la vidéo n'a pas de frame prête
                (videoReady), qu'elle existe en base ou non (fond noir sinon) --
                jamais de flash gris natif du <video> pendant ce court instant */}
            {!videoReady && (
              <img
                src={thumbnailUrl || undefined}
                alt=""
                className="absolute inset-0 bg-black"
                style={{ ...cropStyle, filter: getFilterCss(reel.filtre) }}
              />
            )}
            {shouldMount && (
              <HlsVideo
                videoRef={(el) => { setVideoRef(el); videoElRef.current = el }}
                hlsPlaylistUrl={hlsPlaylistUrl}
                fallbackMp4Url={mediaUrl}
                poster={thumbnailUrl || undefined}
                className="absolute inset-0"
                loop
                muted={muted}
                preload={shouldPreload ? 'auto' : shouldPrefetchMeta ? 'metadata' : 'metadata'}
                onLoadedData={() => setVideoReady(true)}
                style={{ ...cropStyle, filter: getFilterCss(reel.filtre), opacity: videoReady ? 1 : 0 }}
              />
            )}
            <TextOverlay media={media} />
          </div>
        </div>
      ) : (
        <>
          {!videoReady && (
            <img
              src={thumbnailUrl || undefined}
              alt=""
              className="absolute inset-0 w-full h-full bg-black"
              style={{ ...cropStyle, filter: getFilterCss(reel.filtre) }}
            />
          )}
          {shouldMount && (
            <HlsVideo
              videoRef={(el) => { setVideoRef(el); videoElRef.current = el }}
              hlsPlaylistUrl={hlsPlaylistUrl}
              fallbackMp4Url={mediaUrl}
              poster={thumbnailUrl || undefined}
              className="absolute inset-0 w-full h-full"
              loop
              muted={muted}
              // 3 niveaux de préchargement réseau, du plus prioritaire au moins prioritaire :
              // - active/suivante (shouldPreload) : 'auto', téléchargement complet immédiat
              // - suivante+1 (shouldPrefetchMeta) : 'metadata' seul, juste assez pour un
              //   démarrage rapide si l'utilisateur swipe vite sans saturer la data mobile
              // - le reste (celle qu'on vient de quitter) : 'metadata' aussi, pas de re-fetch
              preload={shouldPreload ? 'auto' : shouldPrefetchMeta ? 'metadata' : 'metadata'}
              onLoadedData={() => setVideoReady(true)}
              style={{ ...cropStyle, filter: getFilterCss(reel.filtre), opacity: videoReady ? 1 : 0 }}
            />
          )}
          <TextOverlay media={media} />
        </>
      )}

      {/* Si aucune miniature n'existe en base (vidéos publiées avant la génération
          automatique de thumbnail), le navigateur affiche par défaut une grosse icône
          play floue tant que la vidéo n'a pas assez chargé pour peindre sa première
          image. On masque ça avec un fond uni + spinner, nettement plus propre, jusqu'à
          ce que la vidéo ait sa première image prête. */}
      {shouldMount && !thumbnailUrl && !videoReady && <ReelLoadingOverlay />}

      {/* zone de tap : simple = play/pause, double = like */}
      <button
        onClick={handleVideoTap}
        aria-label="Vidéo"
        className="absolute inset-0 w-full h-full z-[5]"
        style={{ background: 'transparent' }}
      />

      {/* grand cœur, façon Instagram, apparaît puis repart */}
      {showBigHeart && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <Heart
            size={96}
            className="fill-[var(--accent)] text-[var(--accent)]"
            style={{ animation: 'bigHeartPop 0.7s ease-out' }}
          />
        </div>
      )}

      {/* Overlay central play/pause + mute, façon Instagram : apparaît au tap et
          reste affiché statiquement tant que la vidéo est en pause (pas de
          disparition après un délai fixe). Le mute n'existe plus dans la colonne
          de droite -- il est uniquement ici, empilé sous le bouton play, pour
          ne pas perturber les espacements de la colonne d'actions reproduite
          à l'identique d'Instagram. */}
      {isPaused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMute() }}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            className="w-11 h-11 rounded-full flex items-center justify-center pointer-events-auto"
            style={{
              background: 'color-mix(in srgb, var(--accent) 35%, transparent)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid color-mix(in srgb, var(--accent) 50%, transparent)',
            }}
          >
            {muted ? <VolumeX size={20} className="text-white" /> : <Volume2 size={20} className="text-white" />}
          </button>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center pointer-events-none"
            style={{
              background: 'color-mix(in srgb, var(--accent) 35%, transparent)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid color-mix(in srgb, var(--accent) 50%, transparent)',
            }}
          >
            <Play size={28} className="text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* dégradés pour lisibilité de l'UI */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

      {/* Barre de progression draggable, positionnée au-dessus de la BottomNav
          de l'app (fixed bottom-0, z-40, hauteur réelle ~48px de contenu) qui
          sinon la masquerait complètement puisque cette route /video ne fait
          pas partie de ROUTES_SANS_BOTTOM_NAV. Zone de tap invisible plus
          haute (20px) que la barre visible (3px) pour viser facilement au doigt. */}
      <div
        ref={progressBarRef}
        className="absolute inset-x-0 z-40 flex items-end"
        style={{ height: '20px', bottom: 'calc(44px + env(safe-area-inset-bottom))', touchAction: 'none' }}
        onMouseDown={handleProgressPointerDown}
        onMouseMove={handleProgressPointerMove}
        onMouseUp={handleProgressPointerUp}
        onMouseLeave={handleProgressPointerUp}
        onTouchStart={handleProgressPointerDown}
        onTouchMove={handleProgressPointerMove}
        onTouchEnd={handleProgressPointerUp}
      >
        <div className="w-full h-[3px] bg-white/25 relative">
          <div
            className="absolute inset-y-0 left-0 bg-white"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* colonne d'actions à droite -- reproduction Instagram : icônes en
          contour, espacement vertical large et régulier (gap-7 ≈ 65-70px
          centre à centre selon la hauteur des labels), libellé texte "J'aime"
          sous le cœur (PAS un chiffre), chiffre sous commentaire, repost et
          enregistrer sans route pour l'instant (aucun onClick), 3 points
          légèrement détaché du reste comme sur Instagram. Le mute n'est plus
          ici -- il vit uniquement dans l'overlay central (voir plus haut). */}
      <div
        className="absolute right-2 flex flex-col items-center gap-7 z-10 text-white"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom) + 16px)' }}
      >
        <button onClick={toggleLike} className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200">
          <Heart size={30} className={liked ? 'fill-[var(--accent)] text-[var(--accent)]' : ''} strokeWidth={1.8} />
          <span className="text-caption font-medium">J'aime</span>
        </button>
        <button
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200"
        >
          <MessageCircle size={30} strokeWidth={1.8} />
          <span className="text-caption font-semibold">{commentCount}</span>
        </button>
        {/* Repost : sans route pour l'instant. Le compteur sera ajouté quand
            la fonctionnalité existera réellement côté base -- pas de mock. */}
        <button className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200">
          <Repeat2 size={30} strokeWidth={1.8} />
        </button>
        {/* Partager : sans route */}
        <button className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200">
          <Send size={27} strokeWidth={1.8} />
        </button>
        {/* Enregistrer : sans route */}
        <button className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200">
          <Bookmark size={28} strokeWidth={1.8} />
        </button>
        {/* 3 points : sans route, légèrement détaché du groupe précédent */}
        <button className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200 mt-1">
          <MoreVertical size={26} strokeWidth={1.8} />
        </button>
      </div>

      {/* bas : profil, nom, légende -- offsets mesurés en pixels sur la
          capture Instagram : ~78px entre le bas de la légende et la barre de
          progression, ~13px entre le nom et la légende. */}
      <div
        className="absolute left-3 right-16 z-10"
        style={{ bottom: 'calc(48px + env(safe-area-inset-bottom) + 78px)' }}
      >
        <Link to={`/influenceur/${influencer?.id}`} className="flex items-center gap-2 mb-[13px]">
          <img
            src={influencer?.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${influencer?.id}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
          <span className="text-white text-small-medium flex items-center gap-1.5 truncate">
            {influencer?.users?.nom_complet}
            {influencer?.verifie && <VerifiedBadge size={13} />}
          </span>
        </Link>
        {reel.client && (
          <Link to={`/entreprise/${reel.client.id}`} className="flex items-center gap-2 mb-[13px] -mt-0.5">
            <img
              src={reel.client.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${reel.client.nom_complet}`}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-5 h-5 rounded-full object-cover shrink-0"
            />
            <span className="text-white/80 text-caption truncate">{reel.client.nom_complet}</span>
          </Link>
        )}
        {reel.legende && (
          <p className="text-white text-small line-clamp-2">{reel.legende}</p>
        )}
      </div>

      {/* Bloc "son original" en bas à droite, aligné au même niveau vertical
          que la légende (mesuré sur la capture Instagram). La base n'a pas de
          notion d'audio distincte du post, donc on affiche systématiquement
          "son original" avec la photo du créateur -- pas un vrai lecteur audio. */}
      <div
        className="absolute right-3 z-10"
        style={{ bottom: 'calc(48px + env(safe-area-inset-bottom) + 78px)' }}
      >
        <div className="relative w-7 h-7 rounded-md overflow-hidden shrink-0 border border-white/40">
          <img
            src={influencer?.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${influencer?.id}`}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Music2 size={12} className="text-white" />
          </div>
        </div>
      </div>

      {showComments && (
        <CommentsSheet postId={reel.id} onClose={() => setShowComments(false)} />
      )}

      <style>{`
        @keyframes bigHeartPop {
          0% { transform: scale(0.3); opacity: 0; }
          25% { transform: scale(1.15); opacity: 1; }
          40% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
})
