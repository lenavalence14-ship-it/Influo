import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Heart, Repeat2, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { timeAgo } from '../../lib/time'

// Viewer plein écran pour une note texte (façon Facebook "Nouvelle note").
// - Like : tout le monde, peu importe le rôle. Notifie le propriétaire de LA
//   NOTE OUVERTE (si c'est un repost, c'est le republieur qui est notifié,
//   puisque c'est sa note à lui qu'on regarde).
// - Répondre : seulement si viewer.role === auteur.role (même rôle). Ouvre le
//   chat correspondant au rôle (sociale / biz / influenceur) avec le contexte
//   de réponse à la note.
// - Republier : tout le monde, peu importe le rôle. Crée une nouvelle ligne
//   `notes` (repost_of = note originale) + une ligne note_reposts (traçabilité)
//   + notifie l'auteur ORIGINAL.
export default function NoteViewer({ entries, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [reposted, setReposted] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const current = entries[index]
  const note = current?.entry
  const author = current?.original?.users

  useEffect(() => {
    if (!note) return
    let cancelled = false
    const load = async () => {
      const { count } = await supabase
        .from('note_likes')
        .select('id', { count: 'exact', head: true })
        .eq('note_id', note.id)
      const { data: mine } = await supabase
        .from('note_likes')
        .select('id')
        .eq('note_id', note.id)
        .eq('user_id', user?.id)
        .maybeSingle()
      const { data: myRepost } = await supabase
        .from('note_reposts')
        .select('id')
        .eq('note_id', note.id)
        .eq('user_id', user?.id)
        .maybeSingle()
      if (!cancelled) {
        setLikeCount(count || 0)
        setLiked(!!mine)
        setReposted(!!myRepost)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [note?.id, user?.id])

  if (!current || !note) return null

  const sameRole = profile?.role && author?.role && profile.role === author.role && note.user_id !== user?.id
  const isMine = note.user_id === user?.id

  const handleLike = async () => {
    if (liked) {
      setLiked(false)
      setLikeCount((c) => Math.max(0, c - 1))
      await supabase.from('note_likes').delete().eq('note_id', note.id).eq('user_id', user.id)
      return
    }
    setLiked(true)
    setLikeCount((c) => c + 1)
    await supabase.from('note_likes').insert({ note_id: note.id, user_id: user.id })
    if (!isMine) {
      await supabase.from('notifications').insert({
        user_id: note.user_id,
        type: 'note_like',
        contenu: `${profile?.nom_complet || 'Quelqu\u2019un'} a aimé ta note`,
        lien_ref_id: note.id,
        from_user_id: user.id,
      })
    }
  }

  const handleRepost = async () => {
    if (reposted || isMine) return
    setReposted(true)
    const originalId = current.original.id
    const { error } = await supabase.from('notes').insert({
      user_id: user.id,
      contenu: current.original.contenu,
      repost_of: originalId,
      expire_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    if (error) {
      setReposted(false)
      return
    }
    await supabase.from('note_reposts').insert({ note_id: originalId, user_id: user.id })
    await supabase.from('notifications').insert({
      user_id: current.original.user_id,
      type: 'note_repost',
      contenu: `${profile?.nom_complet || 'Quelqu\u2019un'} a republié ta note`,
      lien_ref_id: originalId,
      from_user_id: user.id,
    })
  }

  const handleReply = async () => {
    if (!replyText.trim() || !sameRole || sending) return
    setSending(true)
    const role = profile.role
    const table =
      role === 'influenceur' ? 'conversations_influenceur' : role === 'client' ? 'conversations_biz' : 'conversations_sociale'
    const aField = role === 'client' ? 'client_a_id' : 'user_a_id'
    const bField = role === 'client' ? 'client_b_id' : 'user_b_id'

    // conversations_biz référence profils_client.id, pas users.id directement :
    // il faut résoudre les deux profils_client avant de chercher/créer la conversation.
    let myId = user.id
    let otherId = note.user_id
    if (role === 'client') {
      const [{ data: myClientProfile }, { data: otherClientProfile }] = await Promise.all([
        supabase.from('profils_client').select('id').eq('user_id', user.id).maybeSingle(),
        supabase.from('profils_client').select('id').eq('user_id', note.user_id).maybeSingle(),
      ])
      if (!myClientProfile || !otherClientProfile) {
        setSending(false)
        return
      }
      myId = myClientProfile.id
      otherId = otherClientProfile.id
    }

    // Cherche une conversation existante dans les deux sens
    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .or(`and(${aField}.eq.${myId},${bField}.eq.${otherId}),and(${aField}.eq.${otherId},${bField}.eq.${myId})`)
      .maybeSingle()

    let conversationId = existing?.id
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from(table)
        .insert({ [aField]: myId, [bField]: otherId })
        .select()
        .single()
      if (error || !created) {
        setSending(false)
        return
      }
      conversationId = created.id
    }

    const messagesTable =
      role === 'influenceur' ? 'messages_influenceur' : role === 'client' ? 'messages_biz' : 'messages_sociale'

    await supabase.from(messagesTable).insert({
      conversation_id: conversationId,
      sender_id: user.id,
      contenu: replyText.trim(),
      is_system: false,
      reply_to_note_id: current.original.id,
      reply_to_note_contenu: current.original.contenu,
    })
    await supabase.from(table).update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

    setSending(false)
    setReplyText('')
    const route =
      role === 'influenceur' ? `/messages/influenceur/${conversationId}` : role === 'client' ? `/messages/biz/${conversationId}` : `/messages/sociale/${conversationId}`
    onClose()
    navigate(route)
  }

  const goNext = () => {
    if (index < entries.length - 1) setIndex(index + 1)
    else onClose()
  }
  const goPrev = () => {
    if (index > 0) setIndex(index - 1)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--accent, #7c1a3a)' }}
    >
      <div className="flex gap-1 px-3 pt-3">
        {entries.map((_, i) => (
          <div key={i} className="flex-1 h-[2.5px] rounded-full bg-white/25 overflow-hidden">
            {i < index && <div className="h-full bg-white" />}
            {i === index && <div className="h-full bg-white" style={{ animation: 'noteProgress 5s linear forwards' }} />}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative shrink-0">
          <img
            src={author?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${author?.id}`}
            alt=""
            className="w-9 h-9 rounded-full object-cover"
          />
          {current.kind === 'repost' && current.reposter && (
            <img
              src={current.reposter.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${current.reposter.id}`}
              alt=""
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover border-2"
              style={{ borderColor: 'var(--accent, #7c1a3a)' }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-medium text-white truncate">
            {current.kind === 'repost' && current.reposter
              ? `${author?.nom_complet} & ${current.reposter.nom_complet}`
              : author?.nom_complet}
          </p>
          <p className="text-caption text-white/70">
            {current.kind === 'repost' ? 'a republié · ' : ''}
            {timeAgo(note.created_at)}
          </p>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-white">
          <X size={22} />
        </button>
      </div>

      {/* zones invisibles pour naviguer précédent / suivant, comme les stories classiques */}
      <div className="flex-1 relative flex items-center justify-center px-8" onClick={(e) => {
        const x = e.clientX
        if (x < window.innerWidth / 2) goPrev()
        else goNext()
      }}>
        <p className="text-white text-2xl font-medium text-center leading-snug break-words">
          {current.original.contenu}
        </p>
      </div>

      <div className="px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 flex flex-col gap-2.5">
        {sameRole && (
          <div className="flex items-center gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === 'Enter' && handleReply()}
              placeholder="Répondre à la note…"
              className="flex-1 bg-white/15 text-white placeholder-white/60 rounded-full px-4 h-10 outline-none text-body"
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleReply()
              }}
              disabled={!replyText.trim() || sending}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 disabled:opacity-40 text-white shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-5 text-white">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleLike()
            }}
            className="flex items-center gap-1.5"
          >
            <Heart size={22} fill={liked ? 'white' : 'none'} />
            {likeCount > 0 && <span className="text-caption">{likeCount}</span>}
          </button>
          {!isMine && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRepost()
              }}
              disabled={reposted}
              className="flex items-center gap-1.5 disabled:opacity-50"
            >
              <Repeat2 size={22} />
              <span className="text-caption">{reposted ? 'Republié' : 'Republier'}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
