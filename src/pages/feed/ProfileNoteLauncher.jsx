import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import NoteViewer from './NoteViewer'

// Permet d'ouvrir le viewer de notes d'UN utilisateur précis depuis une page
// de profil (InfluencerProfile, ClientProfileView, SimpleUserProfileView) :
// quand on clique sur l'avatar d'un profil qui a une note active, on doit
// voir sa note plutôt que rester sur le profil. Ce composant construit le
// même genre de "groupe" que NoteBar (notes perso + reposts faits par cet
// utilisateur, mélangés chronologiquement), mais limité à cette seule
// personne : un seul groupe, pas de navigation groupe-à-groupe possible
// (fermer le viewer revient simplement au profil).
//
// Usage :
//   const { openNote, viewer } = useProfileNoteLauncher(userId)
//   <img onClick={openNote} ... />
//   {viewer}
export function useProfileNoteLauncher(userId) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: items = [] } = useQuery({
    queryKey: ['profile-notes', userId],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('notes')
        .select('id, user_id, contenu, created_at, expire_at, repost_of, photo_url, filtre, crop, zoom, texte_overlay, texte_x, texte_y, texte_couleur, texte_police, audio_url, audio_start, audio_duration, users(id, nom_complet, photo_url, role)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      const rows = data || []

      // Il faut aussi les notes ORIGINALES référencées par les reposts de cet
      // utilisateur, pour afficher correctement l'auteur original en cloche.
      const repostOfIds = rows.filter((n) => n.repost_of).map((n) => n.repost_of)
      let originalsById = new Map()
      if (repostOfIds.length) {
        const { data: originals } = await supabase
          .from('notes')
          .select('id, user_id, contenu, created_at, expire_at, repost_of, photo_url, filtre, crop, zoom, texte_overlay, texte_x, texte_y, texte_couleur, texte_police, audio_url, audio_start, audio_duration, users(id, nom_complet, photo_url, role)')
          .in('id', repostOfIds)
        originalsById = new Map((originals || []).map((o) => [o.id, o]))
      }

      return rows
        .filter((n) => new Date(n.expire_at).getTime() > Date.now())
        .map((n) => {
          const isRepost = !!n.repost_of
          const original = isRepost ? originalsById.get(n.repost_of) : n
          if (!original) return null
          return {
            kind: isRepost ? 'repost' : 'original',
            entry: n,
            original,
            reposter: isRepost ? n.users : null,
          }
        })
        .filter(Boolean)
    },
  })

  const hasActiveNote = items.length > 0

  const openNote = () => {
    if (hasActiveNote) setOpen(true)
  }

  const viewer = (
    <AnimatePresence>
      {open && hasActiveNote && (
        <NoteViewer
          key="profile-note-viewer"
          groups={[{ userId, items }]}
          startGroupIndex={0}
          onClose={() => {
            setOpen(false)
            queryClient.invalidateQueries({ queryKey: ['notes'] })
          }}
        />
      )}
    </AnimatePresence>
  )

  return { openNote, viewer, hasActiveNote }
}
