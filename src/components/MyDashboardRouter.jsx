import { useAuth } from '../contexts/AuthContext'
import InfluencerDashboard from '../pages/dashboard/InfluencerDashboard'
import ClientDashboard from '../pages/dashboard/ClientDashboard'

export default function MyDashboardRouter() {
  const { profile } = useAuth()
  if (profile?.role === 'influenceur') return <InfluencerDashboard />
  return <ClientDashboard />
}
