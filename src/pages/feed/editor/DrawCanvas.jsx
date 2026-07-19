import { useEffect, useRef, useState } from 'react'

const DRAW_COLORS = ['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#eab308', '#a855f7']

/**
 * Canvas de dessin libre en overlay. `active` contrôle si le canvas capte les
 * pointer events (sinon les taps traversent vers le reste de l'éditeur).
 * `onExport` reçoit un dataURL PNG transparent à chaque trait terminé.
 */
export default function DrawCanvas({ active, width, height, onExport }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [color, setColor] = useState('#ffffff')
  const [strokeWidth, setStrokeWidth] = useState(6)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
  }, [width, height])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const startDraw = (e) => {
    if (!active) return
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = color
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const draw = (e) => {
    if (!active || !drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const endDraw = () => {
    if (!active || !drawing.current) return
    drawing.current = false
    onExport?.(canvasRef.current.toDataURL('image/png'))
  }

  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    onExport?.(null)
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: active ? 'none' : 'auto', pointerEvents: active ? 'auto' : 'none' }}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />
      {active && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 z-20">
          <div className="flex items-center gap-2 flex-1 overflow-x-auto">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 shrink-0 ${color === c ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            type="range"
            min="2"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-16 shrink-0"
          />
          <button onClick={clearCanvas} className="text-white text-caption-medium shrink-0 px-2">
            Effacer
          </button>
        </div>
      )}
    </>
  )
}
