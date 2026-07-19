import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import Button from '../../components/ui/Button'
import { LogOut, Plus, X, Link2, Grid3x3, Video, ArrowLeft } from 'lucide-react'
import { InstagramIcon, TikTokIcon, FacebookIcon, YouTubeIcon, XIcon, SnapchatIcon } from '../../components/ui/SocialIcons'

const PLATFORM_ICONS = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
  youtube: YouTubeIcon,
  x: XIcon,
  snapchat: SnapchatIcon,
}
import PostCard from '../feed/PostCard'
import { useActiveStories } from '../../hooks/useActiveStories'

export default function InfluencerProfile() {
  const { id } = useParams() // id du profils_influenceur ; si absent, c'est "mon" profil
  const { user, profile, influencerProfile, signOut } = useAuth()
  const [target, setTarget] = useState(null)
  const [tab, setTab] = useState('publications')
  const [subTab, setSubTab] = useState('grille')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [offres, setOffres] = useState([])
  const [reseaux, setReseaux] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()

  const targetId = id || influencerProfile?.id
  const isMe = !id || id === influencerProfile?.id

  const reloadOffres = async () => {
    const offresQuery = supabase.from('offres').select('*').eq('influenceur_id', targetId).order('created_at', { ascending: false })
    const { data } = isMe ? await offresQuery : await offresQuery.eq('actif', true)
    setOffres(data || [])
  }

  const offresAffichees = isMe ? offres : offres.filter((o) => o.actif)

  useEffect(() => {
    if (!targetId) { setLoading(false); return }

    const load = async () => {
      const { data: prof } = await supabase
        .from('profils_influenceur')
        .select('*, users(nom_complet, photo_url, email)')
        .eq('id', targetId)
        .maybeSingle()
      setTarget(prof)

      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          id, legende, crop_format, created_at, type, filtre,
          post_medias(media_url, media_type, position),
          profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url))
        `)
        .eq('influenceur_id', targetId)
        .in('type', ['photo', 'carrousel', 'video'])
        .order('created_at', { ascending: false })

      const postIds = (postsData || []).map((p) => p.id)
      const { data: likes } = postIds.length
        ? await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
        : { data: [] }

      const enrichedPosts = (postsData || []).map((p) => ({
        ...p,
        like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
        liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === user?.id) || false,
      }))
      setPosts(enrichedPosts)

      const offresQuery = supabase.from('offres').select('*').eq('influenceur_id', targetId).order('created_at', { ascending: false })
      const { data: offresData } = isMe ? await offresQuery : await offresQuery.eq('actif', true)
      setOffres(offresData || [])

      const { data: reseauxData } = await supabase
        .from('reseaux_sociaux')
        .select('*')
        .eq('influenceur_id', targetId)
      setReseaux(reseauxData || [])

      setLoading(false)
    }
    load()
  }, [targetId])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (!target) {
    return (
      <div className="p-6 text-center text-[var(--text-secondary)]">
        Profil introuvable.
      </div>
    )
  }

  const totalAbonnes = reseaux.reduce((sum, r) => sum + (r.nombre_abonnes || 0), 0)

  return (
    <div>
      {/* barre du haut, façon Instagram : flèche retour, "Influo", icône de déconnexion */}
      {isMe && (
        <div className="flex items-center justify-between px-3 pt-4 pb-1">
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="w-9 h-9 flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <h1
            className="text-xl"
            style={{ fontFamily: 'var(--font-logo)', color: '#a855f7' }}
          >
            Influo
          </h1>
          <button
            onClick={async () => { await signOut(); navigate('/connexion') }}
            aria-label="Se déconnecter"
            className="w-9 h-9 flex items-center justify-center"
          >
            <LogOut size={20} className="text-red-400" />
          </button>
        </div>
      )}

      {/* header profil */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {activeStoryIds.has(target.id) ? (
              <div className="w-20 h-20 rounded-full p-[2.5px] bg-gradient-to-br from-purple-600 via-violet-500 to-fuchsia-400">
                <div className="w-full h-full rounded-full bg-[var(--bg-primary)] p-[2px]">
                  <img
                    src={target.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${target.id}`}