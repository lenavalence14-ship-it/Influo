import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import StoryBar from './StoryBar'
import PostCard from './PostCard'
import Card from '../../components/ui/Card'
import { Sun, Moon, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUnreadCounts } from '../../hooks/useUnreadCounts'

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { hasUnreadMessages } = useUnreadCounts()

  useEffect(() => {
    const loadFeed = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, legende, crop_format, type, created_at, commande_id,
          post_medias(media_url, position),
          profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
          client:client_id(nom_complet, photo_url),
          commandes!posts_commande_id_fkey(lien_instagram, lien_tiktok)
        `)
        .in('type', ['photo', 'carrousel'])
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) console.error('Erreur chargement feed:', error)

      if (!data) { setPosts([]); setLoading(false); return }

      // récupérer les likes/comments count + si l'utilisateur a liké
      const postIds = data.map((p) => p.id)
      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds)

      const { data: comments } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', postIds)

      const enriched = data.map((p) => ({
        ...p,
        like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
        liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === user.id) || false,
        comment_count: comments?.filter((c) => c.post_id === p.id).length || 0,
      }))

      setPosts(enriched)
      setLoading(false)
    }
    loadFeed()
  }, [user])

  return (
    <div>
      <header className="flex items-center justify-between px-4 pt-6 pb-2 sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <h1
  className="text-3xl"
  style={{ fontFamily: 'var(--font-logo)', color: '#a855f7' }}
>
  Influo
</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/messages')}
            aria-label="Messages"
            className="relative glass rounded-2xl w-11 h-11 flex items-center justify-center"
          >
            <MessageCircle size={19} />
            {hasUnreadMessages && (
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-violet-500" />
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

      <StoryBar />

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
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDeleted={(id) => setPosts((ps) => ps.filter((p) => p.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}