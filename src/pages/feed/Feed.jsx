import { useCallback, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import NoteBar from './NoteBar'
import PostCard from './PostCard'
import Card from '../../components/ui/Card'
import { Sun, Moon, MessageCircle, Plus, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUnreadCounts } from '../../hooks/useUnreadCounts'
import { usePostUploadProgress } from '../../contexts/PostUploadContext'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import Logo from '../../components/ui/Logo'

const PAGE_SIZE = 10

// Récupère une page de posts, puis les compteurs (likes/commentaires) uniquement pour
// ces posts, en parallèle plutôt qu'en série. La pagination (10 posts par page au lieu
// de 30 d'un coup) réduit le poids de la première réponse réseau et le nombre de
// médias montés en même temps dans le DOM.
async function fetchFeedPage({ userId, pageParam = 0 }) {
  const from = pageParam * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, legende, crop_format, type, created_at, commande_id, filtre,
      post_medias(media_url, media_type, thumbnail_url, position),
      profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
      client:client_id(id, nom_complet, photo_url),
      commandes!posts_commande_id_fkey(lien_instagram, lien_tiktok)
    `)
    .in('type', ['photo', 'carrousel', 'video'])
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) console.error('Erreur chargement feed:', error)
  if (!data || data.length === 0) return { posts: [], nextPage: null }

  const postIds = data.map((p) => p.id)
  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
    supabase.from('post_comments').select('post_id').in('post_id', postIds),
  ])

  const posts = data.map((p) => ({
    ...p,
    like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
    liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === userId) || false,
    comment_count: comments?.filter((c) => c.post_id === p.id).length || 0,
  }))

  return { posts, nextPage: data.length === PAGE_SIZE ? pageParam + 1 : null }
}

export default function Feed() {
  const { user, profile, influencerProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { hasUnreadMessages } = useUnreadCounts()
  const uploadProgress = usePostUploadProgress(influencerProfile?.id)
  const queryClient = useQueryClient()
  // partagé entre toutes les vidéos du feed : activer le son sur l'une
  // l'active pour toutes, sans pour autant les jouer toutes en même temps
  // (seule la vidéo réellement visible à l'écran joue, voir PostCard)
  const [feedMuted, setFeedMuted] = useState(true)

  const {
    data,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', user?.id],
    queryFn: ({ pageParam }) => fetchFeedPage({ userId: user.id, pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!user,
  })

  const posts = data?.pages.flatMap((p) => p.posts) || []

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
      <header className="flex items-center justify-between px-4 pt-6 pb-2 sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        {profile?.role === 'influenceur' ? (
          <button
            onClick={() => navigate('/publier')}
            aria-label="Publier"
            className="relative w-9 h-9 flex items-center justify-center"
          >
            {uploadProgress !== null && (
              <svg className="absolute inset-0 w-9 h-9 -rotate-90" viewBox="0 0 36 36">
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
            <Plus size={24} />
            {uploadProgress !== null && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-semibold px-1 rounded-full whitespace-nowrap"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent)' }}
              >
                {uploadProgress}%
              </span>
            )}
          </button>
        ) : (
          <div className="w-9 h-9" />
        )}

        <Logo size={30} />

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/messages')}
            aria-label="Messages"
            className="relative glass rounded-2xl w-11 h-11 flex items-center justify-center"
          >
            <MessageCircle size={19} />
            {hasUnreadMessages && (
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full" style={{ backgroundColor: '#4f0c2d' }} />
            )}
          </button>
          <button
            onClick={toggleTheme}
            aria-label="Changer de thème"
            className="glass rounded-2xl w-11 h-11 flex items-center justify-center"
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
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

      <NoteBar />

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
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              onDeleted={handleDeleted}
              priority={i < 2}
              muted={feedMuted}
              onToggleMute={() => setFeedMuted((m) => !m)}
            />
          ))}
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
