import { Camera } from 'lucide-react'
import { getCropTransformStyle } from '../../../lib/mediaCrop'
import { InstagramIcon, TikTokIcon } from '../../../components/ui/SocialIcons'

// Template C -- design "magazine polaroid" : structure calquée exactement
// sur la référence HTML fournie par l'utilisateur (media-kit-filled-1.html).
// Header pleine largeur (photo profil polaroid verticale avec logos réseaux
// DANS le cadre + nom/catégorie/pays à droite), bio centrée, tableau
// Audience & Démographie pleine largeur, puis à droite du bloc gauche une
// colonne de 4 photos polaroid empilées et sous le tableau 2 photos polaroid
// côte à côte. Fond : une couleur au choix parmi 3 fixes (bordeaux / vert
// sauge foncé / blanc cassé) -- pas de color picker libre, pas de fond photo.
//
// Contrat identique à A/B : { mediaKit, onOpenProfile }. Un champ absent est
// simplement ignoré (ligne du tableau non affichée), jamais une erreur.

const FONDS = {
  bordeaux: { bg: '#4a0714', text: '#fbf9f7', accent: '#e0234a', accentSoft: '#a4123a', polaroidBg: '#f7f5f2', polaroidFg: '#2b2320', polaroidIcon: '#161314' },
  vert_sauge: { bg: '#2f3b32', text: '#fbf9f7', accent: '#8fae7c', accentSoft: '#4d5f52', polaroidBg: '#f7f5f2', polaroidFg: '#2b2320', polaroidIcon: '#161314' },
  blanc_casse: { bg: '#f5f1ea', text: '#1a1a1a', accent: '#b8574f', accentSoft: '#e8dfd0', polaroidBg: '#ffffff', polaroidFg: '#2b2320', polaroidIcon: '#161314' },
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
function LigneTableau({ label, tiktok, instagram, suffix = '', theme }) {
  if (tiktok == null && instagram == null) return null
  const cell = { borderColor: theme.accent, borderWidth: '0 1px 1px 0', borderStyle: 'solid' }
  return (
    <tr>
      <td className="py-1.5 px-1.5 text-left truncate" style={{ ...cell, borderLeftWidth: '1px' }}>{label}</td>
      <td className="py-1.5 px-1.5 text-center truncate" style={cell}>{tiktok != null ? `${tiktok}${suffix}` : '—'}</td>
      <td className="py-1.5 px-1.5 text-center truncate" style={cell}>{instagram != null ? `${instagram}${suffix}` : '—'}</td>
    </tr>
  )
}

function PhotoFrame({ url, natural_width, natural_height, zoom, offset_x, offset_y, cropFormat, onOpenProfile, className, iconSize = 20 }) {
  return (
    <button
      type="button"
      onClick={onOpenProfile}
      className={`overflow-hidden bg-black/10 flex items-center justify-center ${className || ''}`}
      aria-label="Voir le profil"
    >
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
          <Camera size={iconSize} />
        </div>
      )}
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
    <div className="w-full aspect-[2/3] relative overflow-hidden" style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: '"Barlow", system-ui, sans-serif' }}>
      <div className="w-full h-full overflow-y-auto p-3">
      <div className="flex items-start gap-2">

        {/* Colonne gauche : header, bio, tableau, 2 photos du bas */}
        <div className="flex-[1] min-w-0 flex flex-col">

          {/* Header : photo profil polaroid verticale + nom/meta */}
          <div className="grid grid-cols-[.62fr_1fr] gap-3 items-start">
            <figure className="flex flex-col p-1.5 shadow-md" style={{ backgroundColor: theme.polaroidBg }}>
              <PhotoFrame
                url={mediaKit.photo_url}
                natural_width={mediaKit.photo_natural_width}
                natural_height={mediaKit.photo_natural_height}
                zoom={mediaKit.photo_zoom}
                offset_x={mediaKit.photo_offset_x}
                offset_y={mediaKit.photo_offset_y}
                cropFormat="media_kit_c_profil"
                onOpenProfile={onOpenProfile}
                className="w-full aspect-[3/3.4]"
                iconSize={22}
              />
              <div className="flex items-center justify-around mt-2 pb-1">
                <span className="w-7 h-7 rounded-[22%] flex items-center justify-center shrink-0" style={{ backgroundColor: theme.polaroidIcon, color: theme.polaroidBg }}>
                  <TikTokIcon size={14} />
                </span>
                <span className="w-7 h-7 rounded-[22%] flex items-center justify-center shrink-0" style={{ backgroundColor: theme.polaroidIcon, color: theme.polaroidBg }}>
                  <InstagramIcon size={14} />
                </span>
              </div>
            </figure>

            <div className="min-w-0 pt-1">
              <div
                className="uppercase font-bold leading-none break-words"
                style={{ fontFamily: '"Oswald", "Arial Narrow", sans-serif', fontSize: 'clamp(1.1rem, 5vw, 1.9rem)', letterSpacing: '.06em' }}
              >
                {mediaKit.prenom} {mediaKit.nom}
              </div>
              <ul className="list-none mt-3 space-y-1.5 uppercase font-semibold text-[11px] tracking-wide">
                {mediaKit.categories?.length > 0 && (
                  <li className="flex items-center gap-2">
                    <span>&bull;</span><span>{mediaKit.categories.join(' • ')}</span>
                  </li>
                )}
                {mediaKit.c_pays ? (
                  <li className="flex items-center gap-2">
                    <span>&bull;</span><span>{mediaKit.c_pays.toUpperCase()}</span>
                    {paysVersEmoji(mediaKit.c_pays) ? <span className="text-[1.1em] normal-case">{paysVersEmoji(mediaKit.c_pays)}</span> : null}
                  </li>
                ) : null}
              </ul>
            </div>
          </div>

          {/* À propos de moi */}
          {mediaKit.c_a_propos && (
            <div className="mt-5 text-center">
              <h2
                className="inline-block font-semibold uppercase border-b-2 pb-0.5"
                style={{ fontFamily: '"Oswald", "Arial Narrow", sans-serif', borderColor: theme.text, fontSize: 'clamp(.8rem, 2.6vw, 1.1rem)', letterSpacing: '.03em' }}
              >
                À propos de moi
              </h2>
              <p className="mt-2 px-2 text-[13px] leading-relaxed">{mediaKit.c_a_propos}</p>
            </div>
          )}

          {/* Audience & démographie */}
          <div className="mt-5 text-center">
            <h2
              className="inline-block font-semibold uppercase border-b-2 pb-0.5"
              style={{ fontFamily: '"Oswald", "Arial Narrow", sans-serif', color: theme.accent, borderColor: theme.accent, fontSize: 'clamp(.75rem, 2.4vw, 1.05rem)', letterSpacing: '.04em' }}
            >
              Audience &amp; Démographie
            </h2>
          </div>

          <table
            className="w-full mt-3 border-collapse table-fixed text-[8px]"
            style={{ border: `1px solid ${theme.accent}`, backgroundColor: theme.polaroidBg, color: theme.polaroidFg }}
          >
            <colgroup>
              <col style={{ width: '40%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: theme.accentSoft, color: theme.text }}>
                <th className="py-1.5 px-1.5 text-left font-semibold uppercase tracking-wide truncate" style={{ border: `1px solid ${theme.accent}` }}>Audience</th>
                <th className="py-1.5 px-1.5 font-semibold uppercase tracking-wide text-center truncate" style={{ border: `1px solid ${theme.accent}` }}>TikTok</th>
                <th className="py-1.5 px-1.5 font-semibold uppercase tracking-wide text-center truncate" style={{ border: `1px solid ${theme.accent}` }}>Instagram</th>
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

          {/* 2 photos polaroid côte à côte sous le tableau -- distance
              inchangée par rapport au tableau, elles suivent le bloc
              Audience (mt-auto) dans le flux normal. */}
          <div className="mt-3 flex gap-2">
            {[4, 5].map((idx) => (
              <figure key={idx} className="flex-1 p-1.5 pb-4 shadow-md" style={{ backgroundColor: theme.polaroidBg }}>
                <PhotoFrame {...grillePhotos[idx]} cropFormat="media_kit_c_grille" onOpenProfile={onOpenProfile} className="w-full aspect-[4/3.4]" />
              </figure>
            ))}
          </div>
        </div>

        {/* Colonne droite : 4 photos polaroid carrées, empilées, taille
            naturelle (pas d'étirement flex-1) -- la colonne droite doit
            faire la même hauteur totale que le contenu de la colonne gauche. */}
        <div className="flex-[.72] min-w-0 flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <figure key={i} className="p-1.5 pb-4 shadow-md" style={{ backgroundColor: theme.polaroidBg }}>
              <PhotoFrame {...grillePhotos[i]} cropFormat="media_kit_c_grille" onOpenProfile={onOpenProfile} className="w-full aspect-square" />
            </figure>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
