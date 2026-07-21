import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// Contrairement à NewConversation.jsx (influenceur↔client, avec écran de sélection
// d'offre + message pré-rempli), ce composant ne s'affiche jamais : il crée ou retrouve
// la conversation_pro puis redirige immédiatement vers le chat, conformément à la
// consigne "pas de message pré-rempli, direct dans le chat".
export default function NewConversationPro() {
  const [params] = useSearchParams()
  const entrepriseUserId = params.get('entreprise') // public.users.id de l'entreprise visée
  const { user } = useAuth()
  const navigate = useNavigate()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const run = async () => {
      if (!user?.id || !entrepriseUserId) {
        navigate('/messages')
        return
      }

      const { data: clientProfile } = await supabase
        .from('profils_client')
        .select('id')
        .eq('user_id', entrepriseUserId)
        .maybeSingle()

      if (!clientProfile) {
        navigate('/messages')
        return
      }

      const { data: existing } = await supabase
        .from('conversations_pro')
        .select('id')
        .eq('utilisateur_id', user.id)
        .eq('client_id', clientProfile.id)
        .maybeSingle()

      if (existing) {
        navigate(`/messages/pro/${existing.id}`, { replace: true })
        return
      }

      const { data: created, error } = await supabase
        .from('conversations_pro')
        .insert({ utilisateur_id: user.id, client_id: clientProfile.id })
        .select()
        .single()

      if (error || !created) {
        navigate('/messages')
        return
      }
      navigate(`/messages/pro/${created.id}`, { replace: true })
    }
    run()
  }, [user?.id, entrepriseUserId, navigate])

  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}
