import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Image as ImageIcon, X, Type, Check, Music, Sticker, PenLine, Sparkles, Plus } from 'lucide-react'
import { compressImage, compressVideo } from '../../lib/mediaCompression'

const FORMATS = [
  { value: 'carre', label: '1:1', aspect: 'aspect-square' },
  { value: 'horizontal', label: '4:3', aspect: 'aspect-[4/3]' },
  { value: 'vertical', label: '2:3', aspect: 'aspect-[2/3]' },
  { value: 'vertical_45', label: '4:5', aspect: 'aspect-[4/5]' },
]

const TEXT_COLORS = ['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#eab308']

// Boutons de la sidebar façon Instagram. Seul "texte" a un vrai onClick câblé plus bas ;
// les autres sont volontairement inertes (enabled: false) tant que la fonctionnalité n'existe pas.
const SIDEBAR_ITEMS = [
  { key: 'audio', icon: Music, label: 'Audio', enabled: false },
  { key: 'texte', icon: Type, label: 'Texte', enabled: true },
  { key: 'superposition', icon: Sticker, label: 'Superposition', enabled: false },
  { key: 'filtre', icon: Sparkles, label: 'Filtre', enabled: false },
  { key: 'modifier', icon: PenLine, label: 'Modifier', enabled: false },
  { key: 'ratio', icon: ImageIcon, label: 'Ratio', enabled: false },
]

