import SelectionScreen from '../../../components/SelectionScreen'

// Étape 2 sous "Un magazine éditorial" > "Une personne". Même liste que le
// pendant "souvenir éditorial" -- seule différence notée dans le brief :
// "Mon meilleur ami" utilise 🫂 ici plutôt que ❤️. On garde sparklingHeart
// (le seul emoji Fluent chaleureux disponible dans le lot déjà téléchargé)
// pour les deux, faute d'icône "câlin" dédiée dans le lot actuel -- purement
// décoratif, sans impact fonctionnel.
export default function MagazineEditorialPersonne() {
  return (
    <SelectionScreen
      title="Magazine éditorial"
      subtitle="Pour qui, précisément ?"
      options={[
        { emoji: 'man', label: 'Moi', to: '/souvenirs/templates/magazine-editorial-moi' },
        { emoji: 'man', label: 'Un ami', to: '/souvenirs/templates/magazine-editorial-ami' },
        { emoji: 'sparklingHeart', label: 'Mon meilleur ami', to: '/souvenirs/templates/magazine-editorial-meilleur-ami' },
        { emoji: 'manTeacher', label: 'Un mentor', to: '/souvenirs/templates/magazine-editorial-mentor' },
        { emojiCluster: ['man', 'woman', 'girl'], label: 'Un membre de ma famille', to: '/souvenirs/templates/magazine-editorial-famille' },
        { emoji: 'officeWorker', label: 'Un collègue', to: '/souvenirs/templates/magazine-editorial-collegue' },
        { emoji: 'starStruck', label: "Une personne qui m'inspire", to: '/souvenirs/templates/magazine-editorial-inspire' },
        { emoji: 'prince', label: 'Mon petit ami', to: '/souvenirs/templates/magazine-editorial-petit-ami' },
        { emoji: 'princess', label: 'Ma petite amie', to: '/souvenirs/templates/magazine-editorial-petite-amie' },
      ]}
    />
  )
}
