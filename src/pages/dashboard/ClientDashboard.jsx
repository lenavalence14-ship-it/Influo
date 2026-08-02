import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as dashboardApi from '../../api/dashboard'
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
      const result = await dashboardApi.fetchClientDashboard(user.id)
      setCommandes(result.commandes)
      setConversations(result.conversations)
      setPaiements(result.paiements)
    }
    if (user) load()
  }, [user])

  return (
    <div className="px-5 pt-6 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-caption mb-6">
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-h1 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass-strong rounded-2xl p-4">
          <p className="text-caption mb-1">Conversations</p>
          <p className="text-h1">{conversations}</p>
        </div>
        <div className="glass-strong rounded-2xl p-4">
          <p className="text-caption mb-1">Commandes</p>
          <p className="text-h1">{commandes.length}</p>
        </div>
        <div className="glass-strong rounded-2xl p-4">
          <p className="text-caption mb-1">Paiements</p>
          <p className="text-h1">{paiements.length}</p>
        </div>
        <div className="glass-strong rounded-2xl p-4">
          <p className="text-caption mb-1">Total dépensé</p>
          <p className="text-h1">
            {paiements.reduce((s, p) => s + Number(p.montant), 0).toFixed(2)} €
          </p>
        </div>
      </div>

      <h2 className="font-medium mb-3">Historique des prestations</h2>
      <div className="space-y-2">
        {commandes.length === 0 ? (
          <p className="text-caption">Aucune commande pour le moment.</p>
        ) : (
          commandes.map((c) => (
            <div key={c.id} className="glass rounded-2xl p-3 flex justify-between text-body">
              <span className="text-[var(--text-secondary)]">{c.status.replace(/_/g, ' ')}</span>
              <span className="font-medium">{c.montant} €</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
