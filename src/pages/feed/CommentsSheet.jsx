import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../../components/ui/Avatar'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

export default function CommentsSheet({ postId, onClose, onCommentAdded }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const loadComments = async () => {
    const { data } = await supabase
      .from('post_comments')
      .select('id, contenu, created_at, users(nom_complet, photo_url, profils_influenceur(verifie))')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadComments()
  }, [postId])

  const submitComment = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const contenu = text
    setText('')
    await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, contenu })
    onCommentAdded?.()
    loadComments()
  }

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
          ) : comments.length === 0 ? (
            <p className="text-center text-caption py-10">
              Aucun commentaire. Sois le premier à commenter.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <Avatar src={c.users?.photo_url} seed={c.id} size="sm" />
                <div className="flex-1">
                  <p className="text-small-medium flex items-center gap-1.5">
                    {c.users?.nom_complet}
                    {c.users?.profils_influenceur?.[0]?.verifie && <VerifiedBadge size={13} />}
                  </p>
                  <p className="text-small mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.contenu}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={submitComment}
          className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)] shrink-0"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter un commentaire..."
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
        </form>
      </div>
    </div>
  )
}