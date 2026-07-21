import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// Même logique que NewConversationBiz.jsx, mais entre deux utilisateur_simple :
// pas de profils_client, on référence directement users.id.
export default function NewConversationSociale() {
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

      // La conversation peut avoir été créée avec ce compte comme a ou comme b :
      // on vérifie les deux ordres avant de conclure qu'elle n'existe pas encore.
      const { data: existing } = await supabase
        .from('conversations_sociale')
        .select('id')
        .or(
          `and(user_a_id.eq.${user.id},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${user.id})`
        )
        .maybeSingle()

      if (existing) {
        navigate(`/messages/sociale/${existing.id}`, { replace: true })
        return
      }

      const { data: created, error } = await supabase
        .from('conversations_sociale')
        .insert({ user_a_id: user.id, user_b_id: otherUserId })
        .select()
        .single()

      if (error || !created) {
        navigate('/messages')
        return
      }
      navigate(`/messages/sociale/${created.id}`, { replace: true })
    }
    run()
  }, [user?.id, otherUserId, navigate])

  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}
