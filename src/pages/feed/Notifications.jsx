import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Heart, MessageCircle, ShoppingBag, Wallet, ArrowLeft } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { timeAgo, dateSection } from '../../lib/time'
import { useActiveStories } from '../../hooks/useActiveStories'

const TYPE_ICON = {
  like: Heart,
  comment: MessageCircle,
  commande: ShoppingBag,
  retrait: Wallet,
}

const TABS = [
  { key: 'tout', label: 'Tout' },
  { key: 'commentaires', label: 'Commentaires' },
]

const SECTION_ORDER = ["Aujourd'hui", 'Hier', '7 derniers jours', '30 derniers jours', 'Plus ancien']

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tout')
  const { user } = useAuth()
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*, from_user:from_user_id(nom_complet, photo_url, profils_influenceur(id))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setNotifications(data || [])
      setLoading(false)

      await supabase.from('notifications').update({ lu: true }).eq('user_id', user.id).eq('lu', false)
    }
    if (user) load()
  }, [user])

  const handleClick = (n) => {
    if (!n.lien_ref_id) return
    if (n.type === 'like' || n.type === 'comment') navigate('/')
    else if (n.type === 'commande') navigate('/dashboard')
    else if (n.type === 'retrait') navigate('/wallet')
  }

  const filtered = notifications.filter((n) => {
    if (tab === 'commentaires') return n.type === 'comment'
    return true
  })

  const grouped = SECTION_ORDER.map((section) => ({
    section,
    items: filtered.filter((n) => dateSection(n.created_at) === section),
  })).filter((g) => g.items.length > 0)

  return (
    <div>
      <header className="flex items-center gap-3 px-4 pt-6 pb-3">
        <button onClick={() => navigate(-1)} aria-label="Retour" className="w-8 h-8 flex items-center justify-center -ml-1">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-h1">Notifications</h1>
      </header>

      <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-full text-small-medium shrink-0 border transition-colors"
            style={
              tab === t.key
                ? { backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)', borderColor: 'var(--text-primary)' }
                : { backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center mx-4 py-16">
          <p className="text-body text-[var(--text-secondary)]">Rien de nouveau pour le moment.</p>
        </div>
      ) : (
        <div>
          {grouped.map(({ section, items }) => (
            <div key={section}>
              <h2 className="text-body-medium px-4 pt-3 pb-2">{section}</h2>
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type] || Heart
                const actor = n.from_user
                const actorInfluencerId = actor?.profils_influenceur?.id
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 ${
                      !n.lu ? '' : ''
                    }`}
                    style={{ backgroundColor: !n.lu ? 'var(--surface-secondary)' : 'transparent' }}
                  >
                    {actor ? (
                      <Avatar
                        src={actor.photo_url}
                        seed={n.from_user_id}
                        size="lg"
                        ring={actorInfluencerId ? activeStoryIds.has(actorInfluencerId) : false}
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--surface-secondary)' }}
                      >
                        <Icon size={22} className={n.type === 'like' ? 'text-red-500' : 'text-[var(--text-secondary)]'} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-small leading-snug">
                        {n.contenu} <span style={{ color: 'var(--text-secondary)' }}>{timeAgo(n.created_at)}</span>
                      </p>
                    </div>
                    {!n.lu && <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shrink-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}