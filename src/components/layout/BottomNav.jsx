import { NavLink } from 'react-router-dom'
import { Home, Search, Video, Heart, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUnreadCounts } from '../../hooks/useUnreadCounts'

export default function BottomNav() {
  const { profile } = useAuth()
  const { hasUnreadNotifications } = useUnreadCounts()
  const canPublish = profile?.role === 'influenceur'

  const items = [
    { to: '/', icon: Home, label: 'Accueil' },
    { to: '/recherche', icon: Search, label: 'Recherche' },
    ...(canPublish ? [{ to: '/video', icon: Video, label: 'Vidéo' }] : []),
    { to: '/notifications', icon: Heart, label: 'Notifications', dot: hasUnreadNotifications },
    { to: '/profil', icon: User, label: 'Profil' },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pb-safe border-t"
      style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--border)' }}
    >
      <div className="px-2 py-2">
        <div className="flex items-center justify-around">
          {items.map(({ to, icon: Icon, label, dot }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label}
              className={({ isActive }) =>
                `relative flex items-center justify-center w-11 h-11 rounded-2xl transition-opacity duration-200 ${
                  isActive ? 'opacity-100' : 'opacity-50'
                }`
              }
            >
              <Icon size={22} strokeWidth={2.2} />
              {dot && (
                <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-violet-500" />
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}