import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

if (Capacitor.isNativePlatform()) {
  // Approche standard des apps natives: le contenu passe SOUS la status bar
  // (overlay actif), la barre est transparente, et chaque écran gère son
  // propre padding via env(safe-area-inset-top) (déjà en place partout).
  // Chaque écran déclare explicitement sa couleur d'icônes au lieu de la
  // deviner par lecture de pixels.
  StatusBar.setOverlaysWebView({ overlay: true })
}

// Le service worker de la PWA peut garder en cache une ancienne version du HTML/JS/CSS,
// ce qui fait que l'app native (qui charge l'URL via ce SW) affiche une version en retard
// par rapport au web. registerSW avec immediate:true force une vérification de mise à jour
// dès le lancement, et onNeedRefresh recharge automatiquement dès qu'une nouvelle version
// est détectée, au lieu d'attendre le prochain cycle naturel du navigateur.
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload()
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // les données restent "fraîches" 60s : pas de refetch ni de loading en revenant sur une page déjà visitée
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
