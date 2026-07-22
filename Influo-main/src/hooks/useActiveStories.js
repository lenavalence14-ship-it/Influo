import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const EMPTY_SET = new Set()

async function fetchActiveStoryIds() {
  const { data } = await supabase
    .from('posts')
    .select('influenceur_id')
    .eq('type', 'story')
    .gt('expire_at', new Date().toISOString())

  return new Set((data || []).map((p) => p.influenceur_id))
}

/**
 * Retourne un Set des influenceur_id ayant au moins une story active (non expirée).
 * Usage : const activeStoryIds = useActiveStories()
 *         const hasStory = activeStoryIds.has(influencerId)
 *
 * Basé sur React Query : quel que soit le nombre de composants qui appellent ce hook
 * en même temps (un par PostCard du feed, par exemple), une seule requête réseau est
 * émise et le résultat est partagé via le cache (clé ['active-story-ids']).
 * Avant, chaque PostCard déclenchait sa propre requête Supabase indépendante.
 */
export function useActiveStories() {
  const { data } = useQuery({
    queryKey: ['active-story-ids'],
    queryFn: fetchActiveStoryIds,
    staleTime: 30_000,
  })

  return data || EMPTY_SET
}
