import logoSvg from '../../assets/logo.svg'

export default function Logo({ size = 38, className = '' }) {
  return (
    <img
      src={logoSvg}
      alt="Fluo"
      className={className}
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  )
}