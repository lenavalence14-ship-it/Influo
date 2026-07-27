import SelectionScreen from '../../components/SelectionScreen'

// Étape 2 sous "Créer un souvenir éditorial" > "Une personne" : les 9 profils
// listés par le client. Aucune route derrière -- mène directement aux
// templates (étape pas encore construite).
export default function SouvenirEditorialPersonne() {
  return (
    <SelectionScreen
      title="Créer un souvenir éditorial"
      subtitle="Pour qui, précisément ?"
      options={[
        { emoji: 'man', label: 'Moi' },
        { emoji: 'man', label: 'Un ami' },
        { emoji: 'sparklingHeart', label: 'Mon meilleur ami' },
        { emoji: 'manTeacher', label: 'Un mentor' },
        { emojiCluster: ['man', 'woman', 'girl'], label: 'Un membre de ma famille' },
        { emoji: 'officeWorker', label: 'Un collègue' },
        { emoji: 'starStruck', label: "Une personne qui m'inspire" },
        { emoji: 'prince', label: 'Mon petit ami' },
        { emoji: 'princess', label: 'Ma petite amie' },
      ]}
    />
  )
}
