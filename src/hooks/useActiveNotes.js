import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const EMPTY_SET = new Set()

async function fetchActiveNoteUserIds() {
  const { data } = await supabase
    .from('notes')
    .select('user_id')
    .gt('expire_at', new Date().toISOString())

  return new Set((data || []).map((n) => n.user_id))
}

/**
 * Retourne un Set des user_id ayant au moins une note texte active (non expirée),
 * qu'il s'agisse d'une note personnelle ou d'un repost. Utilisé pour savoir si
 * cliquer sur l'avatar d'un profil doit ouvrir sa note plutôt que rester sur
 * la page de profil.
 * Basé sur React Query : une seule requête réseau partagée entre tous les
 * composants qui appellent ce hook (clé ['active-note-user-ids']).
 */
export function useActiveNotes() {
  const { data } = useQuery({
    queryKey: ['active-note-user-ids'],
    queryFn: fetchActiveNoteUserIds,
    staleTime: 15_000,
  })

  return data || EMPTY_SET
}
