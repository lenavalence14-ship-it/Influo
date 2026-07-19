import { useEffect, useRef, useState } from 'react'
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

const cropClasses = {
  carre: 'aspect-square',
  horizontal: 'aspect-[4/3]',
  vertical: 'aspect-[2/3]',
  vertical_45: 'aspect-[4/5]',
}

export default function PostCard({ post, onDeleted, autoOpenComments = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [commentCount, setCommentCount] = useState(post.comment_count || 0)
  const [showComments, setShowComments] = useState(autoOpenComments)
  const [showMenu, setShowMenu] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef(null)

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

  const mediaUrl = post.post_medias?.[0]?.media_url
  const isVideo = post.type === 'video' || post.post_medias?.[0]?.media_type === 'video'

  // autoplay muet quand la vidéo est bien visible à l'écran, pause sinon (comme Instagram)
  useEffect(() => {
    if (!isVideo) return
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: [0, 0.6, 1] }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [isVideo])

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
                <div className="flex items-center gap-1 min-w-0">
                  <Avatar src={client.photo_url} seed={client.nom_complet} size="sm" />
                  <span className="text-[13px] leading-[16px] font-medium truncate">{client.nom_complet}</span>
                </div>
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
          <div className={`w-full ${cropClasses[post.crop_format] || 'aspect-square'} bg-black/20 overflow-hidden relative`}>
            {isVideo ? (
              <>
                <button
                  onClick={() => navigate(`/video/${post.id}`)}
                  className="absolute inset-0 w-full h-full block"
                  aria-label="Voir le réel"
                >
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    className="w-full h-full object-cover"
                    muted={muted}
                    loop
                    playsInline
                    preload="metadata"
                  />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMuted((m) => !m) }}
                  aria-label={muted ? 'Activer le son' : 'Couper le son'}
                  className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </>
            ) : (
              <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
        )}

        {/* actions */}
        <div className="flex items-center gap-3.5 px-3 pt-2 flex-wrap">
          <button onClick={toggleLike} className="active:scale-90 transition-transform duration-200">
            <Heart size={23} className={liked ? 'fill-red-500 text-red-500' : ''} strokeWidth={1.75} />
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
            className="w-full flex items-center gap-3 px-5 py-3 text-body text-red-500"
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