import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Palette } from 'lucide-react'

// Écran "Sélectionnez la couleur d'arrière-plan" -- grille de couleurs,
// calqué sur TexCap. Première case = sélecteur de couleur custom (icône
// palette), suivie de la palette fixe reprise à l'identique de la capture.
const PALETTE = [
  '#FFFFFF', '#000000', '#C0392B', '#951B6E',
  '#FFC088', '#B983FF', '#2D4FC7', '#1C7FA0', '#FF8CFA',
  '#E01777', '#F2543D', '#FFCB05', '#A31257', '#C0392B',
  '#C24118', '#EE7D00', '#FF9800', '#F5A623', '#9AA61B',
  '#4C8C2B', '#7A2FB5', '#FFEB3B', '#4A4A4A', '#A6A6A6',
  '#E4E4E4', '#EFEFEF', '#C9BEE0', '#FBEEDD', '#EEE8C0',
  '#C79167', '#D9622B', '#FBD9A8', '#F5D3C0', '#A6DDA8',
  '#CFE6DC', '#A9DDEA', '#B6E88A', '#D62CC4', '#B266F7',
  '#A9BBAE', '#F7A9B0', '#F5E6A8', '#26A736', '#4FE0B0',
  '#A6D4F2', '#EBC8F2', '#F0AEBB', '#FFE600', '#2FB36A',
]

export default function ChoisirCouleur() {
  const { categorie } = useParams()
  const navigate = useNavigate()

  const choisirCouleur = (couleur) => {
    navigate(`/admin/souvenirs/templates/${categorie}/editeur?fond_type=couleur&fond_valeur=${encodeURIComponent(couleur)}`)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header
        className="flex items-center gap-4 px-4"
        style={{ backgroundColor: 'var(--accent)', height: '96px', color: '#fff' }}
      >
        <button onClick={() => navigate(-1)} aria-label="Retour" className="flex items-center justify-center">
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-body-medium" style={{ fontSize: '17px', color: '#fff' }}>
          Sélectionnez la couleur d'arrière-plan
        </h1>
      </header>

      <div className="grid grid-cols-5 gap-0">
        <button
          onClick={() => {}}
          className="aspect-square flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <Palette size={22} style={{ color: 'var(--text-primary)' }} />
        </button>
        {PALETTE.map((couleur, i) => (
          <button
            key={i}
            onClick={() => choisirCouleur(couleur)}
            className="aspect-square"
            style={{ backgroundColor: couleur }}
            aria-label={couleur}
          />
        ))}
      </div>
    </div>
  )
}
