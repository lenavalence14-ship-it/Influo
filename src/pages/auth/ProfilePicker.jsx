import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, ChevronRight } from 'lucide-react'
import { getSavedAccounts, switchToAccount } from '../../lib/accountSwitcher'
import { useTheme } from '../../contexts/ThemeContext'
import Avatar from '../../components/ui/Avatar'
import Logo from '../../components/ui/Logo'
import { Sun, Moon } from 'lucide-react'

// Écran de sélection de profil, façon "changer de compte" Facebook : si des comptes
// ont déjà été utilisés sur cet appareil, ils apparaissent ici et un tap suffit à
// se reconnecter (restauration de session via refresh_token, pas de mot de passe).
// S'il n'y a aucun compte enregistré, on saute directement vers l'écran de connexion.
export default function ProfilePicker() {
  const [accounts, setAccounts] = useState(null) // null = en cours de chargement
  const [switchingId, setSwitchingId] = useState(null)
  const [error, setError] = useState('')
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    getSavedAccounts().then((list) => {
      if (list.length === 0) {
        navigate('/connexion', { replace: true })
      } else {
        setAccounts(list)
      }
    })
  }, [navigate])

  const handleSelect = async (userId) => {
    setError('')
    setSwitchingId(userId)
    const { error } = await switchToAccount(userId)
    setSwitchingId(null)
    if (error) {
      setError("Cette session a expiré, reconnecte-toi.")
      const list = await getSavedAccounts()
      setAccounts(list)
      return
    }
    navigate('/')
  }

  if (accounts === null) return null // évite un flash avant la redirection ou l'affichage

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-6 py-10 relative overflow-hidden bg-[var(--bg-primary)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-white/[0.04] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-white/[0.03] blur-3xl" />
      </div>

      <button
        onClick={toggleTheme}
        className="absolute top-6 right-16 glass rounded-full p-3 z-10"
        aria-label="Changer de thème"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <button
        onClick={() => navigate('/profils/gerer')}
        className="absolute top-6 right-6 glass rounded-full p-3 z-10"
        aria-label="Gérer les profils"
      >
        <MoreHorizontal size={18} />
      </button>

      <div className="w-full max-w-sm relative z-10 animate-fade-in mt-16">
        <div className="flex justify-center mb-8">
          <Logo size={56} />
        </div>

        {error && (
          <p className="text-center text-small text-[var(--accent)] mb-4">{error}</p>
        )}

        <div className="space-y-3 mb-8">
          {accounts.map((account) => (
            <button
              key={account.userId}
              onClick={() => handleSelect(account.userId)}
              disabled={switchingId !== null}
              className="w-full flex items-center gap-3 p-4 rounded-2xl glass hover:bg-white/5 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            >
              <Avatar src={account.photoUrl} seed={account.userId} size="lg" />
              <span className="flex-1 text-left text-body-medium truncate">
                {switchingId === account.userId ? 'Connexion…' : account.nomComplet}
              </span>
              <ChevronRight size={20} className="text-[var(--text-secondary)] shrink-0" />
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/connexion')}
            className="w-full h-12 rounded-full glass text-body-medium hover:bg-white/10 transition-all duration-200 active:scale-[0.98]"
          >
            Utiliser un autre profil
          </button>
          <button
            onClick={() => navigate('/inscription')}
            className="w-full h-12 rounded-full border border-[var(--accent)] text-[var(--accent)] text-body-medium hover:bg-[var(--accent)]/10 transition-all duration-200 active:scale-[0.98]"
          >
            Créer un compte
          </button>
        </div>

        <p className="text-center mt-10 text-[var(--text-secondary)] text-2xl font-[family-name:--font-logo]">
          Influo
        </p>
      </div>
    </div>
  )
}
