import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Gère le bouton "Suivre" pour n'importe quel profil visité (influenceur, entreprise,
 * ou utilisateur normal), et expose le nombre d'abonnés plateforme (followers réels
 * sur Influo — à ne pas confondre avec nombre_abonnes, qui reste le compteur déclaratif
 * des réseaux sociaux externes de l'influenceur).
 *
 * targetUserId : toujours un public.users.id, quel que soit le type de compte visité.
 */
export function useFollow(targetUserId) {
  const { user } = useAuth()
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!targetUserId) { setLoading(false); return }
    let cancelled = false

    const load = async () => {
      const [{ count }, { count: followingCountResult }] = await Promise.all([
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('followed_id', targetUserId),
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', targetUserId),
      ])

      if (cancelled) return
      setFollowersCount(count || 0)
      setFollowingCount(followingCountResult || 0)

      if (user?.id) {
        const { data } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('followed_id', targetUserId)
          .maybeSingle()
        if (!cancelled) setIsFollowing(Boolean(data))
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [targetUserId, user?.id])

  const toggleFollow = async () => {
    if (!user?.id || !targetUserId || pending) return
    setPending(true)

    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_id', targetUserId)
      if (!error) {
        setIsFollowing(false)
        setFollowersCount((c) => Math.max(0, c - 1))
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followed_id: targetUserId })
      if (!error) {
        setIsFollowing(true)
        setFollowersCount((c) => c + 1)
      }
    }
    setPending(false)
  }

  return { followersCount, followingCount, isFollowing, loading, pending, toggleFollow }
}
