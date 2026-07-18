import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Heart, MessageCircle, ShoppingBag, Wallet } from 'lucide-react'
import Card from '../../components/ui/Card'

const TYPE_ICON = {
  like: Heart,
  comment: MessageCircle,
  commande: ShoppingBag,
  retrait: Wallet,
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setNotifications(data || [])
      setLoading(false)

      await supabase.from('notifications').update({ lu: true }).eq('user_id', user.id).eq('lu', false)
    }
    if (user) load()
  }, [user])

  const handleClick = (n) => {
    if (!n.lien_ref_id) return
    if (n.type === 'like' || n.type === 'comment') navigate('/')
    else if (n.type === 'commande') navigate('/dashboard')
    else if (n.type === 'retrait') navigate('/wallet')
  }

  return (
    <div>
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-h1">Notifications</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <Card variant="subtle" padding="lg" className="text-center mx-4">
          <p className="text-body text-[var(--text-secondary)]">Rien de nouveau pour le moment.</p>
        </Card>
      ) : (
        <div className="px-4 space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] || Heart
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-colors duration-200 ${
                  n.lu ? 'glass' : 'glass-strong'
                }`}
              >
                <div className="w-9 h-9 rounded-full glass flex items-center justify-center shrink-0">
                  <Icon size={16} className={n.type === 'like' ? 'text-red-500' : ''} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-small">{n.contenu}</p>
                </div>
                {!n.lu && <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
