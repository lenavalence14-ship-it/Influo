import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// Même logique que NewConversationPro.jsx : pas d'écran intermédiaire, on crée ou
// retrouve la conversation puis on redirige directement dans le chat.
export default function NewConversationBiz() {
  const [params] = useSearchParams()
  const otherEntrepriseUserId = params.get('entreprise')
  const { user, clientProfile } = useAuth()
  const navigate = useNavigate()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const run = async () => {
      if (!user?.id || !clientProfile?.id || !otherEntrepriseUserId) {
        navigate('/messages')
        return
      }

      const { data: otherClientProfile } = await supabase
        .from('profils_client')
        .select('id')
        .eq('user_id', otherEntrepriseUserId)
        .maybeSingle()

      if (!otherClientProfile || otherClientProfile.id === clientProfile.id) {
        navigate('/messages')
        return
      }

      // La conversation peut avoir été créée avec ce compte comme a ou comme b :
      // on vérifie les deux ordres avant de conclure qu'elle n'existe pas encore.
      const { data: existing } = await supabase
        .from('conversations_biz')
        .select('id')
        .or(
          `and(client_a_id.eq.${clientProfile.id},client_b_id.eq.${otherClientProfile.id}),and(client_a_id.eq.${otherClientProfile.id},client_b_id.eq.${clientProfile.id})`
        )
        .maybeSingle()

      if (existing) {
        navigate(`/messages/biz/${existing.id}`, { replace: true })
        return
      }

      const { data: created, error } = await supabase
        .from('conversations_biz')
        .insert({ client_a_id: clientProfile.id, client_b_id: otherClientProfile.id })
        .select()
        .single()

      if (error || !created) {
        navigate('/messages')
        return
      }
      navigate(`/messages/biz/${created.id}`, { replace: true })
    }
    run()
  }, [user?.id, clientProfile?.id, otherEntrepriseUserId, navigate])

  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}
