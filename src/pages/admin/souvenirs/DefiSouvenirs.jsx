import SelectionScreen from '../../components/SelectionScreen'

// Sous "Lancer un défi de souvenirs" : 2 durées, chacune sans route (mène
// directement aux templates, étape pas encore construite).
export default function DefiSouvenirs() {
  return (
    <SelectionScreen
      title="Lancer un défi de souvenirs"
      subtitle="Sur quelle durée ?"
      columns={2}
      options={[
        { emoji: 'flexedBiceps', label: 'Un mois', to: '/souvenirs/templates/defi-un-mois' },
        { emoji: 'flexedBiceps', label: 'Un an', to: '/souvenirs/templates/defi-un-an' },
      ]}
    />
  )
}
