import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Fetch partagé de tous les media kits existants, avec résolution du bon id
// de navigation (profils_influenceur.id, pas users.id -- media_kits.influenceur_id
// référence users(id), et il n'y a pas de foreign key direct entre les deux
// tables, donc on joint manuellement ici plutôt que de dupliquer cette
// logique dans chaque composant qui affiche un media kit).
export function useMediaKits() {
  return useQuery({
    queryKey: ['media-kits-suggestion'],
    queryFn: async () => {
      const { data: kits, error: kitsError } = await supabase.from('media_kits').select('*')
      if (kitsError) throw kitsError
      if (!kits || kits.length === 0) return []

      const userIds = kits.map((k) => k.influenceur_id)
      const { data: profils, error: profilsError } = await supabase
        .from('profils_influenceur')
        .select('id, user_id')
        .in('user_id', userIds)
      if (profilsError) throw profilsError

      const profilIdByUserId = new Map((profils || []).map((p) => [p.user_id, p.id]))
      return kits
        .map((k) => ({ ...k, profilId: profilIdByUserId.get(k.influenceur_id) }))
        .filter((k) => k.profilId) // exclut un media kit orphelin (profil influenceur supprimé entretemps)
    },
    staleTime: 5 * 60_000,
  })
}
