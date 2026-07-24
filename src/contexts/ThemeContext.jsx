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

    // Une seule règle, appliquée partout dans l'app sans exception (feed,
    // NoteViewer, ReelsViewer, tout écran) : l'app reste toujours affichée
    // SOUS la status bar (pas d'overlay, pas de plein écran caché — voir
    // main.jsx: setOverlaysWebView({ overlay: false })). Le fond de la barre
    // suit le thème, et les icônes sont toujours la couleur opposée au fond.
    StatusBar.setBackgroundColor({ color }).catch(() => {})
    StatusBar.setStyle({ style: theme === 'light' ? Style.Dark : Style.Light }).catch(() => {})
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
