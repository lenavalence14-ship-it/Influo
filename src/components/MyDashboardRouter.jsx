import { Suspense, lazy } from 'react'
import { useAuth } from '../contexts/AuthContext'

// Chargé à la demande, même logique que MyProfileRouter : évite de télécharger
// le code des deux variantes de dashboard (influenceur + client) systématiquement.
const InfluencerDashboard = lazy(() => import('../pages/dashboard/InfluencerDashboard'))
const ClientDashboard = lazy(() => import('../pages/dashboard/ClientDashboard'))

function Fallback() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}

export default function MyDashboardRouter() {
  const { profile } = useAuth()
  return (
    <Suspense fallback={<Fallback />}>
      {profile?.role === 'influenceur' ? <InfluencerDashboard /> : <ClientDashboard />}
    </Suspense>
  )
}
