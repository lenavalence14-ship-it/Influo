import SelectionScreen from '../../components/SelectionScreen'

// Étape 1 sous "Créer un souvenir éditorial" : pour qui.
// "Un groupe de personnes" n'a volontairement pas de route (mène directement
// aux templates -- étape pas encore construite).
export default function SouvenirEditorialPourQui() {
  return (
    <SelectionScreen
      title="Créer un souvenir éditorial"
      subtitle="Pour qui voulez-vous créer ce souvenir ?"
      columns={2}
      options={[
        { emoji: 'man', label: 'Une personne', to: '/souvenirs/souvenir-editorial/personne' },
        { emojiCluster: ['man', 'woman'], label: 'Un groupe de personnes' },
      ]}
    />
  )
}
