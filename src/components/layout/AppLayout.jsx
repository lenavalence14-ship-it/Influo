import { lazy, useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import KeepAliveTabs from '../routing/KeepAliveTabs'
import { useAuth } from '../../contexts/AuthContext'

// Mêmes imports que App.jsx (lazy + code-splitting) : on reste dans le
// Suspense déjà posé par App.jsx autour de toutes les routes, donc pas besoin
// d'un Suspense supplémentaire ici.
const Feed = lazy(() => import('../../pages/feed/Feed'))
const Search = lazy(() => import('../../pages/feed/Search'))
const Notifications = lazy(() => import('../../pages/feed/Notifications'))
const ReelsViewer = lazy(() => import('../../pages/feed/ReelsViewer'))
const MyProfileRouter = lazy(() => import('../MyProfileRouter'))

const ROUTES_SANS_BOTTOM_NAV = ['/notifications']

// Les 5 écrans de la barre de navigation principale : gardés montés en
// permanence (voir KeepAliveTabs.jsx) pour éviter le remontage/redécodage
// d'images à chaque changement d'onglet.
//
// IMPORTANT : `match` doit rester strict (égalité exacte de pathname) et ne
// pas couvrir les routes paramétrées (ex: /profil/modifier, /video/:postId)
// — celles-là continuent de passer par <Outlet /> normal ci-dessous, pour ne
// pas les garder artificiellement en mémoire alors qu'elles ne sont pas des
// onglets de navigation principale.
function buildTabRoutes(canPublish) {
  const routes = [
    { path: '/', match: (p) => p === '/', element: <Feed /> },
    { path: '/recherche', match: (p) => p === '/recherche', element: <Search /> },
    { path: '/notifications', match: (p) => p === '/notifications', element: <Notifications /> },
    { path: '/profil', match: (p) => p === '/profil', element: <MyProfileRouter /> },
  ]
  if (canPublish) {
    routes.push({ path: '/video', match: (p) => p === '/video', element: <ReelsViewer /> })
  }
  return routes
}

export default function AppLayout() {
  const location = useLocation()
  const { profile } = useAuth()
  const hideBottomNav = ROUTES_SANS_BOTTOM_NAV.includes(location.pathname)
  const canPublish = profile?.role === 'influenceur'

  const tabRoutes = useMemo(() => buildTabRoutes(canPublish), [canPublish])
  const isTabRoute = tabRoutes.some((r) => r.match(location.pathname))

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className={`max-w-lg mx-auto ${hideBottomNav ? '' : 'pb-24'}`}>
        {/* Toujours monté, quelle que soit la route actuelle : c'est ce qui
            garantit que Feed/Recherche/etc. ne sont jamais démontés, même
            quand on navigue vers un écran hors barre de nav (ex: /post/123).
            Simplement masqué (display:none, voir KeepAliveTabs) tant qu'on
            n'est pas dessus. */}
        <div style={{ display: isTabRoute ? 'block' : 'none' }}>
          <KeepAliveTabs routes={tabRoutes} />
        </div>

        {/* Les écrans hors barre de nav (détail d'un post, édition de profil,
            offre, etc.) continuent de se démonter normalement : pas de raison
            de les garder en mémoire indéfiniment, ce ne sont pas des onglets
            qu'on visite en boucle. */}
        {!isTabRoute && <Outlet />}
      </div>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
