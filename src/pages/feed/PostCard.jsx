import { useState } from 'react'
import { Heart, MessageCircle, Send, MoreHorizontal, X, Trash2, Pencil } from 'lucide-react'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'
import CommentsSheet from './CommentsSheet'

const cropClasses = {
  carre: 'aspect-square',
  horizontal: 'aspect-[4/3]',
  vertical: 'aspect-[4/5]',
}

export default function PostCard({ post, onDeleted }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [legende, setLegende] = useState(post.legende || '')
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

  const handleSaveLegende = async () => {
    await supabase.from('posts').update({ legende }).eq('id', post.id)
    setEditing(false)
    setShowMenu(false)
  }

  const mediaUrl = post.post_medias?.[0]?.media_url

  if (deleted) return null

  return (
    <article className="mb-6 animate-fade-in">
      <div className="glass-strong rounded-3xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between p-4">
          <Link to={`/influenceur/${influencer?.id}`} className="flex items-center gap-3">
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

          {isOwner && (
            <button onClick={() => setShowMenu(true)} className="p-1.5 -mr-1.5 text-[var(--text-secondary)]">
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
        {editing ? (
          <div className="px-4 pt-1 pb-4">
            <textarea
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              rows={2}
              className="w-full rounded-2xl px-3 py-2 glass outline-none resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSaveLegende} className="text-xs font-semibold">Enregistrer</button>
              <button onClick={() => { setEditing(false); setLegende(post.legende || '') }} className="text-xs text-[var(--text-secondary)]">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          legende && (
            <p className="px-4 pt-1 pb-4 text-sm">
              <span className="font-medium mr-1.5">{influencer?.users?.nom_complet}</span>
              {legende}
            </p>
          )
        )}
      </div>

      {showComments && <CommentsSheet postId={post.id} onClose={() => setShowComments(false)} />}

      {showMenu && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMenu(false)} />
          <div className="relative bg-[var(--bg-elevated)] rounded-t-3xl pb-6 animate-slide-up" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border-subtle)]" />
            </div>
            <button
              onClick={() => { setEditing(true); setShowMenu(false) }}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-sm"
            >
              <Pencil size={18} /> Modifier la légende
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-red-500"
            >
              <Trash2 size={18} /> Supprimer la publication
            </button>
            <button
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-[var(--text-secondary)]"
            >
              <X size={18} /> Annuler
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
