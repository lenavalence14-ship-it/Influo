import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, roleRequired }) {
  const { user, profile, loading, profileLoading } = useAuth()

  // `loading` ne couvre plus que la session (lecture locale quasi
  // instantanée) : ce spinner ne s'affiche donc plus le temps que le profil
  // arrive du réseau, seulement le temps très court de lire la session.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/profils" replace />
  }

  // roleRequired dépend du profil métier (pas encore forcément arrivé) :
  // seuls CES écrans-là attendent profileLoading. Tous les autres écrans
  // protégés s'affichent immédiatement après la session, profil ou pas.
  if (roleRequired) {
    if (profileLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )
    }
    if (profile?.role !== roleRequired) {
      return <Navigate to="/" replace />
    }
  }

  return children
}
