import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Users, TrendingUp, DollarSign, Percent, BadgeCheck, ChevronRight } from 'lucide-react'

const TABS = ['Statistiques', 'Utilisateurs', 'Offres', 'Paiements', 'Retraits', 'Templates']

// Les 30 slugs de bibliothèques de templates, extraits tels quels des
// routes déjà utilisées par le parcours utilisateur (BonneFete.jsx,
// DefiSouvenirs.jsx, MagazineEditorialPersonne.jsx, MagazineEditorialPourQui.jsx,
// SouvenirEditorialPersonne.jsx, SouvenirEditorialPourQui.jsx, MemoryStudio.jsx).
// Aucun slug inventé ici : ce sont exactement ceux vers lesquels un
// utilisateur simple peut naviguer.
const TEMPLATE_CATEGORIES = [
  { slug: 'bonne-fete-nouvelle-annee', label: 'Bonne fête · Nouvelle année' },
  { slug: 'bonne-fete-noel', label: 'Bonne fête · Noël' },
  { slug: 'bonne-fete-saint-valentin', label: 'Bonne fête · St Valentin' },
  { slug: 'bonne-fete-ramadan', label: 'Bonne fête · Ramadan' },
  { slug: 'bonne-fete-paques', label: 'Bonne fête · Pâques' },
  { slug: 'bonne-fete-peres', label: 'Bonne fête · Fête des pères' },
  { slug: 'bonne-fete-meres', label: 'Bonne fête · Fête des mères' },
  { slug: 'defi-un-mois', label: 'Défi souvenirs · Un mois' },
  { slug: 'defi-un-an', label: 'Défi souvenirs · Un an' },
  { slug: 'magazine-editorial-moi', label: 'Magazine éditorial · Moi' },
  { slug: 'magazine-editorial-ami', label: 'Magazine éditorial · Un ami' },
  { slug: 'magazine-editorial-meilleur-ami', label: 'Magazine éditorial · Meilleur ami' },
  { slug: 'magazine-editorial-mentor', label: 'Magazine éditorial · Un mentor' },
  { slug: 'magazine-editorial-famille', label: 'Magazine éditorial · Famille' },
  { slug: 'magazine-editorial-collegue', label: 'Magazine éditorial · Collègue' },
  { slug: 'magazine-editorial-inspire', label: 'Magazine éditorial · Personne qui inspire' },
  { slug: 'magazine-editorial-petit-ami', label: 'Magazine éditorial · Petit ami' },
  { slug: 'magazine-editorial-petite-amie', label: 'Magazine éditorial · Petite amie' },
  { slug: 'magazine-editorial-groupe', label: 'Magazine éditorial · Groupe' },
  { slug: 'souvenir-editorial-moi', label: 'Souvenir éditorial · Moi' },
  { slug: 'souvenir-editorial-ami', label: 'Souvenir éditorial · Un ami' },
  { slug: 'souvenir-editorial-meilleur-ami', label: 'Souvenir éditorial · Meilleur ami' },
  { slug: 'souvenir-editorial-mentor', label: 'Souvenir éditorial · Un mentor' },
  { slug: 'souvenir-editorial-famille', label: 'Souvenir éditorial · Famille' },
  { slug: 'souvenir-editorial-collegue', label: 'Souvenir éditorial · Collègue' },
  { slug: 'souvenir-editorial-inspire', label: 'Souvenir éditorial · Personne qui inspire' },
  { slug: 'souvenir-editorial-petit-ami', label: 'Souvenir éditorial · Petit ami' },
  { slug: 'souvenir-editorial-petite-amie', label: 'Souvenir éditorial · Petite amie' },
  { slug: 'souvenir-editorial-groupe', label: 'Souvenir éditorial · Groupe' },
  { slug: 'anniversaire', label: 'Anniversaire' },
  { slug: 'feliciter', label: 'Féliciter' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-5 pt-8 pb-10">
      <h1 className="text-h1 mb-1">Administration</h1>
      <p className="text-caption mb-6">CEO Influo App</p>

      <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-2 text-body-medium transition-colors ${
              tab === t ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'glass'
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
            <div key={u.id} className="glass rounded-2xl p-3 flex justify-between items-center text-body">
              <div>
                <p className="font-medium">{u.nom_complet}</p>
                <p className="text-[var(--text-secondary)] text-caption">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="glass rounded-full px-3 py-1 text-caption">{u.role}</span>
                {u.role === 'influenceur' && u.profils_influenceur?.id && (
                  <button
                    onClick={() => toggleVerifie(u)}
                    className={`rounded-full p-2 transition-colors ${
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
            <div key={o.id} className="glass rounded-2xl p-3 text-body">
              <p className="font-medium">{o.titre}</p>
              <p className="text-[var(--text-secondary)] text-caption">
                {o.profils_influenceur?.users?.nom_complet} · {o.prix} € · {o.actif ? 'active' : 'inactive'}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'Paiements' && (
        <div className="space-y-2">
          {paiements.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-3 flex justify-between text-body">
              <span className="text-[var(--text-secondary)]">{p.reference?.slice(0, 8)}</span>
              <span className="font-medium">{p.montant} € (comm. {p.commission} €)</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'Retraits' && (
        <div className="space-y-2">
          {retraits.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-3 text-body">
              <div className="flex justify-between items-center mb-2">
                <span>{r.profils_influenceur?.users?.nom_complet}</span>
                <span className="font-medium">{r.montant} €</span>
              </div>
              <div className="flex gap-2">
                <select
                  value={r.status}
                  onChange={(e) => handleRetraitStatus(r.id, e.target.value)}
                  className="glass rounded-full px-3 py-1 text-caption outline-none"
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

      {tab === 'Templates' && (
        <div className="space-y-2">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => navigate(`/souvenirs/templates/${cat.slug}`)}
              className="w-full glass rounded-2xl p-3 flex justify-between items-center text-body"
            >
              <span>{cat.label}</span>
              <ChevronRight size={16} className="text-[var(--text-secondary)]" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`glass-strong rounded-2xl p-4 ${className}`}>
      <Icon size={18} className="mb-2 text-[var(--text-secondary)]" />
      <p className="text-caption mb-1">{label}</p>
      <p className="text-h1">{value}</p>
    </div>
  )
}
