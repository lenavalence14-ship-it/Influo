import { useEffect, useRef, useState } from 'react'
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
  const channelIdRef = useRef(`unread-counts-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const checkMessages = async () => {
      try {
        const orFilter = influencerProfile?.id
          ? `client_id.eq.${user.id},influenceur_id.eq.${influencerProfile.id}`
          : `client_id.eq.${user.id}`

        const { data: convs, error } = await supabase
          .from('conversations')
          .select('id, client_id, influenceur_id, client_last_read_at, influenceur_last_read_at, updated_at')
          .or(orFilter)

        if (cancelled || error) return

        const unread = (convs || []).some((c) => {
          const isClient = c.client_id === user.id
          const lastRead = isClient ? c.client_last_read_at : c.influenceur_last_read_at
          if (!c.updated_at) return false
          return !lastRead || new Date(c.updated_at) > new Date(lastRead)
        })
        setHasUnreadMessages(unread)
      } catch (err) {
        console.warn('checkMessages a échoué (non bloquant):', err)
      }
    }

    const checkNotifications = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('lu', false)

        if (!cancelled && !error) setHasUnreadNotifications((count || 0) > 0)
      } catch (err) {
        console.warn('checkNotifications a échoué (non bloquant):', err)
      }
    }

    checkMessages()
    checkNotifications()

    let channel = null
    try {
      channel = supabase
        .channel(channelIdRef.current)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, checkNotifications)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, checkMessages)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, checkMessages)
        .subscribe((status, err) => {
          if (err) console.warn('Realtime unread-counts erreur (non bloquant):', err)
        })
    } catch (err) {
      console.warn('Impossible de créer le canal Realtime unread-counts (non bloquant):', err)
    }

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [user, influencerProfile])

  return { hasUnreadMessages, hasUnreadNotifications }
}
