// Système de crop "cadre fixe + zoom/pan" (façon Instagram), partagé entre
// l'éditeur (CreatePost.jsx) et le rendu (PostCard.jsx, feed).
//
// Principe : le cadre a un ratio fixe (carré / 16:9 / 9:16). L'image/vidéo est
// affichée dedans avec un zoom (échelle) et un offset (décalage du centre, en
// % du cadre). Deux seuils de zoom coexistent :
// - "contain" (getContainZoom / getMinZoom) : la photo entière est visible,
//   c'est le plancher du zoom dans l'éditeur -- l'utilisateur voit toujours
//   sa photo en entier au minimum, comme Instagram à l'ouverture du crop.
// - "cover" (getCoverZoom) : la photo remplit tout le cadre sans bord vide.
//   C'est le seuil à partir duquel le pan (déplacement) est autorisé -- en
//   dessous, déplacer l'image ne ferait que translater le vide, donc bloqué.
// Entre les deux, l'utilisateur zoome progressivement de "toute la photo
// visible" à "cadre rempli, recadrage possible".

export const RATIO_VALUES = {
  carre: 1,
  horizontal: 16 / 9,
  vertical: 9 / 16,
  vertical_45: 4 / 5,
  souvenir: 2 / 3,
  media_kit: 4 / 3, // cadre photo du Media Kit (MediaKit.jsx / MediaKitSuggestion.jsx)
  media_kit_c_profil: 1, // TemplateC : photo de profil, carrée sur la référence
  media_kit_c_grille: 4 / 3, // TemplateC : les 6 photos "polaroid", format paysage sur la référence
}

export const ZOOM_MAX = 3

// Zoom "cover" : le plus petit facteur qui fait que l'image couvre tout le
// cadre (façon feed / PostCard). Si l'image est plus "large" (proportion-
// nellement) que le cadre, il faut zoomer pour que sa hauteur remplisse le
// cadre (et inversement). C'est le seuil à partir duquel il n'y a JAMAIS de
// bord vide -- c'est pour ça que le pan (déplacement) n'est autorisé qu'à
// partir de ce zoom : en dessous, l'image est plus petite que le cadre dans
// au moins une dimension, donc la déplacer ne fait que changer le côté où
// le vide apparaît, ça n'a pas de sens visuellement (comportement Instagram).
export function getCoverZoom(naturalWidth, naturalHeight, cropFormat) {
  const frameRatio = RATIO_VALUES[cropFormat] || 1
  if (!naturalWidth || !naturalHeight) return 1
  const mediaRatio = naturalWidth / naturalHeight

  // ratio = largeur/hauteur. Si mediaRatio > frameRatio, l'image est
  // "trop large" pour sa hauteur par rapport au cadre : à zoom 1 (image
  // affichée en object-contain dans le cadre), il resterait du vide sur les
  // côtés si on ne zoomait pas -- le zoom cover compense exactement ça.
  if (mediaRatio > frameRatio) {
    return mediaRatio / frameRatio
  }
  return frameRatio / mediaRatio
}

// Zoom "contain" : l'inverse du cover. C'est le plus GRAND facteur qui fait
// que l'image tient ENTIÈREMENT dans le cadre (aucun bord coupé), quel que
// soit son ratio d'origine. C'est le nouveau plancher du zoom dans l'éditeur
// (CreatePost) : au minimum, l'utilisateur voit toute sa photo, comme sur
// Instagram à l'ouverture de l'éditeur de recadrage. Zoomer au-delà permet
// ensuite de recadrer normalement.
export function getContainZoom(naturalWidth, naturalHeight, cropFormat) {
  const coverZoom = getCoverZoom(naturalWidth, naturalHeight, cropFormat)
  // le contain est mathématiquement l'inverse du cover par rapport à 1 :
  // si cover = mediaRatio/frameRatio (>1), contain = frameRatio/mediaRatio (<1)
  return 1 / coverZoom
}

