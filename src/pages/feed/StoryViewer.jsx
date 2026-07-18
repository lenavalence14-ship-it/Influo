import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Pencil } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

const STORY_DURATION_MS = 5000

// groups: array of { influenceurId, nom, photoUrl, verifie, stories: [{id, media_url, texte_overlay, texte_x, texte_y, texte_couleur, texte_police, texte_taille}] }
export default function StoryViewer({ groups, startGroupIndex, myInfluencerId, onClose }) {
  const navigate = useNavigate()
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [localGroups, setLocalGroups] = useState(groups)
  const timerRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const elapsedRef = useRef(0)

  const group = localGroups[groupIndex]
  const story = group?.stories?.[storyIndex]
  const isOwner = group?.influenceurId === myInfluencerId

  // resynchronise avec les données fraîches si elles changent (ex: retour après modification d'une story)
  useEffect(() => {
    setLocalGroups(groups)
  }, [groups])

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

  useEffect(() => {
    if (paused) return
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
  }, [groupIndex, storyIndex, paused])

  if (!story) return null

  const handleTap = (e) => {
    const x = e.clientX
    const width = window.innerWidth
    if (x < width * 0.35) goPrev()
    else goNext()
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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* fond flouté plein écran (uniquement si le média n'est pas déjà vertical plein écran) */}
      {story.crop_format && story.crop_format !== 'vertical' && (
        <div
          className="absolute inset-0 scale-150 blur-3xl brightness-[0.35]"
          style={{ backgroundImage: `url(${story.media_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}

      {/* progress bars */}
      <div className="relative flex gap-1 px-3 pt-3 shrink-0">
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

      {/* header */}
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
          </span>
        </Link>
        <div className="flex items-center">
          {isOwner && (
            <>
              <button
                onClick={() => navigate(`/publier/${story.id}/modifier`)}
                aria-label="Modifier"
                className="text-white w-11 h-11 flex items-center justify-center"
              >
                <Pencil size={19} />
              </button>
              <button
                onClick={handleDelete}
                aria-label="Supprimer"
                className="text-white w-11 h-11 flex items-center justify-center"
              >
                <Trash2 size={20} />
              </button>
            </>
          )}
          <button onClick={onClose} aria-label="Fermer" className="text-white w-11 h-11 flex items-center justify-center">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* media */}
      <div className="relative flex-1 overflow-hidden" onClick={handleTap}>
        <img
          src={story.media_url}
          alt=""
          className={`relative w-full h-full select-none ${
            !story.crop_format || story.crop_format === 'vertical' ? 'object-cover' : 'object-contain'
          }`}
          draggable={false}
        />
        {story.texte_overlay && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center font-semibold px-4 max-w-[90%] whitespace-pre-wrap"
            style={{
              left: `${story.texte_x ?? 50}%`,
              top: `${story.texte_y ?? 50}%`,
              color: story.texte_couleur || '#ffffff',
              fontFamily: story.texte_police || 'DM Sans',
              fontSize: `${story.texte_taille || 28}px`,
              textShadow: '0 1px 6px rgba(0,0,0,0.5)',
            }}
          >
            {story.texte_overlay}
          </div>
        )}
      </div>
    </div>
  )
}