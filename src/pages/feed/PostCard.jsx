import { useState } from 'react'
import { Heart, MessageCircle, Send } from 'lucide-react'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'

const cropClasses = {
  carre: 'aspect-square',
  horizontal: 'aspect-[4/3]',
  vertical: 'aspect-[4/5]',
}

export default function PostCard({ post }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [showComments, setShowComments] = useState(false)

  const influencer = post.profils_influenceur

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

  const mediaUrl = post.post_medias?.[0]?.media_url

  return (
    <article className="mb-6 animate-fade-in">
      <div className="glass-strong rounded-3xl overflow-hidden">
        {/* header */}
        <Link to={`/influenceur/${influencer?.id}`} className="flex items-center gap-3 p-4">
          <img
            src={influencer?.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${influencer?.id}`}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm">{influencer?.users?.nom_complet}</span>
            {influencer?.verifie && <VerifiedBadge size={15} />}
          </div>
        </Link>

        {/* media */}
        {mediaUrl && (
          <div className={`w-full ${cropClasses[post.crop_format] || 'aspect-square'} bg-black/20 overflow-hidden`}>
            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* actions */}
        <div className="flex items-center gap-4 px-4 pt-3">
          <button onClick={toggleLike} className="active:scale-90 transition-transform">
            <Heart
              size={24}
              className={liked ? 'fill-red-500 text-red-500' : ''}
              strokeWidth={2}
            />
          </button>
          <button onClick={() => setShowComments((s) => !s)} className="active:scale-90 transition-transform">
            <MessageCircle size={24} strokeWidth={2} />
          </button>
          <button className="active:scale-90 transition-transform">
            <Send size={22} strokeWidth={2} />
          </button>
        </div>

        {/* like count */}
        <p className="px-4 pt-2 text-sm font-medium">{likeCount} j'aime</p>

        {/* caption */}
        {post.legende && (
          <p className="px-4 pt-1 pb-4 text-sm">
            <span className="font-medium mr-1.5">{influencer?.users?.nom_complet}</span>
            {post.legende}
          </p>
        )}

        {showComments && <CommentsSection postId={post.id} />}
      </div>
    </article>
  )
}

function CommentsSection({ postId }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const { user } = useAuth()

  const loadComments = async () => {
    const { data } = await supabase
      .from('post_comments')
      .select('id, contenu, users(nom_complet)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  useState(() => { loadComments() }, [])

  const submitComment = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, contenu: text })
    setText('')
    loadComments()
  }

  return (
    <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-2">
      {comments.map((c) => (
        <p key={c.id} className="text-sm">
          <span className="font-medium mr-1.5">{c.users?.nom_complet}</span>
          {c.contenu}
        </p>
      ))}
      <form onSubmit={submitComment} className="flex gap-2 pt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ajouter un commentaire..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)]"
        />
        <button type="submit" className="text-sm font-medium disabled:opacity-30" disabled={!text.trim()}>
          Publier
        </button>
      </form>
    </div>
  )
}
