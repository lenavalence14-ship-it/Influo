import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Send, Camera, Image as ImageIcon, ThumbsUp, Plus, Mic } from 'lucide-react'
import MessageBubble from '../../components/messages/MessageBubble'

// Chat utilisateur_simple <-> utilisateur_simple. Repris de ChatBiz.jsx (mêmes pièces
// jointes, header, style de bulles), sans tout ce qui concerne le paiement/la commande :
// ici il n'y a jamais d'échange d'argent entre deux utilisateurs normaux.
export default function ChatSociale() {
  const { id } = useParams()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')

  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const bottomRef = useRef(null)

  const myId = user?.id
  const isSideA = conversation?.user_a_id === myId
  const other = isSideA ? conversation?.user_b : conversation?.user_a

  const loadAll = async () => {
    const { data: conv } = await supabase
      .from('conversations_sociale')
      .select(`
        *,
        user_a:user_a_id(id, nom_complet, photo_url),
        user_b:user_b_id(id, nom_complet, photo_url)
      `)
      .eq('id', id)
      .maybeSingle()
    setConversation(conv)

    const { data: msgs } = await supabase
      .from('messages_sociale')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    setMessages(msgs || [])

    if (conv) {
      const readField = conv.user_a_id === myId ? 'user_a_last_read_at' : 'user_b_last_read_at'
      await supabase.from('conversations_sociale').update({ [readField]: new Date().toISOString() }).eq('id', id)
    }
  }

  useEffect(() => {
    if (!myId) return
    loadAll()

    const channel = supabase
      .channel(`chat-sociale-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_sociale', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages((prev) => {
          const tempIndex = prev.findIndex((m) => m._optimisticId && m.sender_id === payload.new.sender_id && m.contenu === payload.new.contenu && !prev.some((mm) => mm.id === payload.new.id))
          if (tempIndex !== -1) {
            const next = [...prev]
            next[tempIndex] = payload.new
            return next
          }
          if (prev.some((m) => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        const readField = isSideA ? 'user_a_last_read_at' : 'user_b_last_read_at'
        supabase.from('conversations_sociale').update({ [readField]: new Date().toISOString() }).eq('id', id)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations_sociale', filter: `id=eq.${id}` }, (payload) => {
        setConversation((c) => (c ? { ...c, ...payload.new } : c))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages_sociale', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, myId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content, fichierUrl = null, fichierType = null) => {
    const optimisticId = `temp-${Date.now()}-${Math.random()}`
    const optimisticMsg = {
      id: optimisticId,
      _optimisticId: true,
      conversation_id: id,
      sender_id: myId,
      contenu: content,
      fichier_url: fichierUrl,
      fichier_type: fichierType,
      is_system: false,
      created_at: new Date().toISOString(),
      deleted_for: [],
      is_deleted_for_all: false,
      edited_at: null,
    }
    setMessages((prev) => [...prev, optimisticMsg])

    const { data: inserted, error } = await supabase
      .from('messages_sociale')
      .insert({
        conversation_id: id,
        sender_id: myId,
        contenu: content,
        fichier_url: fichierUrl,
        fichier_type: fichierType,
        is_system: false,
      })
      .select()
      .single()

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      return
    }
    setMessages((prev) => prev.map((m) => (m.id === optimisticId ? inserted : m)))
    await supabase.from('conversations_sociale').update({ updated_at: new Date().toISOString() }).eq('id', id)
  }

  const handleEditMessage = async (message, newContent) => {
    const { data } = await supabase
      .from('messages_sociale')
      .update({ contenu: newContent, edited_at: new Date().toISOString() })
      .eq('id', message.id)
      .select()
      .single()
    if (data) setMessages((prev) => prev.map((m) => (m.id === message.id ? data : m)))
  }

  const handleDeleteForMe = async (message) => {
    const nextDeletedFor = [...(message.deleted_for || []), myId]
    const { data } = await supabase
      .from('messages_sociale')
      .update({ deleted_for: nextDeletedFor })
      .eq('id', message.id)
      .select()
      .single()
    if (data) setMessages((prev) => prev.map((m) => (m.id === message.id ? data : m)))
  }

  const handleDeleteForEveryone = async (message) => {
    const { data } = await supabase
      .from('messages_sociale')
      .update({ is_deleted_for_all: true, contenu: null, fichier_url: null })
      .eq('id', message.id)
      .select()
      .single()
    if (data) setMessages((prev) => prev.map((m) => (m.id === message.id ? data : m)))
  }

  const handleSend = async () => {
    if (!text.trim()) return
    const content = text
    setText('')
    await sendMessage(content)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fileName = `${id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('messagerie').upload(fileName, file)
    if (error) return
    const { data: signedUrl } = await supabase.storage.from('messagerie').createSignedUrl(fileName, 60 * 60 * 24 * 7)
    await sendMessage(null, signedUrl?.signedUrl, file.type.startsWith('image/') ? 'image' : 'fichier')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center gap-3 px-3 py-2.5 sticky top-0 bg-[var(--bg-primary)]/90 backdrop-blur-xl z-20 border-b border-[var(--border)] shrink-0">
        <button onClick={() => navigate('/messages')} className="w-9 h-9 -ml-1 flex items-center justify-center shrink-0">
          <ArrowLeft size={20} />
        </button>
        <img
          src={other?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${id}`}
          alt=""
          className="w-9 h-9 rounded-full object-cover shrink-0"
        />
        <p className="text-body-medium flex-1 min-w-0 truncate">{other?.nom_complet}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {messages.map((m, i) => {
          const isMe = m.sender_id === myId

          const readAt = isSideA ? conversation.user_b_last_read_at : conversation.user_a_last_read_at
          const isLastMineMessage = isMe && !messages.slice(i + 1).some((mm) => mm.sender_id === myId)
          const seenByOther = isLastMineMessage && readAt && new Date(readAt) > new Date(m.created_at)

          return (
            <MessageBubble
              key={m.id}
              message={m}
              isMe={isMe}
              myId={myId}
              seenByOther={seenByOther}
              otherPhotoUrl={other?.photo_url}
              seedId={id}
              onEdit={handleEditMessage}
              onDeleteForMe={handleDeleteForMe}
              onDeleteForEveryone={handleDeleteForEveryone}
            />
          )
        })}

        <div ref={bottomRef} />
      </div>

      <div className="px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 flex items-center gap-1 shrink-0">
        <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center shrink-0" style={{ color: 'var(--accent)' }} aria-label="Joindre">
          <Plus size={22} />
        </button>
        <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />

        <button onClick={() => cameraInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center shrink-0" style={{ color: 'var(--accent)' }} aria-label="Caméra">
          <Camera size={20} />
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button onClick={() => galleryInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center shrink-0" style={{ color: 'var(--accent)' }} aria-label="Galerie">
          <ImageIcon size={20} />
        </button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button className="w-9 h-9 flex items-center justify-center shrink-0" style={{ color: 'var(--accent)' }} aria-label="Message vocal">
          <Mic size={20} />
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Message"
          className="flex-1 glass rounded-full px-4 h-10 outline-none text-body min-w-0"
        />

        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-9 h-9 flex items-center justify-center shrink-0 disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
          aria-label={text.trim() ? 'Envoyer' : 'Aimer'}
        >
          {text.trim() ? <Send size={20} /> : <ThumbsUp size={20} />}
        </button>
      </div>
    </div>
  )
} 
