import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft, Send, Camera, Image as ImageIcon,
  Download, Banknote, ThumbsUp, PackageCheck, ShieldCheck,
  Phone, Video, Plus, Mic,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import BottomSheet from '../../components/ui/BottomSheet'
import { generateReceipt } from '../../lib/receipt'
import { timeShort } from '../../lib/time'

// Chat "pro" : utilisateur_simple <-> entreprise. Repris à l'identique de Chat.jsx
// (header, barre de saisie avec pièces jointes, bulles, "vu", tooltip du bouton cash)
// à l'exception de deux points, conformes à ce qui a été validé :
// - pas d'étape "livraison avec média/lien/format" ni de post créé dans le feed
// - la demande de paiement inclut un délai de livraison (texte libre), en plus du montant
export default function ChatPro() {
  const { id } = useParams()
  const [conversation, setConversation] = useState(null)
  const [commande, setCommande] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [showPaymentAsk, setShowPaymentAsk] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDelai, setPaymentDelai] = useState('')

  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const bottomRef = useRef(null)

  const isEntreprise = profile?.role === 'client'

  const loadAll = async () => {
    const { data: conv } = await supabase
      .from('conversations_pro')
      .select('*, utilisateur:utilisateur_id(nom_complet, photo_url), client:client_id(id, user_id, users(nom_complet, photo_url))')
      .eq('id', id)
      .maybeSingle()
    setConversation(conv)

    const { data: cmd } = await supabase
      .from('commandes_pro')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCommande(cmd)

    const { data: msgs } = await supabase
      .from('messages_pro')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    setMessages(msgs || [])

    const readField = isEntreprise ? 'client_last_read_at' : 'utilisateur_last_read_at'
    await supabase.from('conversations_pro').update({ [readField]: new Date().toISOString() }).eq('id', id)
  }

  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel(`chat-pro-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_pro', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new])
        const readField = isEntreprise ? 'client_last_read_at' : 'utilisateur_last_read_at'
        supabase.from('conversations_pro').update({ [readField]: new Date().toISOString() }).eq('id', id)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations_pro', filter: `id=eq.${id}` }, (payload) => {
        setConversation((c) => (c ? { ...c, ...payload.new } : c))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes_pro', filter: `conversation_id=eq.${id}` }, (payload) => {
        setCommande(payload.new || null)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content, fichierUrl = null, fichierType = null) => {
    await supabase.from('messages_pro').insert({
      conversation_id: id,
      sender_id: user.id,
      contenu: content,
      fichier_url: fichierUrl,
      fichier_type: fichierType,
      is_system: false,
    })
    await supabase.from('conversations_pro').update({ updated_at: new Date().toISOString() }).eq('id', id)
  }

  const sendSystemMessage = async (content) => {
    await supabase.from('messages_pro').insert({
      conversation_id: id,
      sender_id: null,
      contenu: content,
      is_system: true,
    })
    await supabase.from('conversations_pro').update({ updated_at: new Date().toISOString() }).eq('id', id)
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

  const handleRequestPayment = async () => {
    if (!paymentAmount) return
    const montant = parseFloat(paymentAmount)
    const commission = +(montant * 0.1).toFixed(2)
    const montantNet = +(montant - commission).toFixed(2)

    const { data: newCommande } = await supabase
      .from('commandes_pro')
      .insert({
        conversation_id: id,
        utilisateur_id: conversation.utilisateur_id,
        client_id: conversation.client_id,
        montant,
        commission,
        montant_net: montantNet,
        status: 'paiement_demande',
      })
      .select()
      .single()

    setCommande(newCommande)
    await sendSystemMessage(
      `💰 L'entreprise demande le paiement de ${montant} €${paymentDelai ? ` — délai de livraison : ${paymentDelai}` : ''}.`
    )
    setShowPaymentAsk(false)
    setPaymentAmount('')
    setPaymentDelai('')
  }

  const handlePay = async () => {
    if (!commande) return
    const { error } = await supabase.rpc('pay_commande_pro', { p_commande_id: commande.id })
    if (error) {
      await sendSystemMessage('⚠️ Le paiement a échoué : ' + error.message)
      return
    }
    await sendSystemMessage('✅ Paiement effectué. Les fonds sont verrouillés jusqu\'à confirmation de la livraison.')
    setCommande((c) => ({ ...c, status: 'paiement_effectue' }))
  }

  const handleMarkDelivered = async () => {
    await supabase.from('commandes_pro').update({ status: 'en_attente_validation' }).eq('id', commande.id)
    await sendSystemMessage('📦 Produit livré. En attente de confirmation de réception.')
    setCommande((c) => ({ ...c, status: 'en_attente_validation' }))
  }

  const handleConfirmReception = async () => {
    const { error } = await supabase.rpc('confirm_reception_commande_pro', { p_commande_id: commande.id })
    if (error) {
      await sendSystemMessage('⚠️ La confirmation a échoué : ' + error.message)
      return
    }
    await sendSystemMessage('🎉 Livraison confirmée. Les fonds sont maintenant disponibles pour l\'entreprise.')
    setCommande((c) => ({ ...c, status: 'terminee' }))
  }

  const handleDownloadReceipt = () => {
    if (!commande) return
    generateReceipt({
      reference: commande.id,
      montant: commande.montant,
      commission: commande.commission,
      montantNet: commande.montant_net,
      offreTitle: null,
      influenceurNom: conversation?.client?.users?.nom_complet,
      clientNom: conversation?.utilisateur?.nom_complet,
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

  const other = isEntreprise ? conversation.utilisateur : conversation.client?.users

  const contextAction = (() => {
    if (!isEntreprise && commande?.status === 'paiement_demande') {
      return { icon: Banknote, label: `Payer ${commande.montant} €`, onClick: handlePay }
    }
    if (isEntreprise && commande?.status === 'paiement_effectue') {
      return { icon: PackageCheck, label: 'Produit livré', onClick: handleMarkDelivered }
    }
    if (!isEntreprise && commande?.status === 'en_attente_validation') {
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

        {isEntreprise && (!commande || commande.status === 'en_discussion') && (
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
          const isMe = m.sender_id === user.id
          const isSystem = !m.sender_id

          const readAt = isEntreprise ? conversation.utilisateur_last_read_at : conversation.client_last_read_at
          const isLastMineMessage = isMe && !messages.slice(i + 1).some((mm) => mm.sender_id === user.id)
          const seenByOther = isLastMineMessage && readAt && new Date(readAt) > new Date(m.created_at)

          return (
            <div key={m.id} className={`flex flex-col ${isSystem ? 'items-center' : isMe ? 'items-end' : 'items-start'}`}>
              {isSystem ? (
                <div className="glass rounded-2xl px-4 py-2 text-caption text-center text-[var(--text-secondary)] max-w-[85%]">
                  {m.contenu}
                </div>
              ) : (
                <>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-body ${isMe ? 'bg-[var(--accent)] text-white' : 'glass'}`}>
                    {m.fichier_url && m.fichier_type === 'image' ? (
                      <img src={m.fichier_url} alt="" className="rounded-xl mb-1 max-w-full" />
                    ) : m.fichier_url ? (
                      <a href={m.fichier_url} target="_blank" rel="noreferrer" className="underline">Fichier joint</a>
                    ) : null}
                    {m.contenu}
                  </div>
                  {m.created_at && (
                    <span className="text-[11px] mt-1 px-1" style={{ color: 'var(--text-secondary)' }}>
                      {timeShort(m.created_at)}
                    </span>
                  )}
                  {seenByOther && (
                    <img
                      src={other?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${id}`}
                      alt="Vu"
                      className="w-4 h-4 rounded-full object-cover mt-0.5"
                    />
                  )}
                </>
              )}
            </div>
          )
        })}

        {!isEntreprise && ['paiement_effectue', 'en_attente_validation', 'terminee'].includes(commande?.status) && (
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
        <BottomSheet onClose={() => setShowPaymentAsk(false)} title="Demander le paiement">
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
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
