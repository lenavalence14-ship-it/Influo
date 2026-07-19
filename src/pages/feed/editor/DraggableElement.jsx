import { useRef } from 'react'

/**
 * Élément libre positionné en % (x, y) sur le canvas parent, déplaçable au doigt.
 * `element` = { id, type: 'texte'|'sticker'|'mention', x, y, ...props }
 */
export default function DraggableElement({ element, onMove, onTap, children }) {
  const dragging = useRef(false)
  const parentRef = useRef(null)

  const handlePointerDown = (e) => {
    e.stopPropagation()
    dragging.current = true
    parentRef.current = e.currentTarget.parentElement
  }

  const handlePointerMove = (e) => {
    if (!dragging.current || !parentRef.current) return
    const rect = parentRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onMove(element.id, Math.max(2, Math.min(98, x)), Math.max(2, Math.min(98, y)))
  }

  const handlePointerUp = () => {
    dragging.current = false
  }

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing touch-none"
      style={{ left: `${element.x}%`, top: `${element.y}%` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={(e) => { e.stopPropagation(); onTap?.(element) }}
    >
      {children}
    </div>
  )
}
