import { motion } from 'framer-motion'

/**
 * Cercle de note façon Instagram : anneau fin statique, même diamètre
 * pour tout le monde (a une note ou pas). Plus de halo tournant.
 *
 * hasNote=true  : anneau fin coloré (accent) statique, comme les stories Instagram vues
 * hasNote=false : anneau fin neutre (déjà vu / expiré / pas de note)
 */
export default function StoryRing({
  layoutId,
  photoUrl,
  fallbackSeed,
  hasStory, // conservé pour compat d'appel ; renommé conceptuellement en "hasNote"
  onClick,
  rotate = 0,
  size = 72,
}) {
  const hasNote = hasStory
  return (
    <motion.div
      layoutId={layoutId}
      onClick={onClick}
      className="relative shrink-0"
      style={{ width: size, height: size, rotate }}
      transition={{ type: 'tween', duration: 0.05 }}
    >
      <div
        className="relative w-full h-full rounded-full"
        style={{
          padding: '2px',
          background: hasNote
            ? 'linear-gradient(45deg, var(--accent), #ff2d6b)'
            : 'var(--border-color, rgba(128,128,128,0.35))',
        }}
      >
        <div className="w-full h-full rounded-full p-[2px]" style={{ background: 'var(--bg-primary)' }}>
          <img
            src={photoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${fallbackSeed}`}
            alt=""
            loading="eager"
            decoding="async"
            className="w-full h-full rounded-full object-cover"
          />
        </div>
      </div>
    </motion.div>
  )
}
