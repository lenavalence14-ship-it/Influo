import { useState, useRef, useEffect, useCallback } from 'react'
import { Music, RotateCcw, X } from 'lucide-react'
import FilterPicker, { getFilterCss } from './editor/FilterPicker'
import DraggableElement from './editor/DraggableElement'

// Polices proposées à l'écran 4 (façon Instagram), un sous-ensemble sûr et
// disponible nativement / déjà chargé par l'app (pas de police externe à
// charger en plus pour rester léger).
const FONTS = [
  { key: 'Inter', label: 'Aa', style: { fontFamily: 'Inter, sans-serif', fontWeight: 600 } },
  { key: 'serif', label: 'Aa', style: { fontFamily: 'Georgia, serif', fontWeight: 700 } },
  { key: 'mono', label: 'Aa', style: { fontFamily: 'monospace', fontWeight: 600 } },
  { key: 'italic', label: 'Aa', style: { fontFamily: 'Inter, sans-serif', fontStyle: 'italic', fontWeight: 500 } },
  { key: 'condensed', label: 'Aa', style: { fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' } },
  { key: 'light', label: 'Aa', style: { fontFamily: 'Inter, sans-serif', fontWeight: 300 } },
  { key: 'wide', label: 'Aa', style: { fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em' } },
]

const TEXT_COLORS = ['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#eab308']

export function getFontStyle(key) {
  return FONTS.find((f) => f.key === key)?.style || FONTS[0].style
}

// Fond flouté + image en object-contain : reproduit le rendu WhatsApp/Instagram
// pour une image qui ne remplit pas tout l'écran (même logique utilisée ici
// pendant l'édition et dans NoteViewer pour l'affichage final).
function BlurredPhoto({ src, filterCss, rotation, children }) {
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: filterCss && filterCss !== 'none' ? `blur(40px) ${filterCss}` : 'blur(40px)',
          transform: 'scale(1.2)',
        }}
      />
      <div className="absolute inset-0 bg-black/30" />
      <img
        src={src}
        alt=""
        className="relative z-10 w-full h-full object-contain select-none"
        draggable={false}
        style={{ filter: filterCss, transform: `rotate(${rotation}deg)` }}
      />
      <div className="absolute inset-0 z-20">{children}</div>
    </div>
  )
}

/**
 * Éditeur plein écran pour une photo de note (image 2 à 5 des maquettes) :
 *  - 'main'   : écran d'édition principal (croix, musique factice, crop, Aa)
 *  - 'crop'   : recadrage manuel à la main (glisser le cadre)
 *  - 'texte'  : ajout de texte superposé, choix police/couleur
 *  - filtres  : panneau qui glisse depuis le bas sur l'écran principal
 *
 * Ne gère PAS l'upload/publication finale : ça reste dans CreateNote, qui
 * reçoit ici le résultat (fichier + filtre + texte + rotation) via onDone.
 */
export default function PhotoNoteEditor({ file, previewUrl, onCancel, onDone }) {
  const [screen, setScreen] = useState('main') // 'main' | 'crop' | 'texte'
  const [showFilters, setShowFilters] = useState(false)

  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [filtre, setFiltre] = useState(null)

  // Recadrage : rectangle en % relatif au conteneur image, ajusté à la main.
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })
  const [draftCrop, setDraftCrop] = useState(crop)

  // Texte superposé (un seul, déplaçable, comme demandé)
  const [textEl, setTextEl] = useState(null) // { contenu, x, y, couleur, police }
  const [textDraft, setTextDraft] = useState('')
  const [textColor, setTextColor] = useState('#ffffff')
  const [textFont, setTextFont] = useState('Inter')

  const filterCss = getFilterCss(filtre)

  // Appelé par "Publier" sur l'écran principal : on ne repasse plus par un
  // second écran de confirmation (CreateNote) pour les photos. onDone
  // déclenche directement la publication en arrière-plan et referme tout de
  // suite l'éditeur (cf. CreateNote.handlePhotoEditorDone).
  const handleDone = () => {
    onDone({
      file,
      previewUrl,
      rotation,
      filtre,
      crop,
      texte: textEl,
    })
  }

  // ---- écran crop ----
  const cropAreaRef = useRef(null)
  const dragState = useRef(null)
  const pendingEvent = useRef(null)
  const rafId = useRef(null)

  const startDrag = (handle) => (e) => {
    e.stopPropagation()
    const point = e.touches ? e.touches[0] : e
    dragState.current = { handle, startX: point.clientX, startY: point.clientY, start: { ...draftCrop } }
  }

  // Calcule le nouveau crop à partir d'un event brut. Pure, pas de setState
  // ici : appelée uniquement depuis la boucle rAF ci-dessous pour ne faire
  // qu'UN SEUL re-render par frame d'écran, au lieu d'un par event
  // pointermove (qui peut fire beaucoup plus vite que 60fps sur mobile et
  // rendait le glissé saccadé).
  const computeNextCrop = (point) => {
    const rect = cropAreaRef.current.getBoundingClientRect()
    const dx = ((point.clientX - dragState.current.startX) / rect.width) * 100
    const dy = ((point.clientY - dragState.current.startY) / rect.height) * 100
    const { handle, start } = dragState.current

    let { x, y, w, h } = start
    if (handle === 'move') {
      x = Math.max(0, Math.min(100 - w, start.x + dx))
      y = Math.max(0, Math.min(100 - h, start.y + dy))
    } else {
      if (handle.includes('l')) {
        const newX = Math.max(0, Math.min(start.x + start.w - 10, start.x + dx))
        w = start.w - (newX - start.x)
        x = newX
      }
      if (handle.includes('r')) {
        w = Math.max(10, Math.min(100 - start.x, start.w + dx))
      }
      if (handle.includes('t')) {
        const newY = Math.max(0, Math.min(start.y + start.h - 10, start.y + dy))
        h = start.h - (newY - start.y)
        y = newY
      }
      if (handle.includes('b')) {
        h = Math.max(10, Math.min(100 - start.y, start.h + dy))
      }
    }
    return { x, y, w, h }
  }

  const flushDrag = useCallback(() => {
    rafId.current = null
    if (!dragState.current || !cropAreaRef.current || !pendingEvent.current) return
    const next = computeNextCrop(pendingEvent.current)
    setDraftCrop(next)
  }, [])

  const onDragMove = useCallback((e) => {
    if (!dragState.current || !cropAreaRef.current) return
    pendingEvent.current = e.touches ? e.touches[0] : e
    if (rafId.current == null) {
      rafId.current = requestAnimationFrame(flushDrag)
    }
  }, [flushDrag])

  const endDrag = useCallback(() => {
    dragState.current = null
    pendingEvent.current = null
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [])

  useEffect(() => {
    if (screen !== 'crop') return
    window.addEventListener('pointermove', onDragMove, { passive: true })
    window.addEventListener('pointerup', endDrag)
    return () => {
      window.removeEventListener('pointermove', onDragMove)
      window.removeEventListener('pointerup', endDrag)
      if (rafId.current != null) cancelAnimationFrame(rafId.current)
    }
  }, [screen, onDragMove, endDrag])

  const openCrop = () => {
    setDraftCrop(crop)
    setScreen('crop')
  }
  const cancelCrop = () => setScreen('main')
  const confirmCrop = () => {
    setCrop(draftCrop)
    setScreen('main')
  }

  // ---- écran texte ----
  const openTexte = () => {
    setTextDraft(textEl?.contenu || '')
    setTextColor(textEl?.couleur || '#ffffff')
    setTextFont(textEl?.police || 'Inter')
    setScreen('texte')
  }
  const confirmTexte = () => {
    if (textDraft.trim()) {
      setTextEl((prev) => ({
        contenu: textDraft,
        couleur: textColor,
        police: textFont,
        x: prev?.x ?? 50,
        y: prev?.y ?? 50,
      }))
    } else {
      setTextEl(null)
    }
    setScreen('main')
  }

  const moveText = (_id, x, y) => setTextEl((prev) => (prev ? { ...prev, x, y } : prev))

  // ---- rendu ----
  const cropStyle = {
    clipPath: `inset(${crop.y}% ${100 - crop.x - crop.w}% ${100 - crop.y - crop.h}% ${crop.x}%)`,
  }

  if (screen === 'crop') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black select-none">
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <div ref={cropAreaRef} className="relative w-full h-full">
            <img
              src={previewUrl}
              alt=""
              className="w-full h-full object-contain opacity-30"
              draggable={false}
              style={{ transform: `rotate(${rotation}deg)` }}
            />
            {/* image nette uniquement dans le cadre de recadrage */}
            <div
              className="absolute inset-0"
              style={{
                clipPath: `inset(${draftCrop.y}% ${100 - draftCrop.x - draftCrop.w}% ${100 - draftCrop.y - draftCrop.h}% ${draftCrop.x}%)`,
              }}
            >
              <img
                src={previewUrl}
                alt=""
                className="w-full h-full object-contain"
                draggable={false}
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            </div>

            {/* cadre déplaçable */}
            <div
              className="absolute border-2 border-white"
              style={{
                left: `${draftCrop.x}%`,
                top: `${draftCrop.y}%`,
                width: `${draftCrop.w}%`,
                height: `${draftCrop.h}%`,
                zIndex: 1,
              }}
              onPointerDown={startDrag('move')}
            >
              {/* grille 3x3 */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/40" />
                ))}
              </div>

              {/* poignées de BORD (haut/bas/gauche/droite) : redimensionnent
                  sur un seul axe. Placées avant les poignées de coin dans le
                  DOM/z-index pour que les coins (plus spécifiques) gagnent
                  s'ils se chevauchent légèrement. */}
              {['t', 'b', 'l', 'r'].map((h) => {
                const isVertical = h === 't' || h === 'b'
                return (
                  <div
                    key={h}
                    onPointerDown={startDrag(h)}
                    className="absolute touch-none"
                    style={{
                      zIndex: 2,
                      // Bande large (44px) centrée sur le bord concerné, sans
                      // déborder sur les zones des poignées de coin.
                      left: isVertical ? 16 : h === 'l' ? -22 : undefined,
                      right: isVertical ? 16 : h === 'r' ? -22 : undefined,
                      top: !isVertical ? 16 : h === 't' ? -22 : undefined,
                      bottom: !isVertical ? 16 : h === 'b' ? -22 : undefined,
                      width: isVertical ? undefined : 44,
                      height: isVertical ? 44 : undefined,
                      cursor: isVertical ? 'ns-resize' : 'ew-resize',
                    }}
                  />
                )
              })}

              {/* poignées d'ANGLE : zone de hit agrandie à 44x44 (cible
                  tactile correcte ; l'ancienne zone de 24x24 était trop
                  petite et le doigt retombait souvent sur le cadre entier
                  -> déplaçait au lieu de rogner). zIndex le plus haut pour
                  toujours gagner sur le bord/le déplacement du cadre. */}
              {['tl', 'tr', 'bl', 'br'].map((h) => (
                <div
                  key={h}
                  onPointerDown={startDrag(h)}
                  className="absolute w-11 h-11 -m-[22px] touch-none"
                  style={{
                    zIndex: 3,
                    left: h.includes('l') ? 0 : undefined,
                    right: h.includes('r') ? 0 : undefined,
                    top: h.includes('t') ? 0 : undefined,
                    bottom: h.includes('b') ? 0 : undefined,
                    cursor: h === 'tl' || h === 'br' ? 'nwse-resize' : 'nesw-resize',
                  }}
                >
                  <div className="w-6 h-6 border-white m-[10px]" style={{
                    borderTopWidth: h.includes('t') ? 3 : 0,
                    borderBottomWidth: h.includes('b') ? 3 : 0,
                    borderLeftWidth: h.includes('l') ? 3 : 0,
                    borderRightWidth: h.includes('r') ? 3 : 0,
                  }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center pb-2">
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white"
          >
            <RotateCcw size={20} />
          </button>
        </div>

        <div
          className="flex items-center justify-between px-6 pb-6 pt-2"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <button onClick={cancelCrop} className="text-body-medium" style={{ color: 'var(--accent)' }}>
            Annuler
          </button>
          <button onClick={confirmCrop} className="text-body-medium" style={{ color: 'var(--accent)' }}>
            Terminé
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'texte') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black select-none">
        <div
          className="flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3"
          style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
        >
          <button onClick={confirmTexte} className="text-white text-body-medium">
            Terminé
          </button>
          <div className="flex items-center gap-2">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setTextColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${textColor === c ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <BlurredPhoto src={previewUrl} filterCss={filterCss} rotation={rotation}>
            <div className="absolute inset-0 flex items-center justify-center px-8 pointer-events-none">
              <textarea
                autoFocus
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="Ajouter du texte"
                rows={2}
                className="note-text-input pointer-events-auto w-full bg-transparent text-center outline-none resize-none"
                style={{ color: textColor, fontSize: 28, textShadow: '0 1px 6px rgba(0,0,0,0.6)', ...getFontStyle(textFont) }}
              />
            </div>
          </BlurredPhoto>
        </div>

        <div className="flex gap-3 overflow-x-auto px-4 py-4 shrink-0">
          {FONTS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTextFont(f.key)}
              className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
                textFont === f.key ? 'bg-white text-black' : 'bg-white/10 text-white'
              }`}
              style={f.style}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // écran principal
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black select-none">
      <div
        className="flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
      >
        <button onClick={onCancel} className="w-9 h-9 flex items-center justify-center text-white">
          <X size={22} />
        </button>
        <div className="flex items-center gap-4">
          <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
            <Music size={18} />
          </button>
          <button
            onClick={openCrop}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={openTexte}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold text-[15px]"
          >
            Aa
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden" style={cropStyle}>
        <BlurredPhoto src={previewUrl} filterCss={filterCss} rotation={rotation}>
          {textEl && (
            <DraggableElement element={textEl} onMove={moveText}>
              <p
                className="text-center px-3 max-w-[80vw] whitespace-pre-wrap"
                style={{ color: textEl.couleur, fontSize: 28, textShadow: '0 1px 6px rgba(0,0,0,0.5)', ...getFontStyle(textEl.police) }}
              >
                {textEl.contenu}
              </p>
            </DraggableElement>
          )}
        </BlurredPhoto>
      </div>

      {showFilters && (
        <div
          className="shrink-0 bg-black/95 pt-2"
          style={{ animation: 'slideUpPanel 0.2s ease-out' }}
        >
          <p className="text-center text-white/60 text-caption pb-1">Filtres</p>
          <FilterPicker imageUrl={previewUrl} isVideo={false} value={filtre} onChange={setFiltre} />
        </div>
      )}

      <div
        className="flex items-center justify-between px-4 pt-2"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <button onClick={onCancel} className="text-white text-body-medium px-2 py-2">
          Annuler
        </button>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="text-white text-body-medium px-2 py-2"
        >
          Filtres
        </button>
        <button onClick={handleDone} className="text-body-medium px-2 py-2" style={{ color: 'var(--accent)' }}>
          Publier
        </button>
      </div>

      <style>{`
        @keyframes slideUpPanel {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .note-text-input::placeholder {
          color: rgba(255, 255, 255, 0.75);
          text-shadow: 0 1px 6px rgba(0,0,0,0.6);
        }
      `}</style>
    </div>
  )
}
