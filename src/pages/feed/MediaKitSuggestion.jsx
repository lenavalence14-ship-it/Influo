import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { pickRandomTemplate } from './media-kit-templates'

// Affichage d'un media kit "suggestion", façon suggestion Instagram : aucune
// identité affichée (pas d'avatar, pas de nom de profil), juste le visuel du
// media kit en plein cadre. Reçoit le media kit à afficher en prop -- le
// tirage aléatoire du MEDIA KIT lui-même et son positionnement (en haut du
// feed ou intercalé en scrollant) sont décidés par Feed.jsx, pas ici, pour
// que les deux emplacements partagent la même règle de non-répétition.
//
// Le tirage du DESIGN (template) affiché, lui, se fait ici : à chaque
// apparition (chaque montage de ce composant), un design est choisi au
// hasard parmi ceux du registre -- volontairement indépendant du choix fait
// à une autre apparition du même media kit ailleurs dans le feed, pour que
// le profil ne soit pas reconnaissable à un design fixe.
export default function MediaKitSuggestion({ mediaKit, label = 'Suggestion pour toi' }) {
  const navigate = useNavigate()

  // useMemo sans dépendances : le tirage a lieu une seule fois par montage
  // de ce composant, pas à chaque re-render -- sinon le design changerait
  // sous les yeux de l'utilisateur pendant qu'il regarde la carte affichée.
  const Template = useMemo(() => pickRandomTemplate(), [])

  if (!mediaKit) return null

  return (
    <div className="w-full">
      <p className="px-4 py-2 text-caption-medium text-[var(--text-secondary)]">
        {label}
      </p>
      <Template mediaKit={mediaKit} onOpenProfile={() => navigate(`/influenceur/${mediaKit.profilId}`)} />
    </div>
  )
}
