export default function Logo({ size = 38, className = '' }) {
  return (
    <img
      src="/src/assets/logo.svg"
      alt="Fluo"
      className={className}
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  )
}