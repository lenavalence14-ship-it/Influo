import { useEffect, useRef, useState } from 'react'
import { Heart, MessageCircle, Send, MoreVertical, Video, ArrowLeft, Plus, Volume2, VolumeX } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import CommentsSheet from './CommentsSheet'

export default function ReelsViewer() {
  const { user } = useAuth()
  const { postId } = useParams()
  const navigate = useNavigate()
  const [reels, setReels] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef(null)
  const videoRefs = useRef([])
  const hasScrolledToStart = useRef(false)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('posts')
        .select(`
          id, legende, created_at, filtre,
post_medias(media_url, media_type, position),
profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url))
        `)
        .eq('type', 'video')
        .order('created_at', { ascending: false })

      const postIds = (data || []).map((p) => p.id)
      const { data: likes } = postIds.length
        ? await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
        : { data: [] }

      const enriched = (data || []).map((p) => ({
        ...p,
        like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
        liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === user?.id) || false,
      }))
      setReels(enriched)
      setLoading(false)
    }
    load()
  }, [user])

  // scrolle instantanément vers le réel demandé par l'URL, une seule fois au chargement
  useEffect(() => {
    if (!reels.length || hasScrolledToStart.current) return
    if (!postId) { hasScrolledToStart.current = true; return }

    const idx = reels.findIndex((r) => r.id === postId)
    if (idx <= 0) { hasScrolledToStart.current = true; return }

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
          const video = videoRefs.current[idx]
          if (!video) return
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(idx)
            video.currentTime = 0
            video.muted = muted
            video.play().catch(() => {})
          } else {
            video.pause()
          }
        })
      },
      { root: container, threshold: [0, 0.6, 1] }
    )

    const slides = container.querySelectorAll('[data-index]')
    slides.forEach((s) => observer.observe(s))

    return () => observer.disconnect()
  }, [reels])

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
          setVideoRef={(el) => (videoRefs.current[i] = el)}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
        />
      ))}
    </div>
  )
}

function ReelSlide({ reel, index, setVideoRef, muted, onToggleMute }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(reel.liked_by_me)
  const [likeCount, setLikeCount] = useState(reel.like_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(0)

  const influencer = reel.profils_influenceur
  const mediaUrl = reel.post_medias?.[0]?.media_url

  useEffect(() => {
    supabase
      .from('post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', reel.id)
      .then(({ count }) => setCommentCount(count || 0))
  }, [reel.id])

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
      <video
        ref={setVideoRef}
        src={mediaUrl}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted={muted}
        playsInline
        preload="metadata"
      />

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
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
          <span className="text-white text-body-medium flex items-center gap-1.5 truncate">
            {influencer?.users?.nom_complet}
            {influencer?.verifie && <VerifiedBadge size={14} />}
          </span>
        </Link>
        {reel.legende && (
          <p className="text-white text-body line-clamp-2">{reel.legende}</p>
        )}
      </div>

      {showComments && (
        <CommentsSheet postId={reel.id} onClose={() => setShowComments(false)} />
      )}
    </div>
  )
}
