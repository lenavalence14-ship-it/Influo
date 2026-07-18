import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft, Send, Camera, Image as ImageIcon,
  Download, Check, Banknote, ThumbsUp, PackageCheck, ShieldCheck,
  Phone, Video, Plus, Mic,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import BottomSheet from '../../components/ui/BottomSheet'
import { generateReceipt } from '../../lib/receipt'
import { timeShort } from '../../lib/time'

const FORMATS = [
  { value: 'carre', label: '1:1' },
  { value: 'horizontal', label: '4:3' },
  { value: 'vertical', label: '2:3' },
  { value: 'vertical_45', label: '4:5' },
]

export default function Chat() {
  const { id } = useParams()
  const [conversation, setConversation] = useState(null)
  const [commande, setCommande] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [showPaymentAsk, setShowPaymentAsk] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')

  // --- état du formulaire de livraison (collaboration vérifiée) ---
  const [showDeliverForm, setShowDeliverForm] = useState(false)
  const [deliverLienInstagram, setDeliverLienInstagram] = useState('')
  const [deliverLienTiktok, setDeliverLienTiktok] = useState('')
  const [deliverFile, setDeliverFile] = useState(null)
  const [deliverPreview, setDeliverPreview] = useState(null)
  const [deliverFormat, setDeliverFormat] = useState('carre')
  const [deliverLoading, setDeliverLoading] = useState(false)
  const deliverFileInputRef = useRef(null)

  const { user, profile, influencerProfile } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
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

    const readField = isInfluencer ? 'influenceur_last_read_at' : 'client_last_read_at'
    await supabase.from('conversations').update({ [readField]: new Date().toISOString() }).eq('id', id)
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

  const handleDeliverFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDeliverFile(file)
    setDeliverPreview(URL.createObjectURL(file))
  }

  const handleDeliverSubmit = async () => {
    if (!deliverLienInstagram && !deliverLienTiktok) return
    if (!deliverFile) return
    setDeliverLoading(true)

    const fileName = `${influencerProfile.id}/livraisons/${commande.id}-${Date.now()}-${deliverFile.name}`
    const { error: uploadError } = await supabase.storage.from('posts').upload(fileName, deliverFile)
    if (uploadError) {
      setDeliverLoading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
    const mediaUrl = urlData.publicUrl

    await supabase
      .from('commandes')
      .update({
        status: 'en_attente_validation',
        lien_livraison: deliverLienInstagram || deliverLienTiktok,
        lien_instagram: deliverLienInstagram || null,
        lien_tiktok: deliverLienTiktok || null,
        media_livraison_url: mediaUrl,
        media_crop_format: deliverFormat,
      })
      .eq('id', commande.id)

    await sendSystemMessage(
      `📎 Prestation livrée${deliverLienInstagram ? ` — Instagram : ${deliverLienInstagram}` : ''}${deliverLienTiktok ? ` — TikTok : ${deliverLienTiktok}` : ''}`,
      mediaUrl
    )

    setCommande((c) => ({
      ...c,
      status: 'en_attente_validation',
      lien_livraison: deliverLienInstagram || deliverLienTiktok,
      lien_instagram: deliverLienInstagram || null,
      lien_tiktok: deliverLienTiktok || null,
      media_livraison_url: mediaUrl,
      media_crop_format: deliverFormat,
    }))

    setDeliverLoading(false)
    setShowDeliverForm(false)
    setDeliverLienInstagram('')
    setDeliverLienTiktok('')
    setDeliverFile(null)
    setDeliverPreview(null)
  }

  const handleConfirmReception = async () => {
    await supabase.from('commandes').update({ status: 'terminee' }).eq('id', commande.id)

    if (commande.media_livraison_url) {
      const { data: newPost } = await supabase
        .from('posts')
        .insert({
          influenceur_id: commande.influenceur_id,
          type: 'photo',
          crop_format: commande.media_crop_format || 'carre',
          commande_id: commande.id,
          client_id: commande.client_id,
        })
        .select()
        .single()

      if (newPost) {
        await supabase.from('post_medias').insert({
          post_id: newPost.id,
          media_url: commande.media_livraison_url,
          position: 0,
        })
        await supabase.from('commandes').update({ post_id: newPost.id }).eq('id', commande.id)
      }
    }

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
  }if (!conversation) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  const other = isInfluencer ? conversation.client : conversation.profils_influenceur?.users

  const contextAction = (() => {
    if (!isInfluencer && commande?.status === 'paiement_demande') {
      return { icon: Banknote, label: `Payer ${commande.montant} €`, onClick: handlePay }
    }
    if (isInfluencer && commande?.status === 'paiement_effectue') {
      return { icon: PackageCheck, label: 'Livrer la prestation', onClick: () => setShowDeliverForm(true) }
    }
    if (!isInfluencer && commande?.status === 'en_attente_validation') {
      return { icon: ShieldCheck, label: 'Confirmer la réception', onClick: handleConfirmReception }
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
        <p className="text-body-medium flex items-center gap-1.5 flex-1 min-w-0 truncate">
          <span className="truncate">{other?.nom_complet}</span>
          {!isInfluencer && conversation.profils_influenceur?.verifie && <VerifiedBadge size={14} />}
        </p>

        {isInfluencer && (!commande || commande.status === 'en_discussion') && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowPaymentAsk(true)}
              className="w-9 h-9 flex items-center justify-center"
              style={{ color: 'var(--accent)' }}
              aria-label="Recevoir le paiement"
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
              Recevoir le paiement
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
        {messages.map((m) => {
          const isMe = m.sender_id === user.id
          const isSystem = !m.sender_id
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
                </>
              )}
            </div>
          )
        })}

        {!isInfluencer && ['paiement_effectue', 'en_attente_validation', 'terminee'].includes(commande?.status) && (
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
        <BottomSheet onClose={() => setShowPaymentAsk(false)} title="Recevoir le paiement">
          <div className="px-4 pb-4 pt-1 flex gap-2">
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
        </BottomSheet>
      )}

      {showDeliverForm && (
        <BottomSheet onClose={() => setShowDeliverForm(false)} title="Livrer la prestation" height="tall">
          <div className="px-4 pb-4 space-y-3">
            <p className="text-caption text-[var(--text-secondary)]">
              Envoie le média de ta publication réelle + le(s) lien(s). Elle apparaîtra comme collaboration vérifiée dans le feed.
            </p>

            <label className="block cursor-pointer">
              {deliverPreview ? (
                <div className={`w-full ${
                  deliverFormat === 'carre' ? 'aspect-square'
                  : deliverFormat === 'horizontal' ? 'aspect-[4/3]'
                  : deliverFormat === 'vertical_45' ? 'aspect-[4/5]'
                  : 'aspect-[2/3]'
                } rounded-2xl overflow-hidden bg-black/20`}>
                  <img src={deliverPreview} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full aspect-square rounded-2xl glass flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
                  <ImageIcon size={24} />
                  <span className="text-caption">Choisir le média de la publication</span>
                </div>
              )}
              <input
                ref={deliverFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleDeliverFileChange}
                className="hidden"
              />
            </label>

            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setDeliverFormat(f.value)}
                  className={`flex-1 rounded-2xl py-2 text-caption-medium transition-colors ${
                    deliverFormat === f.value ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'glass'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <input
              type="url"
              value={deliverLienInstagram}
              onChange={(e) => setDeliverLienInstagram(e.target.value)}
              placeholder="Lien Instagram (optionnel)"
              className="w-full glass rounded-2xl px-4 py-3 outline-none text-body"
            />
            <input
              type="url"
              value={deliverLienTiktok}
              onChange={(e) => setDeliverLienTiktok(e.target.value)}
              placeholder="Lien TikTok (optionnel)"
              className="w-full glass rounded-2xl px-4 py-3 outline-none text-body"
            />
            <p className="text-caption text-[var(--text-secondary)]">Au moins un lien est requis.</p>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowDeliverForm(false)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleDeliverSubmit}
                disabled={deliverLoading || (!deliverLienInstagram && !deliverLienTiktok) || !deliverFile}
                className="flex-1"
              >
                {deliverLoading ? 'Envoi...' : (
                  <span className="flex items-center justify-center gap-2">
                    <Check size={16} /> Livrer
                  </span>
                )}
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}