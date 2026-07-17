import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import Button from '../../components/ui/Button'
import { Sun, Moon, LogOut } from 'lucide-react'

export default function ClientProfile() {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/connexion')
  }

  return (
    <div className="px-5 pt-6 pb-6">
      <div className="flex justify-end mb-4">
        <button onClick={toggleTheme} className="glass rounded-full p-3">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      <div className="flex flex-col items-center text-center mb-8">
        <img
          src={profile?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${profile?.id}`}
          alt=""
          className="w-24 h-24 rounded-full object-cover mb-4"
        />
        <h1 className="text-h1">{profile?.nom_complet}</h1>
        <p className="text-caption">{profile?.email}</p>
      </div>

      <div className="space-y-3">
        <Button variant="glass" fullWidth onClick={() => navigate('/dashboard')}>
          Mon dashboard
        </Button>
        <Button variant="ghost" fullWidth onClick={handleLogout} className="text-red-400">
          <span className="flex items-center justify-center gap-2">
            <LogOut size={16} /> Se déconnecter
          </span>
        </Button>
      </div>
    </div>
  )
}
