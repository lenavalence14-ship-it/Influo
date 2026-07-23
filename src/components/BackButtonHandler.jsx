import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'

// Routes considérées comme "accueil" : si l'utilisateur appuie sur retour
// physique alors qu'il est sur l'une d'elles, l'app se ferme (comportement
// natif attendu). Partout ailleurs, le bouton retour navigue en arrière
// dans l'historique React Router, comme les boutons retour internes de l'app.
const ROOT_PATHS = ['/', '/profils']

export default function BackButtonHandler() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let listenerHandle

    CapacitorApp.addListener('backButton', () => {
      const isRoot = ROOT_PATHS.includes(location.pathname)

      if (isRoot) {
        CapacitorApp.exitApp()
      } else {
        navigate(-1)
      }
    }).then((handle) => {
      listenerHandle = handle
    })

    return () => {
      listenerHandle?.remove()
    }
  }, [location, navigate])

  return null
}
