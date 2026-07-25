import { useEffect, useRef, useState } from 'react'

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

export default function FilterPicker({ imageUrl, isVideo, value, onChange }) {
  // Pour une vidéo, on extrait une seule fois une vraie frame (via canvas) au lieu
  // de monter 8 balises <video> identiques : sur Chrome/Android, une <video> qui ne
  // joue jamais n'affiche souvent rien tant qu'aucune frame n'a été peinte, d'où les
  // vignettes grises vues jusqu'ici. Une image statique s'affiche de façon fiable
  // partout, et coûte 8x moins de décodage vidéo simultané.
  const [videoThumb, setVideoThumb] = useState(null)

  useEffect(() => {
    if (!isVideo || !imageUrl) return
    let cancelled = false
    const video = document.createElement('video')
    video.src = imageUrl
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'

    const capture = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 200
        canvas.height = video.videoHeight || 200
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        setVideoThumb(canvas.toDataURL('image/jpeg', 0.8))
      } catch {
        // toDataURL peut échouer (source cross-origin sans CORS autorisé) : on
        // laisse simplement videoThumb à null, le fond neutre s'affiche à la place
      }
    }

    video.addEventListener('loadeddata', () => {
      // se positionne légèrement après le tout début (souvent noir/flou en vrai)
      try { video.currentTime = Math.min(0.1, video.duration || 0) } catch { capture() }
    })
    video.addEventListener('seeked', capture)
    video.addEventListener('error', () => setVideoThumb(null))

    return () => { cancelled = true }
  }, [isVideo, imageUrl])

  const thumbSrc = isVideo ? videoThumb : imageUrl

  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-3 pt-2">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key === 'normal' ? null : f.key)}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div
            className={`w-14 h-14 rounded-xl overflow-hidden border-2 bg-white/10 ${
              (value || 'normal') === f.key ? 'border-white' : 'border-transparent'
            }`}
          >
            {thumbSrc && (
              <img
                src={thumbSrc}
                alt=""
                className="w-full h-full object-cover"
                style={{ filter: f.css }}
              />
            )}
          </div>
          <span className="text-[11px] text-white/80">{f.label}</span>
        </button>
      ))}
    </div>
  )
}
