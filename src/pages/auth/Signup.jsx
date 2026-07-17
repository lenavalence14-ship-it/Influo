import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import GlassCard from '../../components/ui/GlassCard'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Sun, Moon, User, Briefcase } from 'lucide-react'

export default function Signup() {
  const [role, setRole] = useState(null) // 'influenceur' | 'client'
  const [nomComplet, setNomComplet] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!role) {
      setError('Choisis un type de compte pour continuer.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    setLoading(true)
    const { error } = await signUp({ email, password, nomComplet, role })
    setLoading(false)
    if (error) {
      setError(error.message === 'User already registered'
        ? 'Un compte existe déjà avec cet email.'
        : "Une erreur est survenue. Réessaie.")
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 relative overflow-hidden bg-[var(--bg-base)] py-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-white/[0.04] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-white/[0.03] blur-3xl" />
      </div>

      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 glass rounded-full p-3 z-10"
        aria-label="Changer de thème"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2">Influo</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            Crée ton compte
          </p>
        </div>

        {!role ? (
          <div className="space-y-3">
            <GlassCard
              strong
              className="p-5 cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => setRole('influenceur')}
            >
              <div className="flex items-center gap-4">
                <div className="glass rounded-2xl p-3">
                  <User size={22} />
                </div>
                <div>
                  <p className="font-semibold">Je suis influenceur</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Publie, propose des offres, sois payé
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard
              strong
              className="p-5 cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => setRole('client')}
            >
              <div className="flex items-center gap-4">
                <div className="glass rounded-2xl p-3">
                  <Briefcase size={22} />
                </div>
                <div>
                  <p className="font-semibold">Je suis une entreprise</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Trouve des influenceurs, collabore
                  </p>
                </div>
              </div>
            </GlassCard>

            <p className="text-center mt-6 text-sm text-[var(--text-secondary)]">
              Déjà un compte ?{' '}
              <Link to="/connexion" className="text-[var(--text-primary)] font-medium">
                Se connecter
              </Link>
            </p>
          </div>
        ) : (
          <GlassCard strong className="p-6">
            <button
              onClick={() => setRole(null)}
              className="text-sm text-[var(--text-secondary)] mb-4"
            >
              ← Changer de type de compte
            </button>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={role === 'influenceur' ? 'Nom / nom de marque' : "Nom de l'entreprise"}
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                placeholder="Ton nom"
                required
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                required
              />
              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                required
              />

              {error && <p className="text-sm text-red-400 -mt-2">{error}</p>}

              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Création...' : 'Créer mon compte'}
              </Button>
            </form>
          </GlassCard>
        )}
      </div>
    </div>
  )
}
