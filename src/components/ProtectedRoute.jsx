import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, roleRequired }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/connexion" replace />
  }

  if (roleRequired && profile?.role !== roleRequired) {
    return <Navigate to="/" replace />
  }

  return children
}
