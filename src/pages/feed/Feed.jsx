import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import StoryBar from './StoryBar'
import PostCard from './PostCard'
import { Sun, Moon } from 'lucide-react'

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const loadFeed = async () => {
      const { data } = await supabase
        .from('posts')
        .select(`
          id, legende, crop_format, type, created_at,
          post_medias(media_url, position),
          profils_influenceur(id, verifie, users(nom_complet, photo_url))
        `)
        .in('type', ['photo', 'carrousel'])
        .order('created_at', { ascending: false })
        .limit(30)

      if (!data) { setPosts([]); setLoading(false); return }

      // récupérer les likes/comments count + si l'utilisateur a liké
      const postIds = data.map((p) => p.id)
      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds)

      const enriched = data.map((p) => ({
        ...p,
        like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
        liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === user.id) || false,
      }))

      setPosts(enriched)
      setLoading(false)
    }
    loadFeed()
  }, [user])

  return (
    <div>
      <header className="flex items-center justify-between px-5 pt-6 pb-2 sticky top-0 z-30 bg-[var(--bg-base)]/80 backdrop-blur-xl">
        <h1 className="font-display text-2xl font-bold">Influo</h1>
        <button onClick={toggleTheme} className="glass rounded-full p-2.5">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      <StoryBar />

      <div className="px-4 pt-2">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="glass rounded-3xl p-8 text-center mt-6">
            <p className="text-[var(--text-secondary)]">
              Aucune publication pour le moment. Suis des influenceurs pour remplir ton feed.
            </p>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  )
}
