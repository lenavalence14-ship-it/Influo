// Système de crop "cadre fixe + zoom/pan" (façon Instagram), partagé entre
// l'éditeur (CreatePost.jsx) et le rendu (PostCard.jsx, feed).
//
// Principe : le cadre a un ratio fixe (carré / 16:9 / 9:16). L'image/vidéo est
// affichée dedans avec un zoom (échelle) et un offset (décalage du centre, en
// % du cadre). Le zoom minimum autorisé est celui qui garantit que l'image
// remplit ENTIÈREMENT le cadre, quel que soit son ratio d'origine — c'est ce
// qui interdit structurellement tout espace vide, sans avoir à y penser au
// moment de l'édition ni du rendu.

export const RATIO_VALUES = {
  carre: 1,
  horizontal: 4 / 3,
  vertical: 9 / 16,
  vertical_45: 4 / 5,
}

export const ZOOM_MAX = 3

// Zoom minimum : le plus petit facteur qui fait que l'image couvre tout le
// cadre. Si l'image est plus "large" (proportionnellement) que le cadre, il
// faut zoomer pour que sa hauteur remplisse le cadre (et inversement).
export function getMinZoom(naturalWidth, naturalHeight, cropFormat) {
  const frameRatio = RATIO_VALUES[cropFormat] || 1
  if (!naturalWidth || !naturalHeight) return 1
  const mediaRatio = naturalWidth / naturalHeight

  // ratio = largeur/hauteur. Si mediaRatio > frameRatio, l'image est
  // "trop large" pour sa hauteur par rapport au cadre : à zoom 1 (image
  // affichée en object-contain dans le cadre), il resterait du vide sur les
  // côtés si on ne zoomait pas -- le zoom minimum compense exactement ça.
  if (mediaRatio > frameRatio) {
    return mediaRatio / frameRatio
  }
  return frameRatio / mediaRatio
}

// Contraint un zoom demandé dans les bornes [min, ZOOM_MAX].
export function clampZoom(zoom, minZoom) {
  return Math.min(ZOOM_MAX, Math.max(minZoom, zoom))
}

// Contraint un offset (en % du cadre) pour que l'image ne laisse jamais
// apparaître de bord vide, compte tenu du zoom actuel. Au zoom minimum,
// l'offset autorisé est 0 (l'image remplit tout juste le cadre, aucune marge
// de manœuvre). Plus on zoome, plus on peut déplacer l'image.
export function clampOffset(offset, zoom, minZoom) {
  if (zoom <= minZoom) return 0
  // marge disponible en % : proportionnelle à l'excédent de zoom par rapport
  // au minimum requis pour remplir le cadre.
  const maxOffsetPercent = 50 * (1 - minZoom / zoom)
  return Math.min(maxOffsetPercent, Math.max(-maxOffsetPercent, offset))
}

// Construit le style CSS (transform) à appliquer au média À L'INTÉRIEUR d'un
// conteneur `overflow: hidden` au ratio du cadre. Utilisé identiquement par
// l'éditeur en aperçu temps réel et par le feed au rendu final : c'est ce qui
// garantit "jamais recalculer un nouveau cadrage au moment du rendu" -- la
// fonction est la même des deux côtés, seules les valeurs stockées varient.
export function getCropTransformStyle({ naturalWidth, naturalHeight, cropFormat, zoom, offsetX, offsetY }) {
  const minZoom = getMinZoom(naturalWidth, naturalHeight, cropFormat)
  const effectiveZoom = clampZoom(zoom ?? 1, minZoom)
  const x = clampOffset(offsetX ?? 0, effectiveZoom, minZoom)
  const y = clampOffset(offsetY ?? 0, effectiveZoom, minZoom)

  return {
    // object-fit: cover en base (remplit le cadre en respectant le ratio),
    // puis le zoom utilisateur s'ajoute par-dessus, et l'offset déplace le
    // centre. translate en % est relatif à la taille de l'ÉLÉMENT lui-même
    // (comportement CSS natif de translate avec des %), donc on divise par
    // le zoom pour que le déplacement perçu reste cohérent avec le cadre.
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `translate(${x / effectiveZoom}%, ${y / effectiveZoom}%) scale(${effectiveZoom})`,
    transformOrigin: 'center center',
  }
}

export const CROP_ASPECT_CLASSES = {
  carre: 'aspect-square',
  horizontal: 'aspect-[4/3]',
  vertical: 'aspect-[9/16]',
  vertical_45: 'aspect-[4/5]',
}
