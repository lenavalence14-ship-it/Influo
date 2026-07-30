import { Camera } from 'lucide-react'
import { getCropTransformStyle } from '../../../lib/mediaCrop'
import { InstagramIcon, TikTokIcon } from '../../../components/ui/SocialIcons'

// Template B -- design fourni : fond rose clair, icônes Instagram/TikTok en
// haut avec leur compteur d'abonnés respectif, catégories du profil centrées
// au-dessus de la photo (ronde, pas rectangulaire comme Template A), nom en
// grandes lettres en bas. Mêmes données que Template A (aucun nouveau champ
// en base) -- seule la mise en page change.
export default function TemplateB({ mediaKit, onOpenProfile }) {
  return (
    <div className="w-full aspect-[4/5] flex flex-col items-center px-6 pt-6 pb-8" style={{ backgroundColor: '#fdf1ee' }}>
      <div className="w-full flex items-start justify-between text-black">
        <div className="flex flex-col items-center gap-2">
          <InstagramIcon size={34} />
          {mediaKit.abonnes_instagram != null && (
            <span className="text-[13px]">{mediaKit.abonnes_instagram.toLocaleString()} abonnés</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <TikTokIcon size={34} />
          {mediaKit.abonnes_tiktok != null && (
            <span className="text-[13px]">{mediaKit.abonnes_tiktok.toLocaleString()} abonnés</span>
          )}
        </div>
      </div>

      {mediaKit.categories?.length > 0 && (
        <p className="mt-4 text-[15px] text-black">{mediaKit.categories.join(' • ')}</p>
      )}

      <button
        type="button"
        onClick={onOpenProfile}
        className="mt-5 w-full flex-1 rounded-full overflow-hidden bg-black/10"
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

      <div className="mt-5 text-[28px] tracking-[0.1em] uppercase text-black text-center">
        {mediaKit.prenom} {mediaKit.nom}
      </div>
    </div>
  )
}
