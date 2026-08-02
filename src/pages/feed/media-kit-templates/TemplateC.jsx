import { Camera } from 'lucide-react'
import { getCropTransformStyle } from '../../../lib/mediaCrop'
import { InstagramIcon, TikTokIcon } from '../../../components/ui/SocialIcons'

// Template C -- design "tableau magazine" validé sur référence image par
// l'utilisateur : nom + logos réseaux en haut gauche sur photo de profil
// sans bordure, catégorie + pays, bloc "À propos de moi", un SEUL tableau
// "Audience & Démographie" avec 2 colonnes (TikTok / Instagram) qui empile
// Followers, Vues moyennes, Hommes/Femmes/Autres %, 4 tranches d'âge %, puis
// les nationalités ajoutées librement par l'utilisateur (chacune avec sa
// propre valeur TikTok + Instagram). 6 photos "polaroid" (bordure blanche
// épaisse) à droite/bas. Fond : une couleur au choix parmi 3 fixes
// (bordeaux / vert sauge foncé / blanc cassé) -- pas de color picker libre,
// pas de fond photo.
//
// Contrat identique à A/B : { mediaKit, onOpenProfile }. Un champ absent est
// simplement ignoré (ligne du tableau non affichée), jamais une erreur.

const FONDS = {
  bordeaux: { bg: '#5c1a2e', text: '#ffffff', accent: '#e8a3bb', tableHeader: '#7a2540', tableBorder: '#8a3a52' },
  vert_sauge: { bg: '#3a4a3f', text: '#ffffff', accent: '#c9d4c0', tableHeader: '#4d5f52', tableBorder: '#5c6f60' },
  blanc_casse: { bg: '#f5f1ea', text: '#1a1a1a', accent: '#b8574f', tableHeader: '#e8dfd0', tableBorder: '#d9cbb5' },
}

const TRANCHES_AGE = [
  { key: 'age_18_24', label: '18-24 ans' },
  { key: 'age_25_34', label: '25-34 ans' },
  { key: 'age_35_44', label: '35-44 ans' },
  { key: 'age_45_54', label: '45-54 ans' },
]

