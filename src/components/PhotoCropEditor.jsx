import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import {
  getCropTransformStyle,
  getMinZoom,
  getCoverZoom,
  clampZoom,
  clampOffset,
  CROP_ASPECT_CLASSES,
} from '../lib/mediaCrop'

// Écran plein-écran de recadrage zoom + pan (façon Instagram), pour UNE
// image. Extrait du pattern gestuel de CreatePost.jsx (écran crop d'un post)
// mais générique -- pas de carrousel, pas de choix de ratio ni de rotation --
// pour être réutilisable ailleurs (ici : la photo du Media Kit, ratio fixe
// 'media_kit'). Le rendu du recadrage (getCropTransformStyle) est le MÊME
// que celui utilisé ensuite dans le feed pour afficher le résultat final :
// ce que l'utilisateur voit ici est exactement ce qui sera publié.
//
// Props :
// - imageSrc : URL de l'image à recadrer (objectURL ou URL distante)
// - cropFormat : clé de RATIO_VALUES / CROP_ASPECT_CLASSES (ex. 'media_kit')
// - initialCrop : { zoom, offsetX, offsetY, naturalWidth, naturalHeight } ou null
// - onCancel() : appelé si l'utilisateur annule
// - onConfirm(crop) : appelé avec { zoom, offsetX, offsetY, naturalWidth, naturalHeight }
export default function PhotoCropEditor({ imageSrc, cropFormat, initialCrop, onCancel, onConfirm }) {
  const cropAreaRef = useRef(null)
  const gestureState = useRef(null)
  const pendingEvent = useRef(null)
  const rafId = useRef(null)

  const [crop, setCrop] = useState(() => ({
    zoom: initialCrop?.zoom ?? 1,
    offsetX: initialCrop?.offsetX ?? 0,
    offsetY: initialCrop?.offsetY ?? 0,
    naturalWidth: initialCrop?.naturalWidth ?? null,
    naturalHeight: initialCrop?.naturalHeight ?? null,
  }))

  // Dimensions naturelles inconnues au départ (image pas encore décodée) :
  // dès qu'on les a, on pousse le zoom au minimum "contain" pour ne pas
  // partir sur un cadrage incohérent (photo entière visible par défaut).
  const handleImgLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget
    if (!naturalWidth || !naturalHeight) return
    setCrop((prev) => {
      if (prev.naturalWidth) return prev // déjà connu (ex. recadrage d'une photo déjà enregistrée)
      const minZoom = getMinZoom(naturalWidth, naturalHeight, cropFormat)
      return { ...prev, naturalWidth, naturalHeight, zoom: Math.max(prev.zoom, minZoom) }
    })
  }

  const distanceBetween = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)

  const startGesture = (e) => {
    e.stopPropagation()
    const touches = e.touches
    if (touches && touches.length === 2) {
      gestureState.current = {
        type: 'pinch',
        startDist: distanceBetween(touches[0], touches[1]),
        startZoom: crop.zoom,
        start: { ...crop },
      }
    } else {
      const point = touches ? touches[0] : e
      gestureState.current = { type: 'pan', startX: point.clientX, startY: point.clientY, start: { ...crop } }
    }
  }

  const computeNextCrop = (e) => {
    const rect = cropAreaRef.current.getBoundingClientRect()
    const gesture = gestureState.current
    const minZoom = getMinZoom(gesture.start.naturalWidth, gesture.start.naturalHeight, cropFormat)
    const coverZoom = getCoverZoom(gesture.start.naturalWidth, gesture.start.naturalHeight, cropFormat)

    if (gesture.type === 'pinch' && e.touches?.length === 2) {
      const dist = distanceBetween(e.touches[0], e.touches[1])
      const scaleFactor = dist / gesture.startDist
      const nextZoom = clampZoom(gesture.startZoom * scaleFactor, minZoom)
      return {
        ...gesture.start,
        zoom: nextZoom,
        offsetX: clampOffset(gesture.start.offsetX, nextZoom, coverZoom),
        offsetY: clampOffset(gesture.start.offsetY, nextZoom, coverZoom),
      }
    }

    const point = e.touches ? e.touches[0] : e
    const dx = ((point.clientX - gesture.startX) / rect.width) * 100
    const dy = ((point.clientY - gesture.startY) / rect.height) * 100
    return {
      ...gesture.start,
      offsetX: clampOffset(gesture.start.offsetX + dx, gesture.start.zoom, coverZoom),
      offsetY: clampOffset(gesture.start.offsetY + dy, gesture.start.zoom, coverZoom),
    }
  }

  const flushGesture = useCallback(() => {
    rafId.current = null
    if (!gestureState.current || !cropAreaRef.current || !pendingEvent.current) return
    setCrop(computeNextCrop(pendingEvent.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropFormat])

  const onGestureMove = useCallback((e) => {
    if (!gestureState.current || !cropAreaRef.current) return
    if (e.touches?.length === 2 && gestureState.current.type === 'pan') startGesture(e)
    pendingEvent.current = e
    if (rafId.current == null) rafId.current = requestAnimationFrame(flushGesture)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushGesture])

  const endGesture = useCallback(() => {
    gestureState.current = null
    pendingEvent.current = null
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', onGestureMove, { passive: true })
    window.addEventListener('pointerup', endGesture)
    window.addEventListener('touchmove', onGestureMove, { passive: true })
    window.addEventListener('touchend', endGesture)
    return () => {
      window.removeEventListener('pointermove', onGestureMove)
      window.removeEventListener('pointerup', endGesture)
      window.removeEventListener('touchmove', onGestureMove)
      window.removeEventListener('touchend', endGesture)
      if (rafId.current != null) cancelAnimationFrame(rafId.current)
    }
  }, [onGestureMove, endGesture])

  const transformStyle = getCropTransformStyle({
    naturalWidth: crop.naturalWidth,
    naturalHeight: crop.naturalHeight,
    cropFormat,
    zoom: crop.zoom,
    offsetX: crop.offsetX,
    offsetY: crop.offsetY,
  })

  const minZoom = getMinZoom(crop.naturalWidth, crop.naturalHeight, cropFormat)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black select-none">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onCancel} aria-label="Annuler" className="p-2 text-white">
          <X size={22} />
        </button>
        <span className="text-body-medium text-white">Recadrer la photo</span>
        <button onClick={() => onConfirm(crop)} aria-label="Valider" className="p-2 text-white">
          <Check size={22} />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden px-4">
        <div
          ref={cropAreaRef}
          className={`relative w-full bg-black ${CROP_ASPECT_CLASSES[cropFormat] || 'aspect-square'} overflow-hidden touch-none`}
          onPointerDown={startGesture}
          onTouchStart={startGesture}
        >
          <img
            src={imageSrc}
            alt=""
            className="absolute inset-0 select-none pointer-events-none"
            draggable={false}
            onLoad={handleImgLoad}
            style={transformStyle}
          />
          {/* grille de composition, repère visuel uniquement */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-white/25" />
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <input
          type="range"
          min={minZoom}
          max={3}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => {
            const nextZoom = clampZoom(parseFloat(e.target.value), minZoom)
            const coverZoom = getCoverZoom(crop.naturalWidth, crop.naturalHeight, cropFormat)
            setCrop((prev) => ({
              ...prev,
              zoom: nextZoom,
              offsetX: clampOffset(prev.offsetX, nextZoom, coverZoom),
              offsetY: clampOffset(prev.offsetY, nextZoom, coverZoom),
            }))
          }}
          className="w-full accent-white"
          aria-label="Zoom"
        />
      </div>
    </div>
  )
}
