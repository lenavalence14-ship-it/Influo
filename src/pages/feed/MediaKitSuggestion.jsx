import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Camera } from 'lucide-react'

// Suggestion de media kit en haut du feed, façon "suggestions pour toi"
// Instagram : aucune identité affichée (pas d'avatar, pas de nom de profil),
// juste le visuel du media kit en plein cadre. Un tirage aléatoire par
// chargement du feed ; si un seul media kit existe, c'est toujours celui-là.
// Seule la photo est cliquable, et renvoie vers le profil de l'auteur.
export default function MediaKitSuggestion() {
  const navigate = useNavigate()

  const { data: mediaKits = [] } = useQuery({
    queryKey: ['media-kits-suggestion'],
    queryFn: async () => {
      // media_kits.influenceur_id référence users(id), mais la route de
      // profil (/influenceur/:id) attend l'id de profils_influenceur. Pas de
      // foreign key direct entre les deux tables : on résout donc le bon id
      // de navigation via une seconde requête, jointe ici en JS.
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

  const chosen = useMemo(() => {
    if (mediaKits.length === 0) return null
    return mediaKits[Math.floor(Math.random() * mediaKits.length)]
  }, [mediaKits.length])

  if (!chosen) return null

  return (
    <div className="w-full aspect-[4/5]" style={{ backgroundColor: '#dcdcd4' }}>
      <div className="flex items-center justify-between px-5 pt-5 text-[11px] tracking-[0.2em] text-black/80 uppercase">
        <span>Media Kit</span>
        <span>Content Creator</span>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/influenceur/${chosen.profilId}`)}
        className="block mx-5 mt-4 h-[45%] w-[calc(100%-2.5rem)] overflow-hidden bg-black/10 rounded-lg"
        aria-label="Voir le profil"
      >
        {chosen.photo_url ? (
          <img src={chosen.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-black/30">
            <Camera size={32} />
          </div>
        )}
      </button>

      <div className="flex justify-between px-5 mt-5 text-black">
        <span className="text-[24px] tracking-[0.15em] uppercase">{chosen.prenom}</span>
        <span className="text-[24px] tracking-[0.15em] uppercase">{chosen.nom}</span>
      </div>

      {chosen.categories?.length > 0 && (
        <div className="px-5 mt-5">
          <div className="inline-block px-3 py-1.5" style={{ backgroundColor: '#2fae8f' }}>
            <span className="text-[12px] tracking-[0.2em] uppercase text-black">
              {chosen.categories.join(' • ')}
            </span>
          </div>
        </div>
      )}

      <div className="px-5 mt-6 space-y-1 text-black">
        {chosen.abonnes_instagram != null && (
          <p className="text-right text-[13px] underline">Instagram Followers: {chosen.abonnes_instagram.toLocaleString()}</p>
        )}
        {chosen.abonnes_tiktok != null && (
          <p className="text-[13px] underline">TikTok Followers: {chosen.abonnes_tiktok.toLocaleString()}</p>
        )}
      </div>
    </div>
  )
}
