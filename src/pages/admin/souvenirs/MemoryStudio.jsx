import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import EmojiIcon, { EmojiCluster } from '../../../components/EmojiIcon'

// Écran d'accueil de l'outil "Souvenirs" (type Canva), réservé aux
// utilisateur_simple. Étape 1 du chantier : uniquement le squelette de
// navigation par types de template (boutons style glassmorphism), sans
// bibliothèque de templates ni édition pour l'instant -- ces écrans
// arriveront progressivement, catégorie par catégorie.
const MAIN_OPTIONS = [
  { to: '/souvenirs/souvenir-editorial', emoji: 'man', label: 'Créer un souvenir éditorial' },
  { to: '/souvenirs/magazine-editorial', emoji: 'envelope', label: 'Un magazine éditorial' },
  { to: '/souvenirs/anniversaire', emoji: 'birthdayCake', label: 'Souhaiter un joyeux anniversaire' },
  { to: '/souvenirs/bonne-fete', emoji: 'crescentMoon', label: 'Souhaiter bonne fête' },
  { to: '/souvenirs/defi-souvenirs', emoji: 'flexedBiceps', label: 'Lancer un défi de souvenirs' },
  { to: '/souvenirs/feliciter', emoji: 'trophy', label: 'Féliciter' },
]

export default function MemoryStudio() {
  const navigate = useNavigate()

  const routeFor = (to) => {
    // Anniversaire et Féliciter n'ont aucun écran intermédiaire : ils mènent
    // directement à la bibliothèque de templates.
    if (to === '/souvenirs/anniversaire') return '/souvenirs/templates/anniversaire'
    if (to === '/souvenirs/feliciter') return '/souvenirs/templates/feliciter'
    return to
  }

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="w-9 h-9 rounded-full flex items-center justify-center glass"
          style={{ color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-display" style={{ color: 'var(--text-primary)', fontSize: '20px' }}>
          Souvenirs
        </h1>
      </header>

      <p className="px-4 pt-2 pb-6 text-body" style={{ color: 'var(--text-secondary)' }}>
        Choisissez ce que vous voulez créer aujourd'hui.
      </p>

      <div className="px-4 flex flex-col gap-3">
        {MAIN_OPTIONS.map((opt) => (
          <button
            key={opt.to}
            onClick={() => navigate(routeFor(opt.to))}
            className="glass flex items-center gap-4 px-4 py-4 rounded-2xl text-left active:scale-[0.98] transition-transform duration-150"
          >
            <span
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <EmojiIcon name={opt.emoji} size={26} />
            </span>
            <span className="text-body-medium" style={{ color: 'var(--text-primary)' }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
