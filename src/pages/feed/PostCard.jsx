import { memo, useEffect, useRef, useState } from 'react'
import { Heart, MessageCircle, Send, MoreHorizontal, X, Trash2, Pencil, Volume2, VolumeX } from 'lucide-react'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { InstagramIcon, TikTokIcon } from '../../components/ui/SocialIcons'
import Avatar from '../../components/ui/Avatar'
import BottomSheet from '../../components/ui/BottomSheet'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import CommentsSheet from './CommentsSheet'
import { useActiveStories } from '../../hooks/useActiveStories'
import { timeAgo } from '../../lib/time'
import { getFilterCss } from './editor/FilterPicker'

const cropClasses = {
  carre: 'aspect-square',
  vertical: 'aspect-[9/16]',
  horizontal: 'aspect-[4/3]',
  // ancienne valeur héritée (anciens posts publiés en 4:5 avant le passage à 9:16) :
  // on garde ce ratio pour eux spécifiquement, pas pour 'vertical' qui est désormais 9:16
  vertical_45: 'aspect-[4/5]',
}

// Reproduit exactement le rendu de l'écran de recadrage (CreatePost.jsx) :
// image en object-contain dans le cadre, puis clip-path inset() sur le
// rectangle choisi (crop_x/y/w/h, en % du cadre). Sans ça, le feed retombait
// sur un object-cover centré générique, qui ne correspond jamais au cadrage
// précis validé dans l'éditeur (recadrage manuel écrasé). Retourne null si
// aucun crop précis n'a été enregistré (post publié avant cette fonctionnalité,
// ou crop plein cadre par défaut) : le feed retombe alors sur object-cover.
function getCropRectStyle(post) {
  const { crop_x: x, crop_y: y, crop_w: w, crop_h: h } = post
  if (x == null || y == null || w == null || h == null) return null
  // Crop plein cadre (0,0,100,100) : équivalent à pas de crop, pas la peine
  // de passer par le clip-path (object-cover suffit et coûte moins cher).
  if (x === 0 && y === 0 && w === 100 && h === 100) return null
  return {
    clipPath: `inset(${y}% ${100 - x - w}% ${100 - y - h}% ${x}%)`,
  }
}