// Zoom minimum autorisé par le slider/pinch dans l'éditeur : c'est le zoom
// contain (photo entière visible au minimum). Gardé sous ce nom pour ne pas
// casser les appels existants ; utiliser getCoverZoom() explicitement pour
// le seuil "pan autorisé" (voir clampOffset).
export function getMinZoom(naturalWidth, naturalHeight, cropFormat) {
  return getContainZoom(naturalWidth, naturalHeight, cropFormat)
}

// Contraint un zoom demandé dans les bornes [min, ZOOM_MAX].
export function clampZoom(zoom, minZoom) {
  return Math.min(ZOOM_MAX, Math.max(minZoom, zoom))
}

// Contraint un offset (en % du cadre). Marge FIXE (pas proportionnelle au
// zoom) : contrairement à l'ancienne version qui bloquait quasiment tout pan
// tant que le zoom restait proche du minimum "cover", ici l'utilisateur peut
// toujours déplacer l'image haut/bas/gauche/droite de façon perceptible, à
// n'importe quel niveau de zoom -- au prix, à zoom faible, de pouvoir laisser
// apparaître un peu de fond (le fond noir du cadre côté éditeur) si on pousse
// le déplacement au maximum. C'est un choix assumé : la liberté de recadrage
// prime sur la garantie "jamais de bord vide".
const MAX_PAN_PERCENT = 50

export function clampOffset(offset, zoom, coverZoom) {
  return Math.min(MAX_PAN_PERCENT, Math.max(-MAX_PAN_PERCENT, offset))
}

// Construit le style CSS (transform) à appliquer au média À L'INTÉRIEUR d'un
// conteneur `overflow: hidden` au ratio du cadre. Utilisé identiquement par
// l'éditeur en aperçu temps réel et par le feed au rendu final : c'est ce qui
// garantit "jamais recalculer un nouveau cadrage au moment du rendu" -- la
// fonction est la même des deux côtés, seules les valeurs stockées varient.
export function getCropTransformStyle({ naturalWidth, naturalHeight, cropFormat, zoom, offsetX, offsetY }) {
  const minZoom = getMinZoom(naturalWidth, naturalHeight, cropFormat) // contain : plancher du zoom
  const coverZoom = getCoverZoom(naturalWidth, naturalHeight, cropFormat) // seuil à partir duquel le pan a un sens
  // fallback sur coverZoom (pas 1) : posts legacy sans zoom stocké en base
  // (colonne ajoutée après coup) -- sans ce fallback ils tomberaient au
  // nouveau plancher "contain" et afficheraient du vide dans le feed alors
  // qu'ils n'ont jamais été édités avec ce système.
  const effectiveZoom = clampZoom(zoom ?? coverZoom, minZoom)
  const x = clampOffset(offsetX ?? 0, effectiveZoom, coverZoom)
  const y = clampOffset(offsetY ?? 0, effectiveZoom, coverZoom)

  return {
    // object-fit: contain (pas cover !) -- laisse le navigateur afficher
    // l'image entière sans recadrage natif, c'est le scale() ci-dessous qui
    // gère tout le zoom. Avec "cover" ici, le navigateur recadrerait déjà
    // l'image pour remplir le cadre AVANT même d'appliquer le scale JS --
    // ça annulerait silencieusement tout le calcul de containZoom.
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    transform: `translate(${x / effectiveZoom}%, ${y / effectiveZoom}%) scale(${effectiveZoom})`,
    transformOrigin: 'center center',
  }
}

export const CROP_ASPECT_CLASSES = {
  carre: 'aspect-square',
  horizontal: 'aspect-video',
  vertical: 'aspect-[9/16]',
  vertical_45: 'aspect-[4/5]',
  souvenir: 'aspect-[2/3]', // ratio des templates souvenirs (voir TemplatePreview.jsx)
  media_kit: 'aspect-[4/3]',
  media_kit_c_profil: 'aspect-square',
  media_kit_c_grille: 'aspect-[4/3]',
}
