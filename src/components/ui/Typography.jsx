/**
 * Typography — échelle unique de l'application.
 * Display 32 / H1 24 / H2 20 / Body 16 / Caption 13.
 * Utiliser ces composants plutôt que des classes text-* arbitraires.
 */

export function Display({ as: Tag = 'h1', className = '', children, ...rest }) {
  return (
    <Tag className={`text-display ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function H1({ as: Tag = 'h1', className = '', children, ...rest }) {
  return (
    <Tag className={`text-h1 ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function H2({ as: Tag = 'h2', className = '', children, ...rest }) {
  return (
    <Tag className={`text-h2 ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function Body({ as: Tag = 'p', medium = false, className = '', children, ...rest }) {
  return (
    <Tag className={`${medium ? 'text-body-medium' : 'text-body'} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function Caption({ as: Tag = 'span', medium = false, muted = true, className = '', children, ...rest }) {
  return (
    <Tag
      className={`${medium ? 'text-caption-medium' : 'text-caption'} ${
        muted ? 'text-[var(--text-secondary)]' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}