function PostCard({ post, onDeleted, autoOpenComments = false, priority = false, muted: mutedProp, onToggleMute: onToggleMuteProp }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [commentCount, setCommentCount] = useState(post.comment_count || 0)
  const [showComments, setShowComments] = useState(autoOpenComments)
  const [showMenu, setShowMenu] = useState(false)
  const [deleted, setDeleted] = useState(false)
  // le son est partagé entre toutes les vidéos du feed quand le parent (Feed.jsx)
  // passe muted/onToggleMute ; sinon (ex: PostDetail, une seule carte affichée)
  // on retombe sur un état local propre à cette carte
  const [localMuted, setLocalMuted] = useState(true)
  const muted = mutedProp ?? localMuted
  const onToggleMute = onToggleMuteProp ?? (() => setLocalMuted((m) => !m))
  // le média (vidéo) n'est monté dans le DOM que quand la carte approche de l'écran.
  // Pour les toutes premières cartes du feed (priority), on le monte immédiatement
  // pour éviter un flash vide au premier affichage.
  const [mediaMounted, setMediaMounted] = useState(priority)
  const videoRef = useRef(null)
  const mediaContainerRef = useRef(null)
  const carrouselRef = useRef(null)
  const [carrouselIndex, setCarrouselIndex] = useState(0)

  const influencer = post.profils_influenceur
  const isOwner = influencer?.user_id === user?.id

  // collaboration vérifiée : ce post découle d'une commande validée
  const isCollabVerifiee = Boolean(post.commande_id)
  const client = post.client
  const lienInstagram = post.commandes?.lien_instagram
  const lienTiktok = post.commandes?.lien_tiktok

  const toggleLike = async () => {
    if (liked) {
      setLiked(false)
      setLikeCount((c) => c - 1)
      await supabase.from('post_likes').delete().match({ post_id: post.id, user_id: user.id })
    } else {
      setLiked(true)
      setLikeCount((c) => c + 1)
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Supprimer définitivement cette publication ?')) return
    setShowMenu(false)
    await supabase.from('posts').delete().eq('id', post.id)
    setDeleted(true)
    onDeleted?.(post.id)
  }

  const allMedias = post.post_medias || []
  const isCarrousel = allMedias.length > 1
  const mediaUrl = allMedias[0]?.media_url
  const thumbnailUrl = allMedias[0]?.thumbnail_url
  const isVideo = post.type === 'video' || allMedias[0]?.media_type === 'video'

  // Monte le <video> dans le DOM dès que la carte est à moins de ~1 écran de distance
  // du viewport (lazy loading + préchargement de "la vidéo visible et la suivante").
  // Avant le montage, seule l'image poster (thumbnail réelle) est affichée : aucune
  // requête réseau vidéo n'est émise tant que la carte n'approche pas de l'écran.
  useEffect(() => {
    if (!isVideo || mediaMounted) return
    const container = mediaContainerRef.current
    if (!container) return

    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMediaMounted(true)
          mountObserver.disconnect()
        }
      },
      { rootMargin: '1000px 0px' }
    )
    mountObserver.observe(container)
    return () => mountObserver.disconnect()
  }, [isVideo, mediaMounted])

  // autoplay muet quand la vidéo est bien visible à l'écran, pause sinon (comme Instagram)
  useEffect(() => {
    if (!isVideo || !mediaMounted) return
    const video = videoRef.current
    if (!video) return

    const playObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: [0, 0.6, 1] }
    )
    playObserver.observe(video)
    return () => playObserver.disconnect()
  }, [isVideo, mediaMounted])

  const sortedMedias = allMedias.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const handleCarrouselScroll = () => {
    const el = carrouselRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setCarrouselIndex(Math.max(0, Math.min(sortedMedias.length - 1, index)))
  }

  if (deleted) return null

  return (
    <article className="mb-3 animate-fade-in feed-native">
      <div className="feed-surface overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link to={`/influenceur/${influencer?.id}`} className="flex items-center gap-2 shrink-0">
              <Avatar src={influencer?.users?.photo_url} seed={influencer?.id} size="sm" ring={activeStoryIds.has(influencer?.id)} />
              <div className="flex items-center gap-1">
                <span className="text-[13px] leading-[16px] font-medium">{influencer?.users?.nom_complet}</span>
                {influencer?.verifie && <VerifiedBadge size={12} />}
              </div>
            </Link>

            {isCollabVerifiee && client && (
              <>
                <span className="text-[var(--text-secondary)] opacity-40 shrink-0">|</span>
                <Link to={`/entreprise/${client.id}`} className="flex items-center gap-1 min-w-0">
                  <Avatar src={client.photo_url} seed={client.nom_complet} size="sm" />
                  <span className="text-[13px] leading-[16px] font-medium truncate">{client.nom_complet}</span>
                </Link>
              </>
            )}
          </div>

          {isOwner && (
            <button
              onClick={() => setShowMenu(true)}
              aria-label="Options"
              className="w-9 h-9 -mr-1.5 flex items-center justify-center text-[var(--text-secondary)] shrink-0"
            >
              <MoreHorizontal size={19} />
            </button>
          )}
        </div>

        {/* media */}
        {mediaUrl && (
          <div
            ref={mediaContainerRef}
            className={`w-full ${cropClasses[post.crop_format] || 'aspect-square'} bg-black/20 overflow-hidden relative`}
          >
            {isVideo ? (
              <>
                <button
                  onClick={() => navigate(`/video/${post.id}`)}
                  className="absolute inset-0 w-full h-full block"
                  aria-label="Voir le réel"
                >
                  {/* La miniature réelle (thumbnail_url) s'affiche immédiatement, y compris avant
                      que la balise <video> ne soit montée. Jamais d'icône vidéo grise par défaut :
                      s'il n'y a pas encore de thumbnail (post très ancien sans miniature générée),
                      on affiche simplement le fond neutre, pas un pictogramme. */}
                  {thumbnailUrl && !mediaMounted && (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      loading={priority ? 'eager' : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover"
                      style={{ filter: getFilterCss(post.filtre) }}
                    />
                  )}
                  {mediaMounted && (
                    <video
                      ref={videoRef}
                      src={mediaUrl}
                      poster={thumbnailUrl || undefined}
                      className="w-full h-full object-cover"
                      style={{ filter: getFilterCss(post.filtre) }}
                      muted={muted}
                      loop
                      playsInline
                      preload="metadata"
                    />
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleMute() }}
                  aria-label={muted ? 'Activer le son' : 'Couper le son'}
                  className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </>
            ) : isCarrousel ? (
              <>
                <div
                  ref={carrouselRef}
                  onScroll={handleCarrouselScroll}
                  className="flex w-full h-full overflow-x-auto snap-x snap-mandatory"
                >
                  {sortedMedias.map((m, i) =>
                    m.media_type === 'video' ? (
                      <video
                        key={i}
                        src={m.media_url}
                        poster={m.thumbnail_url || undefined}
                        className="w-full h-full object-cover shrink-0 snap-center"
                        style={{ filter: getFilterCss(post.filtre) }}
                        muted
                        loop
                        playsInline
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <img
                        key={i}
                        src={m.media_url}
                        alt=""
                        loading={priority && i === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="w-full h-full object-cover shrink-0 snap-center"
                        style={{ filter: getFilterCss(post.filtre) }}
                      />
                    )
                  )}
                </div>

                {/* compteur photo visitée / total, façon Instagram */}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[12px] leading-[16px] font-medium">
                  {carrouselIndex + 1}/{sortedMedias.length}
                </div>

                {/* points de progression, fenêtre glissante si beaucoup d'items */}
                <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
                  {(() => {
                    const total = sortedMedias.length
                    const maxDots = 8
                    let start = 0
                    if (total > maxDots) {
                      start = Math.min(Math.max(0, carrouselIndex - Math.floor(maxDots / 2)), total - maxDots)
                    }
                    const visibleCount = Math.min(total, maxDots)
                    return Array.from({ length: visibleCount }).map((_, offset) => {
                      const i = start + offset
                      const active = i === carrouselIndex
                      return (
                        <span
                          key={i}
                          className="rounded-full transition-all duration-200"
                          style={{
                            width: active ? 12 : 5,
                            height: 5,
                            backgroundColor: active ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
              </>
            ) : (
              (() => {
                const cropRectStyle = getCropRectStyle(post)
                return (
                  <div className="w-full h-full relative overflow-hidden" style={cropRectStyle || undefined}>
                    <img
                      src={mediaUrl}
                      alt=""
                      loading={priority ? 'eager' : 'lazy'}
                      decoding="async"
                      className={`w-full h-full ${cropRectStyle ? 'object-contain' : 'object-cover'}`}
                      style={{ filter: getFilterCss(post.filtre) }}
                    />
                  </div>
                )
              })()
            )}
          </div>
        )}

        {/* actions */}
        <div className="flex items-center gap-3.5 px-3 pt-2 flex-wrap">
          <button onClick={toggleLike} className="active:scale-90 transition-transform duration-200">
            <Heart size={23} className={liked ? 'fill-[var(--accent)] text-[var(--accent)]' : ''} strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setShowComments((s) => !s)}
            className="flex items-center gap-1.5 active:scale-90 transition-transform duration-200"
          >
            <MessageCircle size={23} strokeWidth={1.75} />
            {commentCount > 0 && <span className="text-[12px] leading-[15px] font-medium">{commentCount}</span>}
          </button>
          <button className="active:scale-90 transition-transform duration-200">
            <Send size={21} strokeWidth={1.75} />
          </button>

          {lienInstagram && (
            <a
              href={lienInstagram}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 feed-pill rounded-full pl-2.5 pr-3 py-1 text-[12px] leading-[15px] font-medium active:scale-95 transition-transform duration-200"
            >
              Voir sur <InstagramIcon size={12} />
            </a>
          )}
          {lienTiktok && (
            <a
              href={lienTiktok}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 feed-pill rounded-full pl-2.5 pr-3 py-1 text-[12px] leading-[15px] font-medium active:scale-95 transition-transform duration-200"
            >
              Voir sur <TikTokIcon size={12} />
            </a>
          )}
        </div>

        {/* caption */}
        {post.legende && (
          <p className="px-3 pt-1 text-[13px] leading-[16px]" style={{ color: 'var(--text-primary)' }}>
            <span className="font-medium mr-1">{influencer?.users?.nom_complet}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{post.legende}</span>
          </p>
        )}
        {post.created_at && (
          <p className="px-3 pb-2 pt-1 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {timeAgo(post.created_at)}
          </p>
        )}
      </div>

      {showComments && (
        <CommentsSheet
          postId={post.id}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => setCommentCount((c) => c + 1)}
        />
      )}

      {showMenu && (
        <BottomSheet onClose={() => setShowMenu(false)}>
          <button
            onClick={() => { setShowMenu(false); navigate(`/publier/${post.id}/modifier`) }}
            className="w-full flex items-center gap-3 px-5 py-3 text-body"
          >
            <Pencil size={18} /> Modifier la publication
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-3 px-5 py-3 text-body text-[var(--accent)]"
          >
            <Trash2 size={18} /> Supprimer la publication
          </button>
          <button
            onClick={() => setShowMenu(false)}
            className="w-full flex items-center gap-3 px-5 py-3 text-body text-[var(--text-secondary)]"
          >
            <X size={18} /> Annuler
          </button>
        </BottomSheet>
      )}
    </article>
  )
}

// évite les re-renders de toutes les cartes du feed quand une seule change
// (like, pagination qui ajoute des posts, etc.) : ne re-render que si les props
// pertinentes de CETTE carte ont changé.
export default memo(PostCard, (prev, next) => (
  prev.post === next.post &&
  prev.onDeleted === next.onDeleted &&
  prev.autoOpenComments === next.autoOpenComments &&
  prev.priority === next.priority &&
  prev.muted === next.muted &&
  prev.onToggleMute === next.onToggleMute
))
