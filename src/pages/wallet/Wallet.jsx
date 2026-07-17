import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Lock, Unlock, TrendingUp } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const PROVIDERS = [
  { value: 'mtn_momo', label: 'MTN Mobile Money' },
  { value: 'moov_money', label: 'Moov Money' },
]

export default function Wallet() {
  const { influencerProfile } = useAuth()
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [retraits, setRetraits] = useState([])
  const [moyens, setMoyens] = useState([])
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showAddMethod, setShowAddMethod] = useState(false)
  const [amount, setAmount] = useState('')
  const [provider, setProvider] = useState('mtn_momo')
  const [numero, setNumero] = useState('')
  const navigate = useNavigate()

  const loadAll = async () => {
    if (!influencerProfile) return
    const { data: w } = await supabase.from('wallets').select('*').eq('influenceur_id', influencerProfile.id).maybeSingle()
    setWallet(w)

    if (w) {
      const { data: tx } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', w.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setTransactions(tx || [])
    }

    const { data: r } = await supabase
      .from('retraits')
      .select('*')
      .eq('influenceur_id', influencerProfile.id)
      .order('created_at', { ascending: false })
    setRetraits(r || [])

    const { data: m } = await supabase.from('moyens_paiement').select('*').eq('influenceur_id', influencerProfile.id)
    setMoyens(m || [])
  }

  useEffect(() => { loadAll() }, [influencerProfile])

  const handleAddMethod = async () => {
    if (!numero) return
    await supabase.from('moyens_paiement').insert({ influenceur_id: influencerProfile.id, provider, numero })
    setShowAddMethod(false)
    setNumero('')
    loadAll()
  }

  const handleWithdraw = async () => {
    if (!amount || !moyens[0]) return
    const montant = parseFloat(amount)
    if (montant > wallet.solde_disponible) return

    await supabase.from('retraits').insert({
      influenceur_id: influencerProfile.id,
      moyen_paiement_id: moyens[0].id,
      montant,
      status: 'en_attente',
    })

    await supabase.from('wallets').update({
      solde_disponible: +(wallet.solde_disponible - montant).toFixed(2),
    }).eq('id', wallet.id)

    setShowWithdraw(false)
    setAmount('')
    loadAll()
  }

  if (!wallet) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-5 pt-6 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="font-display text-2xl font-bold mb-6">Portefeuille</h1>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass-strong rounded-3xl p-4">
          <Unlock size={18} className="mb-2 text-[var(--text-secondary)]" />
          <p className="text-xs text-[var(--text-secondary)] mb-1">Disponible</p>
          <p className="font-display text-xl font-bold">{wallet.solde_disponible} €</p>
        </div>
        <div className="glass-strong rounded-3xl p-4">
          <Lock size={18} className="mb-2 text-[var(--text-secondary)]" />
          <p className="text-xs text-[var(--text-secondary)] mb-1">Verrouillé</p>
          <p className="font-display text-xl font-bold">{wallet.solde_verrouille} €</p>
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-4 mb-6 flex items-center gap-3">
        <TrendingUp size={18} className="text-[var(--text-secondary)]" />
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Revenus totaux</p>
          <p className="font-display text-lg font-bold">{wallet.revenus_totaux} €</p>
        </div>
      </div>

      {moyens.length === 0 ? (
        <Button variant="glass" fullWidth onClick={() => setShowAddMethod(true)} className="mb-4">
          Connecter un moyen de paiement
        </Button>
      ) : (
        <Button fullWidth onClick={() => setShowWithdraw(true)} className="mb-4" disabled={wallet.solde_disponible <= 0}>
          Retirer mes fonds
        </Button>
      )}

      {showAddMethod && (
        <div className="glass-strong rounded-3xl p-4 mb-4 space-y-3">
          <label className="block">
            <span className="block text-sm mb-2 text-[var(--text-secondary)]">Opérateur</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-2xl px-4 py-3 glass outline-none"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value} className="bg-[var(--bg-elevated)]">{p.label}</option>
              ))}
            </select>
          </label>
          <Input label="Numéro" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="+229 XX XX XX XX" />
          <Button fullWidth onClick={handleAddMethod}>Connecter</Button>
        </div>
      )}

      {showWithdraw && (
        <div className="glass-strong rounded-3xl p-4 mb-4 space-y-3">
          <Input label={`Montant à retirer (max ${wallet.solde_disponible} €)`} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button fullWidth onClick={handleWithdraw}>Confirmer le retrait</Button>
        </div>
      )}

      <h2 className="font-medium mb-3 mt-6">Historique des paiements</h2>
      <div className="space-y-2 mb-6">
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucune transaction.</p>
        ) : (
          transactions.map((t) => (
            <div key={t.id} className="glass rounded-2xl p-3 flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{t.type}</span>
              <span className="font-medium">{t.montant} €</span>
            </div>
          ))
        )}
      </div>

      <h2 className="font-medium mb-3">Historique des retraits</h2>
      <div className="space-y-2">
        {retraits.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun retrait.</p>
        ) : (
          retraits.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-3 flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{r.status}</span>
              <span className="font-medium">{r.montant} €</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
