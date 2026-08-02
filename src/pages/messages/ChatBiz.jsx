import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as messagesApi from '../../api/messages'
import * as storageApi from '../../api/storage'
import * as realtimeApi from '../../api/realtime'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft, Send, Camera, Image as ImageIcon,
  Download, Banknote, ThumbsUp, PackageCheck, ShieldCheck,
  Phone, Video, Plus, Mic,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import BottomSheet from '../../components/ui/BottomSheet'
import { generateReceipt } from '../../lib/receipt'
import MessageBubble from '../../components/messages/MessageBubble'

const TABLE = 'messages_biz'
const CONV_TABLE = 'conversations_biz'

// Chat entreprise <-> entreprise. Repris fidèlement de Chat.jsx (mêmes pièces jointes,
// header, style de boutons), avec la différence validée : n'importe laquelle des deux
// parties peut demander un paiement (pas seulement un rôle fixe), une seule commande
// active à la fois par conversation (appliqué côté serveur par create_commande_biz).
export default function ChatBiz() {
  const { id } = useParams()
  const [conversation, setConversation] = useState(null)
  const [commande, setCommande] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [showPaymentAsk, setShowPaymentAsk] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDelai, setPaymentDelai] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const { clientProfile } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const bottomRef = useRef(null)

  const myClientId = clientProfile?.id
  const isSideA = conversation?.client_a_id === myClientId

  const loadAll = async () => {
    const conv = await messagesApi.fetchConversationGeneric(
      CONV_TABLE,
      id,
      `*, client_a:client_a_id(id, user_id, users(nom_complet, photo_url)), client_b:client_b_id(id, user_id, users(nom_complet, photo_url))`
    )
    setConversation(conv)

    const cmd = await messagesApi.fetchLatestCommandeGeneric('commandes_biz', id)
    setCommande(cmd)

    const msgs = await messagesApi.fetchMessagesGeneric(TABLE, id)
    setMessages(msgs)

    if (conv) {
      const readField = conv.client_a_id === myClientId ? 'client_a_last_read_at' : 'client_b_last_read_at'
      await messagesApi.markConversationReadGeneric(CONV_TABLE, id, readField)
    }
  }

  useEffect(() => {
    if (!myClientId) return
    loadAll()

    const unsubscribeMessages = realtimeApi.subscribeToTable({
      channelName: `chat-biz-messages-${id}`,
      table: TABLE,
      filter: `conversation_id=eq.${id}`,
      handlers: {
        INSERT: (payload) => {
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
          const readField = isSideA ? 'client_a_last_read_at' : 'client_b_last_read_at'
          messagesApi.markConversationReadGeneric(CONV_TABLE, id, readField)
        },
        UPDATE: (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)))
        },
      },
    })

    const unsubscribeConversation = realtimeApi.subscribeToTable({
      channelName: `chat-biz-conversation-${id}`,
      table: CONV_TABLE,
      filter: `id=eq.${id}`,
      handlers: {
        UPDATE: (payload) => {
          setConversation((c) => (c ? { ...c, ...payload.new } : c))
        },
      },
    })

    const unsubscribeCommande = realtimeApi.subscribeToTable({
      channelName: `chat-biz-commande-${id}`,
      table: 'commandes_biz',
      filter: `conversation_id=eq.${id}`,
      handlers: {
        '*': (payload) => {
          setCommande(payload.new || null)
        },
      },
    })

    return () => {
      unsubscribeMessages()
      unsubscribeConversation()
      unsubscribeCommande()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, myClientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content, fichierUrl = null, fichierType = null) => {
    const optimisticId = `temp-${Date.now()}-${Math.random()}`
    const optimisticMsg = {
      id: optimisticId,
      _optimisticId: true,
      conversation_id: id,
      sender_id: myClientId,
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

    const { data: inserted, error } = await messagesApi.sendMessageGeneric(TABLE, CONV_TABLE, {
      conversationId: id,
      senderId: myClientId,
      contenu: content,
      fichierUrl,
      fichierType,
    })

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      return
    }
    setMessages((prev) => prev.map((m) => (m.id === optimisticId ? inserted : m)))
  }

  const handleEditMessage = async (message, newContent) => {
    const data = await messagesApi.editMessageGeneric(TABLE, message.id, newContent)
    if (data) setMessages((prev) => prev.map((m) => (m.id === message.id ? data : m)))
  }

  const handleDeleteForMe = async (message) => {
    const data = await messagesApi.deleteMessageForMeGeneric(TABLE, message, myClientId)
    if (data) setMessages((prev) => prev.map((m) => (m.id === message.id ? data : m)))
  }

  const handleDeleteForEveryone = async (message) => {
    const data = await messagesApi.deleteMessageForEveryoneGeneric(TABLE, message.id)
    if (data) setMessages((prev) => prev.map((m) => (m.id === message.id ? data : m)))
  }

  const sendSystemMessage = async (content) => {
    await messagesApi.sendMessageGeneric(TABLE, CONV_TABLE, { conversationId: id, senderId: null, contenu: content, isSystem: true })
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
    const { error } = await storageApi.uploadFile('messagerie', fileName, file)
    if (error) return
    const signedUrl = await storageApi.getSignedUrl('messagerie', fileName, 60 * 60 * 24 * 7)
    await sendMessage(null, signedUrl, file.type.startsWith('image/') ? 'image' : 'fichier')
  }

  const handleRequestPayment = async () => {
    if (!paymentAmount) return
    setErrorMsg('')

    const { data, error } = await messagesApi.createCommandeBiz({
      conversationId: id,
      montant: parseFloat(paymentAmount),
      delaiLivraison: paymentDelai,
    })

    if (error) {
      setErrorMsg(error.message)
      return
    }

    setCommande(data)
    await sendSystemMessage(
      `💰 Demande de paiement de ${data.montant} €${paymentDelai ? ` — délai de livraison : ${paymentDelai}` : ''}.`
    )
    setShowPaymentAsk(false)
    setPaymentAmount('')
    setPaymentDelai('')
  }

  const handlePay = async () => {
    const { error } = await messagesApi.payCommandeBiz(commande.id)
    if (error) {
      await sendSystemMessage('⚠️ Le paiement a échoué : ' + error.message)
      return
    }
    await sendSystemMessage('✅ Paiement effectué. Les fonds sont verrouillés jusqu\'à confirmation de la livraison.')
    setCommande((c) => ({ ...c, status: 'paiement_effectue' }))
  }

  const handleMarkDelivered = async () => {
    const { error } = await messagesApi.markDeliveredCommandeBiz(commande.id)
    if (error) {
      await sendSystemMessage('⚠️ Échec : ' + error.message)
      return
    }
    await sendSystemMessage('📦 Produit livré. En attente de confirmation de réception.')
    setCommande((c) => ({ ...c, status: 'en_attente_validation' }))
  }

  const handleConfirmReception = async () => {
    const { error } = await messagesApi.confirmReceptionCommandeBiz(commande.id)
    if (error) {
      await sendSystemMessage('⚠️ Échec : ' + error.message)
      return
    }
    await sendSystemMessage('🎉 Livraison confirmée. Les fonds sont maintenant disponibles.')
    setCommande((c) => ({ ...c, status: 'terminee' }))
  }

  const handleDownloadReceipt = () => {
    if (!commande) return
    const demandeurNom = commande.demandeur_id === conversation.client_a_id
      ? conversation.client_a?.users?.nom_complet
      : conversation.client_b?.users?.nom_complet
    const payeurNom = commande.payeur_id === conversation.client_a_id
      ? conversation.client_a?.users?.nom_complet
      : conversation.client_b?.users?.nom_complet

    generateReceipt({
      reference: commande.id,
      montant: commande.montant,
      commission: commande.commission,
      montantNet: commande.montant_net,
      offreTitle: null,
      influenceurNom: demandeurNom,
      clientNom: payeurNom,
      date: new Date().toLocaleDateString('fr-FR'),
    })
  }

  if (!conversation) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  const other = isSideA ? conversation.client_b?.users : conversation.client_a?.users
  const isDemandeur = commande?.demandeur_id === myClientId
  const isPayeur = commande?.payeur_id === myClientId
  const canRequestPayment = !commande || commande.status === 'terminee'

  const contextAction = (() => {
    if (isPayeur && commande?.status === 'paiement_demande') {
      return { icon: Banknote, label: `Payer ${commande.montant} €`, onClick: handlePay }
    }
    if (isDemandeur && commande?.status === 'paiement_effectue') {
      return { icon: PackageCheck, label: 'Produit livré', onClick: handleMarkDelivered }
    }
    if (isPayeur && commande?.status === 'en_attente_validation') {
      return { icon: ShieldCheck, label: 'Livraison reçue', onClick: handleConfirmReception }
    }
    return null
  })()

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

        {canRequestPayment && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowPaymentAsk(true)}
              className="w-9 h-9 flex items-center justify-center"
              style={{ color: 'var(--accent)' }}
              aria-label="Demander le paiement"
            >
              <Banknote size={22} />
            </button>
            <div
              className="absolute top-full right-0 mt-2 whitespace-nowrap glass-strong rounded-xl px-3 py-1.5 text-[11px] z-30"
              style={{ color: 'var(--text-primary)' }}
            >
              <div
                className="absolute right-3 -top-1 w-2 h-2 rotate-45"
                style={{ background: 'var(--surface-primary)' }}
              />
              Demander le paiement
            </div>
          </div>
        )}

        <button className="w-9 h-9 flex items-center justify-center shrink-0" style={{ color: 'var(--accent)' }} aria-label="Appeler">
          <Phone size={20} />
        </button>
        <button className="w-9 h-9 flex items-center justify-center shrink-0" style={{ color: 'var(--accent)' }} aria-label="Appel vidéo">
          <Video size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {messages.map((m, i) => {
          const isMe = m.sender_id === myClientId

          const readAt = isSideA ? conversation.client_b_last_read_at : conversation.client_a_last_read_at
          const isLastMineMessage = isMe && !messages.slice(i + 1).some((mm) => mm.sender_id === myClientId)
          const seenByOther = isLastMineMessage && readAt && new Date(readAt) > new Date(m.created_at)

          return (
            <MessageBubble
              key={m.id}
              message={m}
              isMe={isMe}
              myId={myClientId}
              seenByOther={seenByOther}
              otherPhotoUrl={other?.photo_url}
              seedId={id}
              onEdit={handleEditMessage}
              onDeleteForMe={handleDeleteForMe}
              onDeleteForEveryone={handleDeleteForEveryone}
            />
          )
        })}

        {['paiement_effectue', 'en_attente_validation', 'terminee'].includes(commande?.status) && (isDemandeur || isPayeur) && (
          <div className="flex justify-center">
            <button
              onClick={handleDownloadReceipt}
              className="flex items-center justify-center gap-2 text-caption py-2 px-3"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Download size={14} /> Télécharger le reçu
            </button>
          </div>
        )}

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

        {contextAction && (
          <button
            onClick={contextAction.onClick}
            aria-label={contextAction.label}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <contextAction.icon size={16} />
          </button>
        )}

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

      {showPaymentAsk && (
        <BottomSheet onClose={() => { setShowPaymentAsk(false); setErrorMsg('') }} title="Demander le paiement">
          <div className="px-4 pb-4 pt-1 space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Montant en €"
                autoFocus
                className="flex-1 glass rounded-2xl outline-none text-body px-4 py-3"
              />
              <Button onClick={handleRequestPayment} disabled={!paymentAmount}>Demander</Button>
            </div>
            <input
              type="text"
              value={paymentDelai}
              onChange={(e) => setPaymentDelai(e.target.value)}
              placeholder="Délai de livraison (optionnel, ex : 3 jours)"
              className="w-full glass rounded-2xl outline-none text-body px-4 py-3"
            />
            {errorMsg && <p className="text-caption text-red-400 text-center">{errorMsg}</p>}
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
