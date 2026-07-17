import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Wallet as WalletIcon } from 'lucide-react'

export default function InfluencerDashboard() {
  const { influencerProfile } = useAuth()
  const [stats, setStats] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      if (!influencerProfile) return

      const { data: wallet } = await supabase.from('wallets').select('*').eq('influenceur_id', influencerProfile.id).maybeSingle()
      const { count: nbCommandes } = await supabase.from('commandes').select('*', { count: 'exact', head: true }).eq('influenceur_id', influencerProfile.id)
      const { count: nbConversations } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('influenceur_id', influencerProfile.id)
      const { count: nbOffres } = await supabase.from('offres').select('*', { count: 'exact', head: true }).eq('influenceur_id', influencerProfile.id)

      setStats({
        revenusTotaux: wallet?.revenus_totaux || 0,
        revenusDisponibles: wallet?.solde_disponible || 0,
        revenusVerrouilles: wallet?.solde_verrouille || 0,
        nbCommandes: nbCommandes || 0,
        nbConversations: nbConversations || 0,
        nbOffres: nbOffres || 0,
      })
    }
    load()
  }, [influencerProfile])

  if (!stats) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  const cards = [
    { label: 'Revenus totaux', value: `${stats.revenusTotaux} €` },
    { label: 'Disponibles', value: `${stats.revenusDisponibles} €` },
    { label: 'Verrouillés', value: `${stats.revenusVerrouilles} €` },
    { label: 'Commandes', value: stats.nbCommandes },
    { label: 'Conversations', value: stats.nbConversations },
    { label: 'Offres actives', value: stats.nbOffres },
  ]

  return (
    <div className="px-5 pt-6 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="font-display text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-strong rounded-3xl p-4">
            <p className="text-xs text-[var(--text-secondary)] mb-1">{c.label}</p>
            <p className="font-display text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/wallet')}
        className="glass-strong rounded-3xl p-4 flex items-center gap-3 w-full mt-2"
      >
        <WalletIcon size={20} />
        <span className="font-medium text-sm">Voir mon portefeuille</span>
      </button>
    </div>
  )
}
