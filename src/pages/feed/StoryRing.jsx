import { motion } from 'framer-motion'

/**
 * Cercle de story avec anneau lumineux animé (mode Light/Dark uniquement).
 * Isolé de StoryBar pour porter le layoutId partagé avec StoryViewer :
 * c'est ce layoutId qui permet à Framer Motion de faire l'expansion
 * cercle -> plein écran de façon fluide (voir StoryViewer.jsx).
 *
 * hasStory=false : anneau statique neutre (pas d'énergie, rien à "ouvrir" comme story)
 * hasStory=true  : anneau cramoisi avec un halo qui tourne en continu
 */
export default function StoryRing({
  layoutId,
  photoUrl,
  fallbackSeed,
  hasStory,
  onClick,
  rotate = 0,
  size = 72,
}) {
  return (
    <motion.div
      layoutId={layoutId}
      onClick={onClick}
      className="relative shrink-0"
      style={{ width: size, height: size, rotate }}
      transition={{ type: 'tween', duration: 0.05 }}
    >
      {hasStory ? (
        <div className="relative w-full h-full rounded-full p-[2.5px] overflow-hidden">
          {/* halo tournant : conic-gradient plus large que le cercle, mis en rotation continue */}
          <div
            className="absolute -inset-[6px] animate-story-ring-spin"
            style={{
              background:
                'conic-gradient(from 0deg, var(--accent), #ff2d6b, var(--accent) 55%, #ff2d6b 80%, var(--accent))',
              filter: 'blur(0.5px)',
            }}
          />
          <div className="relative w-full h-full rounded-full p-[2.5px]" style={{ background: 'var(--bg-primary)' }}>
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
        </div>
      ) : (
        <img
          src={photoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${fallbackSeed}`}
          alt=""
          loading="eager"
          decoding="async"
          className="w-full h-full rounded-full object-cover"
        />
      )}
    </motion.div>
  )
}
