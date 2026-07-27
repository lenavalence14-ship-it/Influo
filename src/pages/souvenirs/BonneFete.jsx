import SelectionScreen from '../../components/SelectionScreen'

// Sous "Souhaiter bonne fête" : 7 fêtes, chacune sans route (mène
// directement aux templates, étape pas encore construite).
export default function BonneFete() {
  return (
    <SelectionScreen
      title="Souhaiter bonne fête"
      subtitle="Quelle occasion ?"
      options={[
        { emoji: 'confettiBall', label: 'Nouvelle année · 1er janvier' },
        { emoji: 'christmasTree', label: 'Joyeux Noël · 25 décembre' },
        { emoji: 'revolvingHearts', label: 'St Valentin · 14 février' },
        { emoji: 'mosque', label: 'Ramadan' },
        { emoji: 'rabbitFace', label: 'Pâques' },
        { emoji: 'man', label: 'Fête des pères' },
        { emoji: 'woman', label: 'Fête des mères' },
      ]}
    />
  )
}
