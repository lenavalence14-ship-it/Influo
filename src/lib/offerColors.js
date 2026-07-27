// Détermine si un texte noir ou blanc est le plus lisible sur une couleur de
// fond donnée (hex), via la luminosité relative (formule YIQ, standard pour
// ce genre de calcul rapide côté front). Utilisé pour les bandes colorées
// des appels d'offre : la couleur de fond est choisie librement par le
// client, il faut donc garantir la lisibilité du texte automatiquement.
export function getContrastTextColor(hex) {
  if (!hex) return '#ffffff'
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#ffffff'
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#000000' : '#ffffff'
}

// Palette de 28 couleurs variées proposées au client pour le bandeau de son
// appel d'offre, pensée pour couvrir un large spectre (vives, pastel,
// neutres, foncées) plutôt qu'une simple roue arc-en-ciel basique.
export const OFFER_COLOR_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981',
  '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
  '#D946EF', '#EC4899', '#F43F5E', '#78350F', '#7C2D12', '#1E293B', '#0F172A',
  '#FDBA74', '#FDE68A', '#BBF7D0', '#A5F3FC', '#C7D2FE', '#F5D0FE', '#E5E7EB',
]
