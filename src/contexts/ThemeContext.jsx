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

    // Réglage par défaut basé sur le thème global. Un écran avec un fond fixe
    // différent du thème (ex: NoteViewer toujours sombre) doit appeler
    // setStatusBarStyle lui-même via useStatusBarStyle ci-dessous — comme le
    // fait n'importe quelle app native normale (chaque écran déclare sa
    // propre couleur de status bar, pas de détection automatique).
    StatusBar.setStyle({ style: theme === 'light' ? Style.Dark : Style.Light }).catch(() => {})
  }, [theme])

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  // API pour les écrans plein écran (NoteViewer, ReelsViewer) qui ne
  // peuvent pas deviner la couleur du contenu posté par l'utilisateur :
  // on masque entièrement la status bar plutôt que de choisir une couleur
  // d'icônes au hasard.
  const hideStatusBar = () => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.hide().catch(() => {})
  }
  const showStatusBar = () => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.show().catch(() => {})
    StatusBar.setStyle({ style: theme === 'light' ? Style.Dark : Style.Light }).catch(() => {})
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, hideStatusBar, showStatusBar }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

// À appeler dans un écran plein écran dont le contenu peut être n'importe
// quelle couleur (posté par l'utilisateur) : NoteViewer, ReelsViewer.
// On ne peut pas deviner la bonne couleur d'icônes, donc on masque
// entièrement la status bar tant que l'écran est affiché, et on la
// réaffiche (avec le style du thème global) en le quittant.
export function useFullscreenStatusBar() {
  const { hideStatusBar, showStatusBar } = useTheme()
  useEffect(() => {
    hideStatusBar()
    return () => {
      showStatusBar()
    }
  }, [])
}
