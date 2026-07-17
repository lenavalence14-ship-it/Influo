import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import GlassCard from '../../components/ui/GlassCard'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, profile } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error, data } = await signIn({ email, password })
    setLoading(false)
    if (error) {
      setError('Identifiants incorrects.')
      return
    }
    navigate('/admin')
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 bg-[var(--bg-primary)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-display tracking-tight mb-2">Influo</h1>
          <p className="text-[var(--text-secondary)] text-body">Espace administrateur</p>
        </div>

        <GlassCard strong className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-body text-red-400">{error}</p>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </GlassCard>
      </div>
    </div>
  )
}
