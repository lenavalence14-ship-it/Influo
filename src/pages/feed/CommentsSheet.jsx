import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function CommentsSheet({ postId, onClose }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const loadComments = async () => {
    const { data } = await supabase
      .from('post_comments')
      .select('id, contenu, created_at, users(nom_complet, photo_url)')
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
    loadComments()
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* sheet */}
      <div className="relative bg-[var(--bg-elevated)] rounded-t-3xl flex flex-col h-[75vh] animate-slide-up">
        <div className="flex items-center justify-center relative py-3 border-b border-[var(--border-subtle)] shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-10 h-1 rounded-full bg-[var(--border-subtle)]" />
          <span className="text-sm font-semibold mt-1">Commentaires</span>
          <button onClick={onClose} className="absolute right-4 top-1/2 -translate-y-1/2 p-1">
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-secondary)] py-10">
              Aucun commentaire. Sois le premier à commenter.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <img
                  src={c.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${c.id}`}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium mr-1.5">{c.users?.nom_complet}</span>
                    {c.contenu}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={submitComment}
          className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter un commentaire..."
            autoFocus
            className="flex-1 rounded-full px-4 py-2.5 glass text-sm outline-none placeholder:text-[var(--text-secondary)]"
          />
          <button
            type="submit"
            className="text-sm font-semibold disabled:opacity-30 shrink-0 px-2"
            disabled={!text.trim()}
          >
            Publier
          </button>
        </form>
      </div>
    </div>
  )
}
