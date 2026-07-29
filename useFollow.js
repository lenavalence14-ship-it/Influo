import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Un seul fetch pour TOUS les comptes suivis par l'utilisateur courant, mis
// en cache React Query sous une clé PARTAGÉE ['following-ids', userId] --
// n'importe quel composant qui appelle useFollow, où qu'il soit dans l'app
// (feed, page profil, post détaillé...), lit et écrit dans ce même cache.
// C'est ce qui corrige le désync observé auparavant : avant ce correctif,
// chaque instance de useFollow avait son PROPRE useState local, donc
// s'abonner depuis le feed ne mettait pas à jour le bouton affiché sur
// l'écran de profil (et inversement) tant que le composant n'était pas
// entièrement remonté (d'où "il faut actualiser").
async function fetchFollowingIds(userId) {
  const { data } = await supabase.from('follows').select('followed_id').eq('follower_id', userId)
  return new Set((data || []).map((f) => f.followed_id))
}

async function fetchFollowCounts(targetUserId) {
  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('followed_id', targetUserId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', targetUserId),
  ])
  return { followersCount: followersCount || 0, followingCount: followingCount || 0 }
}

/**
 * Gère le bouton "Suivre" pour n'importe quel profil visité (influenceur, entreprise,
 * ou utilisateur normal), et expose le nombre d'abonnés plateforme (followers réels
 * sur Influo — à ne pas confondre avec nombre_abonnes, qui reste le compteur déclaratif
 * des réseaux sociaux externes de l'influenceur).
 *
 * targetUserId : toujours un public.users.id, quel que soit le type de compte visité.
 *
 * isFollowing/toggleFollow s'appuient sur le cache PARTAGÉ ['following-ids',
 * currentUserId] (React Query) : deux instances de ce hook pour le même
 * currentUserId, appelées depuis deux écrans différents, voient TOUJOURS le
 * même isFollowing et se mettent à jour ensemble, sans refetch ni remontage.
 * followersCount/followingCount restent une requête à part (par targetUserId),
 * ce sont des compteurs publics du profil visité, pas liés à "est-ce que MOI
 * je le suis" -- ne bénéficieraient pas du même partage de cache de toute
 * façon puisqu'ils varient par profil visité, pas par utilisateur courant.
 */
export function useFollow(targetUserId) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: followingIds, isLoading: followingIdsLoading } = useQuery({
    queryKey: ['following-ids', user?.id],
    queryFn: () => fetchFollowingIds(user.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['follow-counts', targetUserId],
    queryFn: () => fetchFollowCounts(targetUserId),
    enabled: !!targetUserId,
    staleTime: 30_000,
  })

  const isFollowing = Boolean(targetUserId && followingIds?.has(targetUserId))
  const loading = (!!targetUserId && countsLoading) || (!!user?.id && followingIdsLoading)

  // Mutation optimiste partagée : met à jour IMMÉDIATEMENT le cache
  // ['following-ids', user.id] (donc TOUS les composants montés qui lisent ce
  // cache re-rendent aussitôt, quel que soit l'écran) puis synchronise avec
  // la base. Le compteur ['follow-counts', targetUserId] est mis à jour en
  // même temps par cohérence d'affichage immédiate.
  const toggleFollow = useCallback(async () => {
    if (!user?.id || !targetUserId) return
    const currentlyFollowing = Boolean(followingIds?.has(targetUserId))

    queryClient.setQueryData(['following-ids', user.id], (old) => {
      const next = new Set(old || [])
      if (currentlyFollowing) next.delete(targetUserId)
      else next.add(targetUserId)
      return next
    })
    queryClient.setQueryData(['follow-counts', targetUserId], (old) => {
      const base = old || { followersCount: 0, followingCount: 0 }
      return {
        ...base,
        followersCount: Math.max(0, base.followersCount + (currentlyFollowing ? -1 : 1)),
      }
    })

    if (currentlyFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_id', targetUserId)
      if (error) {
        // Échec réseau : on annule l'optimisme en réinvalidant depuis la base,
        // plutôt que de laisser un état local désynchronisé de la vérité serveur.
        queryClient.invalidateQueries({ queryKey: ['following-ids', user.id] })
        queryClient.invalidateQueries({ queryKey: ['follow-counts', targetUserId] })
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followed_id: targetUserId })
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['following-ids', user.id] })
        queryClient.invalidateQueries({ queryKey: ['follow-counts', targetUserId] })
      }
    }
  }, [user?.id, targetUserId, followingIds, queryClient])

  return {
    followersCount: counts?.followersCount || 0,
    followingCount: counts?.followingCount || 0,
    isFollowing,
    loading,
    pending: false,
    toggleFollow,
  }
}
