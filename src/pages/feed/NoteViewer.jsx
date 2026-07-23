import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Heart, Repeat2, Send, Eye, ArrowLeft, MoreVertical } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { timeAgo } from '../../lib/time'
import { profileRoute } from '../../lib/profileRoute'

const SEGMENT_DURATION_MS = 5000

// Viewer plein écran pour les notes texte, façon statuts texte WhatsApp.
//
// STRUCTURE : `groups` est une liste de groupes, un groupe = une personne +
// la liste de ses items actifs (notes perso et/ou reposts qu'elle a faits),
// triés du plus ancien au plus récent. Le viewer se déplace :
//   - de SEGMENT en SEGMENT à l'intérieur d'un groupe (auto-défilement),
//   - de GROUPE en GROUPE une fois tous les segments du groupe épuisés.
// La barre de progression en haut ne représente QUE les segments du groupe
// courant (jamais le total de toutes les personnes).
//
// AUTO-DÉFILEMENT : chaque segment dure SEGMENT_DURATION_MS. À la fin, passage
// automatique au segment/groupe suivant. Appui long (pointerdown maintenu)
// met en pause l'anim ET le timer ; relâcher (pointerup / pointerleave)
// reprend exactement là où c'était (comme WhatsApp/Instagram).
//
// VUES : quand je regarde une note qui n'est pas la mienne, j'enregistre une
// vue dans note_views (idempotent, une fois par personne/note). Si c'est ma
// note, un bouton "Vu par X" ouvre la liste des vues.
//
// VUES SUR REPOST vs ORIGINAL : les vues comptabilisées sur l'item ORIGINAL
// (isMine sur une note originale) = vues reçues directement sur l'original +
// somme des vues reçues sur tous ses reposts (cumulé, façon WhatsApp/Insta
// "vues totales du statut"). Les vues comptabilisées sur un REPOST (isMine
// sur un repost) = uniquement les vues reçues sur CE repost précis, pas
// celles de l'original ni des autres reposts.
//
// Like : tout le monde, peu importe le rôle. Notifie le propriétaire de
// L'ITEM OUVERT (si repost, le republieur est notifié).
// Répondre : seulement si viewer.role === auteur.role (même rôle).
// Republier : tout le monde, peu importe le rôle, sauf soi-même. Crée une
// nouvelle ligne notes (repost_of = note ORIGINALE, pas le repost qu'on
// regarde) + note_reposts + notifie l'auteur ORIGINAL. Le nouvel item
// apparaît dans LA BARRE DE TOUT LE MONDE (pas seulement pour la personne
// depuis laquelle on a republié) puisque NoteBar affiche tous les items de
// tous les utilisateurs.
export default function NoteViewer({ groups, startGroupIndex, onClose }) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progressKey, setProgressKey] = useState(0) // force le redémarrage de l'anim CSS
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [reposted, setReposted] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [showViewers, setShowViewers] = useState(false)
  const [viewersList, setViewersList] = useState([])
  const [viewCount, setViewCount] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const timerRef = useRef(null)
  const remainingRef = useRef(SEGMENT_DURATION_MS)
  const startedAtRef = useRef(0)

  const group = groups[groupIndex]
  const items = group?.items || []
  const current = items[segmentIndex]
  const note = current?.entry
  const author = current?.original?.users

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const goNextSegment = useCallback(() => {
    clearTimer()
    if (segmentIndex < items.length - 1) {
      setSegmentIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1)
      setSegmentIndex(0)
    } else {
      onClose()
    }
  }, [segmentIndex, items.length, groupIndex, groups.length, onClose])

  const goPrevSegment = useCallback(() => {
    clearTimer()
    if (segmentIndex > 0) {
      setSegmentIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex((g) => g - 1)
      setSegmentIndex(Math.max(0, (prevGroup?.items?.length || 1) - 1))
    }
  }, [segmentIndex, groupIndex, groups])

  // Démarre / redémarre le timer d'auto-défilement à chaque changement de
  // segment ou de groupe (segment neuf = durée pleine).
  useEffect(() => {
    remainingRef.current = SEGMENT_DURATION_MS
    setProgressKey((k) => k + 1)
    if (!paused) {
      startedAtRef.current = Date.now()
      clearTimer()
      timerRef.current = setTimeout(goNextSegment, SEGMENT_DURATION_MS)
    }
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, segmentIndex])

  const handlePauseStart = () => {
    if (paused) return
    setPaused(true)
    clearTimer()
    const elapsed = Date.now() - startedAtRef.current
    remainingRef.current = Math.max(0, remainingRef.current - elapsed)
  }

  const handlePauseEnd = () => {
    if (!paused) return
    setPaused(false)
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(goNextSegment, remainingRef.current)
  }

  // Charge like/repost/vues à chaque changement d'item affiché, et
  // enregistre une vue si ce n'est pas ma propre note.
  useEffect(() => {
    if (!note) return
    let cancelled = false
    const isMine = note.user_id === user?.id

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

      if (isMine) {
        // Mes vues : sur un repost -> uniquement ses propres vues.
        // Sur une note originale -> ses vues + celles de tous ses reposts.
        let noteIds = [note.id]
        if (!note.repost_of) {
          const { data: reposts } = await supabase.from('notes').select('id').eq('repost_of', note.id)
          if (reposts?.length) noteIds = [note.id, ...reposts.map((r) => r.id)]
        }
        const { data: views } = await supabase
          .from('note_views')
          .select('user_id, created_at, users(id, nom_complet, photo_url)')
          .in('note_id', noteIds)
          .order('created_at', { ascending: false })
        if (!cancelled) {
          setViewCount(views?.length || 0)
          setViewersList(views || [])
        }
      } else if (user?.id) {
        await supabase
          .from('note_views')
          .upsert({ note_id: note.id, user_id: user.id }, { onConflict: 'note_id,user_id', ignoreDuplicates: true })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [note?.id, user?.id])

  if (!current || !note) return null

  const isMine = note.user_id === user?.id

  const myRole = profile?.role
  const theirRole = author?.role
  const canReply =
    !isMine &&
    myRole &&
    theirRole &&
    (myRole === theirRole || myRole === 'client' || theirRole === 'client')

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

  const handleDelete = async () => {
    if (!isMine) return
    clearTimer()
    await supabase.from('notes').delete().eq('id', note.id)
    // Retire l'item localement et avance ; si c'était le dernier segment du
    // dernier groupe, ferme le viewer.
    if (items.length > 1) {
      goNextSegment()
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1)
      setSegmentIndex(0)
    } else {
      onClose()
    }
  }

  const handleReply = async (textOverride) => {
    const messageText = (textOverride ?? replyText).trim()
    if (!messageText || !canReply || sending) return
    setSending(true)

    const myRole = profile.role
    const theirRole = author.role
    const otherUserId = note.user_id

    let table, messagesTable, aField, bField, myId, otherId, conversationId

    if (myRole === theirRole) {
      myId = user.id
      otherId = otherUserId
      if (myRole === 'influenceur') {
        table = 'conversations_influenceur'
        messagesTable = 'messages_influenceur'
        aField = 'user_a_id'
        bField = 'user_b_id'
      } else if (myRole === 'client') {
        table = 'conversations_biz'
        messagesTable = 'messages_biz'
        aField = 'client_a_id'
        bField = 'client_b_id'
        const [{ data: mine }, { data: theirs }] = await Promise.all([
          supabase.from('profils_client').select('id').eq('user_id', user.id).maybeSingle(),
          supabase.from('profils_client').select('id').eq('user_id', otherUserId).maybeSingle(),
        ])
        if (!mine || !theirs) {
          setSending(false)
          return
        }
        myId = mine.id
        otherId = theirs.id
      } else {
        table = 'conversations_sociale'
        messagesTable = 'messages_sociale'
        aField = 'user_a_id'
        bField = 'user_b_id'
      }

      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .or(`and(${aField}.eq.${myId},${bField}.eq.${otherId}),and(${aField}.eq.${otherId},${bField}.eq.${myId})`)
        .maybeSingle()

      conversationId = existing?.id
      if (!conversationId) {
        const { data: created, error } = await supabase.from(table).insert({ [aField]: myId, [bField]: otherId }).select().single()
        if (error || !created) {
          setSending(false)
          return
        }
        conversationId = created.id
      }
    } else if (myRole === 'client' && theirRole === 'influenceur') {
      table = 'conversations'
      messagesTable = 'messages'
      const { data: theirInfluenceurProfile } = await supabase
        .from('profils_influenceur')
        .select('id')
        .eq('user_id', otherUserId)
        .maybeSingle()
      if (!theirInfluenceurProfile) {
        setSending(false)
        return
      }
      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq('client_id', user.id)
        .eq('influenceur_id', theirInfluenceurProfile.id)
        .maybeSingle()
      conversationId = existing?.id
      if (!conversationId) {
        const { data: created, error } = await supabase
          .from(table)
          .insert({ client_id: user.id, influenceur_id: theirInfluenceurProfile.id })
          .select()
          .single()
        if (error || !created) {
          setSending(false)
          return
        }
        conversationId = created.id
      }
    } else if (myRole === 'influenceur' && theirRole === 'client') {
      table = 'conversations'
      messagesTable = 'messages'
      const { data: myInfluenceurProfile } = await supabase
        .from('profils_influenceur')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!myInfluenceurProfile) {
        setSending(false)
        return
      }
      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq('client_id', otherUserId)
        .eq('influenceur_id', myInfluenceurProfile.id)
        .maybeSingle()
      conversationId = existing?.id
      if (!conversationId) {
        const { data: created, error } = await supabase
          .from(table)
          .insert({ client_id: otherUserId, influenceur_id: myInfluenceurProfile.id })
          .select()
          .single()
        if (error || !created) {
          setSending(false)
          return
        }
        conversationId = created.id
      }
    } else if (myRole === 'client' && theirRole === 'utilisateur_simple') {
      table = 'conversations_pro'
      messagesTable = 'messages_pro'
      const { data: myClientProfile } = await supabase.from('profils_client').select('id').eq('user_id', user.id).maybeSingle()
      if (!myClientProfile) {
        setSending(false)
        return
      }
      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq('client_id', myClientProfile.id)
        .eq('utilisateur_id', otherUserId)
        .maybeSingle()
      conversationId = existing?.id
      if (!conversationId) {
        const { data: created, error } = await supabase
          .from(table)
          .insert({ client_id: myClientProfile.id, utilisateur_id: otherUserId })
          .select()
          .single()
        if (error || !created) {
          setSending(false)
          return
        }
        conversationId = created.id
      }
    } else if (myRole === 'utilisateur_simple' && theirRole === 'client') {
      table = 'conversations_pro'
      messagesTable = 'messages_pro'
      const { data: theirClientProfile } = await supabase.from('profils_client').select('id').eq('user_id', otherUserId).maybeSingle()
      if (!theirClientProfile) {
        setSending(false)
        return
      }
      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq('client_id', theirClientProfile.id)
        .eq('utilisateur_id', user.id)
        .maybeSingle()
      conversationId = existing?.id
      if (!conversationId) {
        const { data: created, error } = await supabase
          .from(table)
          .insert({ client_id: theirClientProfile.id, utilisateur_id: user.id })
          .select()
          .single()
        if (error || !created) {
          setSending(false)
          return
        }
        conversationId = created.id
      }
    } else {
      setSending(false)
      return
    }

    await supabase.from(messagesTable).insert({
      conversation_id: conversationId,
      sender_id: user.id,
      contenu: messageText,
      is_system: false,
      reply_to_note_id: current.original.id,
      reply_to_note_contenu: current.original.contenu,
    })
    await supabase.from(table).update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

    setSending(false)
    setReplyText('')
    const routeByTable = {
      conversations: `/messages/${conversationId}`,
      conversations_pro: `/messages/pro/${conversationId}`,
      conversations_biz: `/messages/biz/${conversationId}`,
      conversations_sociale: `/messages/sociale/${conversationId}`,
      conversations_influenceur: `/messages/influenceur/${conversationId}`,
    }
    onClose()
    navigate(routeByTable[table])
  }

  const handleTap = (e) => {
    const x = e.clientX
    if (x < window.innerWidth / 2) goPrevSegment()
    else goNextSegment()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col select-none"
      style={{ background: 'var(--accent, #7c1a3a)' }}
    >
      {/* Barre de progression : UNIQUEMENT les segments du groupe courant */}
      <div className="flex gap-1 px-3 pt-3">
        {items.map((_, i) => (
          <div key={i} className="flex-1 h-[2.5px] rounded-full bg-white/25 overflow-hidden">
            {i < segmentIndex && <div className="h-full bg-white" />}
            {i === segmentIndex && (
              <div
                key={progressKey}
                className="h-full bg-white"
                style={{
                  animation: `noteProgress ${SEGMENT_DURATION_MS}ms linear forwards`,
                  animationPlayState: paused ? 'paused' : 'running',
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        {isMine ? (
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-white shrink-0 -ml-1">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-white shrink-0 -ml-1">
              <ArrowLeft size={22} />
            </button>
            {current.kind === 'repost' && current.reposter ? (
              <div className="flex items-center shrink-0">
                <img
                  src={author?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${author?.id}`}
                  alt=""
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose()
                    navigate(profileRoute(author.id, author.role))
                  }}
                  className="w-9 h-9 rounded-full object-cover border-2 cursor-pointer"
                  style={{ borderColor: 'white' }}
                />
                <img
                  src={current.reposter.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${current.reposter.id}`}
                  alt=""
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose()
                    navigate(profileRoute(current.reposter.id, current.reposter.role))
                  }}
                  className="w-9 h-9 rounded-full object-cover border-2 -ml-3 cursor-pointer"
                  style={{ borderColor: 'white' }}
                />
              </div>
            ) : (
              <img
                src={author?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${author?.id}`}
                alt=""
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                  navigate(profileRoute(author.id, author.role))
                }}
                className="w-9 h-9 rounded-full object-cover shrink-0 cursor-pointer"
              />
            )}
          </>
        )}
        {isMine && (
          <img
            src={author?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${author?.id}`}
            alt=""
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          {isMine ? (
            <p className="text-body-medium text-white truncate">Ma note</p>
          ) : current.kind === 'repost' && current.reposter ? (
            <p className="text-body-medium text-white truncate">
              {author?.nom_complet} <span className="text-white/60">et</span> {current.reposter.nom_complet}
            </p>
          ) : (
            <p className="text-body-medium text-white truncate">{author?.nom_complet}</p>
          )}
          <p className="text-caption text-white/70">
            {current.kind === 'repost' ? 'a republié · ' : ''}
            {timeAgo(note.created_at)}
          </p>
        </div>
        {isMine && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(true)
            }}
            className="w-9 h-9 flex items-center justify-center text-white/90"
            aria-label="Options de la note"
          >
            <MoreVertical size={20} />
          </button>
        )}
      </div>

      {/* Zone tap gauche/droite + appui long = pause (comme les statuts WhatsApp) */}
      <div
        className="flex-1 relative flex items-center justify-center px-8"
        onClick={handleTap}
        onPointerDown={handlePauseStart}
        onPointerUp={handlePauseEnd}
        onPointerLeave={handlePauseEnd}
        onPointerCancel={handlePauseEnd}
      >
        <p className="text-white text-2xl font-medium text-center leading-snug break-words">
          {current.original.contenu}
        </p>
      </div>

      <div className="px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 flex flex-col gap-2.5">
        {isMine ? (
          canReply && (
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
          )
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === 'Enter' && handleReply()}
              placeholder="Répondre"
              disabled={!canReply}
              className="flex-1 min-w-0 bg-white/15 text-white placeholder-white/60 rounded-full px-4 h-11 outline-none text-body disabled:opacity-50"
            />
            {['😍', '😂', '😮'].map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation()
                  if (canReply) handleReply(emoji)
                }}
                disabled={!canReply || sending}
                className="text-2xl shrink-0 disabled:opacity-50"
                aria-label={`Réagir avec ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRepost()
              }}
              disabled={reposted || isMine}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/15 disabled:opacity-40 text-white shrink-0"
              aria-label="Republier"
            >
              <Repeat2 size={20} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleLike()
              }}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/15 text-white shrink-0"
              aria-label="Aimer"
            >
              <Heart size={20} fill={liked ? 'var(--accent)' : 'none'} stroke={liked ? 'var(--accent)' : 'white'} />
            </button>
          </div>
        )}

        {isMine && (
          <div className="flex items-center text-white">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowViewers(true)
              }}
              className="flex items-center gap-1.5"
            >
              <Eye size={22} />
              <span className="text-caption">{viewCount}</span>
            </button>
            {likeCount > 0 && (
              <div className="flex items-center gap-1.5 ml-auto bg-white rounded-full pl-2 pr-3 h-8">
                <Heart size={18} fill="var(--accent)" stroke="var(--accent)" />
                <span className="text-caption" style={{ color: 'var(--accent)' }}>{likeCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showMenu && (
        <div
          className="absolute inset-0 z-10"
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(false)
          }}
        >
          <div
            className="absolute top-14 right-3 rounded-2xl overflow-hidden min-w-[170px] shadow-lg"
            style={{ background: 'var(--surface-primary, #1c1c1e)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowMenu(false)
                onClose()
                navigate(`/notes/nouvelle?edit=${note.id}`)
              }}
              className="w-full text-left px-4 py-3.5 text-body"
              style={{ color: 'var(--text-primary)' }}
            >
              Modifier
            </button>
            <div className="h-px" style={{ background: 'var(--border)' }} />
            <button
              onClick={() => {
                setShowMenu(false)
                handleDelete()
              }}
              className="w-full text-left px-4 py-3.5 text-body text-red-500"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}

      {showViewers && (
        <div
          className="absolute inset-0 z-10 flex flex-col justify-end"
          onClick={(e) => {
            e.stopPropagation()
            setShowViewers(false)
          }}
        >
          <div
            className="bg-[var(--bg-primary,#1c1c1e)] rounded-t-3xl max-h-[70%] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="text-body-medium">Vu par {viewCount}</p>
              <button onClick={() => setShowViewers(false)} className="w-8 h-8 flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
              {viewersList.length === 0 && (
                <p className="text-caption text-center py-6 opacity-60">Personne n'a encore vu cette note.</p>
              )}
              {viewersList.map((v) => (
                <div key={v.user_id} className="flex items-center gap-3 py-2.5">
                  <img
                    src={v.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${v.user_id}`}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body truncate">{v.users?.nom_complet}</p>
                  </div>
                  <span className="text-caption opacity-60">{timeAgo(v.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
