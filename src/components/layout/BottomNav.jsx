import { NavLink } from 'react-router-dom'
import { Home, Search, SquarePlay, Heart } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUnreadCounts } from '../../hooks/useUnreadCounts'

export default function BottomNav() {
  const { profile } = useAuth()
  const { hasUnreadNotifications } = useUnreadCounts()
  const canPublish = profile?.role === 'influenceur'

  const items = [
    { to: '/', icon: Home, label: 'Accueil' },
    { to: '/recherche', icon: Search, label: 'Recherche' },
    ...(canPublish ? [{ to: '/video', icon: SquarePlay, label: 'Vidéo' }] : []),
    { to: '/notifications', icon: Heart, label: 'Notifications', dot: hasUnreadNotifications },
    { to: '/profil', label: 'Profil', isAvatar: true },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pb-safe border-t"
      style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--border)' }}
    >
      <div className="px-2 py-0.5">
        <div className="flex items-center justify-around">
          {items.map(({ to, icon: Icon, label, dot, isAvatar }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label}
              className={({ isActive }) =>
                `relative flex items-center justify-center w-11 h-10 rounded-2xl transition-opacity duration-200 ${
                  isActive ? 'opacity-100' : 'opacity-50'
                }`
              }
            >
              {({ isActive }) =>
                isAvatar ? (
                  <span className={`flex items-center justify-center rounded-full ${isActive ? 'ring-2 ring-violet-500 p-0.5' : ''}`}>
                    <img
                      src={profile?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${profile?.id}`}
                      alt=""
                      className="w-[22px] h-[22px] rounded-full object-cover"
                    />
                  </span>
                ) : (
                  <>
                    <Icon size={24} strokeWidth={2.6} fill={isActive ? 'currentColor' : 'none'} />
                    {dot && (
                      <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-violet-500" />
                    )}
                  </>
                )
              }
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}