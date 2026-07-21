import { Suspense, lazy } from 'react'
import { useAuth } from '../contexts/AuthContext'

// Chargé à la demande : chaque type de compte ne télécharge que le code de son
// propre profil, jamais celui des deux autres variantes.
const InfluencerProfile = lazy(() => import('../pages/profile/InfluencerProfile'))
const ClientProfile = lazy(() => import('../pages/profile/ClientProfile'))
const SimpleUserProfile = lazy(() => import('../pages/profile/SimpleUserProfile'))

function Fallback() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}

export default function MyProfileRouter() {
  const { profile } = useAuth()

  let ProfileComponent = SimpleUserProfile
  if (profile?.role === 'influenceur') ProfileComponent = InfluencerProfile
  else if (profile?.role === 'client') ProfileComponent = ClientProfile

  return (
    <Suspense fallback={<Fallback />}>
      <ProfileComponent />
    </Suspense>
  )
}
