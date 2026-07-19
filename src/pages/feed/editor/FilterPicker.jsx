export const FILTERS = [
  { key: 'normal', label: 'Normal', css: 'none' },
  { key: 'clair', label: 'Clair', css: 'brightness(1.15) contrast(1.05)' },
  { key: 'chaud', label: 'Chaud', css: 'sepia(0.25) saturate(1.3) brightness(1.05)' },
  { key: 'froid', label: 'Froid', css: 'saturate(1.1) hue-rotate(-8deg) brightness(1.05)' },
  { key: 'noir_blanc', label: 'N&B', css: 'grayscale(1) contrast(1.1)' },
  { key: 'vintage', label: 'Vintage', css: 'sepia(0.4) contrast(0.9) brightness(0.95) saturate(0.85)' },
  { key: 'vif', label: 'Vif', css: 'saturate(1.5) contrast(1.1)' },
  { key: 'fade', label: 'Fade', css: 'contrast(0.85) brightness(1.1) saturate(0.7)' },
]

export function getFilterCss(key) {
  return FILTERS.find((f) => f.key === key)?.css || 'none'
}

export default function FilterPicker({ imageUrl, value, onChange }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-3 pt-2">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key === 'normal' ? null : f.key)}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div
            className={`w-14 h-14 rounded-xl overflow-hidden border-2 ${
              (value || 'normal') === f.key ? 'border-white' : 'border-transparent'
            }`}
          >
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: f.css }}
            />
          </div>
          <span className="text-[11px] text-white/80">{f.label}</span>
        </button>
      ))}
    </div>
  )
}
