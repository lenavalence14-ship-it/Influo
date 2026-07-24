import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

if (Capacitor.isNativePlatform()) {
  // Le contenu reste sous la status bar par défaut (mode normal pour tous
  // les écrans classiques : feed, profil, messages...). Les écrans qui ont
  // besoin du plein écran sans aucune icône (NoteViewer, ReelsViewer)
  // masquent la barre eux-mêmes via StatusBar.hide() (voir ThemeContext).
  StatusBar.setOverlaysWebView({ overlay: false })
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
