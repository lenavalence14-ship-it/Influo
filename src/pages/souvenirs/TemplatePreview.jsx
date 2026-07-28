import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Check, ImagePlus } from 'lucide-react'
import html2canvas from 'html2canvas'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ---------------------------------------------------------------------
// Aperçu + édition d'un template choisi dans la bibliothèque, par un
// utilisateur_simple. Il ne peut modifier QUE les blocs marqués
// `editable: true` par l'admin (voir admin/souvenirs/ValidationBlocsEditables.jsx) :
// - bloc texte -> tape dessus, le clavier s'ouvre, il écrit avec la police/
//   taille déjà choisies par l'admin (non modifiables par lui)
// - bloc photo -> tape dessus, la galerie s'ouvre, il importe une photo puis
//   l'ajuste (pincer pour zoomer, glisser pour déplacer) À L'INTÉRIEUR du
//   cadre fixé par l'admin -- le cadre lui-même (position/taille) ne bouge
//   jamais, seul le contenu à l'intérieur change.
// Une fois terminé, "Publier" capture le rendu final (fond + tous les
// blocs, éditables ou non) en une image, et la publie comme un post normal
// dans le feed (voir Option A validée avec l'admin).
// ---------------------------------------------------------------------

// fontCss/MASQUES_SVG : copie fidèle depuis EditeurTemplateMobile.jsx et
// ValidationBlocsEditables.jsx. Doit rester identique partout, sinon ce que
// l'utilisateur voit/publie diverge de ce que l'admin a construit.
function fontCss(nomPolice) {
  if (!nomPolice || nomPolice === 'Default') return 'inherit'
  const GOOGLE_FONTS_MAP = {
    'Lily Script One': 'Lily Script One', 'Bungee': 'Bungee', 'Chewy': 'Chewy',
    'Righteous': 'Righteous', 'Roboto': 'Roboto', 'Pacifico': 'Pacifico',
    'Sofia': 'Sofia', 'Berkshire Swash': 'Berkshire Swash', 'Amita': 'Amita',
    'Amatic SC': 'Amatic SC', 'Tangerine': 'Tangerine', 'Parisienne': 'Parisienne',
    'Edwardian Script ITC': 'Tangerine',
  }
  const mapped = GOOGLE_FONTS_MAP[nomPolice]
  return mapped ? `'${mapped}', cursive, sans-serif` : 'inherit'
}

const MASQUES_SVG = {
  rectangle: null,
  cercle: <circle cx="0.5" cy="0.5" r="0.5" />,
  coeur: (
    <path d="M 0.5 0.88 C 0.2 0.65, 0.02 0.45, 0.02 0.28 C 0.02 0.12, 0.15 0.02, 0.3 0.02
             C 0.4 0.02, 0.47 0.08, 0.5 0.16 C 0.53 0.08, 0.6 0.02, 0.7 0.02
             C 0.85 0.02, 0.98 0.12, 0.98 0.28 C 0.98 0.45, 0.8 0.65, 0.5 0.88 Z" />
  ),
  etoile: (
    <polygon points="0.50,0.02 0.61,0.36 0.98,0.36 0.68,0.57 0.79,0.91 0.50,0.70 0.21,0.91 0.32,0.57 0.02,0.36 0.39,0.36" />
  ),
}

async function fetchTemplate(id) {
  const { data, error } = await supabase
    .from('templates')
    .select('id, categorie, image_url, background_type, background_valeur, blocs')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

const distanceBetween = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)

