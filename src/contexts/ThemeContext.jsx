import { createContext, useContext, useEffect, useState } from 'react'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

const ThemeContext = createContext()

// Règle unique, appliquée partout dans l'app, sans aucune exception
// (feed, NoteViewer, ReelsViewer, tout écran) :
// - thème sombre  -> fond de page noir, icônes de la barre système blanches
// - thème clair   -> fond de page blanc, icônes de la barre système noires
// Aucun écran ne gère la barre système de son côté.

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

    const color = theme === 'light' ? '#f5f5f5' : '#0a0a0a'

    let meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', color)

    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (appleMeta) {
      appleMeta.setAttribute('content', theme === 'light' ? 'default' : 'black-translucent')
    }

    if (!Capacitor.isNativePlatform()) return

    SystemBars.setStyle({
      style: theme === 'light' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    }).catch(() => {})
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
