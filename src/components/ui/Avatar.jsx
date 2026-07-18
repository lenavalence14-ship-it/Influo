/**
 * Avatar — image de profil standardisée.
 * Toujours un cercle parfait (rounded-full), conforme au pattern Instagram existant.
 *
 * size: 'sm' (32px) | 'md' (40px) | 'lg' (64px) | 'xl' (80px) | 'xxl' (96px)
 */
const SIZES = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
  xxl: 'w-24 h-24',
}

export default function Avatar({ src, seed, size = 'md', className = '', ring = false }) {
  const fallback = `https://api.dicebear.com/9.x/glass/svg?seed=${seed || 'default'}`

  if (ring) {
    return (
      <div className={`${SIZES[size]} rounded-full p-[2.5px] bg-gradient-to-br from-purple-600 via-violet-500 to-fuchsia-400 shrink-0 ${className}`}>
        <div className="w-full h-full rounded-full bg-[var(--bg-primary)] p-[2px]">
          <img src={src || fallback} alt="" className="w-full h-full rounded-full object-cover" />
        </div>
      </div>
    )
  }

  return (
    <img
      src={src || fallback}
      alt=""
      className={`${SIZES[size]} rounded-full object-cover shrink-0 ${className}`}
    />
  )
}