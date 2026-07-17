import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-lg mx-auto pb-28">
        <Outlet />
      </div>
      <div className="max-w-lg mx-auto">
        <BottomNav />
      </div>
    </div>
  )
}
