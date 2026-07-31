import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import GlassCard from '../../components/ui/GlassCard'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
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
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 relative overflow-hidden bg-[var(--bg-primary)]">
      {/* Fond dégradé subtil pour donner du relief au glass */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-white/[0.04] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-white/[0.03] blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        <div className="mb-10 text-center">
          <h1 className="text-display tracking-tight mb-2">Influo</h1>
          <p className="text-[var(--text-secondary)] text-body">
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
              <p className="text-body text-red-400 -mt-2">{error}</p>
            )}

            <div className="text-right -mt-2">
              <Link to="/mot-de-passe-oublie" className="text-caption hover:text-[var(--text-primary)] transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </GlassCard>

        <p className="text-center mt-6 text-caption">
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="text-[var(--text-primary)] font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
