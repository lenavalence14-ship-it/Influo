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

export default function CreatePost() {
  const [searchParams] = useSearchParams()
  const { postId } = useParams()
  const isEditing = Boolean(postId)
  const { influencerProfile } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [isStory, setIsStory] = useState(searchParams.get('type') === 'story')
  const [loadingExisting, setLoadingExisting] = useState(isEditing)

  // step 1: sélection, step 2: éditeur plein écran
  const [step, setStep] = useState(isEditing ? 'edit' : 'select')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([]) // fichiers locaux à uploader (nouveau post)
  const [existingMediaUrls, setExistingMediaUrls] = useState([]) // médias déjà en ligne (mode édition)
  const [existingMediaTypes, setExistingMediaTypes] = useState([]) // 'image' ou 'video' pour chaque média existant
  const [legende, setLegende] = useState('')
  const [format, setFormat] = useState(isStory ? 'vertical' : 'carre')
  const [loading, setLoading] = useState(false)

  // story text overlay
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

  // --- Étape 1 : sélection de fichier (uniquement pour une nouvelle publication) ---
  if (step === 'select') {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col text-white">
        {/* header façon Instagram */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
          <button onClick={() => navigate(-1)} aria-label="Fermer" className="w-9 h-9 flex items-center justify-center">
            <X size={22} />
          </button>
          <span className="text-body-medium">{isStory ? 'Nouvelle story' : 'Nouvelle publication'}</span>
          <div className="w-9" />
        </div>

        {/* le sélecteur natif du téléphone reste la seule vraie source de médias en PWA :
            on ouvre le picker au tap sur la grande carte, façon "Choisir des photos ou vidéos" d'IG */}
        <label className="flex-1 flex flex-col items-center justify-center px-6 cursor-pointer gap-4">
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

  // --- Étape 2 : éditeur plein écran ---
  const displayMedias = isEditing ? existingMediaUrls : previews
  const mainPreview = displayMedias[0]

  const handleMediaTap = (e) => {
    if (!isStory) return
    if (!addingText) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setTextePos({ x, y })
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 relative z-10">
        <button
          onClick={() => (isEditing ? navigate(-1) : setStep('select'))}
          aria-label="Fermer" className="text-white w-11 h-11 flex items-center justify-center"
        >
          <X size={24} />
        </button>
        <span className="text-white text-body-medium">
          {isEditing ? 'Modifier' : isStory ? 'Nouvelle story' : 'Nouvelle publication'}
        </span>
        <div className="w-9" />
      </div>

      {/* preview zone */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4 relative">
        {isStory && (
          <div className="absolute right-3 top-4 flex flex-col items-center gap-5 z-20">
            {[
              { icon: Music, label: 'Audio', disabled: true },
              { icon: Type, label: 'Texte', disabled: false, onClick: () => setAddingText((a) => !a), active: addingText },
              { icon: Sticker, label: 'Superposition', disabled: true },
              { icon: Sparkles, label: 'Filtre', disabled: true },
              { icon: PenLine, label: 'Modifier', disabled: true },
              { icon: ImageIcon, label: 'Ratio', disabled: true },
            ].map(({ icon: Icon, label, disabled, onClick, active }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={disabled}
                aria-label={disabled ? `${label} — bientôt disponible` : label}
                className={`flex flex-col items-center gap-1 ${disabled ? 'opacity-40' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${active ? 'bg-white text-black' : 'bg-black/40 text-white'}`}>
                  <Icon size={17} />
                </div>
                <span className="text-white text-[10px] leading-none">{label}</span>
              </button>
            ))}
          </div>
        )}
        {isStory ? (
          <div
            className="relative w-full max-w-[380px] aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-900"
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

      {/* text input popover for story */}
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

      {/* bas : miniature + bouton publier, façon Instagram */}
      <div className="shrink-0 px-4 pb-6 pt-2" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
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

        {isStory && (
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
        )}

        {!isStory && (
          <>
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
          </>
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
      </div>
    </div>
  )
}
