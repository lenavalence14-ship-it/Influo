import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Image as ImageIcon, X, Type, Check, Music, Sticker, Sparkles,
  PenLine, AtSign, MoreHorizontal, ChevronDown, ChevronUp, Plus, Send,
} from 'lucide-react'
import { compressImage, compressVideo } from '../../lib/mediaCompression'
import DrawCanvas from './editor/DrawCanvas'
import FilterPicker, { getFilterCss } from './editor/FilterPicker'
import StickerPicker from './editor/StickerPicker'
import MentionPicker from './editor/MentionPicker'
import DraggableElement from './editor/DraggableElement'

const FORMATS = [
  { value: 'carre', label: '1:1', aspect: 'aspect-square' },
  { value: 'horizontal', label: '4:3', aspect: 'aspect-[4/3]' },
  { value: 'vertical', label: '2:3', aspect: 'aspect-[2/3]' },
  { value: 'vertical_45', label: '4:5', aspect: 'aspect-[4/5]' },
]

const TEXT_COLORS = ['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#eab308']

const PRIMARY_TOOLS = [
  { key: 'audio', icon: Music, label: 'Audio' },
  { key: 'texte', icon: Type, label: 'Texte' },
  { key: 'stickers', icon: Sticker, label: 'Superposition' },
  { key: 'filtre', icon: Sparkles, label: 'Filtre' },
]

const MORE_TOOLS = [
  { key: 'dessiner', icon: PenLine, label: 'Dessiner' },
  { key: 'mentionner', icon: AtSign, label: 'Mentionner' },
]

let uid = 0
const nextId = () => `el_${Date.now()}_${uid++}`

