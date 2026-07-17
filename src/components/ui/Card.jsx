/**
 * Card — surface standard de l'application.
 * Remplace tous les usages ad hoc de `glass-strong rounded-3xl` etc.
 *
 * variant: 'strong' (fond très visible, ex. post, écran principal)
 *          'subtle' (fond plus discret, ex. ligne de liste, item secondaire)
 * padding: 'none' | 'sm' (12px) | 'md' (16px) | 'lg' (24px)
 */
export default function Card({
  children,
  variant = 'strong',
  padding = 'none',
  className = '',
  as: Tag = 'div',
  ...rest
}) {
  const variants = {
    strong: 'glass-strong',
    subtle: 'glass',
  }
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  return (
    <Tag
      className={`rounded-2xl overflow-hidden ${variants[variant]} ${paddings[padding]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}