export default function TemplatePreview() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => fetchTemplate(templateId),
    enabled: Boolean(templateId),
  })

  // Copie locale modifiable des blocs, initialisée dès que le template est
  // chargé. On ne modifie jamais le template original en base : ce sont les
  // valeurs de contenu (texte tapé, photo choisie, zoom/position de cette
  // photo) que l'utilisateur produit pour SON souvenir.
  const [blocsLocaux, setBlocsLocaux] = useState(null)
  const [blocActifId, setBlocActifId] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState(null)
  const [capturing, setCapturing] = useState(false)

  if (blocsLocaux === null && template?.blocs) {
    setBlocsLocaux(template.blocs)
  }

  const blocs = blocsLocaux || template?.blocs || []
  const blocActif = blocs.find((b) => b.id === blocActifId) || null

  const majContenuTexte = (id, contenu) => {
    setBlocsLocaux((bs) => bs.map((b) => (b.id === id ? { ...b, contenu } : b)))
  }

  const majBloc = (id, patch) => {
    setBlocsLocaux((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  const handleChoisirPhoto = () => {
    fileInputRef.current?.click()
  }

  const handleFichierChoisi = (e) => {
    const fichier = e.target.files?.[0]
    if (!fichier || !blocActifId) return
    const previewUrl = URL.createObjectURL(fichier)
    // Nouvelle photo importée : on repart d'un zoom/position neutres, quelle
    // que soit la photo précédente (l'utilisateur peut en changer plusieurs
    // fois avant de publier).
    majBloc(blocActifId, {
      imageType: 'photo',
      imageValeur: previewUrl,
      imageFichier: fichier, // gardé en mémoire pour l'upload final, pas envoyé en base tel quel
      imgScaleX: 1, imgScaleY: 1, imgOffsetX: 0, imgOffsetY: 0,
    })
    e.target.value = ''
  }

  // -------------------- Pincer/glisser la photo dans son cadre --------------------
  // Même logique de geste (un seul doigt = pan, deux doigts = pinch zoom) que
  // CreatePost.jsx, mais sans plancher/plafond de zoom : demandé explicitement
  // en "libre", contrairement au recadrage de post classique qui borne le zoom
  // pour ne jamais laisser de vide dans le cadre.
  const gestureState = useRef(null)
  const pendingEvent = useRef(null)
  const rafId = useRef(null)
  const zoneActiveRef = useRef(null)

  const startGesture = (e) => {
    if (!blocActif || blocActif.type !== 'photo') return
    e.stopPropagation()
    const touches = e.touches
    const base = {
      imgScaleX: blocActif.imgScaleX ?? 1,
      imgScaleY: blocActif.imgScaleY ?? 1,
      imgOffsetX: blocActif.imgOffsetX ?? 0,
      imgOffsetY: blocActif.imgOffsetY ?? 0,
    }
    if (touches && touches.length === 2) {
      gestureState.current = {
        type: 'pinch',
        startDist: distanceBetween(touches[0], touches[1]),
        start: base,
      }
    } else {
      const point = touches ? touches[0] : e
      gestureState.current = { type: 'pan', startX: point.clientX, startY: point.clientY, start: base }
    }
  }

  const computeNext = (e) => {
    const rect = zoneActiveRef.current.getBoundingClientRect()
    const gesture = gestureState.current
    if (gesture.type === 'pinch' && e.touches?.length === 2) {
      const dist = distanceBetween(e.touches[0], e.touches[1])
      const factor = dist / gesture.startDist
      // Zoom libre : pas de clamp, seul un plancher très bas (0.1) empêche
      // une photo réduite à rien par erreur de manipulation.
      const nextScale = Math.max(0.1, gesture.start.imgScaleX * factor)
      return { ...gesture.start, imgScaleX: nextScale, imgScaleY: nextScale }
    }
    const point = e.touches ? e.touches[0] : e
    const dx = ((point.clientX - gesture.startX) / rect.width) * 100
    const dy = ((point.clientY - gesture.startY) / rect.height) * 100
    return { ...gesture.start, imgOffsetX: gesture.start.imgOffsetX + dx, imgOffsetY: gesture.start.imgOffsetY + dy }
  }

  const flushGesture = useCallback(() => {
    rafId.current = null
    if (!gestureState.current || !zoneActiveRef.current || !pendingEvent.current || !blocActifId) return
    majBloc(blocActifId, computeNext(pendingEvent.current))
  }, [blocActifId])

  const onGestureMove = useCallback((e) => {
    if (!gestureState.current || !zoneActiveRef.current) return
    if (e.touches?.length === 2 && gestureState.current.type === 'pan') startGesture(e)
    pendingEvent.current = e
    if (rafId.current == null) rafId.current = requestAnimationFrame(flushGesture)
  }, [flushGesture])

  const endGesture = useCallback(() => {
    gestureState.current = null
    pendingEvent.current = null
    if (rafId.current != null) { cancelAnimationFrame(rafId.current); rafId.current = null }
  }, [])

  useEffect(() => {
    if (!blocActif || blocActif.type !== 'photo') return
    window.addEventListener('pointermove', onGestureMove, { passive: true })
    window.addEventListener('pointerup', endGesture)
    window.addEventListener('touchmove', onGestureMove, { passive: true })
    window.addEventListener('touchend', endGesture)
    return () => {
      window.removeEventListener('pointermove', onGestureMove)
      window.removeEventListener('pointerup', endGesture)
      window.removeEventListener('touchmove', onGestureMove)
      window.removeEventListener('touchend', endGesture)
      if (rafId.current != null) cancelAnimationFrame(rafId.current)
    }
  }, [blocActif, onGestureMove, endGesture])

  // -------------------- Publication --------------------
  const handlePublier = async () => {
    setPublishing(true)
    setPublishError(null)
    try {
      // Upload de chaque photo importée localement (blob URL) vers le
      // storage, AVANT la capture finale : html2canvas doit pointer vers des
      // URLs réelles, pas des object URL locales qui disparaîtraient à la
      // navigation suivante.
      const blocsUploades = await Promise.all(blocs.map(async (bloc) => {
        if (bloc.type !== 'photo' || !bloc.imageFichier) return bloc
        const chemin = `souvenirs/${user.id}/${templateId}-${bloc.id}-${Date.now()}.jpg`
        const { error: errUpload } = await supabase.storage.from('posts').upload(chemin, bloc.imageFichier, { contentType: bloc.imageFichier.type })
        if (errUpload) throw errUpload
        const { data: pub } = supabase.storage.from('posts').getPublicUrl(chemin)
        return { ...bloc, imageValeur: pub.publicUrl, imageFichier: undefined }
      }))
      setBlocsLocaux(blocsUploades)
      // Laisser le DOM re-render avec les nouvelles URLs (upload) avant capture.
      await new Promise((r) => requestAnimationFrame(r))
      await new Promise((r) => requestAnimationFrame(r))

      setBlocActifId(null) // ferme toute édition active pour ne pas capturer un cadre/contour
      setCapturing(true)
      await new Promise((r) => requestAnimationFrame(r))

      const rendu = await html2canvas(canvasRef.current, {
        useCORS: true,
        backgroundColor: null,
        scale: 1080 / canvasRef.current.offsetWidth,
      })
      setCapturing(false)

      const blob = await new Promise((resolve) => rendu.toBlob(resolve, 'image/jpeg', 0.92))

      // Légende du post = concaténation des textes remplis par l'utilisateur
      // dans les blocs éditables, séparés par un retour à la ligne.
      const legende = blocsUploades.filter((b) => b.type === 'texte' && b.editable && b.contenu).map((b) => b.contenu).join('\n')

      const { data: post, error: errPost } = await supabase
        .from('posts')
        .insert({ utilisateur_id: user.id, type: 'photo', legende: legende || null, crop_format: 'souvenir' })
        .select().single()
      if (errPost) throw errPost

      const cheminFinal = `${user.id}/${post.id}/0-souvenir.jpg`
      const { error: errUploadFinal } = await supabase.storage.from('posts').upload(cheminFinal, blob, { contentType: 'image/jpeg' })
      if (errUploadFinal) throw errUploadFinal
      const { data: pubFinal } = supabase.storage.from('posts').getPublicUrl(cheminFinal)

      const { error: errMedia } = await supabase.from('post_medias').insert({
        post_id: post.id, media_url: pubFinal.publicUrl, media_type: 'image', position: 0,
      })
      if (errMedia) throw errMedia

      queryClient.invalidateQueries({ queryKey: ['feed'] })
      navigate('/')
    } catch (err) {
      console.error('Erreur publication souvenir', err)
      setPublishError(err?.message || "Impossible de publier ce souvenir.")
      setCapturing(false)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Fermer"
          className="w-9 h-9 rounded-full flex items-center justify-center glass"
          style={{ color: '#fff' }}
        >
          <X size={18} />
        </button>
        {blocActif ? (
          <button
            onClick={() => setBlocActifId(null)}
            aria-label="Terminer la modification"
            className="w-9 h-9 rounded-full flex items-center justify-center glass"
            style={{ color: '#fff' }}
          >
            <Check size={18} />
          </button>
        ) : (
          <button
            onClick={handlePublier}
            disabled={publishing}
            className="px-4 py-2 rounded-full text-body-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {publishing ? 'Publication…' : 'Publier'}
          </button>
        )}
      </header>

      {publishError && (
        <p className="px-6 text-caption text-center" style={{ color: '#f87171' }}>{publishError}</p>
      )}

      <div className="flex-1 flex items-center justify-center px-4 pb-6 overflow-hidden">
        {isLoading && <span className="text-white/60 text-body">Chargement…</span>}

        {template && blocs.length === 0 && (
          // Templates créés avant l'ajout des blocs éditables : on retombe
          // sur l'ancien rendu (simple image), rien de cassé.
          <img src={template.image_url} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
        )}

        {template && blocs.length > 0 && (
          <div
            ref={canvasRef}
            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              aspectRatio: '2 / 3',
              backgroundColor: template.background_type === 'couleur' ? template.background_valeur : '#e0e0e0',
              backgroundImage: template.background_type === 'photo' && template.background_valeur ? `url(${template.background_valeur})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {blocs.map((bloc) => (
              <BlocUtilisateur
                key={bloc.id}
                bloc={bloc}
                actif={bloc.id === blocActifId}
                capturing={capturing}
                zoneRef={bloc.id === blocActifId ? zoneActiveRef : undefined}
                onActiver={() => bloc.editable && setBlocActifId(bloc.id)}
                onChangeTexte={(val) => majContenuTexte(bloc.id, val)}
                onChoisirPhoto={handleChoisirPhoto}
                onGestureStart={startGesture}
              />
            ))}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFichierChoisi} className="hidden" />
    </div>
  )
}

function BlocUtilisateur({ bloc, actif, capturing, zoneRef, onActiver, onChangeTexte, onChoisirPhoto, onGestureStart }) {
  const style = {
    position: 'absolute',
    left: `${bloc.x}%`, top: `${bloc.y}%`,
    width: `${bloc.width}%`, height: `${bloc.height}%`,
    outline: capturing ? 'none' : bloc.editable ? (actif ? '2px solid #3b82f6' : '2px dashed rgba(255,255,255,0.8)') : 'none',
    // Les blocs non éditables ne captent aucune interaction : ils sont
    // visuellement figés, comme demandé.
    pointerEvents: bloc.editable ? 'auto' : 'none',
    cursor: bloc.editable ? 'pointer' : 'default',
    touchAction: actif && bloc.type === 'photo' ? 'none' : 'auto',
  }

  return (
    <div
      ref={zoneRef}
      style={style}
      onClick={!actif ? onActiver : undefined}
      onMouseDown={actif && bloc.type === 'photo' ? onGestureStart : undefined}
      onTouchStart={actif && bloc.type === 'photo' ? onGestureStart : undefined}
    >
      {bloc.type === 'texte' && (
        actif ? (
          <textarea
            autoFocus
            value={bloc.contenu}
            onChange={(e) => onChangeTexte(e.target.value)}
            className="w-full h-full px-1 bg-transparent resize-none outline-none"
            style={{
              fontFamily: fontCss(bloc.police),
              fontWeight: bloc.gras ? 'bold' : 'normal',
              fontStyle: bloc.italique ? 'italic' : 'normal',
              textDecoration: bloc.souligne ? 'underline' : 'none',
              color: bloc.couleur,
              textAlign: bloc.alignement,
              fontSize: `${bloc.taille}px`,
              lineHeight: 1.25,
            }}
          />
        ) : (
          <div
            className="w-full h-full flex overflow-hidden px-1"
            style={{
              fontFamily: fontCss(bloc.police),
              fontWeight: bloc.gras ? 'bold' : 'normal',
              fontStyle: bloc.italique ? 'italic' : 'normal',
              textDecoration: bloc.souligne ? 'underline' : 'none',
              color: bloc.couleur,
              backgroundColor: bloc.fond || 'transparent',
              justifyContent: bloc.alignement === 'left' ? 'flex-start' : bloc.alignement === 'right' ? 'flex-end' : 'center',
              alignItems: 'flex-start',
              textAlign: bloc.alignement,
              fontSize: `${bloc.taille}px`,
              lineHeight: 1.25,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
            }}
          >
            <span style={{ width: '100%' }}>{bloc.contenu || ' '}</span>
          </div>
        )
      )}

      {bloc.type === 'photo' && (
        <div
          className="w-full h-full overflow-hidden relative"
          style={{
            opacity: bloc.opacite,
            clipPath: (bloc.masque ?? 'rectangle') !== 'rectangle' ? `url(#masque-${bloc.id})` : undefined,
          }}
        >
          {(bloc.masque ?? 'rectangle') !== 'rectangle' && (
            <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
              <clipPath id={`masque-${bloc.id}`} clipPathUnits="objectBoundingBox">
                {MASQUES_SVG[bloc.masque]}
              </clipPath>
            </svg>
          )}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: bloc.imageType === 'couleur' ? bloc.imageValeur : undefined,
              backgroundImage: bloc.imageType === 'photo' ? `url(${bloc.imageValeur})` : undefined,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              transform: `translate(${bloc.imgOffsetX ?? 0}%, ${bloc.imgOffsetY ?? 0}%) scaleX(${bloc.imgScaleX ?? 1}) scaleY(${bloc.imgScaleY ?? 1})`,
            }}
          />
          {bloc.editable && actif && !capturing && (
            <button
              onClick={(e) => { e.stopPropagation(); onChoisirPhoto() }}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center pointer-events-auto"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              aria-label="Changer la photo"
            >
              <ImagePlus size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
