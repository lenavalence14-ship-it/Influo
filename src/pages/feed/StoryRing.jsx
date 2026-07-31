import { motion } from 'framer-motion'

/**
 * Génère le chemin SVG d'une superellipse (squircle), la vraie courbe utilisée
 * par les icônes iOS et par la référence Atlantis — PAS un simple
 * border-radius CSS, qui donne un arc de cercle dans les coins au lieu de
 * cette transition progressive "plat au milieu, arrondi aux coins".
 * Formule : |x/a|^n + |y/b|^n = 1, avec n=4 (valeur standard squircle).
 */
function superellipsePath(width, height, n = 4, steps = 64) {
  const a = width / 2
  const b = height / 2
  const cx = a
  const cy = b
  const points = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2)
    const cosT = Math.cos(t)
    const sinT = Math.sin(t)
    const x = Math.pow(Math.abs(cosT), 2 / n) * a
    const y = Math.pow(Math.abs(sinT), 2 / n) * b
    points.push([x, y])
  }
  const q1 = points.map(([x, y]) => [cx + x, cy - y])
  const q2 = points.slice().reverse().map(([x, y]) => [cx - x, cy - y])
  const q3 = points.map(([x, y]) => [cx - x, cy + y])
  const q4 = points.slice().reverse().map(([x, y]) => [cx + x, cy + y])
  const all = [...q1, ...q2, ...q3, ...q4]
  return `M ${all.map((p) => p.join(',')).join(' L ')} Z`
}

/**
 * Cercle de note façon Instagram, mais avec la forme squircle (superellipse)
 * de la référence Atlantis au lieu d'un cercle parfait.
 *
 * uploading=true : un halo lumineux tourne autour tant que la publication
 * n'est pas terminée. Dès que uploading repasse à false, le halo s'arrête net.
 *
 * hasNote=true  : contour dégradé (accent) statique, comme les stories Instagram vues
 * hasNote=false : contour neutre (déjà vu / expiré / pas de note)
 */
export default function StoryRing({
  layoutId,
  photoUrl,
  fallbackSeed,
  hasStory,
  uploading = false,
  onClick,
  rotate = 0,
  size = 60,
}) {
  const hasNote = hasStory
  const width = size
  const height = size * 1.3
  const borderWidth = 3
  const clipPathId = `squircle-clip-${(layoutId || fallbackSeed || 'x').toString().replace(/[^a-zA-Z0-9-]/g, '')}`
  const path = superellipsePath(width, height)
  const innerPath = superellipsePath(width - borderWidth * 2, height - borderWidth * 2)

  return (
    <motion.div
      layoutId={layoutId}
      onClick={onClick}
      className="relative shrink-0"
      style={{ width, height, rotate }}
      transition={{ type: 'tween', duration: 0.05 }}
    >
      {uploading && (
        <div
          className="absolute pointer-events-none"
          style={{
            inset: -6,
            background: 'conic-gradient(from 0deg, transparent 0%, var(--accent) 35%, #ff2d6b 50%, transparent 65%)',
            animation: 'noteRingSpin 0.9s linear infinite',
            filter: 'blur(2px)',
            clipPath: `path('${superellipsePath(width + 12, height + 12)}')`,
          }}
        />
      )}
      <svg width={width} height={height} className="absolute inset-0">
        <defs>
          <clipPath id={clipPathId}>
            <path d={innerPath} transform={`translate(${borderWidth}, ${borderWidth})`} />
          </clipPath>
          <linearGradient id={`grad-${clipPathId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="#ff2d6b" />
          </linearGradient>
        </defs>
        <path d={path} fill={hasNote ? `url(#grad-${clipPathId})` : 'var(--border-color, rgba(128,128,128,0.35))'} />
        <path d={innerPath} fill="var(--bg-primary)" transform={`translate(${borderWidth}, ${borderWidth})`} />
      </svg>
      <div className="absolute inset-0">
        <img
          src={photoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${fallbackSeed}`}
          alt=""
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover"
          style={{
            clipPath: `url(#${clipPathId})`,
            padding: borderWidth + 2,
            boxSizing: 'border-box',
          }}
        />
      </div>
      {uploading && (
        <style>{`
          @keyframes noteRingSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      )}
    </motion.div>
  )
}
