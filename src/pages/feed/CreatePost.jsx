import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Image as ImageIcon, X, Type, Check } from 'lucide-react'

const FORMATS = [
  { value: 'carre', label: '1:1', aspect: 'aspect-square' },
  { value: 'horizontal', label: '4:3', aspect: 'aspect-[4/3]' },
  { value: 'vertical', label: '4:5', aspect: 'aspect-[4/5]' },
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

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        influenceur_id: influencerProfile.id,
        type: isStory ? 'story' : files.length > 1 ? 'carrousel' : 'photo',
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
      const file = files[i]
      const fileName = `${influencerProfile.id}/${post.id}/${i}-${file.name}`
      await supabase.storage.from('posts').upload(fileName, file)
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
      await supabase.from('post_medias').insert({ post_id: post.id, media_url: urlData.publicUrl, position: i })
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
      <div className="px-5 pt-6 pb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-caption mb-6">
          <ArrowLeft size={16} /> Retour
        </button>
        <h1 className="text-h1 mb-6">
          {isStory ? 'Nouvelle story' : 'Nouvelle publication'}
        </h1>
        <label className="block cursor-pointer">
          <div className={`${isStory ? 'aspect-[9/16]' : 'aspect-square'} rounded-2xl glass-strong flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]`}>
            <ImageIcon size={28} />
            <span className="text-body">Choisir {isStory ? 'une photo' : 'une ou plusieurs photos'}</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
        {isStory ? (
          <button
            onClick={() => setAddingText((a) => !a)}
            aria-label="Ajouter du texte" className={`w-11 h-11 flex items-center justify-center rounded-full ${addingText ? 'bg-white text-black' : 'text-white'}`}
          >
            <Type size={20} />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* preview zone */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4">
        {isStory ? (
          <div
            className="relative w-full max-w-[380px] aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-900"
            onClick={handleMediaTap}
          >
            {format !== 'vertical' && (
              <div
                className="absolute inset-0 scale-150 blur-3xl brightness-[0.35]"
                style={{ backgroundImage: `url(${mainPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
            )}
            <img
              src={mainPreview}
              alt=""
              className={`relative w-full h-full select-none ${format === 'vertical' ? 'object-cover' : 'object-contain'}`}
              draggable={false}
            />
            {texteOverlay && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 text-center font-semibold px-4 max-w-[90%] whitespace-pre-wrap pointer-events-none"
                style={{
                  left: `${textePos.x}%`,
                  top: `${textePos.y}%`,
                  color: texteCouleur,
                  fontFamily: 'DM Sans',
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
              {displayMedias.length > 1 ? (
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

      {/* bottom controls */}
      <div className="shrink-0 px-4 pb-6 pt-2" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
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
