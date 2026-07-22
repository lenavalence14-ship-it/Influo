import { useLocation } from 'react-router-dom'
import { useRef } from 'react'

/**
 * Garde en mémoire chaque écran de la barre de navigation principale au lieu
 * de le démonter/remonter à chaque changement d'onglet (comportement par
 * défaut de <Outlet /> / React Router).
 *
 * Problème résolu : sans ceci, revenir sur le Feed après être allé sur
 * Recherche recrée tout le composant Feed depuis zéro — nouvelles requêtes
 * réseau (même si React Query sert depuis le cache, le DOM est reconstruit),
 * et surtout chaque <img> est détruite puis recréée : le navigateur doit
 * redécoder chaque image même si le fichier vient du cache HTTP. C'est ce
 * qui donne la sensation de "chargement" à chaque retour sur un écran déjà
 * visité.
 *
 * Avec ce composant : chaque onglet n'est monté qu'une seule fois, la
 * première fois qu'on le visite. Changer d'onglet ensuite ne fait que
 * basculer une classe CSS (hidden), le DOM et son état (scroll, images
 * déjà décodées, formulaires en cours) restent intacts.
 *
 * Usage : voir KeepAliveOutlet.jsx, qui déclare la liste des routes à garder
 * en vie et delegue le rendu ici.
 */
export default function KeepAliveTabs({ routes }) {
  const location = useLocation()
  // mountedPaths : ensemble des chemins déjà visités au moins une fois dans
  // cette session. On n'y ajoute jamais de suppression : un onglet visité
  // reste monté jusqu'à ce que l'app entière soit rechargée.
  const mountedPaths = useRef(new Set())

  const currentRoute = routes.find((r) => r.match(location.pathname))
  if (currentRoute) {
    mountedPaths.current.add(currentRoute.path)
  }

  return (
    <>
      {routes
        .filter((r) => mountedPaths.current.has(r.path))
        .map((r) => (
          <div key={r.path} style={{ display: r.path === currentRoute?.path ? 'block' : 'none' }}>
            {r.element}
          </div>
        ))}
    </>
  )
}
