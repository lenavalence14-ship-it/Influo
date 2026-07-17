import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const { user } = useAuth()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setNotifications(data || [])

      // marquer comme lues
      await supabase.from('notifications').update({ lu: true }).eq('user_id', user.id).eq('lu', false)
    }
    if (user) load()
  }, [user])

  return (
    <div>
      <header className="px-5 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
      </header>

      {notifications.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center mx-4">
          <p className="text-[var(--text-secondary)]">Rien de nouveau pour le moment.</p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className={`glass rounded-2xl p-4 text-sm ${!n.lu ? 'glass-strong' : ''}`}>
              {n.contenu}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
