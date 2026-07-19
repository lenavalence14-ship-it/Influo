import { Suspense, lazy } from 'react'
import { useAuth } from '../contexts/AuthContext'

// Chargé à la demande : un utilisateur "client" ne télécharge jamais le code de
// InfluencerProfile (et inversement), au lieu des deux variantes systématiquement.
const InfluencerProfile = lazy(() => import('../pages/profile/InfluencerProfile'))
const ClientProfile = lazy(() => import('../pages/profile/ClientProfile'))

function Fallback() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}

export default function MyProfileRouter() {
  const { profile } = useAuth()
  return (
    <Suspense fallback={<Fallback />}>
      {profile?.role === 'influenceur' ? <InfluencerProfile /> : <ClientProfile />}
    </Suspense>
  )
}
