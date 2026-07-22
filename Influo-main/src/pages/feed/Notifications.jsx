import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Heart, MessageCircle, ShoppingBag, Wallet, ArrowLeft, UserPlus } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { timeAgo, dateSection } from '../../lib/time'
import { useActiveStories } from '../../hooks/useActiveStories'
import { profileRoute } from '../../lib/profileRoute'

// Types de notifications qui pointent vers un post (pour aller chercher sa miniature)
const POST_TYPES = [
  'like', 'comment', 'comment_collab',
  'nouveau_post', 'nouveau_reel', 'nouvelle_collab', 'nouveau_reel_collab',
  'reply', 'reply_content', 'comment_like',
]

const TYPE_ICON = {
  like: Heart,
  comment: MessageCircle,
  comment_collab: MessageCircle,
  reply: MessageCircle,
  reply_content: MessageCircle,
  comment_like: Heart,
  commande: ShoppingBag,
  commande_pro: ShoppingBag,
  retrait: Wallet,
  retrait_pro: Wallet,
  follow: UserPlus,
}

// Libellé de secours si `contenu` (déjà formulé côté trigger SQL) est absent pour
// une raison quelconque — sert uniquement de filet de sécurité.
const TYPE_SUFFIX = {
  like: 'a aimé votre publication',
  comment: 'a commenté votre publication',
  comment_collab: 'a commenté votre contenu collaboratif',
  reply: 'a répondu à votre commentaire',
  reply_content: 'a répondu à un commentaire sur votre contenu',
  comment_like: 'a aimé votre commentaire',
  commande: 'a passé une nouvelle commande',
  commande_pro: 'a passé une nouvelle commande',
  follow: 'a commencé à vous suivre',
}

const TABS = [
  { key: 'tout', label: 'Tout' },
  { key: 'commentaires', label: 'Commentaires' },
]

const SECTION_ORDER = ["Aujourd'hui", 'Hier', '7 derniers jours', '30 derniers jours', 'Plus ancien']

async function fetchNotifications(userId) {
  const { data } = await supabase
    .from('notifications')
    .select('*, from_user:from_user_id(nom_complet, photo_url, role, profils_influenceur(id, verifie))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  const postIds = (data || [])
    .filter((n) => POST_TYPES.includes(n.type) && n.lien_ref_id)
    .map((n) => n.lien_ref_id)

  let mediaByPostId = {}
  if (postIds.length > 0) {
    const { data: medias } = await supabase
      .from('post_medias')
      .select('post_id, media_url, media_type, thumbnail_url, position')
      .in('post_id', postIds)
      .order('position', { ascending: true })
    mediaByPostId = (medias || []).reduce((acc, m) => {
      if (!acc[m.post_id]) acc[m.post_id] = { url: m.media_url, type: m.media_type, thumbnailUrl: m.thumbnail_url }
      return acc
    }, {})
  }

  return (data || []).map((n) => ({
    ...n,
    post_thumbnail: POST_TYPES.includes(n.type) ? mediaByPostId[n.lien_ref_id] : null,
  }))
}

async function fetchMyFollowing(userId) {
  const { data } = await supabase.from('follows').select('followed_id').eq('follower_id', userId)
  return new Set((data || []).map((r) => r.followed_id))
}

const COMMENT_TAB_TYPES = ['comment', 'comment_collab', 'reply', 'reply_content']

export default function Notifications() {
  const [tab, setTab] = useState('tout')
  const { user } = useAuth()
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading: loading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => fetchNotifications(user.id),
    enabled: !!user,
  })

  // Qui je suis déjà, pour savoir si le bouton "Suivre en retour" doit apparaître
  // sur une notification de type "follow" (façon Instagram).
  const { data: myFollowing = new Set() } = useQuery({
    queryKey: ['my-following', user?.id],
    queryFn: () => fetchMyFollowing(user.id),
    enabled: !!user,
  })

  const handleClick = async (n) => {
    if (!n.lu) {
      queryClient.setQueryData(['notifications', user?.id], (old) =>
        (old || []).map((item) => (item.id === n.id ? { ...item, lu: true } : item))
      )
      await supabase.from('notifications').update({ lu: true }).eq('id', n.id)
    }

    if (n.type === 'follow') {
      if (n.from_user_id) navigate(profileRoute(n.from_user_id, n.from_user?.role))
      return
    }

    if (!n.lien_ref_id) {
      if (n.type === 'commande' || n.type === 'commande_pro') navigate('/dashboard')
      else if (n.type === 'retrait' || n.type === 'retrait_pro') navigate('/wallet')
      return
    }

    if (COMMENT_TAB_TYPES.includes(n.type)) navigate(`/post/${n.lien_ref_id}?comments=1`)
    else if (POST_TYPES.includes(n.type)) navigate(`/post/${n.lien_ref_id}`)
    else if (n.type === 'commande' || n.type === 'commande_pro') navigate('/dashboard')
    else if (n.type === 'retrait' || n.type === 'retrait_pro') navigate('/wallet')
  }

  const handleFollowBack = async (n, e) => {
    e.stopPropagation()
    if (!user?.id || !n.from_user_id) return
    queryClient.setQueryData(['my-following', user?.id], (old) => {
      const next = new Set(old)
      next.add(n.from_user_id)
      return next
    })
    await supabase.from('follows').insert({ follower_id: user.id, followed_id: n.from_user_id })
  }

  const filtered = notifications.filter((n) => {
    if (tab === 'commentaires') return COMMENT_TAB_TYPES.includes(n.type)
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
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(n)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleClick(n) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 cursor-pointer"
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
                        <Icon size={22} className={n.type === 'like' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-small leading-snug">
                        {actor && (n.type === 'like' || n.type === 'comment') ? (
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
                      {n.type === 'follow' && n.from_user_id && !myFollowing.has(n.from_user_id) && (
                        <Button
                          variant="primary"
                          shape="rect"
                          className="mt-2"
                          onClick={(e) => handleFollowBack(n, e)}
                        >
                          Suivre en retour
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!n.lu && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#4f0c2d' }} />}
                      {n.post_thumbnail?.url && (
                        n.post_thumbnail.type === 'video' ? (
                          n.post_thumbnail.thumbnailUrl ? (
                            <img
                              src={n.post_thumbnail.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="w-11 h-11 rounded-md object-cover"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-md bg-black/20" />
                          )
                        ) : (
                          <img
                            src={n.post_thumbnail.url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-11 h-11 rounded-md object-cover"
                          />
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
