import SelectionScreen from '../../components/SelectionScreen'

// Étape 1 sous "Un magazine éditorial" : pour qui. Structure identique à
// SouvenirEditorialPourQui, catégorie distincte comme demandé.
export default function MagazineEditorialPourQui() {
  return (
    <SelectionScreen
      title="Magazine éditorial"
      subtitle="Pour qui voulez-vous créer ce magazine éditorial ?"
      columns={2}
      options={[
        { emoji: 'man', label: 'Une personne', to: '/souvenirs/magazine-editorial/personne' },
        { emojiCluster: ['man', 'woman'], label: 'Un groupe de personnes' },
      ]}
    />
  )
}
