export default function GlassCard({ children, className = '', strong = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`${strong ? 'glass-strong' : 'glass'} rounded-3xl ${className}`}
    >
      {children}
    </div>
  )
}
