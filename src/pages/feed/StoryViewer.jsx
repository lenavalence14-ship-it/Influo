import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Pencil, Send, Heart, MessageCircle, Share, Volume2, VolumeX } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import CommentsSheet from './CommentsSheet'
import { timeAgo } from '../../lib/time'
import { getFilterCss } from './editor/FilterPicker'

const STORY_DURATION_MS = 5000

// groups: array of { influenceurId, nom, photoUrl, verifie, stories: [{id, media_url, media_type, texte_overlay, texte_x, texte_y, texte_couleur, texte_police, texte_taille}] }
export default function StoryViewer({ groups, startGroupIndex, myInfluencerId, onClose }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [localGroups, setLocalGroups] = useState(groups)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [liked, setLiked] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [muted, setMuted] = useState(true)
  const timerRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const elapsedRef = useRef(0)
  const videoRef = useRef(null)

  const group = localGroups[groupIndex]
  const story = group?.stories?.[storyIndex]
  const isOwner = group?.influenceurId === myInfluencerId
  const isVideo = story?.media_type === 'video'

  // resynchronise avec les données fraîches si elles changent (ex: retour après modification d'une story)
  useEffect(() => {
    setLocalGroups(groups)
  }, [groups])

  // vérifie si la story actuelle est déjà likée par l'utilisateur, et charge le nb de commentaires
  useEffect(() => {
    if (!story || !user) return
    let cancelled = false
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('post_id', story.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLiked(!!data)
      })
    supabase
      .from('post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', story.id)
      .then(({ count }) => {
        if (!cancelled) setCommentCount(count || 0)
      })
    return () => { cancelled = true }
  }, [story?.id, user])

  const goNext = () => {
    if (!group) return onClose()
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1)
    } else if (groupIndex < localGroups.length - 1) {
      setGroupIndex((g) => g + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      const prevGroup = localGroups[groupIndex - 1]
      setGroupIndex((g) => g - 1)
      setStoryIndex(prevGroup.stories.length - 1)
    }
  }

  // pour les images : progression pilotée par un timer fixe de 5s
  useEffect(() => {
    if (paused || isVideo) return
    setProgress(0)
    startRef.current = performance.now()

    const tick = (now) => {
      const elapsed = now - startRef.current
      const pct = Math.min(elapsed / STORY_DURATION_MS, 1)
      setProgress(pct)
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    timerRef.current = setTimeout(goNext, STORY_DURATION_MS)

    return () => {
      clearTimeout(timerRef.current)
      cancelAnimationFrame(rafRef.current)
    }
  }, [groupIndex, storyIndex, paused, isVideo])

  // pour les vidéos : progression pilotée par la lecture réelle (currentTime / duration)
  useEffect(() => {
    if (!isVideo) return
    setProgress(0)
    const video = videoRef.current
    if (!video) return

    if (paused) {
      video.pause()
      cancelAnimationFrame(rafRef.current)
      return
    }

    video.muted = muted
    video.play().catch(() => {})

    const tick = () => {
      if (video.duration) {
        setProgress(Math.min(video.currentTime / video.duration, 1))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [groupIndex, storyIndex, paused, isVideo, muted])

  if (!story) return null

  const handleTap = (e) => {
    const x = e.clientX
    const width = window.innerWidth
    if (x < width * 0.35) goPrev()
    else goNext()
  }

  const handleToggleLike = async () => {
    if (!user) return
    if (liked) {
      setLiked(false)
      await supabase.from('post_likes').delete().match({ post_id: story.id, user_id: user.id })
    } else {
      setLiked(true)
      await supabase.from('post_likes').insert({ post_id: story.id, user_id: user.id })
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/influenceur/${group.influenceurId}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `Story de ${group.nom}`, url })
      } catch {
        // partage annulé par l'utilisateur, on ignore
      }
    } else {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) return
    setSending(true)
    const contenu = messageText

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', user.id)
      .eq('influenceur_id', group.influenceurId)
      .is('offre_id', null)
      .maybeSingle()

    let conversationId = existing?.id

    if (!conversationId) {
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({ client_id: user.id, influenceur_id: group.influenceurId, offre_id: null })
        .select('id')
        .single()

      if (error) {
        setSending(false)
        return
      }
      conversationId = conv.id
    }

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      contenu,
    })
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

    setMessageText('')
    setSending(false)
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  const handleDelete = async () => {
    setPaused(true)
    if (!window.confirm('Supprimer définitivement cette story ?')) {
      setPaused(false)
      return
    }
    await supabase.from('posts').delete().eq('id', story.id)

    const updatedStories = group.stories.filter((s) => s.id !== story.id)
    if (updatedStories.length === 0) {
      // plus de story pour cet influenceur, on retire le groupe entier
      const newGroups = localGroups.filter((_, i) => i !== groupIndex)
      if (newGroups.length === 0) {
        onClose()
        return
      }
      setLocalGroups(newGroups)
      setGroupIndex((i) => Math.min(i, newGroups.length - 1))
      setStoryIndex(0)
    } else {
      const newGroups = localGroups.map((g, i) =>
        i === groupIndex ? { ...g, stories: updatedStories } : g
      )
      setLocalGroups(newGroups)
      setStoryIndex((i) => Math.min(i, updatedStories.length - 1))
    }
    setPaused(false)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-hidden">
      {/* fond flouté plein écran (uniquement si le média n'est pas déjà vertical plein écran) */}
      {story.crop_format && story.crop_format !== 'vertical' && story.crop_format !== 'vertical_45' && (
        <div
          className="absolute inset-0 scale-150 blur-3xl brightness-[0.35]"
          style={{ backgroundImage: `url(${story.media_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}

      {/* media : remplit littéralement tout l'écran, y compris derrière le header */}
      {isVideo ? (
        <video
          key={story.id}
          ref={videoRef}
          src={story.media_url}
          className={`absolute inset-0 w-full h-full select-none ${
            !story.crop_format || story.crop_format === 'vertical' || story.crop_format === 'vertical_45' ? 'object-cover' : 'object-contain'
          }`}
          style={{ filter: getFilterCss(story.filtre) }}
          playsInline
          autoPlay
          muted={muted}
          onEnded={goNext}
        />
      ) : (
        <img
          src={story.media_url}
          alt=""
          className={`absolute inset-0 w-full h-full select-none ${
            !story.crop_format || story.crop_format === 'vertical' || story.crop_format === 'vertical_45' ? 'object-cover' : 'object-contain'
          }`}
          draggable={false}
          style={{ filter: getFilterCss(story.filtre) }}
        />
      )}

      {story.dessin_url && (
        <img src={story.dessin_url} alt="" className="absolute inset-0 w-full h-full pointer-events-none" />
      )}

      {Array.isArray(story.elements) && story.elements.length > 0 ? (
        story.elements.map((el) => (
          <div
            key={el.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${el.x}%`, top: `${el.y}%` }}
          >
            {el.type === 'texte' && (
              <p
                className="text-center font-semibold px-4 max-w-[85vw] whitespace-pre-wrap"
                style={{ color: el.couleur || '#ffffff', fontSize: '26px', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}
              >
                {el.contenu}
              </p>
            )}
            {el.type === 'sticker' && <span className="text-5xl">{el.contenu}</span>}
            {el.type === 'mention' && (
              <span className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-full text-body-medium text-white">
                @{el.contenu}
              </span>
            )}
          </div>
        ))
      ) : story.texte_overlay ? (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 text-center font-semibold px-4 max-w-[90%] whitespace-pre-wrap"
          style={{
            left: `${story.texte_x ?? 50}%`,
            top: `${story.texte_y ?? 50}%`,
            color: story.texte_couleur || '#ffffff',
            fontSize: `${story.texte_taille || 28}px`,
            textShadow: '0 1px 6px rgba(0,0,0,0.5)',
          }}
        >
          {story.texte_overlay}
        </div>
      ) : null}

      {/* zone de tap plein écran pour naviguer (sous l'UI flottante, au-dessus du média) */}
      <div className="absolute inset-0" onClick={handleTap} />

      {/* dégradé pour garder l'UI lisible par-dessus n'importe quelle image */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* progress bars (flotte par-dessus) */}
      <div className="relative flex gap-1 px-3 pt-3 shrink-0 pointer-events-none">
        {group.stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-[2.5px] rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white"
              style={{
                width: i < storyIndex ? '100%' : i === storyIndex ? `${progress * 100}%` : '0%',
                transition: i === storyIndex ? 'none' : undefined,
              }}
            />
          </div>
        ))}
      </div>

      {/* header (flotte par-dessus) */}
      <div className="relative flex items-center justify-between px-4 py-3 shrink-0">
        <Link
          to={`/influenceur/${group.influenceurId}`}
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={group.photoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${group.influenceurId}`}
            alt=""
            className="w-9 h-9 rounded-full object-cover"
          />
          <span className="text-white text-body-medium flex items-center gap-1.5">
            {group.nom}
            {group.verifie && <VerifiedBadge size={14} />}
            {story.created_at && (
              <span className="text-white/60 text-small font-normal">· {timeAgo(story.created_at)}</span>
            )}
          </span>
        </Link>
        <div className="flex items-center">
          {isVideo && (
            <button
              onClick={(e) => { e.stopPropagation(); setMuted((m) => !m) }}
              aria-label={muted ? 'Activer le son' : 'Couper le son'}
              className="text-white w-11 h-11 flex items-center justify-center"
            >
              {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
          )}
          {isOwner && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/publier/${story.id}/modifier`) }}
                aria-label="Modifier"
                className="text-white w-11 h-11 flex items-center justify-center"
              >
                <Pencil size={19} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete() }}
                aria-label="Supprimer"
                className="text-white w-11 h-11 flex items-center justify-center"
              >
                <Trash2 size={20} />
              </button>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            aria-label="Fermer"
            className="text-white w-11 h-11 flex items-center justify-center"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* barre de contact + actions en bas, uniquement si ce n'est pas ma propre story */}
      {!isOwner && (
        <div
          className="absolute bottom-0 left-0 right-0 px-3 flex items-center gap-2"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))', paddingTop: '12px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 flex items-center h-11 rounded-full border border-white/40 px-4">
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              placeholder="Entrer en contact..."
              className="flex-1 bg-transparent outline-none text-white text-body placeholder:text-white/60"
            />
          </div>

          {messageText.trim() ? (
            <button
              onClick={handleSendMessage}
              disabled={sending}
              aria-label="Envoyer"
              className="w-11 h-11 flex items-center justify-center text-white disabled:opacity-40 active:scale-90 transition-transform duration-200 shrink-0"
            >
              <Send size={22} />
            </button>
          ) : (
            <>
              <button
                onClick={handleToggleLike}
                aria-label="J'aime"
                className="w-11 h-11 flex items-center justify-center active:scale-90 transition-transform duration-200 shrink-0"
              >
                <Heart size={24} className={liked ? 'fill-red-500 text-red-500' : 'text-white'} strokeWidth={2} />
              </button>
              <button
                onClick={() => { setPaused(true); setShowComments(true) }}
                aria-label="Commenter"
                className="w-11 h-11 flex items-center justify-center active:scale-90 transition-transform duration-200 shrink-0"
              >
                <MessageCircle size={24} className="text-white" strokeWidth={2} />
              </button>
              <button
                onClick={handleShare}
                aria-label="Partager"
                className="w-11 h-11 flex items-center justify-center active:scale-90 transition-transform duration-200 shrink-0"
              >
                <Share size={22} className="text-white" strokeWidth={2} />
              </button>
            </>
          )}

          {sent && (
            <span className="absolute -top-8 left-4 text-white text-caption bg-black/60 rounded-full px-3 py-1">
              Message envoyé
            </span>
          )}
          {linkCopied && (
            <span className="absolute -top-8 left-4 text-white text-caption bg-black/60 rounded-full px-3 py-1">
              Lien copié
            </span>
          )}
        </div>
      )}

      {showComments && (
        <div onClick={(e) => e.stopPropagation()}>
          <CommentsSheet
            postId={story.id}
            onClose={() => { setShowComments(false); setPaused(false) }}
            onCommentAdded={() => setCommentCount((c) => c + 1)}
          />
        </div>
      )}
    </div>
  )
}