import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as messagesApi from '../../api/messages'
import * as authApi from '../../api/auth'
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

      const otherClientProfile = await authApi.fetchClientProfileIdByUserId(otherEntrepriseUserId)

      if (!otherClientProfile || otherClientProfile.id === clientProfile.id) {
        navigate('/messages')
        return
      }

      const { conversationId, error } = await messagesApi.findOrCreateSymmetricConversation({
        table: 'conversations_biz',
        sideAField: 'client_a_id',
        sideBField: 'client_b_id',
        myId: clientProfile.id,
        otherId: otherClientProfile.id,
        insertFields: { client_a_id: clientProfile.id, client_b_id: otherClientProfile.id },
      })

      if (error) {
        navigate('/messages')
        return
      }
      navigate(`/messages/biz/${conversationId}`, { replace: true })
    }
    run()
  }, [user?.id, clientProfile?.id, otherEntrepriseUserId, navigate])

  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}
