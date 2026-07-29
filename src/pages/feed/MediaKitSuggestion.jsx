import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { getCropTransformStyle } from '../../lib/mediaCrop'

// Rendu visuel d'un media kit "suggestion", façon suggestion Instagram :
// aucune identité affichée (pas d'avatar, pas de nom de profil), juste le
// visuel du media kit en plein cadre. Reçoit le media kit à afficher en
// prop -- le tirage aléatoire et le choix de position (en haut du feed ou
// intercalé en scrollant) sont décidés par Feed.jsx, pas ici, pour que les
// deux emplacements partagent la même règle de non-répétition.
export default function MediaKitSuggestion({ mediaKit, label = 'Suggestion pour toi' }) {
  const navigate = useNavigate()

  if (!mediaKit) return null

  return (
    <div className="w-full">
      <p className="px-4 py-2 text-caption-medium text-[var(--text-secondary)]">
        {label}
      </p>
      <div className="w-full aspect-[4/5]" style={{ backgroundColor: '#dcdcd4' }}>
        <div className="flex items-center justify-between px-5 pt-5 text-[11px] tracking-[0.2em] text-black/80 uppercase">
          <span>Media Kit</span>
          <span>Content Creator</span>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/influenceur/${mediaKit.profilId}`)}
          className="block mx-5 mt-4 h-[45%] w-[calc(100%-2.5rem)] overflow-hidden bg-black/10 rounded-lg"
          aria-label="Voir le profil"
        >
          {mediaKit.photo_url ? (
            <img
              src={mediaKit.photo_url}
              alt=""
              style={getCropTransformStyle({
                naturalWidth: mediaKit.photo_natural_width,
                naturalHeight: mediaKit.photo_natural_height,
                cropFormat: 'media_kit',
                zoom: mediaKit.photo_zoom,
                offsetX: mediaKit.photo_offset_x,
                offsetY: mediaKit.photo_offset_y,
              })}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-black/30">
              <Camera size={32} />
            </div>
          )}
        </button>

        <div className="flex justify-between px-5 mt-5 text-black">
          <span className="text-[24px] tracking-[0.15em] uppercase">{mediaKit.prenom}</span>
          <span className="text-[24px] tracking-[0.15em] uppercase">{mediaKit.nom}</span>
        </div>

        {mediaKit.categories?.length > 0 && (
          <div className="px-5 mt-5">
            <div className="inline-block px-3 py-1.5" style={{ backgroundColor: '#2fae8f' }}>
              <span className="text-[12px] tracking-[0.2em] uppercase text-black">
                {mediaKit.categories.join(' • ')}
              </span>
            </div>
          </div>
        )}

        <div className="px-5 mt-6 space-y-1 text-black">
          {mediaKit.abonnes_instagram != null && (
            <p className="text-right text-[13px] underline">Instagram Followers: {mediaKit.abonnes_instagram.toLocaleString()}</p>
          )}
          {mediaKit.abonnes_tiktok != null && (
            <p className="text-[13px] underline">TikTok Followers: {mediaKit.abonnes_tiktok.toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  )
}
