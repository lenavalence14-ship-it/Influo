import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import EmojiIcon, { EmojiCluster } from './EmojiIcon'

// Écran de sélection générique réutilisé par tous les sous-écrans de l'outil
// Souvenirs (choix "pour qui", "quelle fête", "quelle durée"...). Chaque
// option peut soit naviguer vers une route interne (`to`), soit n'avoir
// aucune route pour l'instant (`to` absent) -- dans ce cas le bouton reste
// visuellement identique mais ne fait rien au clic, en attendant la
// bibliothèque de templates (étape suivante du chantier, pas construite ici).
export default function SelectionScreen({ title, subtitle, options, columns = 1 }) {
  const navigate = useNavigate()

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
        <h1 className="text-display" style={{ color: 'var(--text-primary)', fontSize: '18px' }}>
          {title}
        </h1>
      </header>

      {subtitle && (
        <p className="px-4 pt-2 pb-6 text-body" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      )}

      <div className={`px-4 grid gap-3 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => opt.to && navigate(opt.to)}
            className={`glass flex items-center gap-3 px-4 py-4 rounded-2xl text-left active:scale-[0.98] transition-transform duration-150 ${
              columns === 2 ? 'flex-col text-center gap-2 py-5' : ''
            }`}
          >
            <span
              className="rounded-xl flex items-center justify-center shrink-0"
              style={{
                width: columns === 2 ? 48 : 44,
                height: columns === 2 ? 48 : 44,
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              {opt.emojiCluster ? (
                <EmojiCluster names={opt.emojiCluster} size={26} />
              ) : (
                <EmojiIcon name={opt.emoji} size={24} />
              )}
            </span>
            <span
              className={columns === 2 ? 'text-caption font-medium' : 'text-body-medium'}
              style={{ color: 'var(--text-primary)' }}
            >
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
