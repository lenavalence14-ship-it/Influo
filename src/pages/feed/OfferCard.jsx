import { useState } from 'react'
import { ChevronRight, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import BottomSheet from '../../components/ui/BottomSheet'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { timeAgo } from '../../lib/time'
import { getContrastTextColor } from '../../lib/offerColors'

// Carte "appel d'offre" publiée par un client (profils_client), mélangée au
// feed influenceur mais structurellement distincte d'un post (table
// appels_offre séparée -- pas de média, pas de like/comment/repost, auteur =
// client et non influenceur). Deux bandes couleur accent, comme demandé :
// - en haut, au niveau du nom du profil : "Appel d'offre" (pas de bouton), et
//   3 points à GAUCHE de "Appel d'offre", visibles uniquement pour le client
//   propriétaire, pour modifier/supprimer -- même pattern que le menu owner
//   de PostCard (BottomSheet, Modifier/Supprimer/Annuler).
// - en bas, juste avant l'endroit où seraient les actions : "Postuler" avec
//   un chevron -- deviendra un vrai bouton plus tard, réservé aux
//   influenceurs, mais pour l'instant purement visuel (pas de onClick).
export default function OfferCard({ offer, onDeleted }) {
  const client = offer.profils_client
  const { clientProfile } = useAuth()
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const isOwner = clientProfile?.id && client?.id && clientProfile.id === client.id

  // couleur choisie par le client (palette de marque), fallback sur l'accent
  // par défaut de l'app si non renseignée. Contraste texte calculé
  // automatiquement pour rester lisible quelle que soit la couleur choisie
  // (var(--accent) reste toujours en blanc, comportement historique inchangé).
  const bandColor = offer.couleur || 'var(--accent)'
  const bandTextColor = offer.couleur ? getContrastTextColor(offer.couleur) : '#ffffff'

  const handleDelete = async () => {
    if (!window.confirm("Supprimer définitivement cet appel d'offre ?")) return
    setShowMenu(false)
    await supabase.from('appels_offre').delete().eq('id', offer.id)
    setDeleted(true)
    onDeleted?.(offer.id)
  }

  if (deleted) return null

  return (
    <article className="mb-3 animate-fade-in feed-native">
      <div className="feed-surface overflow-hidden">
        {/* bande du haut : nom du profil client + libellé "Appel d'offre" */}
        <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: bandColor }}>
          <Link to={client?.user_id ? `/entreprise/${client.user_id}` : '#'} className="flex items-center gap-2 min-w-0">
            <Avatar src={client?.users?.photo_url} seed={client?.id} size="sm" />
            <span className="text-[13px] leading-[16px] font-medium truncate" style={{ color: bandTextColor }}>
              {client?.users?.nom_complet}
            </span>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {isOwner && (
              <button
                onClick={() => setShowMenu(true)}
                aria-label="Options"
                className="w-7 h-7 flex items-center justify-center"
                style={{ color: bandTextColor }}
              >
                <MoreHorizontal size={18} />
              </button>
            )}
            <span className="text-[13px] leading-[16px] font-medium" style={{ color: bandTextColor }}>Appel d'offre</span>
          </div>
        </div>

        {/* contenu texte de l'appel d'offre */}
        <p className="px-3 pt-3 pb-2 text-[14px] leading-[20px] whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
          {offer.contenu}
        </p>

        {offer.created_at && (
          <p className="px-3 pb-2 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {timeAgo(offer.created_at)}
          </p>
        )}

        {/* bande du bas : "Postuler", pas encore fonctionnel -- réservé aux
            influenceurs quand le bouton sera actif */}
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-between px-3 py-2 cursor-default"
          style={{ backgroundColor: bandColor, color: bandTextColor }}
        >
          <span className="text-[14px] font-medium">Postuler</span>
          <ChevronRight size={18} />
        </button>
      </div>

      {showMenu && (
        <BottomSheet onClose={() => setShowMenu(false)}>
          <button
            onClick={() => { setShowMenu(false); navigate(`/publier-offre/${offer.id}/modifier`) }}
            className="w-full flex items-center gap-3 px-5 py-3 text-body"
          >
            <Pencil size={18} /> Modifier l'appel d'offre
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-3 px-5 py-3 text-body text-[var(--accent)]"
          >
            <Trash2 size={18} /> Supprimer l'appel d'offre
          </button>
          <button
            onClick={() => setShowMenu(false)}
            className="w-full flex items-center gap-3 px-5 py-3 text-body text-[var(--text-secondary)]"
          >
            <X size={18} /> Annuler
          </button>
        </BottomSheet>
      )}
    </article>
  )
}
