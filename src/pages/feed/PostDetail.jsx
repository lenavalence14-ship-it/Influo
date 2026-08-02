import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import * as feedApi from '../../api/feed'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft } from 'lucide-react'
import PostCard from './PostCard'

export default function PostDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const openComments = searchParams.get('comments') === '1'
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { post: fetchedPost, notFound: isNotFound } = await feedApi.fetchSinglePost(id, user.id)
      if (isNotFound) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setPost(fetchedPost)
      setLoading(false)
    }
    if (user) load()
  }, [id, user])

  return (
    <div>
      <header className="flex items-center gap-3 px-4 pt-6 pb-3">
        <button onClick={() => navigate(-1)} aria-label="Retour" className="w-8 h-8 flex items-center justify-center -ml-1">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-h1">Publication</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : notFound ? (
        <div className="text-center mx-4 py-16">
          <p className="text-body text-[var(--text-secondary)]">
            Cette publication n'existe plus ou a été supprimée.
          </p>
        </div>
      ) : (
        <div className="px-0 pt-0">
          <PostCard post={post} onDeleted={() => navigate('/')} autoOpenComments={openComments} />
        </div>
      )}
    </div>
  )
}