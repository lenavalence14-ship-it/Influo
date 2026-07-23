import { motion } from 'framer-motion'

/**
 * Cercle de note façon Instagram : anneau fin statique, même diamètre
 * pour tout le monde (a une note ou pas).
 *
 * uploading=true : un halo lumineux tourne autour de l'anneau tant que la
 * publication (upload photo + insert) n'est pas terminée. Dès que
 * uploading repasse à false, le halo s'arrête net.
 *
 * hasNote=true  : anneau fin coloré (accent) statique, comme les stories Instagram vues
 * hasNote=false : anneau fin neutre (déjà vu / expiré / pas de note)
 */
export default function StoryRing({
  layoutId,
  photoUrl,
  fallbackSeed,
  hasStory, // conservé pour compat d'appel ; renommé conceptuellement en "hasNote"
  uploading = false,
  onClick,
  rotate = 0,
  size = 88,
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
      {uploading && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: -6,
            background: 'conic-gradient(from 0deg, transparent 0%, var(--accent) 35%, #ff2d6b 50%, transparent 65%)',
            animation: 'noteRingSpin 0.9s linear infinite',
            filter: 'blur(2px)',
          }}
        />
      )}
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
