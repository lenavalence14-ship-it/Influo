import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, TrendingUp, DollarSign, Percent, BadgeCheck } from 'lucide-react'

const TABS = ['Statistiques', 'Utilisateurs', 'Offres', 'Paiements', 'Retraits']

export default function AdminDashboard() {
  const [tab, setTab] = useState('Statistiques')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [offres, setOffres] = useState([])
  const [paiements, setPaiements] = useState([])
  const [retraits, setRetraits] = useState([])

  useEffect(() => {
    const loadStats = async () => {
      const { count: nbUsers } = await supabase.from('users').select('*', { count: 'exact', head: true })
      const { count: nbInfluenceurs } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'influenceur')
      const { count: nbClients } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client')
      const { data: paiementsData } = await supabase.from('paiements').select('montant, commission')
      const { data: retraitsData } = await supabase.from('retraits').select('montant').eq('status', 'traite')

      const chiffreAffaires = paiementsData?.reduce((s, p) => s + Number(p.montant), 0) || 0
      const commissions = paiementsData?.reduce((s, p) => s + Number(p.commission), 0) || 0
      const totalRetraits = retraitsData?.reduce((s, r) => s + Number(r.montant), 0) || 0

      setStats({
        nbUsers: nbUsers || 0,
        nbInfluenceurs: nbInfluenceurs || 0,
        nbClients: nbClients || 0,
        nbPaiements: paiementsData?.length || 0,
        chiffreAffaires,
        commissions,
        totalRetraits,
      })
    }
    loadStats()
  }, [])

  useEffect(() => {
    const loadTabData = async () => {
      if (tab === 'Utilisateurs') {
        const { data } = await supabase
          .from('users')
          .select('*, profils_influenceur(id, verifie)')
          .order('created_at', { ascending: false })
        setUsers(data || [])
      } else if (tab === 'Offres') {
        const { data } = await supabase.from('offres').select('*, profils_influenceur(users(nom_complet))').order('created_at', { ascending: false })
        setOffres(data || [])
      } else if (tab === 'Paiements') {
        const { data } = await supabase.from('paiements').select('*').order('created_at', { ascending: false })
        setPaiements(data || [])
      } else if (tab === 'Retraits') {
        const { data } = await supabase.from('retraits').select('*, profils_influenceur(users(nom_complet))').order('created_at', { ascending: false })
        setRetraits(data || [])
      }
    }
    loadTabData()
  }, [tab])

  const handleRetraitStatus = async (retraitId, status) => {
    await supabase.from('retraits').update({ status }).eq('id', retraitId)
    setRetraits((rs) => rs.map((r) => (r.id === retraitId ? { ...r, status } : r)))
  }

  const toggleVerifie = async (u) => {
    const profilId = u.profils_influenceur?.id
    if (!profilId) return
    const nextValue = !u.profils_influenceur?.verifie
    await supabase.from('profils_influenceur').update({ verifie: nextValue }).eq('id', profilId)
    setUsers((us) =>
      us.map((x) =>
        x.id === u.id ? { ...x, profils_influenceur: { ...x.profils_influenceur, verifie: nextValue } } : x
      )
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] px-5 pt-8 pb-10">
      <h1 className="font-display text-2xl font-bold mb-1">Administration</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">CEO Influo App</p>

      <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'glass'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Statistiques' && stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Users} label="Utilisateurs" value={stats.nbUsers} />
          <StatCard icon={Users} label="Influenceurs" value={stats.nbInfluenceurs} />
          <StatCard icon={Users} label="Clients" value={stats.nbClients} />
          <StatCard icon={TrendingUp} label="Paiements" value={stats.nbPaiements} />
          <StatCard icon={DollarSign} label="Chiffre d'affaires" value={`${stats.chiffreAffaires.toFixed(2)} €`} />
          <StatCard icon={Percent} label="Commissions (10%)" value={`${stats.commissions.toFixed(2)} €`} />
          <StatCard icon={DollarSign} label="Retraits effectués" value={`${stats.totalRetraits.toFixed(2)} €`} className="col-span-2" />
        </div>
      )}

      {tab === 'Utilisateurs' && (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="glass rounded-2xl p-3 flex justify-between items-center text-sm">
              <div>
                <p className="font-medium">{u.nom_complet}</p>
                <p className="text-[var(--text-secondary)] text-xs">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="glass rounded-full px-2.5 py-1 text-xs">{u.role}</span>
                {u.role === 'influenceur' && u.profils_influenceur?.id && (
                  <button
                    onClick={() => toggleVerifie(u)}
                    className={`rounded-full p-1.5 transition-colors ${
                      u.profils_influenceur?.verifie ? 'bg-blue-500 text-white' : 'glass text-[var(--text-secondary)]'
                    }`}
                    title={u.profils_influenceur?.verifie ? 'Retirer la vérification' : 'Vérifier ce profil'}
                  >
                    <BadgeCheck size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Offres' && (
        <div className="space-y-2">
          {offres.map((o) => (
            <div key={o.id} className="glass rounded-2xl p-3 text-sm">
              <p className="font-medium">{o.titre}</p>
              <p className="text-[var(--text-secondary)] text-xs">
                {o.profils_influenceur?.users?.nom_complet} · {o.prix} € · {o.actif ? 'active' : 'inactive'}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'Paiements' && (
        <div className="space-y-2">
          {paiements.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-3 flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{p.reference?.slice(0, 8)}</span>
              <span className="font-medium">{p.montant} € (comm. {p.commission} €)</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'Retraits' && (
        <div className="space-y-2">
          {retraits.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-3 text-sm">
              <div className="flex justify-between items-center mb-2">
                <span>{r.profils_influenceur?.users?.nom_complet}</span>
                <span className="font-medium">{r.montant} €</span>
              </div>
              <div className="flex gap-2">
                <select
                  value={r.status}
                  onChange={(e) => handleRetraitStatus(r.id, e.target.value)}
                  className="glass rounded-full px-3 py-1 text-xs outline-none"
                >
                  <option value="en_attente" className="bg-[var(--bg-elevated)]">en attente</option>
                  <option value="traite" className="bg-[var(--bg-elevated)]">traité</option>
                  <option value="echoue" className="bg-[var(--bg-elevated)]">échoué</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`glass-strong rounded-3xl p-4 ${className}`}>
      <Icon size={18} className="mb-2 text-[var(--text-secondary)]" />
      <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  )
}
