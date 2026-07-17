import { NavLink } from 'react-router-dom'
import { Home, Search, PlusSquare, Heart, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function BottomNav() {
  const { profile } = useAuth()
  const canPublish = profile?.role === 'influenceur'

  const items = [
    { to: '/', icon: Home, label: 'Accueil' },
    { to: '/recherche', icon: Search, label: 'Recherche' },
    ...(canPublish ? [{ to: '/publier', icon: PlusSquare, label: 'Publier' }] : []),
    { to: '/notifications', icon: Heart, label: 'Notifications' },
    { to: '/profil', icon: User, label: 'Profil' },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pb-safe border-t"
      style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--border)' }}
    >
      <div className="px-2 py-2">
        <div className="flex items-center justify-around">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label}
              className={({ isActive }) =>
                `flex items-center justify-center w-11 h-11 rounded-2xl transition-opacity duration-200 ${
                  isActive ? 'opacity-100' : 'opacity-50'
                }`
              }
            >
              <Icon size={22} strokeWidth={2.2} />
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}