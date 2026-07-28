import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { ChevronLeft, Check } from 'lucide-react'

// Écran "Recadrer" -- recadrage manuel à la souris/au doigt (zone de crop
// déplaçable et redimensionnable librement sur l'image). À la validation,
// les coordonnées de la zone (en pixels réels de l'image source) sont
// écrites sur le calque (crop_x/crop_y/crop_width/crop_height), lues par
// KonvaImage côté canvas principal pour n'afficher que la portion recadrée.
export default function PanneauRecadrer({ layer, onChange, onFermer }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [zoneCroppee, setZoneCroppee] = useState(null)

  const onCropComplete = useCallback((_zonePourcentage, zonePixels) => {
    setZoneCroppee(zonePixels)
  }, [])

  const valider = () => {
    if (zoneCroppee) {
      onChange({
        crop_x: zoneCroppee.x,
        crop_y: zoneCroppee.y,
        crop_width: zoneCroppee.width,
        crop_height: zoneCroppee.height,
      })
    }
    onFermer()
  }

  if (!layer.image_url) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <header
          className="flex items-center gap-4 px-4"
          style={{ backgroundColor: 'var(--accent)', height: '64px', color: '#fff' }}
        >
          <button onClick={onFermer} aria-label="Retour" className="flex items-center justify-center">
            <ChevronLeft size={26} />
          </button>
          <h1 className="text-body-medium" style={{ fontSize: '17px', color: '#fff' }}>Recadrer</h1>
        </header>
        <p className="p-6 text-center text-body" style={{ color: 'var(--text-secondary)' }}>
          Ce calque n'a pas d'image (couleur pleine) -- rien à recadrer.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{ backgroundColor: 'var(--accent)', height: '64px', color: '#fff' }}
      >
        <button onClick={onFermer} aria-label="Retour" className="flex items-center justify-center">
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-body-medium" style={{ fontSize: '17px', color: '#fff' }}>Recadrer</h1>
        <button onClick={valider} aria-label="Valider" className="flex items-center justify-center">
          <Check size={24} />
        </button>
      </header>

      <div className="relative flex-1" style={{ minHeight: '400px' }}>
        <Cropper
          image={layer.image_url}
          crop={crop}
          zoom={zoom}
          aspect={undefined}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="contain"
        />
      </div>

      <div className="shrink-0 p-4 flex items-center gap-3">
        <span className="text-caption" style={{ color: 'var(--text-primary)' }}>Zoom</span>
        <input
          type="range"
          min="1" max="3" step="0.01"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="flex-1"
        />
      </div>
    </div>
  )
}
