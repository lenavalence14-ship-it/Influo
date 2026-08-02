import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import * as messagesApi from '../../api/messages'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { ArrowLeft } from 'lucide-react'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

export default function NewConversation() {
  const [searchParams] = useSearchParams()
  const offreId = searchParams.get('offre')
  const influenceurIdParam = searchParams.get('influenceur')
  const [offre, setOffre] = useState(null)
  const [influenceurDirect, setInfluenceurDirect] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      if (offreId) {
        const data = await messagesApi.fetchOffreWithInfluencer(offreId)
        setOffre(data)
        setMessage(
          `Bonjour ! Je suis intéressé(e) par votre offre "${data?.titre}" à ${data?.prix} € (délai ${data?.delai_jours} jours). Pouvons-nous en discuter ?`
        )
      } else if (influenceurIdParam) {
        const data = await messagesApi.fetchInfluencerBasic(influenceurIdParam)
        setInfluenceurDirect(data)
        setMessage('Bonjour ! Je souhaiterais discuter d\'une collaboration avec vous.')
      } else {
        setMessage('Bonjour ! Je souhaiterais discuter d\'une collaboration avec vous.')
      }
      setLoading(false)
    }
    load()
  }, [offreId, influenceurIdParam])

  const handleSend = async () => {
    setSending(true)
    const influenceurId = offre?.profils_influenceur?.id || influenceurIdParam

    const { conversationId, error } = await messagesApi.findOrCreateConversation({
      userId: user.id,
      influenceurId,
      offreId,
      firstMessage: message,
    })

    setSending(false)
    if (error) return
    navigate(`/messages/${conversationId}`)
  }

  const influencer = offre?.profils_influenceur || influenceurDirect

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-5 pt-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-caption mb-6">
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-h1 mb-1 flex items-center gap-1.5">
        Contacter {influencer?.users?.nom_complet || ''}
        {influencer?.verifie && <VerifiedBadge size={17} />}
      </h1>
      <p className="text-caption mb-6">
        Modifie le message avant de l'envoyer si tu veux.
      </p>

      <div className="glass-strong rounded-2xl p-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          className="w-full bg-transparent outline-none resize-none text-body"
        />
      </div>

      <Button fullWidth className="mt-6" onClick={handleSend} disabled={sending || !message.trim()}>
        {sending ? 'Envoi...' : 'Envoyer le message'}
      </Button>
    </div>
  )
}