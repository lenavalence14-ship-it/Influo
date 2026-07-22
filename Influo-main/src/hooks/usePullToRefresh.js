import { useEffect, useRef, useState } from 'react'

// Hook générique de pull-to-refresh tactile (comme Instagram).
// Ne se déclenche que si le scroll est déjà tout en haut de la page,
// pour ne pas interférer avec le scroll normal.
const THRESHOLD = 70 // distance en px à tirer avant de déclencher le refresh
const MAX_PULL = 110 // distance max visuelle de l'indicateur

export function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)

  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY > 0 || refreshing) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    const onTouchMove = (e) => {
      if (!pulling.current || refreshing) return
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) {
        setPullDistance(0)
        return
      }
      // resistance progressive pour un rendu naturel (comme iOS/Instagram)
      const resisted = Math.min(MAX_PULL, delta * 0.5)
      setPullDistance(resisted)
    }

    const onTouchEnd = async () => {
      if (!pulling.current) return
      pulling.current = false
      if (pullDistance >= THRESHOLD) {
        setRefreshing(true)
        setPullDistance(THRESHOLD)
        try {
          await onRefresh()
        } finally {
          setRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [pullDistance, refreshing, onRefresh])

  return { pullDistance, refreshing, threshold: THRESHOLD }
}
