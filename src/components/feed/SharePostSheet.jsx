import { useEffect, useState } from 'react'
import { X, Link2, Share2, BookImage } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sendPostToUsers, shareToNote } from '../../lib/sharePost'
import Avatar from '../ui/Avatar'

const MAX_RECIPIENTS = 5

// Feuille de partage d'un post (bouton avion en papier de PostCard.jsx).
// Liste de contacts = abonnements + abonnés (follows) UNION utilisateurs
// avec qui une conversation sociale existe déjà -- dédupliquée -- comme
// demandé (les deux sources, pas une seule).
//
// mediaUrl / postId / author sont fournis par PostCard (déjà résolus là-bas
// depuis post_medias / profils_influenceur / utilisateur, pas re-fetchés
// ici pour éviter une requête redondante).
export default function SharePostSheet({ postId, mediaUrl, onClose }) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([]) // array of user ids
  const [sending, setSending] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!user?.id) return
      const [{ data: following }, { data: followers }, { data: convos }] = await Promise.all([
        supabase.from('follows').select('users:followed_id(id, nom_complet, photo_url)').eq('follower_id', user.id),
        supabase.from('follows').select('users:follower_id(id, nom_complet, photo_url)').eq('followed_id', user.id),
        supabase
          .from('conversations_sociale')
          .select('user_a:user_a_id(id, nom_complet, photo_url), user_b:user_b_id(id, nom_complet, photo_url)')
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
      ])

      const byId = new Map()
      const addContact = (u) => {
        if (u && u.id !== user.id && !byId.has(u.id)) byId.set(u.id, u)
      }
      following?.forEach((f) => addContact(f.users))
      followers?.forEach((f) => addContact(f.users))
      convos?.forEach((c) => {
        addContact(c.user_a)
        addContact(c.user_b)
      })

      if (!cancelled) {
        setContacts(Array.from(byId.values()))
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const toggleSelect = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_RECIPIENTS) return prev // max 5, on ignore le tap au-delà
      return [...prev, id]
    })
  }

  const postUrl = `${window.location.origin}/post/${postId}`

  const handleCopyLink = async () => {
    await navigator.clipboard?.writeText(postUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  // Partage hors app (WhatsApp, etc.) : Web Share API native du téléphone,
  // envoie juste le lien -- pas d'intégration API WhatsApp comme précisé
  // ("j'ai pas d'api WhatsApp").
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url: postUrl })
      } catch {
        // annulé par l'utilisateur, rien à faire
      }
    } else {
      handleCopyLink()
    }
  }

  const handleAddToNote = async () => {
    if (!user?.id || !mediaUrl) return
    setSending(true)
    try {
      await shareToNote({ myId: user.id, mediaUrl })
      onClose()
    } catch (err) {
      console.error('Échec ajout à la note :', err)
    } finally {
      setSending(false)
    }
  }

  const handleSend = async () => {
    if (!user?.id || selected.length === 0) return
    setSending(true)
    try {
      await sendPostToUsers({ myId: user.id, otherUserIds: selected, postId })
      onClose()
    } catch (err) {
      console.error('Échec envoi partage :', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative glass-strong rounded-t-3xl max-h-[80vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-body font-medium">Partager</span>
          <button onClick={onClose} className="p-1">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center text-caption text-[var(--text-secondary)] py-10">
              Aucun contact à afficher pour l'instant.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-y-4 py-2">
              {contacts.map((c) => {
                const isSelected = selected.includes(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleSelect(c.id)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="relative">
                      <Avatar src={c.photo_url} seed={c.id} size="lg" />
                      {isSelected && (
                        <div
                          className="absolute inset-0 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(0,0,0,0.45)' }}
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px]"
                            style={{ background: 'var(--accent)' }}
                          >
                            ✓
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] truncate max-w-[64px] text-center">{c.nom_complet}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selected.length > 0 && (
          <div className="px-4 py-2">
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full rounded-2xl py-3 text-body font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {sending ? 'Envoi…' : `Envoyer (${selected.length}/${MAX_RECIPIENTS})`}
            </button>
          </div>
        )}

        <div className="flex justify-around items-center px-4 py-4 border-t border-white/10">
          <button onClick={handleAddToNote} disabled={sending} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
              <BookImage size={20} />
            </div>
            <span className="text-[11px] text-center">Ajouter à la note</span>
          </button>
          <button onClick={handleCopyLink} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
              <Link2 size={20} />
            </div>
            <span className="text-[11px] text-center">{linkCopied ? 'Copié !' : 'Copier le lien'}</span>
          </button>
          <button onClick={handleNativeShare} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
              <Share2 size={20} />
            </div>
            <span className="text-[11px] text-center">Partager</span>
          </button>
        </div>
      </div>
    </div>
  )
}
