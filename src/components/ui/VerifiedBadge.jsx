export default function VerifiedBadge({ size = 16 }) {
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size} height={size} fill="none">
        <defs>
          <linearGradient id="verifiedBadgeGradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>
        </defs>
        <path
          fill="url(#verifiedBadgeGradient)"
          d="M19.9998 2.5L23.9583 5.44306L28.8384 4.75721L30.5384 9.39069L35.0503 11.4599L34.5883 16.3712L37.6905 20.2005L34.5883 24.0298L35.0503 28.9411L30.5384 31.0103L28.8384 35.6438L23.9583 34.9579L19.9998 37.9010L16.0413 34.9579L11.1612 35.6438L9.46122 31.0103L4.94933 28.9411L5.41134 24.0298L2.30908 20.2005L5.41134 16.3712L4.94933 11.4599L9.46122 9.39069L11.1612 4.75721L16.0413 5.44306L19.9998 2.5Z"
        />
        <path
          d="M13.5 20.3L18 24.8L27 15.5"
          stroke="white"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}