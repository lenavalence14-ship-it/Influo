import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Retourne { hasUnreadMessages, hasUnreadNotifications } pour afficher un point
 * sur les icônes messages / notifications. Se met à jour en temps réel.
 *
 * Couvre maintenant deux systèmes de conversation distincts :
 * - conversations (influenceur ↔ client), déjà existant
 * - conversations_pro (utilisateur_simple ↔ entreprise), nouveau
 * Les deux ont des colonnes différentes (influenceur_id vs utilisateur_id) donc on
 * les vérifie séparément puis on combine les deux résultats en un seul booléen.
 */
export function useUnreadCounts() {
  const { user, influencerProfile, clientProfile } = useAuth()
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

        let unread = false
        if (!error) {
          unread = (convs || []).some((c) => {
            const isClient = c.client_id === user.id
            const lastRead = isClient ? c.client_last_read_at : c.influenceur_last_read_at
            if (!c.updated_at) return false
            return !lastRead || new Date(c.updated_at) > new Date(lastRead)
          })
        }

        // conversations_pro : utilisateur_id référence directement users.id, tandis que
        // client_id référence profils_client.id (d'où l'usage de clientProfile?.id ici,
        // et non user.id comme pour la table conversations ci-dessus).
        const orFilterPro = clientProfile?.id
          ? `utilisateur_id.eq.${user.id},client_id.eq.${clientProfile.id}`
          : `utilisateur_id.eq.${user.id}`

        const { data: convsPro, error: errorPro } = await supabase
          .from('conversations_pro')
          .select('id, utilisateur_id, client_id, utilisateur_last_read_at, client_last_read_at, updated_at')
          .or(orFilterPro)

        let unreadPro = false
        if (!errorPro) {
          unreadPro = (convsPro || []).some((c) => {
            const isUtilisateur = c.utilisateur_id === user.id
            const lastRead = isUtilisateur ? c.utilisateur_last_read_at : c.client_last_read_at
            if (!c.updated_at) return false
            return !lastRead || new Date(c.updated_at) > new Date(lastRead)
          })
        }

        // conversations_biz : entreprise <-> entreprise, symétrique (client_a/client_b).
        let unreadBiz = false
        if (clientProfile?.id) {
          const { data: convsBiz, error: errorBiz } = await supabase
            .from('conversations_biz')
            .select('id, client_a_id, client_b_id, client_a_last_read_at, client_b_last_read_at, updated_at')
            .or(`client_a_id.eq.${clientProfile.id},client_b_id.eq.${clientProfile.id}`)

          if (!errorBiz) {
            unreadBiz = (convsBiz || []).some((c) => {
              const isSideA = c.client_a_id === clientProfile.id
              const lastRead = isSideA ? c.client_a_last_read_at : c.client_b_last_read_at
              if (!c.updated_at) return false
              return !lastRead || new Date(c.updated_at) > new Date(lastRead)
            })
          }
        }

        if (!cancelled) setHasUnreadMessages(unread || unreadPro || unreadBiz)
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages_pro' }, checkMessages)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations_pro' }, checkMessages)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages_biz' }, checkMessages)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations_biz' }, checkMessages)
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
  }, [user, influencerProfile, clientProfile])

  return { hasUnreadMessages, hasUnreadNotifications }
}
