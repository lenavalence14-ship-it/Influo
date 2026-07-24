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

    // synchronise la couleur de la barre système (statut) avec le thème actif
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

    // Android natif (Capacitor) : la meta tag ci-dessus n'a aucun effet, il faut appeler le plugin directement.
    // IMPORTANT : ces appels peuvent échouer silencieusement (pont natif pas
    // encore prêt au tout début du montage, notamment en mode server.url où
    // le WebView charge du contenu distant — le pont Capacitor peut être
    // légèrement en retard par rapport au JS). Sans .catch(), une promesse
    // rejetée disparaît sans rien faire : le style de la barre reste bloqué
    // sur son état précédent, ce qui donnait l'impression d'un bug
    // intermittent où la barre "oublie" de changer de couleur. On catch et
    // on retente une fois après un court délai.
    if (!Capacitor.isNativePlatform()) return

    const applyStatusBar = () => {
      StatusBar.setBackgroundColor({ color }).catch(() => {})
      StatusBar.setStyle({ style: theme === 'light' ? Style.Dark : Style.Light }).catch(() => {})
    }
    applyStatusBar()
    const retry = setTimeout(applyStatusBar, 400)

    // ThemeContext est l'UNIQUE responsable de la couleur/style de la barre
    // de statut, partout dans l'app. D'autres composants peuvent avoir
    // besoin de faire basculer l'overlay plein écran (ex: NoteViewer pour
    // que les photos remplissent tout l'écran) — ce qui peut réinitialiser
    // la couleur/style côté natif Android. Plutôt que de laisser ces
    // composants dupliquer leur propre logique couleur (source de bugs
    // intermittents constatés avant), ils émettent juste un événement
    // 'statusbar-reapply' pour demander à ThemeContext de réappliquer SA
    // version, une fois l'overlay stabilisé.
    window.addEventListener('statusbar-reapply', applyStatusBar)
    return () => {
      clearTimeout(retry)
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
