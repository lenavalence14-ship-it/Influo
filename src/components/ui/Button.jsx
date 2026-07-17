export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // primary | glass | ghost
  className = '',
  disabled = false,
  fullWidth = false,
}) {
  const base = 'font-medium rounded-full px-6 py-3.5 transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100'
  const variants = {
    primary: 'bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90',
    glass: 'glass text-[var(--text-primary)] hover:bg-white/10',
    ghost: 'bg-transparent text-[var(--text-primary)] hover:bg-white/5',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}
