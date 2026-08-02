import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as messagesApi from '../../api/messages'
import { useAuth } from '../../contexts/AuthContext'

// Même logique que NewConversationSociale.jsx, mais entre deux influenceurs.
// Ajouté pour permettre la réponse aux notes entre influenceurs.
export default function NewConversationInfluenceur() {
  const [params] = useSearchParams()
  const otherUserId = params.get('utilisateur')
  const { user } = useAuth()
  const navigate = useNavigate()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const run = async () => {
      if (!user?.id || !otherUserId || otherUserId === user.id) {
        navigate('/messages')
        return
      }

      const { conversationId, error } = await messagesApi.findOrCreateSymmetricConversation({
        table: 'conversations_influenceur',
        sideAField: 'user_a_id',
        sideBField: 'user_b_id',
        myId: user.id,
        otherId: otherUserId,
        insertFields: { user_a_id: user.id, user_b_id: otherUserId },
      })

      if (error) {
        navigate('/messages')
        return
      }
      navigate(`/messages/influenceur/${conversationId}`, { replace: true })
    }
    run()
  }, [user?.id, otherUserId, navigate])

  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}
