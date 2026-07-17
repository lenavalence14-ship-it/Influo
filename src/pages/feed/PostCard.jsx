import { useState } from 'react'
import { Heart, MessageCircle, Send, MoreHorizontal, X, Trash2, Pencil } from 'lucide-react'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import Card from '../../components/ui/Card'
import Avatar from '../../components/ui/Avatar'
import BottomSheet from '../../components/ui/BottomSheet'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import CommentsSheet from './CommentsSheet'

const cropClasses = {
  carre: 'aspect-square',
  horizontal: 'aspect-[4/3]',
  vertical: 'aspect-[4/5]',
}

export default function PostCard({ post, onDeleted }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const influencer = post.profils_influenceur
  const isOwner = influencer?.user_id === user?.id

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

  if (deleted) return null

  return (
    <article className="mb-6 animate-fade-in">
      <Card variant="strong">
        {/* header */}
        <div className="flex items-center justify-between p-4">
          <Link to={`/influenceur/${influencer?.id}`} className="flex items-center gap-3">
            <Avatar src={influencer?.users?.photo_url} seed={influencer?.id} size="md" />
            <div className="flex items-center gap-2">
              <span className="text-small-medium">{influencer?.users?.nom_complet}</span>
              {influencer?.verifie && <VerifiedBadge size={15} />}
            </div>
          </Link>

          {isOwner && (
            <button
              onClick={() => setShowMenu(true)}
              aria-label="Options"
              className="w-11 h-11 -mr-2 flex items-center justify-center text-[var(--text-secondary)]"
            >
              <MoreHorizontal size={20} />
            </button>
          )}
        </div>

        {/* media */}
        {mediaUrl && (
          <div className={`w-full ${cropClasses[post.crop_format] || 'aspect-square'} bg-black/20 overflow-hidden`}>
            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* actions */}
        <div className="flex items-center gap-4 px-4 pt-3">
          <button onClick={toggleLike} className="active:scale-90 transition-transform duration-200">
            <Heart size={24} className={liked ? 'fill-red-500 text-red-500' : ''} strokeWidth={2} />
          </button>
          <button onClick={() => setShowComments((s) => !s)} className="active:scale-90 transition-transform duration-200">
            <MessageCircle size={24} strokeWidth={2} />
          </button>
          <button className="active:scale-90 transition-transform duration-200">
            <Send size={22} strokeWidth={2} />
          </button>
        </div>

        {/* like count */}
        <p className="px-4 pt-2 text-small-medium">{likeCount} j'aime</p>

        {/* caption */}
        {post.legende && (
          <p className="px-4 pt-1 pb-4 text-small">
            <span className="text-small-medium mr-1.5">{influencer?.users?.nom_complet}</span>
            {post.legende}
          </p>
        )}
      </Card>

      {showComments && <CommentsSheet postId={post.id} onClose={() => setShowComments(false)} />}

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