export default function CreatePost() {
  const [searchParams] = useSearchParams()
  const { postId } = useParams()
  const isEditing = Boolean(postId)
  const { influencerProfile } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

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

  const [addingText, setAddingText] = useState(false)
  const [texteOverlay, setTexteOverlay] = useState('')
  const [textePos, setTextePos] = useState({ x: 50, y: 50 })
  const [texteCouleur, setTexteCouleur] = useState('#ffffff')

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
        setTexteOverlay(data.texte_overlay || '')
        setTextePos({ x: data.texte_x ?? 50, y: data.texte_y ?? 50 })
        setTexteCouleur(data.texte_couleur || '#ffffff')
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

  const handleMediaTap = (e) => {
    if (!isStory || !addingText) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setTextePos({ x, y })
  }

  const handleSidebarClick = (key) => {
    if (key === 'texte') setAddingText((a) => !a)
  }

  const handlePublish = async () => {
    if (!isEditing && files.length === 0) return
    setLoading(true)

    if (isEditing) {
      await supabase
        .from('posts')
        .update({
          legende: isStory ? null : legende,
          crop_format: format,
          texte_overlay: isStory && texteOverlay ? texteOverlay : null,
          texte_x: isStory ? textePos.x : null,
          texte_y: isStory ? textePos.y : null,
          texte_couleur: isStory ? texteCouleur : null,
        })
        .eq('id', postId)

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
        legende: isStory ? null : legende,
        crop_format: format,
        expire_at: isStory ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        texte_overlay: isStory && texteOverlay ? texteOverlay : null,
        texte_x: isStory ? textePos.x : null,
        texte_y: isStory ? textePos.y : null,
        texte_couleur: isStory ? texteCouleur : null,
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
            ref={fileInputRef}
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
  // ÉCRAN 2 — ÉDITION (structure neuve, calquée sur Instagram)
  // ============================================================
  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-4 pt-3 pb-2 h-14 shrink-0">
        <button
          onClick={() => (isEditing ? navigate(-1) : setStep('select'))}
          aria-label="Fermer"
          className="w-9 h-9 flex items-center justify-center"
        >
          <X size={22} />
        </button>
        <span className="text-body-medium">
          {isEditing ? 'Modifier' : isStory ? 'Nouvelle story' : 'Nouvelle publication'}
        </span>
        <div className="w-9" />
      </header>

      {/* zone médiane : photo + sidebar, hauteur flexible mais jamais rognée */}
      <main className="flex-1 min-h-0 flex">
        <div className="flex-1 flex items-center justify-center px-4 py-2 min-w-0">
          {isStory ? (
            <div
              className="relative w-full max-w-[380px] aspect-[9/16] max-h-full rounded-2xl overflow-hidden bg-neutral-900"
              onClick={handleMediaTap}
            >
              {format !== 'vertical' && format !== 'vertical_45' && (
                <div
                  className="absolute inset-0 scale-150 blur-3xl brightness-[0.35]"
                  style={{ backgroundImage: `url(${mainPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
              )}
              <img
                src={mainPreview}
                alt=""
                className={`relative w-full h-full select-none ${format === 'vertical' || format === 'vertical_45' ? 'object-cover' : 'object-contain'}`}
                draggable={false}
              />
              {texteOverlay && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-center font-semibold px-4 max-w-[90%] whitespace-pre-wrap pointer-events-none"
                  style={{
                    left: `${textePos.x}%`,
                    top: `${textePos.y}%`,
                    color: texteCouleur,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    fontSize: '28px',
                    textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                  }}
                >
                  {texteOverlay}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-[380px]">
              <div className={`relative w-full ${FORMATS.find((f) => f.value === format)?.aspect} rounded-2xl overflow-hidden bg-neutral-900`}>
                {mainIsVideo ? (
                  <video src={mainPreview} className="w-full h-full object-cover" controls playsInline />
                ) : displayMedias.length > 1 ? (
                  <div className="grid grid-cols-3 gap-1 w-full h-full">
                    {displayMedias.map((p, i) => (
                      <div key={i} className="aspect-square overflow-hidden">
                        <img src={p} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <img src={mainPreview} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              {isEditing && (
                <p className="text-white/40 text-caption text-center mt-3">
                  Pour changer la photo, supprime cette publication et republie.
                </p>
              )}
            </div>
          )}
        </div>

        {/* sidebar Instagram — colonne dédiée à côté de la photo, jamais en absolute par-dessus */}
        {isStory && (
          <div className="w-16 shrink-0 flex flex-col items-center justify-between py-3 pr-1">
            {SIDEBAR_ITEMS.map(({ key, icon: Icon, label, enabled }) => {
              const isActive = key === 'texte' && addingText
              return (
                <button
                  key={key}
                  onClick={() => enabled && handleSidebarClick(key)}
                  aria-label={enabled ? label : `${label} — bientôt disponible`}
                  className={`flex flex-col items-center gap-1 w-full ${enabled ? '' : 'opacity-40 pointer-events-none'}`}
                >
                  <Icon size={20} className={isActive ? 'bg-white text-black rounded-full p-1 box-content' : ''} />
                  <span className="text-[10px] leading-none text-center">{label}</span>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* popover saisie texte (story) */}
      {isStory && addingText && (
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setTexteCouleur(c)}
                className={`w-7 h-7 rounded-full border-2 ${texteCouleur === c ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            value={texteOverlay}
            onChange={(e) => setTexteOverlay(e.target.value)}
            placeholder="Ajouter du texte..."
            autoFocus
            className="w-full h-12 rounded-2xl px-4 bg-white/10 text-white outline-none text-body placeholder:text-white/50"
          />
          <p className="text-white/50 text-caption mt-2">Touche l'image pour repositionner le texte</p>
        </div>
      )}

      {/* pied : miniature + ratio + légende + publier */}
      <footer className="shrink-0 px-4 pb-6 pt-2" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-lg overflow-hidden border-2 border-white shrink-0 bg-neutral-800">
            {mainIsVideo ? (
              <video src={mainPreview} className="w-full h-full object-cover" muted />
            ) : (
              <img src={mainPreview} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <button
            disabled
            aria-label="Ajouter un média — bientôt disponible"
            className="w-11 h-11 rounded-lg border border-white/20 flex items-center justify-center text-white/30 shrink-0"
          >
            <Plus size={18} />
          </button>
        </div>

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

        {!isStory && (
          <textarea
            value={legende}
            onChange={(e) => setLegende(e.target.value)}
            rows={2}
            placeholder="Écris une légende..."
            className="w-full rounded-2xl px-4 py-3 bg-white/10 text-white outline-none resize-none text-body placeholder:text-white/50 mb-3"
          />
        )}

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
    </div>
  )
}
