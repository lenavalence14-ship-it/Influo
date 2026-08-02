import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { X, Link2, Share2, BookImage } from 'lucide-react'
import * as messagesApi from '../../api/messages'
import { useAuth } from '../../contexts/AuthContext'
import { sendPostToUsers } from '../../lib/sharePost'
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
  const navigate = useNavigate()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([]) // array of user ids
  const [sending, setSending] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!user?.id) return
      const contactsList = await messagesApi.fetchShareContacts(user.id)

      if (!cancelled) {
        setContacts(contactsList)
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

  const nativeShareSupported = typeof navigator !== 'undefined' && Boolean(navigator.share)

  // Partage hors app (WhatsApp, etc.) : Web Share API native du téléphone.
  // On n'envoie QUE l'URL -- l'aperçu avec image (comme Instagram) est
  // généré par WhatsApp lui-même à partir des balises Open Graph que le
  // serveur injecte pour /post/:id (voir server.js), pas par ce bouton.
  const handleNativeShare = async () => {
    if (!nativeShareSupported) return
    try {
      await navigator.share({ url: postUrl })
    } catch {
      // annulé par l'utilisateur, rien à faire
    }
  }

  const [downloadingForNote, setDownloadingForNote] = useState(false)

  // "Ajouter à la note" doit ouvrir le même éditeur photo existant (crop,
  // filtre, texte, musique) que pour n'importe quelle note -- PAS une
  // publication directe : c'est l'utilisateur qui appuie sur "Partager"
  // dans cet éditeur pour publier réellement (voir CreateNote.jsx).
  // On télécharge donc le média du post en fichier local d'abord, puisque
  // l'éditeur/l'upload de note attendent un vrai File, pas une URL distante.
  const handleAddToNote = async () => {
    if (!mediaUrl) return
    setDownloadingForNote(true)
    try {
      const response = await fetch(mediaUrl)
      const blob = await response.blob()
      const file = new File([blob], 'post-partage.jpg', { type: blob.type || 'image/jpeg' })
      onClose()
      navigate('/notes/nouvelle', { state: { sharedFile: file } })
    } catch (err) {
      console.error('Échec téléchargement du média pour la note :', err)
      setDownloadingForNote(false)
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
          <button onClick={handleAddToNote} disabled={downloadingForNote} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
              {downloadingForNote ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              ) : (
                <BookImage size={20} />
              )}
            </div>
            <span className="text-[11px] text-center">Ajouter à la note</span>
          </button>
          <button onClick={handleCopyLink} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
              <Link2 size={20} />
            </div>
            <span className="text-[11px] text-center">{linkCopied ? 'Copié !' : 'Copier le lien'}</span>
          </button>
          <button
            onClick={handleNativeShare}
            disabled={!nativeShareSupported}
            className="flex flex-col items-center gap-1.5 disabled:opacity-40"
          >
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
