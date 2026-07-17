import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft } from 'lucide-react'

export default function ClientDashboard() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [commandes, setCommandes] = useState([])
  const [paiements, setPaiements] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { count: nbConv } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', user.id)
      const { data: cmds } = await supabase.from('commandes').select('*').eq('client_id', user.id).order('created_at', { ascending: false })
      setCommandes(cmds || [])
      setConversations(nbConv || 0)

      if (cmds?.length) {
        const { data: pmts } = await supabase.from('paiements').select('*').in('commande_id', cmds.map((c) => c.id))
        setPaiements(pmts || [])
      }
    }
    if (user) load()
  }, [user])

  return (
    <div className="px-5 pt-6 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="font-display text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass-strong rounded-3xl p-4">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Conversations</p>
          <p className="font-display text-xl font-bold">{conversations}</p>
        </div>
        <div className="glass-strong rounded-3xl p-4">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Commandes</p>
          <p className="font-display text-xl font-bold">{commandes.length}</p>
        </div>
        <div className="glass-strong rounded-3xl p-4">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Paiements</p>
          <p className="font-display text-xl font-bold">{paiements.length}</p>
        </div>
        <div className="glass-strong rounded-3xl p-4">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Total dépensé</p>
          <p className="font-display text-xl font-bold">
            {paiements.reduce((s, p) => s + Number(p.montant), 0).toFixed(2)} €
          </p>
        </div>
      </div>

      <h2 className="font-medium mb-3">Historique des prestations</h2>
      <div className="space-y-2">
        {commandes.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucune commande pour le moment.</p>
        ) : (
          commandes.map((c) => (
            <div key={c.id} className="glass rounded-2xl p-3 flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{c.status.replace(/_/g, ' ')}</span>
              <span className="font-medium">{c.montant} €</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
