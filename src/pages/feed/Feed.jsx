import { useCallback, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import * as feedApi from '../../api/feed'
import { useAuth } from '../../contexts/AuthContext'
import PostCard from './PostCard'
import MediaKitSuggestion from './MediaKitSuggestion'
import { useMediaKits } from '../../hooks/useMediaKits'
import OfferCard from './OfferCard'
import Card from '../../components/ui/Card'
import { MessageCircle, Plus, RefreshCw, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUnreadCounts } from '../../hooks/useUnreadCounts'
import { usePostUploadProgress } from '../../contexts/PostUploadContext'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import Logo from '../../components/ui/Logo'

const PAGE_SIZE = 10

export default function Feed() {
  const { user, profile, influencerProfile } = useAuth()
  const navigate = useNavigate()
  const { hasUnreadMessages } = useUnreadCounts()
  const uploadProgress = usePostUploadProgress(influencerProfile?.id)
  const queryClient = useQueryClient()
  // partagé entre toutes les vidéos du feed : activer le son sur l'une
  // l'active pour toutes, sans pour autant les jouer toutes en même temps
  // (seule la vidéo réellement visible à l'écran joue, voir PostCard)
  const [feedMuted, setFeedMuted] = useState(true)
  const toggleFeedMuted = useCallback(() => setFeedMuted((m) => !m), [])

  const {
    data,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', user?.id],
    queryFn: ({ pageParam }) => feedApi.fetchFeedPage({ userId: user.id, pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!user,
  })

  const posts = data?.pages.flatMap((p) => p.posts) || []

  // Media kits "suggestion" : un en haut de feed, d'autres intercalés en
  // scrollant à intervalles aléatoires (façon Instagram), sans jamais
  // répéter deux fois le même media kit dans un même rendu du feed.
  const { data: mediaKits = [] } = useMediaKits()

  // Tirage mémoïsé : ne se refait PAS à chaque re-render ni à chaque nouvelle
  // page de posts chargée (posts.length grandit à chaque scroll) -- sinon tout
  // le tirage (position des media kits ET, en cascade via un remount, leur
  // template) repart de zéro à chaque scroll, donnant une impression de
  // "clignotement" au lieu d'un feed stable comme Instagram. On dépend
  // seulement de la LISTE de media kits disponibles (via une clé stable faite
  // de leurs ids triés, pas juste sa longueur) : le tirage n'est refait que si
  // l'ensemble réel de media kits change, jamais pour une simple page de plus.
  const mediaKitsKey = useMemo(
    () => [...mediaKits].map((mk) => mk.id).sort().join(','),
    [mediaKits]
  )

  // On garde le résultat déjà calculé pour les posts déjà vus, et on
  // n'étend le calcul QUE sur les posts nouvellement chargés -- jamais de
  // retirage sur une position déjà décidée précédemment.
  const feedItemsCache = useRef({ mediaKitsKey: null, top: null, items: [], postsProcessed: 0, poolIndex: 0, nextInsertAt: null, pool: [] })

  const feedItemsWithMediaKits = useMemo(() => {
    const cache = feedItemsCache.current

    // Nouvel ensemble de media kits (changement réel, pas juste un scroll) :
    // on retire tout depuis le début, une seule fois.
    if (cache.mediaKitsKey !== mediaKitsKey) {
      const shuffled = [...mediaKits].sort(() => Math.random() - 0.5)
      cache.mediaKitsKey = mediaKitsKey
      cache.top = mediaKits.length > 0 ? shuffled[0] : null
      cache.pool = mediaKits.length > 0 ? shuffled.slice(1) : []
      cache.items = []
      cache.postsProcessed = 0
      cache.poolIndex = 0
      cache.nextInsertAt = cache.pool.length > 0 ? Math.floor(Math.random() * 7) + 6 : Infinity
    }

    // On ajoute uniquement les posts pas encore traités (nouvelle page de
    // scroll) à la suite des items déjà stables, sans toucher à ce qui a
    // déjà été décidé pour les posts précédents.
    for (let i = cache.postsProcessed; i < posts.length; i++) {
      cache.items.push({ type: 'post', post: posts[i] })
      if (cache.pool.length > 0 && i + 1 === cache.nextInsertAt) {
        const mk = cache.pool[cache.poolIndex % cache.pool.length]
        cache.items.push({ type: 'media-kit', mediaKit: mk, key: `mk-${i}` })
        cache.poolIndex += 1
        cache.nextInsertAt = i + 1 + Math.floor(Math.random() * 7) + 6
      }
    }
    cache.postsProcessed = posts.length

    return { top: cache.top, items: cache.items }
  }, [mediaKitsKey, posts, mediaKits])

  // followingIds : un seul fetch pour tout le feed (voir fetchFollowingIds
  // plus haut). staleTime généreux : le feed se recharge de toute façon à
  // chaque follow/unfollow via l'invalidation ci-dessous, pas besoin de
  // reinterroger la base à chaque scroll.
  const { data: followingIds = new Set() } = useQuery({
    queryKey: ['following-ids', user?.id],
    queryFn: () => feedApi.fetchFollowingIds(user.id),
    enabled: !!user,
    staleTime: 60_000,
  })

  // Bascule optimiste locale (S1/S2) : on met à jour le cache React Query
  // directement, sans refetch réseau -- chaque PostCard n'a plus besoin
  // d'appeler useFollow individuellement, il suffit de lui passer isFollowing
  // (dérivé de followingIds) et ce callback pour agir au clic.
  const toggleFollowUser = useCallback(async (targetUserId) => {
    if (!user?.id || !targetUserId) return
    const isFollowing = followingIds.has(targetUserId)
    queryClient.setQueryData(['following-ids', user.id], (old) => {
      const next = new Set(old || [])
      if (isFollowing) next.delete(targetUserId)
      else next.add(targetUserId)
      return next
    })
    if (isFollowing) {
      await feedApi.unfollowUser(user.id, targetUserId)
    } else {
      await feedApi.followUser(user.id, targetUserId)
    }
  }, [user?.id, followingIds, queryClient])

  const { pullDistance, refreshing, threshold } = usePullToRefresh(refetch)

  const handleDeleted = useCallback((id) => {
    queryClient.setQueryData(['feed', user?.id], (old) => {
      if (!old) return old
      return { ...old, pages: old.pages.map((p) => ({ ...p, posts: p.posts.filter((post) => post.id !== id) })) }
    })
  }, [queryClient, user?.id])

  // sentinelle IntersectionObserver : déclenche le chargement de la page suivante
  // uniquement quand l'utilisateur approche du bas du feed (lazy loading des publications).
  const sentinelRef = useRef(null)
  const observerRef = useCallback((node) => {
    if (sentinelRef.current) sentinelRef.current.disconnect()
    if (!node) return
    sentinelRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '800px' } // anticipe le chargement avant que l'utilisateur n'atteigne réellement le bas
    )
    sentinelRef.current.observe(node)
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div>
      <header className="flex items-center justify-between px-4 pt-6 pb-2 sticky top-0 z-30 bg-[var(--bg-primary)]">
        <Logo size={20} />

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate('/amis')}
            aria-label="Amis"
            className="glass rounded-xl w-7 h-7 flex items-center justify-center"
          >
            <Users size={14} />
          </button>

          {profile?.role === 'influenceur' ? (
            <button
              onClick={() => navigate('/publier')}
              aria-label="Publier"
              className="relative glass rounded-xl w-7 h-7 flex items-center justify-center"
            >
              {uploadProgress !== null && (
                <svg className="absolute inset-0 w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="2" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 15.5}
                    strokeDashoffset={2 * Math.PI * 15.5 * (1 - uploadProgress / 100)}
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                  />
                </svg>
              )}
              <Plus size={14} />
              {uploadProgress !== null && (
                <span
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-semibold px-1 rounded-full whitespace-nowrap"
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent)' }}
                >
                  {uploadProgress}%
                </span>
              )}
            </button>
          ) : profile?.role === 'client' ? (
            <button
              onClick={() => navigate('/publier-offre')}
              aria-label="Publier un appel d'offre"
              className="glass rounded-xl w-7 h-7 flex items-center justify-center"
            >
              <Plus size={14} />
            </button>
          ) : null}

          <button
            onClick={() => navigate('/messages')}
            aria-label="Messages"
            className="relative glass rounded-xl w-7 h-7 flex items-center justify-center"
          >
            <MessageCircle size={14} />
            {hasUnreadMessages && (
              <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#4f0c2d' }} />
            )}
          </button>
        </div>
      </header>

      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex justify-center items-center overflow-hidden transition-[height]"
          style={{ height: refreshing ? 44 : pullDistance }}
        >
          <RefreshCw
            size={20}
            className={refreshing ? 'animate-spin' : 'text-[var(--text-secondary)]'}
            style={refreshing ? { color: '#4f0c2d' } : undefined}
            style={
              refreshing
                ? undefined
                : {
                    transform: `rotate(${(pullDistance / threshold) * 360}deg)`,
                    opacity: Math.min(1, pullDistance / threshold),
                  }
            }
          />
        </div>
      )}

      <MediaKitSuggestion mediaKit={feedItemsWithMediaKits.top} />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="px-4 pt-2">
          <Card variant="subtle" padding="lg" className="text-center mt-6">
            <p className="text-body text-[var(--text-secondary)]">
              Aucune publication pour le moment. Suis des influenceurs pour remplir ton feed.
            </p>
          </Card>
        </div>
      ) : (
        <div className="pt-0">
          {feedItemsWithMediaKits.items.map((item, i) => {
            if (item.type === 'media-kit') {
              return <MediaKitSuggestion key={item.key} mediaKit={item.mediaKit} label="Suggestion pour toi" />
            }
            const post = item.post
            return post.item_type === 'offre' ? (
              <OfferCard key={post.id} offer={post} onDeleted={handleDeleted} />
            ) : (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={handleDeleted}
                priority={i < 2}
                muted={feedMuted}
                onToggleMute={toggleFeedMuted}
                isFollowingAuthor={followingIds}
                onToggleFollowAuthor={toggleFollowUser}
              />
            )
          })}
          {hasNextPage && (
            <div ref={observerRef} className="flex justify-center py-6">
              {isFetchingNextPage && (
                <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
