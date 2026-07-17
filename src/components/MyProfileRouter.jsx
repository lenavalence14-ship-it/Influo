import { useAuth } from '../contexts/AuthContext'
import InfluencerProfile from '../pages/profile/InfluencerProfile'
import ClientProfile from '../pages/profile/ClientProfile'

export default function MyProfileRouter() {
  const { profile } = useAuth()
  if (profile?.role === 'influenceur') return <InfluencerProfile />
  return <ClientProfile />
}
