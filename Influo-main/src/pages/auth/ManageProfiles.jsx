import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getSavedAccounts, removeAccount } from '../../lib/accountSwitcher'
import Avatar from '../../components/ui/Avatar'

// Écran "Supprimer les profils de cet appareil" : retire uniquement le raccourci
// local (le refresh_token stocké), ne supprime ni ne déconnecte le compte lui-même.
export default function ManageProfiles() {
  const [accounts, setAccounts] = useState([])
  const navigate = useNavigate()

  const load = () => getSavedAccounts().then(setAccounts)

  useEffect(() => {
    load()
  }, [])

  const handleRemove = async (userId) => {
    await removeAccount(userId)
    load()
  }

  return (
    <div className="min-h-screen w-full bg-[var(--bg-primary)] px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors"
        aria-label="Retour"
      >
        <ArrowLeft size={22} />
      </button>

      <h1 className="text-title mb-6">Supprimer les profils de cet appareil</h1>

      <div className="rounded-2xl glass-strong overflow-hidden">
        {accounts.length === 0 && (
          <p className="p-6 text-center text-[var(--text-secondary)] text-body">
            Aucun profil enregistré sur cet appareil.
          </p>
        )}
        {accounts.map((account, i) => (
          <div
            key={account.userId}
            className={`flex items-center gap-3 p-4 ${i !== accounts.length - 1 ? 'border-b border-white/5' : ''}`}
          >
            <Avatar src={account.photoUrl} seed={account.userId} size="md" />
            <span className="flex-1 text-left text-body-medium truncate">{account.nomComplet}</span>
            <button
              onClick={() => handleRemove(account.userId)}
              className="h-9 px-4 rounded-full glass text-small-medium hover:bg-white/10 transition-all active:scale-[0.97]"
            >
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
