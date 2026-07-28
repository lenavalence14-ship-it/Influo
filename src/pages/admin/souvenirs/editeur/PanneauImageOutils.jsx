import { useState } from 'react'
import {
  ChevronLeft, Check, Move, Circle, Crop, Copy,
  FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, ArrowLeft as ArrowLeftIcon,
  ArrowRight, Minus, Plus,
} from 'lucide-react'
import PanneauRecadrer from './PanneauRecadrer'

const STEP_DEFAUT = 10

// Panneau d'outils pour le calque photo sélectionné -- calqué sur les
// captures TexCap (images 2 et 3). Position / Opacité / Recadrer / Cloner
// en haut ; Retourner (horizontal, vertical) en dessous. "Position" ouvre
// un sous-écran avec 4 flèches directionnelles (déplacement par pas de
// STEP pixels réels sur le canvas) et un +/- pour agrandir/réduire le
// calque (PAS un zoom caméra -- change bien width/height du calque).
export default function PanneauImageOutils({ layer, onChange, onDupliquer, onFermer }) {
  const [sousEcran, setSousEcran] = useState(null) // null | 'position' | 'recadrer'

  if (sousEcran === 'position') {
    return (
      <PanneauPosition
        layer={layer}
        onChange={onChange}
        onFermer={() => setSousEcran(null)}
      />
    )
  }

  if (sousEcran === 'recadrer') {
    return (
      <PanneauRecadrer
        layer={layer}
        onChange={onChange}
        onFermer={() => setSousEcran(null)}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{ backgroundColor: 'var(--accent)', height: '64px', color: '#fff' }}
      >
        <button onClick={onFermer} aria-label="Retour" className="flex items-center justify-center">
          <ChevronLeft size={26} />
        </button>
        <button onClick={onFermer} aria-label="Valider" className="flex items-center justify-center">
          <Check size={24} />
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div
          style={{
            width: '200px',
            height: `${(layer.height / layer.width) * 200}px`,
            backgroundColor: layer.background_color || undefined,
            backgroundImage: layer.image_url ? `url(${layer.image_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: layer.opacity ?? 1,
            transform: `rotate(${layer.rotation || 0}deg) scaleX(${layer.flip_h ? -1 : 1}) scaleY(${layer.flip_v ? -1 : 1})`,
          }}
        />
      </div>

      <div className="shrink-0 p-3 flex flex-col gap-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <div className="grid grid-cols-4 gap-2">
          <OutilBouton icon={Move} label="Position" onClick={() => setSousEcran('position')} />
          <OutilOpacite layer={layer} onChange={onChange} />
          <OutilBouton icon={Crop} label="Recadrer" onClick={() => setSousEcran('recadrer')} />
          <OutilBouton icon={Copy} label="Cloner" onClick={onDupliquer} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <OutilBouton icon={FlipHorizontal} label="Retourner" onClick={() => onChange({ flip_h: !layer.flip_h })} />
          <OutilBouton icon={FlipVertical} label="Retourner" onClick={() => onChange({ flip_v: !layer.flip_v })} />
        </div>
      </div>
    </div>
  )
}

function OutilBouton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 py-2">
      <Icon size={22} style={{ color: 'var(--text-primary)' }} />
      <span className="text-caption" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </button>
  )
}

function OutilOpacite({ layer, onChange }) {
  return (
    <label className="flex flex-col items-center gap-1.5 py-2">
      <Circle size={22} style={{ color: 'var(--text-primary)' }} />
      <span className="text-caption" style={{ color: 'var(--text-primary)' }}>Opacité</span>
      <input
        type="range"
        min="0" max="1" step="0.05"
        value={layer.opacity ?? 1}
        onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
        className="w-16"
      />
    </label>
  )
}

// Sous-écran "Position" -- image 3 : 4 flèches directionnelles + champ
// "Étape" (pas de déplacement en pixels réels sur le canvas 1080x1350) +
// +/- pour agrandir/réduire le calque en conservant son ratio largeur/hauteur.
function PanneauPosition({ layer, onChange, onFermer }) {
  const [step, setStep] = useState(STEP_DEFAUT)

  const deplacer = (dx, dy) => onChange({ x: layer.x + dx, y: layer.y + dy })

  const redimensionner = (facteur) => {
    const ratio = layer.height / layer.width
    const nouvelleLargeur = Math.max(20, layer.width * facteur)
    onChange({ width: nouvelleLargeur, height: nouvelleLargeur * ratio })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{ backgroundColor: 'var(--accent)', height: '64px', color: '#fff' }}
      >
        <button onClick={onFermer} aria-label="Retour" className="flex items-center justify-center">
          <ChevronLeft size={26} />
        </button>
        <button onClick={onFermer} aria-label="Valider" className="flex items-center justify-center">
          <Check size={24} />
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div
          style={{
            width: '200px',
            height: `${(layer.height / layer.width) * 200}px`,
            backgroundColor: layer.background_color || undefined,
            backgroundImage: layer.image_url ? `url(${layer.image_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>

      <div className="shrink-0 p-4 flex flex-col gap-3">
        <div className="flex border-b" style={{ borderColor: 'var(--glass-border)' }}>
          <span className="px-3 py-2 text-body-medium" style={{ color: 'var(--accent)', borderBottom: '2px solid var(--accent)' }}>
            Manuel
          </span>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button onClick={() => deplacer(-step, 0)} className="w-10 h-10 flex items-center justify-center" aria-label="Gauche">
            <ArrowLeftIcon size={22} style={{ color: 'var(--text-primary)' }} />
          </button>
          <div className="flex flex-col gap-2">
            <button onClick={() => deplacer(0, -step)} className="w-10 h-10 flex items-center justify-center" aria-label="Haut">
              <ArrowUp size={22} style={{ color: 'var(--text-primary)' }} />
            </button>
            <button onClick={() => deplacer(0, step)} className="w-10 h-10 flex items-center justify-center" aria-label="Bas">
              <ArrowDown size={22} style={{ color: 'var(--text-primary)' }} />
            </button>
          </div>
          <button onClick={() => deplacer(step, 0)} className="w-10 h-10 flex items-center justify-center" aria-label="Droite">
            <ArrowRight size={22} style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-3">
          <span className="text-body" style={{ color: 'var(--text-primary)' }}>Étape</span>
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="w-8 h-8 rounded-lg glass flex items-center justify-center"
            aria-label="Diminuer le pas"
          >
            <Minus size={14} style={{ color: 'var(--text-primary)' }} />
          </button>
          <input
            type="number"
            value={step}
            onChange={(e) => setStep(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-14 text-center rounded-lg glass py-1"
            style={{ color: 'var(--text-primary)' }}
          />
          <button
            onClick={() => setStep((s) => s + 1)}
            className="w-8 h-8 rounded-lg glass flex items-center justify-center"
            aria-label="Augmenter le pas"
          >
            <Plus size={14} style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <span className="text-body" style={{ color: 'var(--text-primary)' }}>Taille</span>
          <button
            onClick={() => redimensionner(0.9)}
            className="w-8 h-8 rounded-lg glass flex items-center justify-center"
            aria-label="Réduire"
          >
            <Minus size={14} style={{ color: 'var(--text-primary)' }} />
          </button>
          <button
            onClick={() => redimensionner(1.1)}
            className="w-8 h-8 rounded-lg glass flex items-center justify-center"
            aria-label="Agrandir"
          >
            <Plus size={14} style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
