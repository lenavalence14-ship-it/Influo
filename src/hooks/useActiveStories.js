import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Retourne un Set des influenceur_id ayant au moins une story active (non expirée).
 * Usage : const activeStoryIds = useActiveStories()
 *         const hasStory = activeStoryIds.has(influencerId)
 */
export function useActiveStories() {
  const [activeIds, setActiveIds] = useState(new Set())

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data } = await supabase
        .from('posts')
        .select('influenceur_id')
        .eq('type', 'story')
        .gt('expire_at', new Date().toISOString())

      if (!cancelled) {
        setActiveIds(new Set((data || []).map((p) => p.influenceur_id)))
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return activeIds
}