export default function CreatePost() {
  const [searchParams] = useSearchParams()
  const { postId } = useParams()
  const isEditing = Boolean(postId)
  const { influencerProfile } = useAuth()
  const navigate = useNavigate()

  const [isStory, setIsStory] = useState(searchParams.get('type') === 'story')
  const [loadingExisting, setLoadingExisting] = useState(isEditing)

  const [step, setStep] = useState(isEditing ? 'edit' : 'select')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [existingMediaUrls, setExistingMediaUrls] = useState([])
  const [existingMediaTypes, setExistingMediaTypes] = useState([])
  const [legende, setLegende] = useState('')
  const [format, setFormat] = useState(isStory ? 'vertical' : 'carre')
  const [loading, setLoading] = useState(false)

  // outils actifs
  const [activeTool, setActiveTool] = useState(null) // 'texte' | 'stickers' | 'filtre' | 'dessiner' | 'mentionner' | null
  const [showMore, setShowMore] = useState(false)

  // éléments superposés multiples (texte, sticker, mention)
  const [elements, setElements] = useState([])
  const [editingTextId, setEditingTextId] = useState(null)
  const [textDraft, setTextDraft] = useState('')
  const [textColor, setTextColor] = useState('#ffffff')

  // filtre + dessin
  const [filtre, setFiltre] = useState(null)
  const [dessinDataUrl, setDessinDataUrl] = useState(null)
  const [dessinFile, setDessinFile] = useState(null)

  const canvasRef = useRef(null)
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 700 })

  useEffect(() => {
    if (!isEditing) return
    const loadPost = async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, post_medias(media_url, position)')
        .eq('id', postId)
        .maybeSingle()

      if (data) {
        setIsStory(data.type === 'story')
        setLegende(data.legende || '')
        setFormat(data.crop_format || (data.type === 'story' ? 'vertical' : 'carre'))
        setFiltre(data.filtre || null)
        setElements(Array.isArray(data.elements) ? data.elements : [])
        // rétrocompatibilité : ancien texte simple -> élément
        if (data.texte_overlay && (!data.elements || data.elements.length === 0)) {
          setElements([{
            id: nextId(),
            type: 'texte',
            x: data.texte_x ?? 50,
            y: data.texte_y ?? 50,
            contenu: data.texte_overlay,
            couleur: data.texte_couleur || '#ffffff',
          }])
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

  // --- gestion des éléments ---
  const addTextElement = () => {
    setTextDraft('')
    setTextColor('#ffffff')
    const id = nextId()
    setElements((els) => [...els, { id, type: 'texte', x: 50, y: 50, contenu: '', couleur: '#ffffff' }])
    setEditingTextId(id)
    setActiveTool('texte')
  }

  const commitTextEdit = () => {
    if (!editingTextId) return
    setElements((els) =>
      textDraft.trim()
        ? els.map((el) => (el.id === editingTextId ? { ...el, contenu: textDraft, couleur: textColor } : el))
        : els.filter((el) => el.id !== editingTextId)
    )
    setEditingTextId(null)
    setActiveTool(null)
  }

  const addSticker = (emoji) => {
    setElements((els) => [...els, { id: nextId(), type: 'sticker', x: 50, y: 40, contenu: emoji }])
  }

  const addMention = (user) => {
    setElements((els) => [...els, { id: nextId(), type: 'mention', x: 50, y: 30, contenu: user.nom_complet, userId: user.id }])
    setActiveTool(null)
  }

  const moveElement = (id, x, y) => {
    setElements((els) => els.map((el) => (el.id === id ? { ...el, x, y } : el)))
  }

  const handleElementTap = (el) => {
    if (el.type === 'texte') {
      setTextDraft(el.contenu)
      setTextColor(el.couleur || '#ffffff')
      setEditingTextId(el.id)
      setActiveTool('texte')
    }
  }

  const handleToolClick = (key) => {
    setShowMore(false)
    if (key === 'texte') {
      addTextElement()
      return
    }
    setActiveTool((cur) => (cur === key ? null : key))
  }

  // --- publication ---
  const handlePublish = async () => {
    if (!isEditing && files.length === 0) return
    setLoading(true)

    let dessinUrl = null
    if (dessinFile) {
      const fileName = `${influencerProfile.id}/dessin-${Date.now()}.png`
      await supabase.storage.from('posts').upload(fileName, dessinFile)
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
      dessinUrl = urlData.publicUrl
    }

    const commonFields = {
      legende: isStory ? null : legende,
      crop_format: format,
      elements,
      filtre,
      dessin_url: dessinUrl,
      // rétrocompat : on garde aussi le premier élément texte dans les anciennes colonnes
      texte_overlay: elements.find((e) => e.type === 'texte')?.contenu || null,
      texte_x: elements.find((e) => e.type === 'texte')?.x ?? null,
      texte_y: elements.find((e) => e.type === 'texte')?.y ?? null,
      texte_couleur: elements.find((e) => e.type === 'texte')?.couleur || null,
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
        type: isStory ? 'story' : hasVideo ? 'video' : files.length > 1 ? 'carrousel' : 'photo',
        expire_at: isStory ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        ...commonFields,
      })
      .select()
      .single()

    if (error) {
      setLoading(false)
      return
    }

    for (let i = 0; i < files.length; i++) {
      const rawFile = files[i]
      const file = isVideoFile(rawFile) ? await compressVideo(rawFile) : await compressImage(rawFile)
      const fileName = `${influencerProfile.id}/${post.id}/${i}-${file.name}`
      await supabase.storage.from('posts').upload(fileName, file)
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
      await supabase.from('post_medias').insert({
        post_id: post.id,
        media_url: urlData.publicUrl,
        media_type: isVideoFile(rawFile) ? 'video' : 'image',
        position: i,
      })
    }

    setLoading(false)
    navigate('/')
  }

  const handleDessinExport = async (dataUrl) => {
    setDessinDataUrl(dataUrl)
    if (!dataUrl) {
      setDessinFile(null)
      return
    }
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    setDessinFile(new File([blob], 'dessin.png', { type: 'image/png' }))
  }

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
          <span className="text-body-medium">{isStory ? 'Nouvelle story' : 'Nouvelle publication'}</span>
          <div className="w-9" />
        </header>

        <label className="flex-1 flex flex-col items-center justify-center px-6 gap-4 cursor-pointer">
          <div className={`${isStory ? 'aspect-[9/16] max-h-[55vh]' : 'aspect-square'} w-full max-w-[380px] rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.04] flex flex-col items-center justify-center gap-3 text-white/50`}>
            <ImageIcon size={30} />
            <span className="text-body text-center px-6">
              Choisir {isStory ? 'une photo ou vidéo' : 'des photos ou vidéos'}
            </span>
          </div>
          <span className="text-caption text-white/40 text-center max-w-[280px]">
            Ouvre la galerie de ton téléphone{!isStory ? ' — tu peux sélectionner plusieurs fichiers' : ''}
          </span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple={!isStory}
            onChange={handleFilesChange}
            className="hidden"
          />
        </label>
      </div>
    )
  }

  // ============================================================
  // ÉCRAN 2 — ÉDITION
  // ============================================================
  const filterCss = getFilterCss(filtre)

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
      {/* barre du haut : miniature + nom + bouton + */}
      <header className="flex items-center gap-3 px-4 pt-3 pb-2 h-14 shrink-0">
        <button
          onClick={() => (isEditing ? navigate(-1) : setStep('select'))}
          aria-label="Retour"
          className="w-9 h-9 -ml-1 flex items-center justify-center shrink-0"
        >
          <X size={22} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0 bg-white/10 rounded-full pl-1 pr-3 py-1">
          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-neutral-800">
            {mainIsVideo ? (
              <video src={mainPreview} className="w-full h-full object-cover" muted />
            ) : (
              <img src={mainPreview} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <span className="text-[13px] text-white/90 truncate">
            {isStory ? 'Nouvelle story' : 'Nouvelle publication'}
          </span>
        </div>
        <button
          disabled
          aria-label="Ajouter un média — bientôt disponible"
          className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/30 shrink-0"
        >
          <Plus size={16} />
        </button>
      </header>

      {/* zone médiane : canvas photo avec tous les overlays, commun à post et story */}
      <main className="flex-1 min-h-0 relative overflow-hidden">
        <div
          ref={canvasRef}
          className="absolute inset-0 flex items-center justify-center px-4"
          onClick={() => activeTool === 'texte' && editingTextId && commitTextEdit()}
        >
          <div className={`relative w-full ${isStory ? 'h-full max-w-none' : 'max-w-[380px]'}`}>
            <div
              className={`relative w-full overflow-hidden bg-neutral-900 ${
                isStory ? 'h-full rounded-none' : `${FORMATS.find((f) => f.value === format)?.aspect} rounded-2xl`
              }`}
            >
              {mainIsVideo ? (
                <video src={mainPreview} className="w-full h-full object-cover" controls={!isStory} playsInline style={{ filter: filterCss }} />
              ) : !isStory && displayMedias.length > 1 ? (
                <div className="grid grid-cols-3 gap-1 w-full h-full">
                  {displayMedias.map((p, i) => (
                    <div key={i} className="aspect-square overflow-hidden">
                      <img src={p} alt="" className="w-full h-full object-cover" style={{ filter: filterCss }} />
                    </div>
                  ))}
                </div>
              ) : (
                <img src={mainPreview} alt="" className="w-full h-full object-cover select-none" draggable={false} style={{ filter: filterCss }} />
              )}

              {dessinDataUrl && (
                <img src={dessinDataUrl} alt="" className="absolute inset-0 w-full h-full pointer-events-none" />
              )}

              {elements.map((el) => (
                <DraggableElement key={el.id} element={el} onMove={moveElement} onTap={handleElementTap}>
                  {el.type === 'texte' && el.id !== editingTextId && (
                    <p
                      className="text-center font-semibold px-2 max-w-[80vw] whitespace-pre-wrap"
                      style={{ color: el.couleur, fontSize: '26px', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}
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
                </DraggableElement>
              ))}

              <DrawCanvas
                active={activeTool === 'dessiner'}
                width={canvasSize.width}
                height={canvasSize.height}
                onExport={handleDessinExport}
              />
            </div>

            {isEditing && !isStory && (
              <p className="text-white/40 text-caption text-center mt-3">
                Pour changer la photo, supprime cette publication et republie.
              </p>
            )}
          </div>

          {/* barre d'icônes verticale flottante, façon Instagram, commune à post et story */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-5 z-10">
            {PRIMARY_TOOLS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); handleToolClick(key) }}
                className="flex items-center gap-2"
              >
                <span className="text-[13px] text-white whitespace-nowrap">{label}</span>
                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${activeTool === key ? 'bg-white text-black' : 'bg-black/40 text-white'}`}>
                  <Icon size={17} />
                </span>
              </button>
            ))}

            <button onClick={(e) => { e.stopPropagation(); setShowMore((s) => !s) }} className="flex items-center gap-2">
              <span className="text-[13px] text-white whitespace-nowrap">Plus</span>
              <span className="w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center shrink-0">
                <MoreHorizontal size={17} />
              </span>
            </button>

            {showMore && MORE_TOOLS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); handleToolClick(key) }}
                className="flex items-center gap-2"
              >
                <span className="text-[13px] text-white whitespace-nowrap">{label}</span>
                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${activeTool === key ? 'bg-white text-black' : 'bg-black/40 text-white'}`}>
                  <Icon size={17} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* panneau d'outil actif (texte, stickers, filtre, mentionner) */}
      {activeTool === 'texte' && editingTextId && (
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setTextColor(c)}
                className={`w-7 h-7 rounded-full border-2 ${textColor === c ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitTextEdit()}
            placeholder="Ajouter du texte..."
            autoFocus
            className="w-full h-12 rounded-2xl px-4 bg-white/10 text-white outline-none text-body placeholder:text-white/50"
          />
          <div className="flex justify-end mt-2">
            <button onClick={commitTextEdit} className="text-white text-body-medium px-3 py-1.5">Terminé</button>
          </div>
        </div>
      )}

      {activeTool === 'stickers' && (
        <div className="shrink-0 border-t border-white/10">
          <StickerPicker onPick={addSticker} />
        </div>
      )}

      {activeTool === 'filtre' && (
        <div className="shrink-0 border-t border-white/10">
          <FilterPicker imageUrl={mainPreview} value={filtre} onChange={setFiltre} />
        </div>
      )}

      {activeTool === 'mentionner' && (
        <div className="shrink-0 border-t border-white/10">
          <MentionPicker onPick={addMention} />
        </div>
      )}

      {/* pied : ratio (post uniquement) + légende + publier */}
      {!isStory && (
        <footer className="shrink-0 px-4 pb-6 pt-2" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2 mb-3">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                className={`flex-1 rounded-2xl py-3 text-caption-medium transition-colors ${
                  format === f.value ? 'bg-white text-black' : 'bg-white/10 text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <textarea
            value={legende}
            onChange={(e) => setLegende(e.target.value)}
            rows={2}
            placeholder="Écris une légende..."
            className="w-full rounded-2xl px-4 py-3 bg-white/10 text-white outline-none resize-none text-body placeholder:text-white/50 mb-3"
          />

          <button
            onClick={handlePublish}
            disabled={loading}
            className="w-full h-12 rounded-full bg-white text-black text-body-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? 'Enregistrement...' : (
              <>
                <Check size={18} strokeWidth={2.5} /> {isEditing ? 'Enregistrer' : 'Publier'}
              </>
            )}
          </button>
        </footer>
      )}

      {/* story : bouton Publier flottant, pas de pied de page qui rogne la photo */}
      {isStory && (
        <div
          className="shrink-0 px-4 pb-6 pt-3"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handlePublish}
            disabled={loading}
            className="w-full h-12 rounded-full bg-white text-black text-body-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? 'Publication...' : (
              <>
                <Send size={16} /> {isEditing ? 'Enregistrer' : 'Publier'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}