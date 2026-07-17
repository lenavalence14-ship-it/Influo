import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Paperclip, Send, Camera, Download } from 'lucide-react'
import Button from '../../components/ui/Button'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { generateReceipt } from '../../lib/receipt'

export default function Chat() {
  const { id } = useParams()
  const [conversation, setConversation] = useState(null)
  const [commande, setCommande] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [showPaymentAsk, setShowPaymentAsk] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const { user, profile, influencerProfile } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const bottomRef = useRef(null)

  const isInfluencer = profile?.role === 'influenceur'

  const loadAll = async () => {
    const { data: conv } = await supabase
      .from('conversations')
      .select('*, client:client_id(nom_complet, photo_url), profils_influenceur(id, verifie, users(nom_complet, photo_url)), offres(*)')
      .eq('id', id)
      .maybeSingle()
    setConversation(conv)

    const { data: cmd } = await supabase
      .from('commandes')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCommande(cmd)

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    setMessages(msgs || [])
  }

  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content, fichierUrl = null, fichierType = null) => {
    await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: user.id,
      contenu: content,
      fichier_url: fichierUrl,
      fichier_type: fichierType,
      is_system: false,
    })
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id)
  }

  const sendSystemMessage = async (content, fichierUrl = null) => {
    await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: null,
      contenu: content,
      fichier_url: fichierUrl,
      is_system: true,
    })
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id)
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
      .from('commandes')
      .insert({
        conversation_id: id,
        client_id: conversation.client_id,
        influenceur_id: conversation.influenceur_id,
        offre_id: conversation.offre_id,
        montant,
        commission,
        montant_net: montantNet,
        status: 'paiement_demande',
      })
      .select()
      .single()

    setCommande(newCommande)
    await sendSystemMessage(
      `💰 L'influenceur demande le paiement de ${montant} € pour cette prestation.`
    )
    setShowPaymentAsk(false)
    setPaymentAmount('')
  }

  const handlePay = async () => {
    if (!commande) return

    const { data: paiement } = await supabase.from('paiements').insert({
      commande_id: commande.id,
      montant: commande.montant,
      commission: commande.commission,
      provider_simule: 'mock',
      reussi: true,
    }).select().single()

    await supabase.from('commandes').update({ status: 'paiement_effectue' }).eq('id', commande.id)

    // créditer le wallet en verrouillé
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('influenceur_id', commande.influenceur_id)
      .maybeSingle()

    if (wallet) {
      await supabase.from('wallets').update({
        solde_verrouille: +(wallet.solde_verrouille + commande.montant_net).toFixed(2),
        revenus_totaux: +(wallet.revenus_totaux + commande.montant_net).toFixed(2),
      }).eq('id', wallet.id)

      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        commande_id: commande.id,
        type: 'paiement_verrouille',
        montant: commande.montant_net,
      })
    }

    await sendSystemMessage('✅ Paiement effectué. Les fonds sont verrouillés jusqu\'à validation de la prestation.')
    setCommande((c) => ({ ...c, status: 'paiement_effectue', paiement_reference: paiement?.reference || paiement?.id }))
  }

  const handleDownloadReceipt = () => {
    if (!commande) return
    generateReceipt({
      reference: commande.paiement_reference || commande.id,
      montant: commande.montant,
      commission: commande.commission,
      montantNet: commande.montant_net,
      offreTitle: conversation?.offres?.titre,
      influenceurNom: conversation?.profils_influenceur?.users?.nom_complet,
      clientNom: conversation?.client?.nom_complet,
      date: new Date().toLocaleDateString('fr-FR'),
    })
  }

  const handleDeliver = async () => {
    const lien = window.prompt('Lien de la publication (TikTok, Instagram, YouTube...) :')
    if (!lien) return
    await supabase.from('commandes').update({ status: 'en_attente_validation', lien_livraison: lien }).eq('id', commande.id)
    await sendSystemMessage(`📎 Prestation livrée : ${lien}`, lien)
    setCommande((c) => ({ ...c, status: 'en_attente_validation', lien_livraison: lien }))
  }

  const handleConfirmReception = async () => {
    await supabase.from('commandes').update({ status: 'terminee' }).eq('id', commande.id)

    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('influenceur_id', commande.influenceur_id)
      .maybeSingle()

    if (wallet) {
      await supabase.from('wallets').update({
        solde_verrouille: +(wallet.solde_verrouille - commande.montant_net).toFixed(2),
        solde_disponible: +(wallet.solde_disponible + commande.montant_net).toFixed(2),
      }).eq('id', wallet.id)

      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        commande_id: commande.id,
        type: 'deverrouillage',
        montant: commande.montant_net,
      })
    }

    await sendSystemMessage('🎉 Prestation validée. Les fonds sont maintenant disponibles pour l\'influenceur.')
    setCommande((c) => ({ ...c, status: 'terminee' }))
  }

  if (!conversation) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  const other = isInfluencer ? conversation.client : conversation.profils_influenceur?.users

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-3 px-4 py-4 sticky top-0 bg-[var(--bg-primary)]/90 backdrop-blur-xl z-20 border-b border-[var(--border)]">
        <button onClick={() => navigate('/messages')}>
          <ArrowLeft size={20} />
        </button>
        <img
          src={other?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${id}`}
          alt=""
          className="w-9 h-9 rounded-full object-cover"
        />
        <p className="text-body-medium flex items-center gap-1.5">
          {other?.nom_complet}
          {!isInfluencer && conversation.profils_influenceur?.verifie && <VerifiedBadge size={14} />}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => {
          const isMe = m.sender_id === user.id
          const isSystem = !m.sender_id
          return (
            <div key={m.id} className={`flex ${isSystem ? 'justify-center' : isMe ? 'justify-end' : 'justify-start'}`}>
              {isSystem ? (
                <div className="glass rounded-2xl px-4 py-2 text-caption text-center text-[var(--text-secondary)] max-w-[85%]">
                  {m.contenu}
                </div>
              ) : (
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-body ${isMe ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'glass'}`}>
                  {m.fichier_url && m.fichier_type === 'image' ? (
                    <img src={m.fichier_url} alt="" className="rounded-xl mb-1 max-w-full" />
                  ) : m.fichier_url ? (
                    <a href={m.fichier_url} target="_blank" rel="noreferrer" className="underline">Fichier joint</a>
                  ) : null}
                  {m.contenu}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* zone d'actions paiement selon rôle et statut */}
      <div className="px-4 pb-2">
        {isInfluencer && (!commande || commande.status === 'en_discussion') && !showPaymentAsk && (
          <Button variant="glass" fullWidth onClick={() => setShowPaymentAsk(true)} className="mb-2">
            Recevoir le paiement
          </Button>
        )}

        {showPaymentAsk && (
          <div className="glass-strong rounded-2xl p-3 mb-2 flex gap-2">
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Montant en €"
              className="flex-1 bg-transparent outline-none text-body px-2"
            />
            <Button onClick={handleRequestPayment}>Demander</Button>
          </div>
        )}

        {!isInfluencer && commande?.status === 'paiement_demande' && (
          <Button fullWidth onClick={handlePay} className="mb-2">
            Payer {commande.montant} €
          </Button>
        )}

        {!isInfluencer && ['paiement_effectue', 'en_attente_validation', 'terminee'].includes(commande?.status) && (
          <button
            onClick={handleDownloadReceipt}
            className="flex items-center justify-center gap-2 text-caption w-full py-2 mb-1"
          >
            <Download size={14} /> Télécharger le reçu
          </button>
        )}

        {isInfluencer && commande?.status === 'paiement_effectue' && (
          <Button variant="glass" fullWidth onClick={handleDeliver} className="mb-2">
            Livrer la prestation
          </Button>
        )}

        {!isInfluencer && commande?.status === 'en_attente_validation' && (
          <Button fullWidth onClick={handleConfirmReception} className="mb-2">
            Confirmer la réception
          </Button>
        )}
      </div>

      {/* input message */}
      <div className="px-4 pb-6 pt-2 flex items-center gap-2">
        <button onClick={() => fileInputRef.current?.click()} className="glass rounded-full p-3 shrink-0">
          <Paperclip size={18} />
        </button>
        <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
        <button onClick={() => cameraInputRef.current?.click()} className="glass rounded-full p-3 shrink-0">
          <Camera size={18} />
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Message..."
          className="flex-1 glass rounded-full px-4 py-3 outline-none text-body"
        />
        <button onClick={handleSend} className="bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full p-3 shrink-0">
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}