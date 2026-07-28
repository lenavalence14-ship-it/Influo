import SelectionScreen from '../../../components/SelectionScreen'

// Sous "Souhaiter bonne fête" : 7 fêtes, chacune sans route (mène
// directement aux templates, étape pas encore construite).
export default function BonneFete() {
  return (
    <SelectionScreen
      title="Souhaiter bonne fête"
      subtitle="Quelle occasion ?"
      options={[
        { emoji: 'confettiBall', label: 'Nouvelle année · 1er janvier', to: '/admin/souvenirs/templates/bonne-fete-nouvelle-annee' },
        { emoji: 'christmasTree', label: 'Joyeux Noël · 25 décembre', to: '/admin/souvenirs/templates/bonne-fete-noel' },
        { emoji: 'revolvingHearts', label: 'St Valentin · 14 février', to: '/admin/souvenirs/templates/bonne-fete-saint-valentin' },
        { emoji: 'mosque', label: 'Ramadan', to: '/admin/souvenirs/templates/bonne-fete-ramadan' },
        { emoji: 'rabbitFace', label: 'Pâques', to: '/admin/souvenirs/templates/bonne-fete-paques' },
        { emoji: 'man', label: 'Fête des pères', to: '/admin/souvenirs/templates/bonne-fete-peres' },
        { emoji: 'woman', label: 'Fête des mères', to: '/admin/souvenirs/templates/bonne-fete-meres' },
      ]}
    />
  )
}
