import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const STORY_DURATION_MS = 5000

// groups: array of { influenceurId, nom, photoUrl, stories: [{id, media_url, texte_overlay, texte_x, texte_y, texte_couleur, texte_police, texte_taille}] }
export default function StoryViewer({ groups, startGroupIndex, onClose }) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(null)

  const group = groups[groupIndex]
  const story = group?.stories?.[storyIndex]

  const goNext = () => {
    if (!group) return onClose()
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
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
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex((g) => g - 1)
      setStoryIndex(prevGroup.stories.length - 1)
    }
  }

  useEffect(() => {
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
  }, [groupIndex, storyIndex])

  if (!story) return null

  const handleTap = (e) => {
    const x = e.clientX
    const width = window.innerWidth
    if (x < width * 0.35) goPrev()
    else goNext()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* progress bars */}
      <div className="flex gap-1 px-3 pt-3 shrink-0">
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
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <img
            src={group.photoUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${group.influenceurId}`}
            alt=""
            className="w-9 h-9 rounded-full object-cover"
          />
          <span className="text-white text-sm font-medium">{group.nom}</span>
        </div>
        <button onClick={onClose} className="text-white p-1">
          <X size={24} />
        </button>
      </div>

      {/* media */}
      <div className="relative flex-1 overflow-hidden" onClick={handleTap}>
        <img src={story.media_url} alt="" className="w-full h-full object-contain select-none" draggable={false} />
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
