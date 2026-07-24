import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Image as ImageIcon, X, RotateCcw, Check } from 'lucide-react'
import { compressImage, compressVideo, generateVideoThumbnail } from '../../lib/mediaCompression'
import { triggerHlsTranscode } from '../../lib/hlsTranscode'
import FilterPicker, { getFilterCss } from './editor/FilterPicker'
import DraggableElement from './editor/DraggableElement'
import { FONTS, getFontStyle } from './PhotoNoteEditor'

const RATIOS = [
  { value: 'carre', label: 'Carré', aspect: 'aspect-square' },
  { value: 'vertical', label: 'Vertical', aspect: 'aspect-[4/5]' },
  { value: 'paysage', label: 'Paysage', aspect: 'aspect-[4/3]' },
]

// anciens posts publiés avec un ancien système de format : on les fait
// retomber sur le ratio encore existant le plus proche, uniquement pour
// l'affichage dans CET éditeur (n'affecte pas l'affichage publié ailleurs).
const LEGACY_FORMAT_MAP = { horizontal: 'paysage', vertical_45: 'vertical' }

const TEXT_COLORS = ['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#eab308']

export default function CreatePost() {
  const { postId } = useParams()
  const isEditing = Boolean(postId)
  const { influencerProfile } = useAuth()
  const navigate = useNavigate()

  const [loadingExisting, setLoadingExisting] = useState(isEditing)

  const [step, setStep] = useState(isEditing ? 'edit' : 'select') // 'select' | 'edit' | 'crop' | 'texte'
  const [showFilters, setShowFilters] = useState(false)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [existingMediaUrls, setExistingMediaUrls] = useState([])
  const [existingMediaTypes, setExistingMediaTypes] = useState([])
  const [legende, setLegende] = useState('')
  const [format, setFormat] = useState('carre')
  const [loading, setLoading] = useState(false)

  const [rotation, setRotation] = useState(0)
  const [filtre, setFiltre] = useState(null)

  // recadrage manuel : rectangle en % relatif au conteneur image
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })
  const [draftCrop, setDraftCrop] = useState(crop)

  // texte superposé (un seul, déplaçable, comme dans l'éditeur de note)
  const [textEl, setTextEl] = useState(null) // { contenu, x, y, couleur, police }
  const [textDraft, setTextDraft] = useState('')
  const [textColor, setTextColor] = useState('#ffffff')
  const [textFont, setTextFont] = useState('Inter')

  useEffect(() => {
    if (!isEditing) return
    const loadPost = async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, post_medias(media_url, media_type, position)')
        .eq('id', postId)
        .maybeSingle()

      if (data) {
        setLegende(data.legende || '')
        const savedFormat = data.crop_format
        setFormat(LEGACY_FORMAT_MAP[savedFormat] || savedFormat || 'carre')
        setFiltre(data.filtre || null)
        if (data.texte_overlay) {
          setTextEl({
            contenu: data.texte_overlay,
            couleur: data.texte_couleur || '#ffffff',
            police: data.texte_police || 'Inter',
            x: data.texte_x ?? 50,
            y: data.texte_y ?? 50,
          })
        }
        const sorted = [...(data.post_medias || [])].sort((a, b) => a.position - b.position)
        setExistingMediaUrls(sorted.map((m) => m.media_url))
        setExistingMediaTypes(sorted.map((m) => m.media_type || 'image'))
      }
      setLoadingExisting(false)
    }
    loadPost()
  }, [isEditing, postId])

  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length === 0) return
    setFiles(selected)
    setPreviews(selected.map((f) => URL.createObjectURL(f)))
    setStep('edit')
  }

  const isVideoFile = (f) => f?.type?.startsWith('video/')
  const mainIsVideo = isEditing ? existingMediaTypes[0] === 'video' : isVideoFile(files[0])
  const displayMedias = isEditing ? existingMediaUrls : previews
  const mainPreview = displayMedias[0]
  const isCarrousel = !mainIsVideo && displayMedias.length > 1

  const moveText = (_id, x, y) => setTextEl((prev) => (prev ? { ...prev, x, y } : prev))

  // --- publication ---
  const handlePublish = async () => {
    if (!isEditing && files.length === 0) return
    setLoading(true)

    const commonFields = {
      legende,
      crop_format: format,
      rotation,
      crop,
      filtre,
      texte_overlay: textEl?.contenu || null,
      texte_x: textEl?.x ?? null,
      texte_y: textEl?.y ?? null,
      texte_couleur: textEl?.couleur || null,
      texte_police: textEl?.police || null,
    }

    if (isEditing) {
      await supabase.from('posts').update(commonFields).eq('id', postId)
      setLoading(false)
      navigate(-1)
      return
    }

    const hasVideo = files.some(isVideoFile)
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        influenceur_id: influencerProfile.id,
        type: hasVideo ? 'video' : files.length > 1 ? 'carrousel' : 'photo',
        ...commonFields,
      })
      .select()
      .single()

    if (error) {
      setLoading(false)
      return
    }

    // Chaque fichier du post (photo unique, carrousel, vidéo) est traité en parallèle :
    // compression + génération de miniature + upload, au lieu d'une boucle séquentielle
    // qui attend chaque étape de chaque fichier avant de passer au suivant. Pour un
    // carrousel de 5 photos, cela remplace 5 allers-retours réseau successifs par 5
    // en parallèle, et la publication se termine bien plus vite.
    await Promise.all(files.map(async (rawFile, i) => {
      const isVideo = isVideoFile(rawFile)

      // Compresse systématiquement avant upload : réduit le volume envoyé sur le réseau
      // (upload) ET le volume que chaque viewer devra ensuite télécharger (download),
      // ce qui est le levier de performance le plus direct sur connexion 4G.
      // La génération de la miniature vidéo se fait en parallèle de la compression,
      // pas après, car les deux lisent le fichier source indépendamment.
      const [file, thumbFile] = await Promise.all([
        isVideo ? compressVideo(rawFile) : compressImage(rawFile),
        isVideo ? generateVideoThumbnail(rawFile) : Promise.resolve(null),
      ])

      const fileName = `${influencerProfile.id}/${post.id}/${i}-${file.name}`

      const uploadTasks = [
        supabase.storage.from('posts').upload(fileName, file),
      ]

      let thumbName = null
      if (isVideo && thumbFile) {
        thumbName = `${influencerProfile.id}/${post.id}/${i}-thumb.jpg`
        uploadTasks.push(supabase.storage.from('posts').upload(thumbName, thumbFile))
      }

      await Promise.all(uploadTasks)

      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
      const thumbnailUrl = thumbName
        ? supabase.storage.from('posts').getPublicUrl(thumbName).data.publicUrl
        : null

      const { data: mediaRow } = await supabase
        .from('post_medias')
        .insert({
          post_id: post.id,
          media_url: urlData.publicUrl,
          media_type: isVideo ? 'video' : 'image',
          thumbnail_url: thumbnailUrl,
          position: i,
        })
        .select('id')
        .single()

      // Déclenche le transcodage HLS en arrière-plan, sans bloquer la publication :
      // le post part tout de suite avec le MP4 (media_url) en lecture immédiate,
      // et le player basculera sur le HLS (qualité adaptative) une fois prêt
      // (voir hls_status côté ReelsViewer). "Fire-and-forget" volontaire ici :
      // si ça échoue silencieusement, l'utilisateur voit quand même sa vidéo
      // en MP4 classique, ce n'est jamais bloquant pour lui.
      if (isVideo && mediaRow?.id) {
        triggerHlsTranscode({
          postMediaId: mediaRow.id,
          sourceUrl: urlData.publicUrl,
          storagePrefix: `${influencerProfile.id}/${post.id}/${i}-hls`,
        })
      }
    }))

    setLoading(false)
    navigate('/')
  }

  // (le spinner de chargement est rendu plus bas, après tous les Hooks)

  // ============================================================
  // ÉCRAN 1 — SÉLECTION
  // ============================================================
  // (le contenu est rendu plus bas, après tous les Hooks, pour respecter
  // les règles des Hooks React : ils doivent être appelés dans le même
  // ordre à chaque rendu, donc aucun `return` avant eux)
  const cropAreaRef = useRef(null)
  const dragState = useRef(null)
  const pendingEvent = useRef(null)
  const rafId = useRef(null)

  const startDrag = (handle) => (e) => {
    e.stopPropagation()
    const point = e.touches ? e.touches[0] : e
    dragState.current = { handle, startX: point.clientX, startY: point.clientY, start: { ...draftCrop } }
  }

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
    setDraftCrop(computeNextCrop(pendingEvent.current))
  }, [])

  const onDragMove = useCallback((e) => {
    if (!dragState.current || !cropAreaRef.current) return
    pendingEvent.current = e.touches ? e.touches[0] : e
    if (rafId.current == null) rafId.current = requestAnimationFrame(flushDrag)
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
    if (step !== 'crop') return
    window.addEventListener('pointermove', onDragMove, { passive: true })
    window.addEventListener('pointerup', endDrag)
    return () => {
      window.removeEventListener('pointermove', onDragMove)
      window.removeEventListener('pointerup', endDrag)
      if (rafId.current != null) cancelAnimationFrame(rafId.current)
    }
  }, [step, onDragMove, endDrag])

  const openCrop = () => {
    setDraftCrop(crop)
    setStep('crop')
  }
  const cancelCrop = () => setStep('edit')
  const confirmCrop = () => {
    setCrop(draftCrop)
    setStep('edit')
  }

  // choix d'un ratio : recadre le cadre, centré, à cette proportion — reste
  // ensuite ajustable à la main comme un crop normal
  const applyRatio = (ratioValue) => {
    setFormat(ratioValue)
    const targets = { carre: 1, vertical: 4 / 5, paysage: 4 / 3 }
    const target = targets[ratioValue]
    if (!target || !cropAreaRef.current) return
    const rect = cropAreaRef.current.getBoundingClientRect()
    const containerRatio = rect.width / rect.height
    let w = 100, h = 100
    if (target > containerRatio) {
      h = (containerRatio / target) * 100
    } else {
      w = (target / containerRatio) * 100
    }
    setDraftCrop({ x: (100 - w) / 2, y: (100 - h) / 2, w, h })
  }

  // ---- écran texte ----
  const openTexte = () => {
    setTextDraft(textEl?.contenu || '')
    setTextColor(textEl?.couleur || '#ffffff')
    setTextFont(textEl?.police || 'Inter')
    setStep('texte')
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
    setStep('edit')
  }

  // ============================================================
  // CHARGEMENT (édition d'un post existant)
  // ============================================================
  if (loadingExisting) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  // ============================================================
  // ÉCRAN 1 — SÉLECTION
  // ============================================================
  if (step === 'select') {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
        <header className="flex items-center justify-between px-4 pt-3 pb-2 h-14 shrink-0">
          <button onClick={() => navigate(-1)} aria-label="Fermer" className="w-9 h-9 flex items-center justify-center">
            <X size={22} />
          </button>
          <span className="text-body-medium">Nouvelle publication</span>
          <div className="w-9" />
        </header>

        <label className="flex-1 flex flex-col items-center justify-center px-6 gap-4 cursor-pointer">
          <div className="aspect-square w-full max-w-[380px] rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.04] flex flex-col items-center justify-center gap-3 text-white/50">
            <ImageIcon size={30} />
            <span className="text-body text-center px-6">Choisir des photos ou vidéos</span>
          </div>
          <span className="text-caption text-white/40 text-center max-w-[280px]">
            Ouvre la galerie de ton téléphone — tu peux sélectionner plusieurs fichiers
          </span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFilesChange}
            className="hidden"
          />
        </label>
      </div>
    )
  }

  // ============================================================
  // ÉCRAN CROP — cadre manuel + choix de ratio
  // ============================================================
  const cropStyle = {
    clipPath: `inset(${crop.y}% ${100 - crop.x - crop.w}% ${100 - crop.y - crop.h}% ${crop.x}%)`,
  }

  if (step === 'crop') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black select-none">
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <div ref={cropAreaRef} className="relative w-full h-full">
            <img
              src={mainPreview}
              alt=""
              className="w-full h-full object-contain opacity-30"
              draggable={false}
              style={{ transform: `rotate(${rotation}deg)` }}
            />
            <div
              className="absolute inset-0"
              style={{
                clipPath: `inset(${draftCrop.y}% ${100 - draftCrop.x - draftCrop.w}% ${100 - draftCrop.y - draftCrop.h}% ${draftCrop.x}%)`,
              }}
            >
              <img
                src={mainPreview}
                alt=""
                className="w-full h-full object-contain"
                draggable={false}
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            </div>

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
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/40" />
                ))}
              </div>

              {['t', 'b', 'l', 'r'].map((h) => {
                const isVertical = h === 't' || h === 'b'
                return (
                  <div
                    key={h}
                    onPointerDown={startDrag(h)}
                    className="absolute touch-none"
                    style={{
                      zIndex: 2,
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

        {/* choix de ratio, en plus du cadre manuel */}
        <div className="flex gap-2 px-4 pb-2">
          {RATIOS.map((r) => (
            <button
              key={r.value}
              onClick={() => applyRatio(r.value)}
              className={`flex-1 rounded-2xl py-3 text-caption-medium transition-colors ${
                format === r.value ? 'bg-white text-black' : 'bg-white/10 text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
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

  // ============================================================
  // ÉCRAN TEXTE — Aa, polices, couleur
  // ============================================================
  const filterCss = getFilterCss(filtre)

  if (step === 'texte') {
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

        <div className="flex-1 relative overflow-hidden" style={cropStyle}>
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <img
              src={mainPreview}
              alt=""
              className="w-full h-full object-contain select-none"
              draggable={false}
              style={{ filter: filterCss, transform: `rotate(${rotation}deg)` }}
            />
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
          </div>
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

  // ============================================================
  // ÉCRAN PRINCIPAL
  // ============================================================
  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col select-none">
      <div
        className="flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => (isEditing ? navigate(-1) : setStep('select'))}
          className="w-9 h-9 flex items-center justify-center text-white"
        >
          <X size={22} />
        </button>
        <div className="flex items-center gap-4">
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
        <div className="relative w-full h-full bg-black">
          {mainIsVideo ? (
            <video src={mainPreview} className="w-full h-full object-contain" controls autoPlay playsInline style={{ filter: filterCss }} />
          ) : isCarrousel ? (
            <div className="grid grid-cols-3 gap-1 w-full h-full">
              {displayMedias.map((p, i) => (
                <div key={i} className="aspect-square overflow-hidden">
                  <img src={p} alt="" className="w-full h-full object-cover" style={{ filter: filterCss }} />
                </div>
              ))}
            </div>
          ) : (
            <img
              src={mainPreview}
              alt=""
              className="w-full h-full object-contain select-none"
              draggable={false}
              style={{ filter: filterCss, transform: `rotate(${rotation}deg)` }}
            />
          )}

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
        </div>
      </div>

      {showFilters && (
        <div className="shrink-0 bg-black/95 pt-2" style={{ animation: 'slideUpPanel 0.2s ease-out' }}>
          <p className="text-center text-white/60 text-caption pb-1">Filtres</p>
          <FilterPicker imageUrl={mainPreview} isVideo={mainIsVideo} value={filtre} onChange={setFiltre} />
        </div>
      )}

      <div className="px-4 pt-2">
        <textarea
          value={legende}
          onChange={(e) => setLegende(e.target.value)}
          rows={2}
          placeholder="Écris une légende..."
          className="w-full rounded-2xl px-4 py-3 bg-white/10 text-white outline-none resize-none text-body placeholder:text-white/50"
        />
      </div>

      <div
        className="flex items-center justify-between px-4 pt-2"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <button onClick={() => (isEditing ? navigate(-1) : setStep('select'))} className="text-white text-body-medium px-2 py-2">
          Annuler
        </button>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="text-white text-body-medium px-2 py-2"
        >
          Filtres
        </button>
        <button onClick={handlePublish} disabled={loading} className="text-body-medium px-2 py-2 disabled:opacity-40" style={{ color: 'var(--accent)' }}>
          {loading ? '...' : isEditing ? 'Enregistrer' : 'Publier'}
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