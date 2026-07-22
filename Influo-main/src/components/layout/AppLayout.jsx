import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

const ROUTES_SANS_BOTTOM_NAV = ['/notifications']

export default function AppLayout() {
  const location = useLocation()
  const hideBottomNav = ROUTES_SANS_BOTTOM_NAV.includes(location.pathname)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className={`max-w-lg mx-auto ${hideBottomNav ? '' : 'pb-24'}`}>
        <Outlet />
      </div>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}