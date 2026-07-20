import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { saveAccount } from '../../lib/accountSwitcher'
import { ArrowLeft } from 'lucide-react'
import appIcon from '../../assets/app-icon.png'

// Écran de connexion classique, accessible via "Utiliser un autre profil" depuis
// le sélecteur de profils. Reproduit la structure de l'écran de connexion Facebook
// (logo rond, champ unique email, mot de passe, bouton plein, lien mot de passe oublié,
// bouton créer un compte en contour) avec les couleurs et le logo Influo.
export default function SwitchAccount() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [pendingSession, setPendingSession] = useState(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await signIn({ email, password })
    setLoading(false)
    if (error) {
      setError('Email ou mot de passe incorrect.')
      return
    }
    if (data?.session?.refresh_token) {
      // On va chercher le vrai nom et la vraie photo dans public.users : sans ça,
      // le sélecteur de profils affiche l'email à la place de l'avatar habituel.
      const { data: userRow } = await supabase
        .from('users')
        .select('nom_complet, photo_url')
        .eq('id', data.user.id)
        .maybeSingle()

      setPendingSession({
        userId: data.user.id,
        email,
        nomComplet: userRow?.nom_complet || email,
        photoUrl: userRow?.photo_url || null,
        refreshToken: data.session.refresh_token,
      })
      setShowConsent(true)
      return
    }
    navigate('/')
  }

  const handleConsent = async (remember) => {
    if (remember && pendingSession) {
      await saveAccount({
        userId: pendingSession.userId,
        nomComplet: pendingSession.nomComplet,
        email: pendingSession.email,
        photoUrl: pendingSession.photoUrl,
        refreshToken: pendingSession.refreshToken,
      })
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-6 py-8 relative overflow-hidden bg-[var(--bg-primary)]">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 p-2 rounded-full hover:bg-white/5 transition-colors z-10"
        aria-label="Retour"
      >
        <ArrowLeft size={22} />
      </button>

      <div className="w-full max-w-sm relative z-10 animate-fade-in mt-20 flex flex-col items-center">
        <img src={appIcon} alt="Influo" className="w-20 h-20 rounded-2xl mb-16" />

        <form onSubmit={handleSubmit} className="w-full space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full h-14 px-4 rounded-xl bg-transparent border border-[var(--border)] text-body placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            className="w-full h-14 px-4 rounded-xl bg-transparent border border-[var(--border)] text-body placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />

          {error && <p className="text-body text-[var(--accent)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-full bg-[var(--accent)] text-white text-body-medium disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>

          <Link
            to="/mot-de-passe-oublie"
            className="block text-center text-body text-[var(--text-primary)] pt-1"
          >
            Mot de passe oublié ?
          </Link>
        </form>

        <div className="flex-1 min-h-[40px]" />

        <Link
          to="/inscription"
          className="w-full h-14 rounded-full border border-[var(--accent)] text-[var(--accent)] text-body-medium flex items-center justify-center active:scale-[0.98] transition-all mt-16"
        >
          Créer un nouveau compte
        </Link>

        <p
          className="text-center mt-10 text-[var(--accent)] text-2xl"
          style={{ fontFamily: 'var(--font-logo)' }}
        >
          Influo
        </p>
      </div>

      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/60">
          <div
            className="w-full max-w-sm rounded-2xl p-6 text-center border"
            style={{
              background: 'linear-gradient(135deg, rgba(79,12,45,0.55), rgba(79,12,45,0.25))',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderColor: 'rgba(255,255,255,0.18)',
            }}
          >
            <p className="text-body-medium mb-2 text-white">Enregistrer ce profil sur cet appareil ?</p>
            <p className="text-caption text-white/70 mb-6">
              Tu pourras te reconnecter en un tap la prochaine fois, sans ressaisir ton mot de passe.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConsent(false)}
                className="flex-1 h-12 rounded-full border border-white/25 text-white text-body-medium active:scale-[0.98] transition-all"
              >
                Non merci
              </button>
              <button
                onClick={() => handleConsent(true)}
                className="flex-1 h-12 rounded-full bg-white text-[var(--accent)] text-body-medium font-semibold active:scale-[0.98] transition-all"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}