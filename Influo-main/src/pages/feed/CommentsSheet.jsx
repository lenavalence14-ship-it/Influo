import { useEffect, useRef, useState } from 'react'
import { X, Heart } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../../components/ui/Avatar'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { useActiveStories } from '../../hooks/useActiveStories'
import { timeAgo } from '../../lib/time'

// Une ligne de commentaire ou de réponse. Les réponses (parent_comment_id renseigné)
// sont affichées en retrait, comme sur Instagram — un seul niveau de profondeur,
// pas de réponses-aux-réponses (toute réponse à une réponse remonte au même parent).
function CommentRow({ c, isReply, onReply, onToggleLike, activeStoryIds }) {
  return (
    <div className={`flex items-start gap-3 ${isReply ? 'ml-11 mt-3' : ''}`}>
      <Avatar
        src={c.users?.photo_url}
        seed={c.id}
        size="sm"
        ring={c.users?.profils_influenceur?.id && activeStoryIds.has(c.users.profils_influenceur.id)}
      />
      <div className="flex-1 min-w-0">
        <p className="text-small-medium flex items-center gap-1.5">
          {c.users?.nom_complet}
          {c.users?.profils_influenceur?.verifie && <VerifiedBadge size={13} />}
        </p>
        <p className="text-small mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.contenu}</p>
        <div className="flex items-center gap-3 mt-1">
          {c.created_at && (
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {timeAgo(c.created_at)}
            </span>
          )}
          {c.like_count > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {c.like_count} j'aime
            </span>
          )}
          <button onClick={() => onReply(c)} className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Répondre
          </button>
        </div>
      </div>
      <button
        onClick={() => onToggleLike(c)}
        aria-label={c.liked_by_me ? 'Ne plus aimer' : "J'aime"}
        className="w-8 h-8 flex items-center justify-center shrink-0 -mt-0.5"
      >
        <Heart
          size={14}
          className={c.liked_by_me ? 'text-[var(--accent)] fill-current' : 'text-[var(--text-secondary)]'}
        />
      </button>
    </div>
  )
}

export default function CommentsSheet({ postId, onClose, onCommentAdded }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState(null) // commentaire racine auquel on répond
  const { user } = useAuth()
  const activeStoryIds = useActiveStories()
  const inputRef = useRef(null)

  const loadComments = async () => {
    const { data } = await supabase
      .from('post_comments')
      .select('id, contenu, created_at, parent_comment_id, user_id, users(nom_complet, photo_url, profils_influenceur(id, verifie))')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    const list = data || []
    const commentIds = list.map((c) => c.id)
    const { data: likes } = commentIds.length
      ? await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
      : { data: [] }

    const enriched = list.map((c) => ({
      ...c,
      like_count: likes?.filter((l) => l.comment_id === c.id).length || 0,
      liked_by_me: likes?.some((l) => l.comment_id === c.id && l.user_id === user?.id) || false,
    }))

    setComments(enriched)
    setLoading(false)
  }

  useEffect(() => {
    loadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const submitComment = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const contenu = replyTo ? `@${replyTo.users?.nom_complet} ${text}` : text
    setText('')
    const activeReply = replyTo
    setReplyTo(null)
    await supabase.from('post_comments').insert({
      post_id: postId,
      user_id: user.id,
      contenu,
      parent_comment_id: activeReply?.id || null,
    })
    onCommentAdded?.()
    loadComments()
  }

  const toggleLike = async (c) => {
    const wasLiked = c.liked_by_me
    setComments((prev) =>
      prev.map((item) =>
        item.id === c.id
          ? { ...item, liked_by_me: !wasLiked, like_count: item.like_count + (wasLiked ? -1 : 1) }
          : item
      )
    )
    if (wasLiked) {
      await supabase.from('comment_likes').delete().match({ comment_id: c.id, user_id: user.id })
    } else {
      await supabase.from('comment_likes').insert({ comment_id: c.id, user_id: user.id })
    }
  }

  const startReply = (c) => {
    // Une réponse à une réponse s'accroche toujours au commentaire racine (parent
    // au premier niveau), pas à la réponse elle-même — un seul niveau de profondeur.
    setReplyTo(c.parent_comment_id ? comments.find((x) => x.id === c.parent_comment_id) || c : c)
    inputRef.current?.focus()
  }

  const rootComments = comments.filter((c) => !c.parent_comment_id)
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parent_comment_id) {
      if (!acc[c.parent_comment_id]) acc[c.parent_comment_id] = []
      acc[c.parent_comment_id].push(c)
    }
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-[var(--bg-elevated)] rounded-t-2xl flex flex-col h-[75vh] animate-slide-up">
        <div className="flex items-center justify-center relative py-3 border-b border-[var(--border)] shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-[var(--border)]" />
          <span className="text-body-medium mt-2">Commentaires</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center"
          >
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
          ) : rootComments.length === 0 ? (
            <p className="text-center text-caption py-10">
              Aucun commentaire. Sois le premier à commenter.
            </p>
          ) : (
            rootComments.map((c) => (
              <div key={c.id}>
                <CommentRow c={c} isReply={false} onReply={startReply} onToggleLike={toggleLike} activeStoryIds={activeStoryIds} />
                {(repliesByParent[c.id] || []).map((r) => (
                  <CommentRow key={r.id} c={r} isReply onReply={startReply} onToggleLike={toggleLike} activeStoryIds={activeStoryIds} />
                ))}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={submitComment}
          className="flex flex-col gap-1.5 px-4 py-3 border-t border-[var(--border)] shrink-0"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          {replyTo && (
            <div className="flex items-center justify-between text-[11px] px-1" style={{ color: 'var(--text-secondary)' }}>
              <span>Réponse à {replyTo.users?.nom_complet}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="font-medium">
                Annuler
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyTo ? `Répondre à ${replyTo.users?.nom_complet}...` : 'Ajouter un commentaire...'}
              autoFocus
              className="flex-1 h-11 rounded-full px-4 glass text-body outline-none placeholder:text-[var(--text-secondary)]"
            />
            <button
              type="submit"
              className="text-body-medium disabled:opacity-30 shrink-0 px-2 h-11"
              disabled={!text.trim()}
            >
              Publier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}