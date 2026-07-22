import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
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

      const { data: existing } = await supabase
        .from('conversations_influenceur')
        .select('id')
        .or(
          `and(user_a_id.eq.${user.id},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${user.id})`
        )
        .maybeSingle()

      if (existing) {
        navigate(`/messages/influenceur/${existing.id}`, { replace: true })
        return
      }

      const { data: created, error } = await supabase
        .from('conversations_influenceur')
        .insert({ user_a_id: user.id, user_b_id: otherUserId })
        .select()
        .single()

      if (error || !created) {
        navigate('/messages')
        return
      }
      navigate(`/messages/influenceur/${created.id}`, { replace: true })
    }
    run()
  }, [user?.id, otherUserId, navigate])

  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}
