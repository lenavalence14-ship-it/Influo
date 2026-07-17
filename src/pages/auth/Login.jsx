import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import GlassCard from '../../components/ui/GlassCard'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Sun, Moon } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn({ email, password })
    setLoading(false)
    if (error) {
      setError("Email ou mot de passe incorrect.")
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 relative overflow-hidden bg-[var(--bg-base)]">
      {/* Fond dégradé subtil pour donner du relief au glass */}
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
        <div className="mb-10 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2">Influo</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            Connecte-toi pour continuer
          </p>
        </div>

        <GlassCard strong className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="••••••••"
              required
            />

            {error && (
              <p className="text-sm text-red-400 -mt-2">{error}</p>
            )}

            <div className="text-right -mt-2">
              <Link to="/mot-de-passe-oublie" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </GlassCard>

        <p className="text-center mt-6 text-sm text-[var(--text-secondary)]">
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="text-[var(--text-primary)] font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
