/**
 * Badge — étiquette générique (rôle, plateforme, statut).
 * Ne remplace pas VerifiedBadge, qui reste un composant dédié au symbole de vérification.
 *
 * variant: 'default' (glass neutre) | 'accent' (couleur accent) | 'success' | 'danger'
 */
export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'glass text-[var(--text-primary)]',
    accent: 'bg-[var(--accent)] text-white',
    success: 'bg-green-500/15 text-green-400',
    danger: 'bg-red-500/15 text-red-400',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-caption-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
