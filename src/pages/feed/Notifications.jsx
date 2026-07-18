import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Heart, MessageCircle, ShoppingBag, Wallet, ArrowLeft } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { timeAgo, dateSection } from '../../lib/time'
import { useActiveStories } from '../../hooks/useActiveStories'

const TYPE_ICON = {
  like: Heart,
  comment: MessageCircle,
  commande: ShoppingBag,
  retrait: Wallet,
}

const TYPE_SUFFIX = {
  like: 'a aimé votre publication',
  comment: 'a commenté votre publication',
  commande: 'a passé une nouvelle commande',
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
        .select('*, from_user:from_user_id(nom_complet, photo_url, profils_influenceur(id, verifie))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const postIds = (data || [])
        .filter((n) => (n.type === 'like' || n.type === 'comment') && n.lien_ref_id)
        .map((n) => n.lien_ref_id)

      let mediaByPostId = {}
      if (postIds.length > 0) {
        const { data: medias } = await supabase
          .from('post_medias')
          .select('post_id, media_url, media_type, position')
          .in('post_id', postIds)
          .order('position', { ascending: true })
        mediaByPostId = (medias || []).reduce((acc, m) => {
          if (!acc[m.post_id]) acc[m.post_id] = { url: m.media_url, type: m.media_type }
          return acc
        }, {})
      }

      const enriched = (data || []).map((n) => ({
        ...n,
        post_thumbnail: (n.type === 'like' || n.type === 'comment') ? mediaByPostId[n.lien_ref_id] : null,
      }))

      setNotifications(enriched)
      setLoading(false)
    }
    if (user) load()
  }, [user])

  const handleClick = async (n) => {
    if (!n.lu) {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, lu: true } : item)))
      await supabase.from('notifications').update({ lu: true }).eq('id', n.id)
    }
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
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150"
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
                        {actor && TYPE_SUFFIX[n.type] ? (
                          <>
                            <span className="text-small-medium">{actor.nom_complet}</span>
                            {actor.profils_influenceur?.verifie && (
                              <span className="inline-block align-text-bottom mx-0.5">
                                <VerifiedBadge size={12} />
                              </span>
                            )}
                            {' '}{TYPE_SUFFIX[n.type]}
                          </>
                        ) : (
                          n.contenu
                        )}{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>{timeAgo(n.created_at)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!n.lu && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#a855f7' }} />}
                      {n.post_thumbnail?.url && (
                        n.post_thumbnail.type === 'video' ? (
                          <video
                            src={n.post_thumbnail.url}
                            className="w-11 h-11 rounded-md object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img src={n.post_thumbnail.url} alt="" className="w-11 h-11 rounded-md object-cover" />
                        )
                      )}
                    </div>
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