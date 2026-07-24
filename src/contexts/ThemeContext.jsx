import { createContext, useContext, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('influo-theme') || 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
    localStorage.setItem('influo-theme', theme)

    // synchronise la couleur/style de la barre système avec le thème actif,
    // partout dans l'app (aucun composant ne gère l'overlay ou la couleur
    // de son côté — le contenu reste toujours affiché EN DESSOUS de la
    // barre de statut, jamais derrière, overlay désactivé une fois pour
    // toutes dans main.jsx).
    const color = theme === 'light' ? '#f5f5f5' : '#0a0a0a'
    let meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', color)

    // iOS : la barre de statut ne peut être que claire/sombre/translucide, pas une couleur précise
    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (appleMeta) {
      appleMeta.setAttribute('content', theme === 'light' ? 'default' : 'black-translucent')
    }

    if (!Capacitor.isNativePlatform()) return

    // Règle: les icônes de la status bar doivent toujours être la couleur
    // inverse du fond RÉELLEMENT affiché sous elles à cet instant précis
    // (pas du thème global de l'app). On lit donc en continu la couleur de
    // fond effective au sommet de l'écran, et on en déduit le style
    // d'icônes opposé. Marche pour toute page sans qu'aucune page n'ait à
    // s'en occuper individuellement.

    const parseRgb = (str) => {
      const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
      if (!m) return null
      return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
    }

    const isLightColor = ([r, g, b]) => {
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      return luminance > 0.5
    }

    const getTopBackgroundColor = () => {
      const x = window.innerWidth / 2
      const y = 4
      const stack = document.elementsFromPoint(x, y)
      for (const el of stack) {
        const bg = getComputedStyle(el).backgroundColor
        const rgb = parseRgb(bg)
        if (rgb && !/rgba\([^)]*,\s*0\s*\)/.test(bg)) {
          return rgb
        }
      }
      return null
    }

    let lastStyle = null
    const applyStatusBar = () => {
      const rgb = getTopBackgroundColor()
      const light = rgb ? isLightColor(rgb) : theme === 'light'
      const style = light ? Style.Dark : Style.Light
      if (style !== lastStyle) {
        StatusBar.setStyle({ style }).catch(() => {})
        lastStyle = style
      }
      StatusBar.setBackgroundColor({ color }).catch(() => {})
    }

    applyStatusBar()
    const retry = setTimeout(applyStatusBar, 400)
    const observer = new MutationObserver(() => applyStatusBar())
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
    const interval = setInterval(applyStatusBar, 500)
    window.addEventListener('statusbar-reapply', applyStatusBar)

    return () => {
      clearTimeout(retry)
      clearInterval(interval)
      observer.disconnect()
      window.removeEventListener('statusbar-reapply', applyStatusBar)
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
