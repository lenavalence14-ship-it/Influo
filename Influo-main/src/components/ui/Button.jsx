export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // primary | glass | ghost | danger
  shape = 'pill', // pill | rect
  className = '',
  disabled = false,
  fullWidth = false,
}) {
  const base =
    'h-9 px-4 inline-flex items-center justify-center gap-2 text-small-medium ' +
    'transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100'

  const shapes = {
    pill: 'rounded-full h-12 px-6 text-body-medium',
    rect: 'rounded-lg',
  }

  const variants = {
    primary: 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90',
    glass: 'glass text-[var(--text-primary)] hover:bg-white/10',
    ghost: 'bg-transparent text-[var(--text-primary)] hover:bg-white/5',
    danger: 'bg-transparent text-red-500 hover:bg-red-500/10',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${shapes[shape]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}
