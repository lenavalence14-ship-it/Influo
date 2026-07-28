import SelectionScreen from '../../../components/SelectionScreen'

// Étape 2 sous "Créer un souvenir éditorial" > "Une personne" : les 9 profils
// listés par le client. Aucune route derrière -- mène directement aux
// templates (étape pas encore construite).
export default function SouvenirEditorialPersonne() {
  return (
    <SelectionScreen
      title="Créer un souvenir éditorial"
      subtitle="Pour qui, précisément ?"
      options={[
        { emoji: 'man', label: 'Moi', to: '/admin/souvenirs/templates/souvenir-editorial-moi' },
        { emoji: 'man', label: 'Un ami', to: '/admin/souvenirs/templates/souvenir-editorial-ami' },
        { emoji: 'sparklingHeart', label: 'Mon meilleur ami', to: '/admin/souvenirs/templates/souvenir-editorial-meilleur-ami' },
        { emoji: 'manTeacher', label: 'Un mentor', to: '/admin/souvenirs/templates/souvenir-editorial-mentor' },
        { emojiCluster: ['man', 'woman', 'girl'], label: 'Un membre de ma famille', to: '/admin/souvenirs/templates/souvenir-editorial-famille' },
        { emoji: 'officeWorker', label: 'Un collègue', to: '/admin/souvenirs/templates/souvenir-editorial-collegue' },
        { emoji: 'starStruck', label: "Une personne qui m'inspire", to: '/admin/souvenirs/templates/souvenir-editorial-inspire' },
        { emoji: 'prince', label: 'Mon petit ami', to: '/admin/souvenirs/templates/souvenir-editorial-petit-ami' },
        { emoji: 'princess', label: 'Ma petite amie', to: '/admin/souvenirs/templates/souvenir-editorial-petite-amie' },
      ]}
    />
  )
}
