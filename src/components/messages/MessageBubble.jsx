import { useEffect, useRef, useState } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { timeShort } from '../../lib/time'

const EDIT_WINDOW_MS = 2 * 60 * 1000 // 2 minutes, comme convenu

/**
 * Bulle de message réutilisable (Chat / ChatPro / ChatBiz / ChatSociale).
 * Gère : affichage "Vous"-free (le préfixe reste dans la liste, pas ici),
 * appui long -> menu contextuel ancré sur place façon WhatsApp,
 * modifier (fenêtre de 2 min après l'envoi), supprimer pour moi / pour tous,
 * indicateur "modifié" grisé, et l'état "vu" (avatar sous la dernière bulle).
 *
 * Props attendues :
 * - message: { id, sender_id, contenu, fichier_url, fichier_type, created_at,
 *              edited_at, deleted_for, is_deleted_for_all, is_system }
 * - isMe: bool
 * - myId: uuid de l'utilisateur courant (pour deleted_for)
 * - seenByOther: bool (avatar "vu")
 * - otherPhotoUrl / seedId: pour l'avatar "vu"
 * - onEdit(message, newContent): async
 * - onDeleteForMe(message): async
 * - onDeleteForEveryone(message): async
 */
export default function MessageBubble({
  message,
  isMe,
  myId,
  seenByOther,
  otherPhotoUrl,
  seedId,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.contenu || '')
  const pressTimer = useRef(null)
  const bubbleRef = useRef(null)

  // Un message supprimé "pour moi" ne doit jamais s'afficher chez moi, quel
  // que soit son état chez l'autre — deleted_for est propre à chaque personne.
  const hiddenForMe = message.deleted_for?.includes(myId)
  if (hiddenForMe) return null

  const isDeleted = message.is_deleted_for_all
  const canEdit = isMe && !isDeleted && Date.now() - new Date(message.created_at).getTime() < EDIT_WINDOW_MS

  const startPress = () => {
    if (isDeleted) return
    pressTimer.current = setTimeout(() => setMenuOpen(true), 450)
  }
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutside = (e) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('touchstart', closeOnOutside)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('touchstart', closeOnOutside)
    }
  }, [menuOpen])

  const handleCopy = () => {
    if (message.contenu) navigator.clipboard?.writeText(message.contenu)
    setMenuOpen(false)
  }

  const handleEditStart = () => {
    setEditValue(message.contenu || '')
    setEditing(true)
    setMenuOpen(false)
  }

  const handleEditSubmit = async () => {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === message.contenu) {
      setEditing(false)
      return
    }
    await onEdit?.(message, trimmed)
    setEditing(false)
  }

  const handleDeleteForMe = async () => {
    setMenuOpen(false)
    await onDeleteForMe?.(message)
  }

  const handleDeleteForEveryone = async () => {
    setMenuOpen(false)
    await onDeleteForEveryone?.(message)
  }

  if (message.is_system) {
    return (
      <div className="flex justify-center">
        <div className="glass rounded-2xl px-4 py-2 text-caption text-center text-[var(--text-secondary)] max-w-[85%]">
          {message.contenu}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
      <div ref={bubbleRef} className="relative max-w-[75%]">
        {message.reply_to_note_id && !isDeleted && (
          <div
            className={`mb-1 rounded-xl px-3 py-1.5 text-caption italic opacity-80 border-l-2 ${
              isMe ? 'border-white/50' : 'border-[var(--accent)]'
            }`}
            style={{ background: 'rgba(128,128,128,0.12)' }}
          >
            Réponse à la note : {message.reply_to_note_contenu || '…'}
          </div>
        )}
        {editing ? (
          <div className="flex flex-col gap-1.5 min-w-[220px]">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSubmit()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="glass rounded-2xl px-3.5 py-2.5 text-body outline-none w-full"
            />
            <div className="flex gap-2 justify-end text-caption">
              <button onClick={() => setEditing(false)} className="text-[var(--text-secondary)] px-2 py-1">
                Annuler
              </button>
              <button onClick={handleEditSubmit} style={{ color: 'var(--accent)' }} className="px-2 py-1">
                Enregistrer
              </button>
            </div>
          </div>
        ) : (
          <div
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            className={`rounded-2xl px-3.5 py-2.5 text-body select-none ${
              isDeleted
                ? 'italic text-[var(--text-secondary)] glass'
                : isMe
                ? 'bg-[var(--accent)] text-white'
                : 'glass'
            }`}
          >
            {isDeleted ? (
              'Ce message a été supprimé'
            ) : (
              <>
                {message.fichier_url && message.fichier_type === 'image' ? (
                  <img src={message.fichier_url} alt="" className="rounded-xl mb-1 max-w-full" />
                ) : message.fichier_url ? (
                  <a href={message.fichier_url} target="_blank" rel="noreferrer" className="underline">
                    Fichier joint
                  </a>
                ) : null}
                {message.contenu}
              </>
            )}
          </div>
        )}

        {/* menu contextuel ancré sur la bulle, façon WhatsApp */}
        {menuOpen && (
          <div
            className={`absolute z-30 glass-strong rounded-xl overflow-hidden py-1 min-w-[170px] top-full mt-1 ${
              isMe ? 'right-0' : 'left-0'
            }`}
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
          >
            {message.contenu && (
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-body text-left hover:bg-white/5"
              >
                <Copy size={16} /> Copier
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleEditStart}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-body text-left hover:bg-white/5"
              >
                <Pencil size={16} /> Modifier
              </button>
            )}
            {isMe && (
              <button
                onClick={handleDeleteForEveryone}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-body text-left hover:bg-white/5"
                style={{ color: '#e33' }}
              >
                <Trash2 size={16} /> Supprimer pour tous
              </button>
            )}
            <button
              onClick={handleDeleteForMe}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-body text-left hover:bg-white/5"
              style={{ color: '#e33' }}
            >
              <Trash2 size={16} /> Supprimer pour moi
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-1 px-1">
        {message.created_at && (
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {timeShort(message.created_at)}
          </span>
        )}
        {!isDeleted && message.edited_at && (
          <span className="text-[11px] italic" style={{ color: 'var(--text-secondary)' }}>
            modifié
          </span>
        )}
      </div>

      {seenByOther && (
        <img
          src={otherPhotoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${seedId}`}
          alt="Vu"
          className="w-4 h-4 rounded-full object-cover mt-0.5"
        />
      )}
    </div>
  )
}
