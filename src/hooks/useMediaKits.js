import { useQuery } from '@tanstack/react-query'
import * as profileApi from '../api/profile'

// Fetch partagé de tous les media kits existants, avec résolution du bon id
// de navigation (profils_influenceur.id, pas users.id -- media_kits.influenceur_id
// référence users(id), et il n'y a pas de foreign key direct entre les deux
// tables, donc on joint manuellement ici plutôt que de dupliquer cette
// logique dans chaque composant qui affiche un media kit).
export function useMediaKits() {
  return useQuery({
    queryKey: ['media-kits-suggestion'],
    queryFn: profileApi.fetchAllMediaKits,
    staleTime: 5 * 60_000,
  })
}