function paysVersEmoji(pays) {
  const map = {
    'bénin': 'BJ', 'benin': 'BJ', 'togo': 'TG', 'cameroun': 'CM', "côte d'ivoire": 'CI',
    "cote d'ivoire": 'CI', 'sénégal': 'SN', 'senegal': 'SN', 'mali': 'ML', 'burkina faso': 'BF',
    'niger': 'NE', 'guinée': 'GN', 'guinee': 'GN', 'gabon': 'GA', 'congo': 'CG', 'rdc': 'CD',
    'france': 'FR', 'belgique': 'BE', 'suisse': 'CH', 'canada': 'CA', 'maroc': 'MA',
    'algérie': 'DZ', 'algerie': 'DZ', 'tunisie': 'TN',
  }
  const code = map[(pays || '').trim().toLowerCase()]
  if (!code) return null
  return code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

// Une ligne du tableau : label + valeur TikTok + valeur Instagram. N'est
// rendue que si au moins une des deux valeurs est renseignée.
function LigneTableau({ label, tiktok, instagram, suffix = '', theme, isHeader }) {
  if (!isHeader && tiktok == null && instagram == null) return null
  return (
    <tr style={{ borderBottom: `1px solid ${theme.tableBorder}` }}>
      <td className="py-1.5 px-2 text-[10px]">{label}</td>
      <td className="py-1.5 px-2 text-[10px] text-center">{tiktok != null ? `${tiktok}${suffix}` : '—'}</td>
      <td className="py-1.5 px-2 text-[10px] text-center">{instagram != null ? `${instagram}${suffix}` : '—'}</td>
    </tr>
  )
}

function PhotoFrame({ url, natural_width, natural_height, zoom, offset_x, offset_y, cropFormat, onOpenProfile, className, withBorder }) {
  return (
    <button
      type="button"
      onClick={onOpenProfile}
      className={`overflow-hidden bg-black/10 ${withBorder ? 'p-1.5 bg-white' : ''} ${className || ''}`}
      aria-label="Voir le profil"
    >
      <div className="w-full h-full overflow-hidden">
        {url ? (
          <img
            src={url}
            alt=""
            style={getCropTransformStyle({
              naturalWidth: natural_width,
              naturalHeight: natural_height,
              cropFormat,
              zoom,
              offsetX: offset_x,
              offsetY: offset_y,
            })}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-black/20">
            <Camera size={20} />
          </div>
        )}
      </div>
    </button>
  )
}

export default function TemplateC({ mediaKit, onOpenProfile }) {
  const theme = FONDS[mediaKit.fond_couleur_c] || FONDS.bordeaux

  const grillePhotos = [1, 2, 3, 4, 5, 6].map((n) => ({
    url: mediaKit[`c_photo_grille_${n}_url`],
    natural_width: mediaKit[`c_photo_grille_${n}_natural_width`],
    natural_height: mediaKit[`c_photo_grille_${n}_natural_height`],
    zoom: mediaKit[`c_photo_grille_${n}_zoom`],
    offset_x: mediaKit[`c_photo_grille_${n}_offset_x`],
    offset_y: mediaKit[`c_photo_grille_${n}_offset_y`],
  }))

  const nationalites = mediaKit.c_audience_nationalites || [] // [{ pays, pct_tiktok, pct_instagram }]

  return (
    <div className="w-full aspect-[2/3] relative overflow-hidden" style={{ backgroundColor: theme.bg, color: theme.text }}>
      <div className="flex h-full">
        {/* Colonne gauche : identité + tableau */}
        <div className="w-1/2 flex flex-col p-4 overflow-hidden">
          <div className="flex items-start gap-3">
            <PhotoFrame
              url={mediaKit.photo_url}
              natural_width={mediaKit.photo_natural_width}
              natural_height={mediaKit.photo_natural_height}
              zoom={mediaKit.photo_zoom}
              offset_x={mediaKit.photo_offset_x}
              offset_y={mediaKit.photo_offset_y}
              cropFormat="media_kit_c_profil"
              onOpenProfile={onOpenProfile}
              className="w-16 h-16 rounded-md shrink-0"
              withBorder={false}
            />
            <div className="min-w-0">
              <div className="text-[18px] font-black uppercase leading-[0.95] truncate" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {mediaKit.prenom} {mediaKit.nom}
              </div>
              <div className="flex gap-1.5 mt-2">
                <span className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-white shrink-0">
                  <TikTokIcon size={13} />
                </span>
                <span className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-white shrink-0">
                  <InstagramIcon size={13} />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-0.5 text-[11px]">
            {mediaKit.categories?.length > 0 && <p>• {mediaKit.categories.join(' • ')}</p>}
            {mediaKit.c_pays ? (
              <p className="flex items-center gap-1.5">
                • {mediaKit.c_pays.toUpperCase()}
                {paysVersEmoji(mediaKit.c_pays) ? <span>{paysVersEmoji(mediaKit.c_pays)}</span> : null}
              </p>
            ) : null}
          </div>

          {mediaKit.c_a_propos && (
            <div className="mt-3">
              <p className="text-[12px] font-bold uppercase underline underline-offset-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                À propos de moi
              </p>
              <p className="text-[10px] leading-snug mt-1.5 line-clamp-4">{mediaKit.c_a_propos}</p>
            </div>
          )}

          <div className="mt-3">
            <p className="text-[12px] font-bold uppercase" style={{ color: theme.accent, fontFamily: 'Georgia, "Times New Roman", serif' }}>
              Audience & Démographie
            </p>
            <table className="w-full mt-1.5 border-collapse">
              <thead>
                <tr style={{ backgroundColor: theme.tableHeader }}>
                  <th className="py-1.5 px-2 text-[9px] text-left font-medium uppercase">Audience</th>
                  <th className="py-1.5 px-2 text-[9px] font-medium uppercase">TikTok</th>
                  <th className="py-1.5 px-2 text-[9px] font-medium uppercase">Instagram</th>
                </tr>
              </thead>
              <tbody>
                <LigneTableau theme={theme} label="Followers" tiktok={mediaKit.abonnes_tiktok} instagram={mediaKit.abonnes_instagram} />
                <LigneTableau theme={theme} label="Vues moyennes" tiktok={mediaKit.c_vues_moy_tiktok} instagram={mediaKit.c_vues_moy_instagram} />
                <LigneTableau theme={theme} label="Hommes" suffix="%" tiktok={mediaKit.c_pct_hommes_tiktok} instagram={mediaKit.c_pct_hommes_instagram} />
                <LigneTableau theme={theme} label="Femmes" suffix="%" tiktok={mediaKit.c_pct_femmes_tiktok} instagram={mediaKit.c_pct_femmes_instagram} />
                <LigneTableau theme={theme} label="Autres" suffix="%" tiktok={mediaKit.c_pct_autres_tiktok} instagram={mediaKit.c_pct_autres_instagram} />
                {TRANCHES_AGE.map((t) => (
                  <LigneTableau
                    key={t.key}
                    theme={theme}
                    label={t.label}
                    suffix="%"
                    tiktok={mediaKit[`${t.key}_tiktok`]}
                    instagram={mediaKit[`${t.key}_instagram`]}
                  />
                ))}
                {nationalites.map((n, i) => (
                  <LigneTableau
                    key={i}
                    theme={theme}
                    label={n.pays}
                    suffix="%"
                    tiktok={n.pct_tiktok}
                    instagram={n.pct_instagram}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* 2 photos "polaroid" sous le tableau, dans la colonne gauche -- conforme à la référence */}
          <div className="mt-2 grid grid-cols-2 gap-2 flex-1 min-h-0">
            <PhotoFrame {...grillePhotos[4]} cropFormat="media_kit_c_grille" onOpenProfile={onOpenProfile} className="w-full h-full" withBorder />
            <PhotoFrame {...grillePhotos[5]} cropFormat="media_kit_c_grille" onOpenProfile={onOpenProfile} className="w-full h-full" withBorder />
          </div>
        </div>

        {/* Colonne droite : 4 photos "polaroid" empilées */}
        <div className="w-1/2 flex flex-col gap-2 p-2">
          {[0, 1, 2, 3].map((i) => (
            <PhotoFrame
              key={i}
              {...grillePhotos[i]}
              cropFormat="media_kit_c_grille"
              onOpenProfile={onOpenProfile}
              className="flex-1 w-full"
              withBorder
            />
          ))}
        </div>
      </div>
    </div>
  )
}
