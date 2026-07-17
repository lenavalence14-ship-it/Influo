/**
 * Section — bloc vertical standard.
 * Garantit un espacement cohérent entre les grandes zones d'un écran
 * (ex. header de page, groupe de cards, bloc de formulaire).
 *
 * spacing: 'sm' (16px) | 'md' (24px) | 'lg' (32px) — espace en dessous de la section.
 */
export default function Section({ children, spacing = 'md', className = '' }) {
  const spacings = {
    sm: 'mb-4',
    md: 'mb-6',
    lg: 'mb-8',
  }

  return <div className={`${spacings[spacing]} ${className}`}>{children}</div>
}
