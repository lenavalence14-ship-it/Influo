import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Retourne { hasUnreadMessages, hasUnreadNotifications } pour afficher un point
 * sur les icônes messages / notifications. Se met à jour en temps réel.
 */
export function useUnreadCounts() {
  const { user, influencerProfile } = useAuth()
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const checkMessages = async () => {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, client_id, influenceur_id, client_last_read_at, influenceur_last_read_at, updated_at')
        .or(
          influencerProfile?.id
            ? `client_id.eq.${user.id},influenceur_id.eq.${influencerProfile.id}`
            : `client_id.eq.${user.id}`
        )

      if (cancelled) return

      const unread = (convs || []).some((c) => {
        const isClient = c.client_id === user.id
        const lastRead = isClient ? c.client_last_read_at : c.influenceur_last_read_at
        if (!c.updated_at) return false
        return !lastRead || new Date(c.updated_at) > new Date(lastRead)
      })
      setHasUnreadMessages(unread)
    }

    const checkNotifications = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('lu', false)

      if (!cancelled) setHasUnreadNotifications((count || 0) > 0)
    }

    checkMessages()
    checkNotifications()

    const channel = supabase
      .channel('unread-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, checkNotifications)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, checkMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, checkMessages)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user, influencerProfile])

  return { hasUnreadMessages, hasUnreadNotifications }
}
