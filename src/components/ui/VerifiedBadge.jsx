import { Check } from 'lucide-react'

export default function VerifiedBadge({ size = 16 }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-white shrink-0"
      style={{ width: size, height: size }}
    >
      <Check size={size * 0.65} strokeWidth={3} className="text-black" />
    </span>
  )
}
