import TemplateA from './TemplateA'
import TemplateB from './TemplateB'

// Registre des designs disponibles pour l'affichage aléatoire du Media Kit
// dans le Feed (voir MediaKitSuggestion.jsx). Ajouter un design = ajouter une
// entrée ici, rien d'autre à modifier côté tirage aléatoire.
// Chaque template reçoit { mediaKit, onOpenProfile } et affiche les champs
// du media kit dont IL a besoin -- un champ pas encore rempli est simplement
// ignoré par le template concerné.
export const MEDIA_KIT_TEMPLATES = [TemplateA, TemplateB]

// Tire un template au hasard. Appelé à CHAQUE apparition d'un media kit dans
// le feed (pas une fois par media kit) : deux apparitions du même media kit,
// à deux endroits du feed, peuvent donc afficher deux designs différents --
// c'est voulu, pour qu'un même profil ne soit pas reconnaissable à un design
// fixe (façon suggestions Instagram).
export function pickRandomTemplate() {
  const index = Math.floor(Math.random() * MEDIA_KIT_TEMPLATES.length)
  return MEDIA_KIT_TEMPLATES[index]
}
