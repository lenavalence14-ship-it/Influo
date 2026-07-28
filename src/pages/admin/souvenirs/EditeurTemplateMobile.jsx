import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, Check, Type, Shapes, Image as ImageIcon, Layers,
  X, ArrowUpDown, RotateCcw, Move, Copy, ZoomIn, FlipHorizontal, FlipVertical,
  Plus, Minus, ArrowUp, ArrowDown, ArrowLeft as ArrowLeftIcon, ArrowRight,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Palette,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// ---------------------------------------------------------------------
// Polices -- liste calquée sur le sélecteur de référence (images 4/5).
// Chargées via Google Fonts à la demande (on ne charge que ce qui est
// affiché/utilisé pour ne pas plomber le poids de la page).
// ---------------------------------------------------------------------
const POLICES = [
  'Default', 'Lily Script One', 'Agency FB', 'Andalan Demo', 'iCiel Auther', 'Bambus',
  'Birthday Boy', 'Bivouac', 'iCiel Blooming Elegant', 'iCiel Blooming Elegant Hand',
  'iCiel Brawls', 'Bungee', 'iCiel Butcher and Block', 'Stylish Calligraphy', 'Candy Cane',
  'Carbon', 'Chewy', 'Christmas Cookies', 'Collegiate', 'iCiel Cucho', 'Dodge',
  'Effra', 'Evident', 'UVF Fairview', 'iCiel Fairy Tales', 'iCiel Prtridge', 'Danube',
  'Genghis Khan', 'Genghis Khan Medium Oblique', 'Getsu Magic', 'VL Golf', 'Goo Easter',
  'GoodDog', 'Parisienne', 'Righteous', 'Roboto', 'Pacifico', 'iCiel Smoothy Cursive', 'Sofia',
  'Stencil', 'Rocoi Lalola', 'iCiel Mijas', 'iCiel Nabila', 'Beloved', 'Berkshire Swash',
  'Dumpling', 'Monday', 'Posterizer KG Inline', 'Smirk', 'Amita', 'Amatic SC',
  'Tangerine', 'Hillda', 'Michael', 'Selfie', 'Wild Pen', 'FS Playlist Script',
  'Wednesday', 'Typo Writer Demo', 'FS Bandung', 'Thirsty Script Extrabold Demo',
  'Voluptate Demo', 'Wingko', 'Zefani Stencil', 'Edwardian Script ITC',
]

// Sous-ensemble mappable à de vraies familles Google Fonts existantes (le
// reste, absent du catalogue Google Fonts, retombe sur une police système
// proche pour ne pas bloquer l'affichage).
const GOOGLE_FONTS_MAP = {
  'Lily Script One': 'Lily Script One', 'Bungee': 'Bungee', 'Chewy': 'Chewy',
  'Righteous': 'Righteous', 'Roboto': 'Roboto', 'Pacifico': 'Pacifico',
  'Sofia': 'Sofia', 'Berkshire Swash': 'Berkshire Swash', 'Amita': 'Amita',
  'Amatic SC': 'Amatic SC', 'Tangerine': 'Tangerine', 'Parisienne': 'Parisienne',
  'Edwardian Script ITC': 'Tangerine', // fallback proche (script fin)
}

let fontsLoaded = false
function chargerGoogleFonts() {
  if (fontsLoaded) return
  fontsLoaded = true
  const familles = Object.values(GOOGLE_FONTS_MAP).map((f) => f.replace(/ /g, '+')).join('&family=')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${familles}&display=swap`
  document.head.appendChild(link)
}

function fontCss(nomPolice) {
  if (!nomPolice || nomPolice === 'Default') return 'inherit'
  const mapped = GOOGLE_FONTS_MAP[nomPolice]
  return mapped ? `'${mapped}', cursive, sans-serif` : 'inherit'
}

// ---------------------------------------------------------------------
// Suppression d'arrière-plan par couleur (chroma key simple, sans IA).
// Rend transparent tout pixel dont la couleur est proche de `cible`
// (distance euclidienne RGB <= tolerance). Retourne un blob PNG.
// ---------------------------------------------------------------------
async function supprimerCouleurImage(fichierOuUrl, cible, tolerance) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = typeof fichierOuUrl === 'string' ? fichierOuUrl : URL.createObjectURL(fichierOuUrl)
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = imgData.data
  const [cr, cg, cb] = cible
  const tol2 = tolerance * tolerance

  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - cr, dg = d[i + 1] - cg, db = d[i + 2] - cb
    const dist2 = dr * dr + dg * dg + db * db
    if (dist2 <= tol2) d[i + 3] = 0 // transparent
  }
  ctx.putImageData(imgData, 0, 0)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Lit la couleur d'un pixel de l'image affichée au point (xPct, yPct) en %.
function lireCouleurPixel(imgEl, xPct, yPct) {
  const canvas = document.createElement('canvas')
  canvas.width = imgEl.naturalWidth
  canvas.height = imgEl.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(imgEl, 0, 0)
  const x = Math.round((xPct / 100) * canvas.width)
  const y = Math.round((yPct / 100) * canvas.height)
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
  return [r, g, b]
}



let idCounter = 1
const nextId = () => `bloc_${idCounter++}`

function nouveauBlocTexte() {
  return {
    id: nextId(),
    type: 'texte',
    x: 15, y: 40, width: 70, height: 15, // en % du canvas
    contenu: 'Votre texte',
    police: 'Default',
    taille: 24, // px de référence à 100% de largeur de bloc "standard"
    couleur: '#111111',
    gras: false,
    italique: false,
    souligne: false,
    alignement: 'center',
    fond: null, // couleur de fond du bloc, ou null (transparent)
  }
}

// ---------------------------------------------------------------------
// Masques de découpe pour les blocs photo, définis en coordonnées SVG
// relatives (0 à 1, clipPathUnits="objectBoundingBox") pour s'adapter à
// n'importe quelle taille de bloc sans recalcul JS.
// ---------------------------------------------------------------------
const MASQUES_SVG = {
  rectangle: null, // pas de clip-path, rectangle natif du bloc
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

const OPTIONS_MASQUE = [
  { valeur: 'rectangle', label: 'Rectangle' },
  { valeur: 'cercle', label: 'Cercle' },
  { valeur: 'coeur', label: 'Cœur' },
  { valeur: 'etoile', label: 'Étoile' },
]

function nouveauBlocPhoto(fondType, fondValeur) {
  return {
    id: nextId(),
    type: 'photo',
    x: 20, y: 30, width: 60, height: 40,
    imageType: fondType, // 'photo' | 'couleur'
    imageValeur: fondValeur,
    opacite: 1,
    rotationFlipH: false,
    rotationFlipV: false,
    // l'image vit dans un cadre fixe (le bloc) : imgScaleX/Y zooment l'image
    // indépendamment sur chaque axe à l'intérieur, imgOffsetX/Y la déplace
    // (en % de la largeur/hauteur du bloc). scale=1 = l'image tient dans le
    // cadre sur cet axe (avec background-size: contain comme base).
    imgScaleX: 1,
    imgScaleY: 1,
    imgOffsetX: 0,
    imgOffsetY: 0,
    masque: 'rectangle', // 'rectangle' | 'cercle' | 'coeur' | 'etoile'
  }
}

export default function EditeurTemplateMobile() {
  const { categorie } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const fondType = searchParams.get('fond_type')
  const fondValeur = searchParams.get('fond_valeur')

  const [blocs, setBlocs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [panneau, setPanneau] = useState(null) // 'texte' | 'photo' | 'photo_source' | 'police' | 'position' | null
  const canvasRef = useRef(null)

  useEffect(() => { chargerGoogleFonts() }, [])

  const selected = blocs.find((b) => b.id === selectedId) || null

  const updateBloc = useCallback((id, patch) => {
    setBlocs((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [])

  const supprimerBloc = (id) => {
    setBlocs((bs) => bs.filter((b) => b.id !== id))
    setSelectedId(null)
    setPanneau(null)
  }

  const dupliquerBloc = (id) => {
    const src = blocs.find((b) => b.id === id)
    if (!src) return
    const copie = { ...src, id: nextId(), x: src.x + 4, y: src.y + 4 }
    setBlocs((bs) => [...bs, copie])
    setSelectedId(copie.id)
  }

  // -------------------- Ajout : Texte --------------------
  const handleAjouterTexte = () => {
    const bloc = nouveauBlocTexte()
    setBlocs((bs) => [...bs, bloc])
    setSelectedId(bloc.id)
    setPanneau('texte')
  }

  // -------------------- Ajout : Photo --------------------
  const handleOuvrirPhoto = () => {
    setSelectedId(null)
    setPanneau('photo_source')
  }

  const [fichierEnAttente, setFichierEnAttente] = useState(null) // { file, previewUrl }

  const handleFichierChoisi = async (e) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    const previewUrl = URL.createObjectURL(fichier)
    setFichierEnAttente({ file: fichier, previewUrl })
    setPanneau('detourage')
    e.target.value = '' // permet de re-choisir le même fichier plus tard
  }

  // Appelé depuis PanneauDetourage une fois l'utilisateur satisfait (ou "passer")
  const finaliserImportImage = async (blob) => {
    if (!fichierEnAttente) return
    try {
      const contentType = blob ? 'image/png' : fichierEnAttente.file.type
      const nomFichier = blob ? `bloc_${Date.now()}.png` : `bloc_${Date.now()}_${fichierEnAttente.file.name}`
      const chemin = `${categorie}/${nomFichier}`
      const donnees = blob || fichierEnAttente.file
      const { error } = await supabase.storage.from('templates').upload(chemin, donnees, { upsert: true, contentType })
      if (error) throw error
      const { data: pub } = supabase.storage.from('templates').getPublicUrl(chemin)
      const bloc = nouveauBlocPhoto('photo', pub.publicUrl)
      setBlocs((bs) => [...bs, bloc])
      setSelectedId(bloc.id)
      setPanneau('photo')
      setFichierEnAttente(null)
    } catch (err) {
      console.error('Erreur upload image de bloc', err)
      alert("Erreur lors de l'import de l'image.")
    }
  }

  const handleChoisirCouleurBloc = (couleur) => {
    const bloc = nouveauBlocPhoto('couleur', couleur)
    setBlocs((bs) => [...bs, bloc])
    setSelectedId(bloc.id)
    setPanneau('photo')
  }

  // -------------------- Drag (déplacement bloc) --------------------
  const dragState = useRef(null)
  const startDrag = (e, bloc) => {
    e.stopPropagation()
    setSelectedId(bloc.id)
    const rect = canvasRef.current.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    dragState.current = {
      id: bloc.id, startX: point.clientX, startY: point.clientY,
      origX: bloc.x, origY: bloc.y, canvasW: rect.width, canvasH: rect.height,
      mode: 'move',
    }
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragMove, { passive: false })
    window.addEventListener('touchend', onDragEnd)
  }

  const onDragMove = (e) => {
    if (!dragState.current) return
    e.preventDefault?.()
    const { id, startX, startY, origX, origY, canvasW, canvasH, mode, origW, origH, handle } = dragState.current
    const point = e.touches ? e.touches[0] : e
    const dxPct = ((point.clientX - startX) / canvasW) * 100
    const dyPct = ((point.clientY - startY) / canvasH) * 100

    if (mode === 'move') {
      updateBloc(id, {
        x: Math.max(0, Math.min(100, origX + dxPct)),
        y: Math.max(0, Math.min(100, origY + dyPct)),
      })
    } else if (mode === 'resize') {
      let { x, y, width, height } = { x: origX, y: origY, width: origW, height: origH }
      if (handle.includes('e')) width = Math.max(5, origW + dxPct)
      if (handle.includes('s')) height = Math.max(5, origH + dyPct)
      if (handle.includes('w')) { width = Math.max(5, origW - dxPct); x = origX + (origW - width) }
      if (handle.includes('n')) { height = Math.max(5, origH - dyPct); y = origY + (origH - height) }
      updateBloc(id, { x, y, width, height })
    }
  }

  const onDragEnd = () => {
    dragState.current = null
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('touchmove', onDragMove)
    window.removeEventListener('touchend', onDragEnd)
  }

  // -------------------- Édition image : pan (glisser) + pinch (zoom) --------------------
  const [editionImageId, setEditionImageId] = useState(null)
  const imgDragState = useRef(null)

  const startImageDrag = (e, bloc) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    const blocWpx = (bloc.width / 100) * rect.width
    const blocHpx = (bloc.height / 100) * rect.height

    if (e.touches && e.touches.length === 2) {
      // début pincer : on mémorise la distance entre les 2 doigts et le scale de départ
      const [t1, t2] = e.touches
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      imgDragState.current = { id: bloc.id, mode: 'pinch', startDist: dist, origScaleX: bloc.imgScaleX, origScaleY: bloc.imgScaleY }
    } else {
      const point = e.touches ? e.touches[0] : e
      imgDragState.current = {
        id: bloc.id, mode: 'pan', startX: point.clientX, startY: point.clientY,
        origOffsetX: bloc.imgOffsetX, origOffsetY: bloc.imgOffsetY, blocWpx, blocHpx,
      }
    }
    window.addEventListener('mousemove', onImageMove)
    window.addEventListener('mouseup', onImageEnd)
    window.addEventListener('touchmove', onImageMove, { passive: false })
    window.addEventListener('touchend', onImageEnd)
  }

  const onImageMove = (e) => {
    if (!imgDragState.current) return
    e.preventDefault?.()
    const state = imgDragState.current

    if (e.touches && e.touches.length === 2 && state.mode !== 'pinch') {
      // transition pan -> pinch si un 2e doigt arrive en cours de geste
      const [t1, t2] = e.touches
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const bloc = blocs.find((b) => b.id === state.id)
      imgDragState.current = { id: state.id, mode: 'pinch', startDist: dist, origScaleX: bloc.imgScaleX, origScaleY: bloc.imgScaleY }
      return
    }

    if (state.mode === 'pinch') {
      if (!e.touches || e.touches.length < 2) return
      const [t1, t2] = e.touches
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const facteur = dist / state.startDist
      const newScaleX = Math.max(0.1, Math.min(5, state.origScaleX * facteur))
      const newScaleY = Math.max(0.1, Math.min(5, state.origScaleY * facteur))
      updateBloc(state.id, { imgScaleX: newScaleX, imgScaleY: newScaleY })
    } else {
      const point = e.touches ? e.touches[0] : e
      const dxPct = ((point.clientX - state.startX) / state.blocWpx) * 100
      const dyPct = ((point.clientY - state.startY) / state.blocHpx) * 100
      const limite = 60 // amplitude de déplacement permise dans le cadre
      updateBloc(state.id, {
        imgOffsetX: Math.max(-limite, Math.min(limite, state.origOffsetX + dxPct)),
        imgOffsetY: Math.max(-limite, Math.min(limite, state.origOffsetY + dyPct)),
      })
    }
  }

  const onImageEnd = () => {
    imgDragState.current = null
    window.removeEventListener('mousemove', onImageMove)
    window.removeEventListener('mouseup', onImageEnd)
    window.removeEventListener('touchmove', onImageMove)
    window.removeEventListener('touchend', onImageEnd)
  }

  // -------------------- Édition image : étirement X/Y via poignées --------------------
  const imgResizeState = useRef(null)

  const startImageResize = (e, bloc, handle) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    imgResizeState.current = {
      id: bloc.id, handle,
      startX: point.clientX, startY: point.clientY,
      origScaleX: bloc.imgScaleX, origScaleY: bloc.imgScaleY,
      blocWpx: (bloc.width / 100) * rect.width,
      blocHpx: (bloc.height / 100) * rect.height,
    }
    window.addEventListener('mousemove', onImageResizeMove)
    window.addEventListener('mouseup', onImageResizeEnd)
    window.addEventListener('touchmove', onImageResizeMove, { passive: false })
    window.addEventListener('touchend', onImageResizeEnd)
  }

  const onImageResizeMove = (e) => {
    if (!imgResizeState.current) return
    e.preventDefault?.()
    const state = imgResizeState.current
    const point = e.touches ? e.touches[0] : e
    const dx = point.clientX - state.startX
    const dy = point.clientY - state.startY
    // 2x car scale s'applique symétriquement autour du centre de l'image
    const dScaleX = (2 * dx) / state.blocWpx
    const dScaleY = (2 * dy) / state.blocHpx

    const updates = {}
    if (state.handle.includes('e')) updates.imgScaleX = Math.max(0.1, Math.min(5, state.origScaleX + dScaleX))
    if (state.handle.includes('w')) updates.imgScaleX = Math.max(0.1, Math.min(5, state.origScaleX - dScaleX))
    if (state.handle.includes('s')) updates.imgScaleY = Math.max(0.1, Math.min(5, state.origScaleY + dScaleY))
    if (state.handle.includes('n')) updates.imgScaleY = Math.max(0.1, Math.min(5, state.origScaleY - dScaleY))
    updateBloc(state.id, updates)
  }

  const onImageResizeEnd = () => {
    imgResizeState.current = null
    window.removeEventListener('mousemove', onImageResizeMove)
    window.removeEventListener('mouseup', onImageResizeEnd)
    window.removeEventListener('touchmove', onImageResizeMove)
    window.removeEventListener('touchend', onImageResizeEnd)
  }

  const startResize = (e, bloc, handle) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    dragState.current = {
      id: bloc.id, startX: point.clientX, startY: point.clientY,
      origX: bloc.x, origY: bloc.y, origW: bloc.width, origH: bloc.height,
      canvasW: rect.width, canvasH: rect.height, mode: 'resize', handle,
    }
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragMove, { passive: false })
    window.addEventListener('touchend', onDragEnd)
  }

  // -------------------- Enregistrement --------------------
  const handleEnregistrer = async () => {
    setSaving(true)
    try {
      const { data: existants, error: errOrdre } = await supabase
        .from('templates').select('ordre').eq('categorie', categorie)
        .order('ordre', { ascending: false }).limit(1)
      if (errOrdre) throw errOrdre
      const prochainOrdre = (existants?.[0]?.ordre ?? -1) + 1

      const { data: inserted, error: errInsert } = await supabase
        .from('templates')
        .insert({ categorie, ordre: prochainOrdre, background_type: fondType, background_valeur: fondValeur })
        .select('id').single()
      if (errInsert) throw errInsert

      let imageUrl = fondType === 'photo' ? fondValeur : null
      if (fondType === 'couleur') {
        const canvas = document.createElement('canvas')
        canvas.width = 1080; canvas.height = 1350
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = fondValeur || '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        const path = `${categorie}/${inserted.id}.png`
        const { error: errUpload } = await supabase.storage.from('templates').upload(path, blob, { upsert: true, contentType: 'image/png' })
        if (errUpload) throw errUpload
        const { data: pub } = supabase.storage.from('templates').getPublicUrl(path)
        imageUrl = pub.publicUrl
      }

      const { error: errUpdate } = await supabase.from('templates').update({ image_url: imageUrl }).eq('id', inserted.id)
      if (errUpdate) throw errUpdate

      // TODO (prochaine étape) : persister `blocs` dans `template_layers`
      // une fois la migration DB prête pour ce nouveau modèle de blocs.
      console.log('BLOCS À PERSISTER', blocs)

      navigate(`/admin/souvenirs/templates/${categorie}`)
    } catch (err) {
      console.error('Erreur enregistrement template', err)
      alert("Erreur lors de l'enregistrement du template.")
    } finally {
      setSaving(false)
    }
  }

  const fermerPanneau = () => { setPanneau(null) }

  return (
    <div className="flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', height: '100dvh' }}>
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{ backgroundColor: 'var(--accent)', height: '64px', color: '#fff' }}
      >
        <button onClick={() => navigate(-1)} aria-label="Retour" className="flex items-center justify-center">
          <ChevronLeft size={26} />
        </button>
        <button onClick={handleEnregistrer} disabled={saving} aria-label="Enregistrer" className="flex items-center justify-center">
          <Check size={24} />
        </button>
      </header>

      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-primary)' }}
        onClick={() => { setSelectedId(null); setPanneau(null) }}
      >
        <div
          ref={canvasRef}
          className="relative w-full max-w-sm overflow-hidden"
          style={{
            aspectRatio: '4 / 5',
            backgroundColor: fondType === 'couleur' ? fondValeur : '#e0e0e0',
            backgroundImage: fondType === 'photo' && fondValeur ? `url(${fondValeur})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {blocs.map((bloc) => (
            <BlocRendu
              key={bloc.id}
              bloc={bloc}
              selected={bloc.id === selectedId}
              editionImage={editionImageId === bloc.id}
              onSelect={(e) => { e.stopPropagation(); if (editionImageId === bloc.id) return; setSelectedId(bloc.id); setPanneau(bloc.type === 'texte' ? 'texte' : 'photo') }}
              onEntrerEditionImage={() => { setSelectedId(bloc.id); setEditionImageId(bloc.id); setPanneau(null) }}
              onDragStart={(e) => startDrag(e, bloc)}
              onResizeStart={(e, handle) => startResize(e, bloc, handle)}
              onImageDragStart={(e) => startImageDrag(e, bloc)}
              onImageResizeStart={(e, handle) => startImageResize(e, bloc, handle)}
              onSupprimer={() => supprimerBloc(bloc.id)}
            />
          ))}
        </div>
      </div>

      {editionImageId && (
        <button
          onClick={() => { setEditionImageId(null); setPanneau('photo') }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-body-medium z-40"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          Terminer l'ajustement de l'image
        </button>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFichierChoisi} className="hidden" />

      <div className="shrink-0">
        {panneau === null && (
          <BarreOutilsPrincipale
            onTexte={handleAjouterTexte}
            onPhoto={handleOuvrirPhoto}
          />
        )}

        {panneau === 'photo_source' && (
          <PanneauPhotoSource
            onRetour={fermerPanneau}
            onGalerie={() => fileInputRef.current?.click()}
            onCouleur={handleChoisirCouleurBloc}
          />
        )}

        {panneau === 'detourage' && fichierEnAttente && (
          <PanneauDetourage
            fichierEnAttente={fichierEnAttente}
            onValider={(blob) => finaliserImportImage(blob)}
            onPasser={() => finaliserImportImage(null)}
            onRetour={() => { setFichierEnAttente(null); fermerPanneau() }}
          />
        )}

        {panneau === 'texte' && selected && (
          <PanneauTexte
            bloc={selected}
            onChange={(patch) => updateBloc(selected.id, patch)}
            onRetour={() => setPanneau(null)}
            onOuvrirPolices={() => setPanneau('police')}
          />
        )}

        {panneau === 'police' && selected && (
          <PanneauPolice
            policeActuelle={selected.police}
            onChoisir={(p) => { updateBloc(selected.id, { police: p }); setPanneau('texte') }}
            onRetour={() => setPanneau('texte')}
          />
        )}

        {panneau === 'photo' && selected && (
          <PanneauPhoto
            bloc={selected}
            onChange={(patch) => updateBloc(selected.id, patch)}
            onRetour={() => setPanneau(null)}
            onSupprimer={() => supprimerBloc(selected.id)}
            onDupliquer={() => dupliquerBloc(selected.id)}
            onOuvrirPosition={() => setPanneau('position')}
            onEntrerEditionImage={() => { setEditionImageId(selected.id); setPanneau(null) }}
          />
        )}

        {panneau === 'position' && selected && (
          <PanneauPosition
            bloc={selected}
            onChange={(patch) => updateBloc(selected.id, patch)}
            onRetour={() => setPanneau('photo')}
          />
        )}
      </div>
    </div>
  )
}

// =======================================================================
// Rendu d'un bloc sur le canvas (texte ou photo) + poignées de resize/drag
// =======================================================================
function BlocRendu({ bloc, selected, editionImage, onSelect, onEntrerEditionImage, onDragStart, onResizeStart, onImageDragStart, onImageResizeStart, onSupprimer }) {
  const style = {
    position: 'absolute',
    left: `${bloc.x}%`, top: `${bloc.y}%`,
    width: `${bloc.width}%`, height: `${bloc.height}%`,
    outline: selected ? '2px solid #3b82f6' : editionImage ? '2px dashed #22c55e' : 'none',
    cursor: editionImage ? 'grab' : 'move',
    touchAction: 'none',
  }

  const gererMouseDown = (e) => {
    if (bloc.type === 'photo' && editionImage) {
      e.stopPropagation()
      onImageDragStart(e)
      return
    }
    onDragStart(e)
  }

  return (
    <div
      style={style}
      onMouseDown={gererMouseDown}
      onTouchStart={gererMouseDown}
      onClick={onSelect}
      onDoubleClick={bloc.type === 'photo' ? (e) => { e.stopPropagation(); onEntrerEditionImage() } : undefined}
    >
      {bloc.type === 'texte' && (
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
              transform: `translate(${bloc.imgOffsetX}%, ${bloc.imgOffsetY}%) scaleX(${(bloc.rotationFlipH ? -1 : 1) * (bloc.imgScaleX ?? 1)}) scaleY(${(bloc.rotationFlipV ? -1 : 1) * (bloc.imgScaleY ?? 1)})`,
            }}
          />
        </div>
      )}

      {bloc.type === 'photo' && editionImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${bloc.imgOffsetX}%, ${bloc.imgOffsetY}%) scaleX(${(bloc.rotationFlipH ? -1 : 1) * (bloc.imgScaleX ?? 1)}) scaleY(${(bloc.rotationFlipV ? -1 : 1) * (bloc.imgScaleY ?? 1)})`,
          }}
        >
          {['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map((h) => (
            <div key={h} className="pointer-events-auto">
              <PoigneeResize handle={h} color="#22c55e" onStart={(e) => onImageResizeStart(e, h)} />
            </div>
          ))}
        </div>
      )}

      {selected && !editionImage && (
        <>
          {['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map((h) => (
            <PoigneeResize key={h} handle={h} onStart={(e) => onResizeStart(e, h)} />
          ))}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSupprimer() }}
            aria-label="Supprimer le bloc"
            className="absolute flex items-center justify-center rounded-full bg-red-500 text-white"
            style={{ top: -12, left: -12, width: 24, height: 24, zIndex: 30 }}
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  )
}

function PoigneeResize({ handle, onStart, color = '#3b82f6' }) {
  const pos = {
    nw: { top: -6, left: -6, cursor: 'nwse-resize' },
    n: { top: -6, left: '50%', marginLeft: -6, cursor: 'ns-resize' },
    ne: { top: -6, right: -6, cursor: 'nesw-resize' },
    w: { top: '50%', left: -6, marginTop: -6, cursor: 'ew-resize' },
    e: { top: '50%', right: -6, marginTop: -6, cursor: 'ew-resize' },
    sw: { bottom: -6, left: -6, cursor: 'nesw-resize' },
    s: { bottom: -6, left: '50%', marginLeft: -6, cursor: 'ns-resize' },
    se: { bottom: -6, right: -6, cursor: 'nwse-resize' },
  }[handle]

  return (
    <div
      onMouseDown={onStart}
      onTouchStart={onStart}
      className="absolute w-3 h-3 rounded-full bg-white border-2"
      style={{ ...pos, position: 'absolute', borderColor: color, touchAction: 'none', zIndex: 10 }}
    />
  )
}

// =======================================================================
// Barre du bas -- niveau racine (4 boutons)
// =======================================================================
function BarreOutilsPrincipale({ onTexte, onPhoto }) {
  return (
    <>
      <div className="text-center py-2 text-body-medium" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
        Fonctionnalité
      </div>
      <div className="grid grid-cols-4">
        <ToolButton icon={Type} label="Sélectionné" onClick={onTexte} />
        <ToolButton icon={Shapes} label="Forme" />
        <ToolButton icon={ImageIcon} label="Photo" onClick={onPhoto} />
        <ToolButton icon={Layers} label="Arrière-plan" />
      </div>
    </>
  )
}

function ToolButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 py-3">
      <Icon size={22} style={{ color: 'var(--text-primary)' }} />
      <span className="text-caption truncate px-1" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </button>
  )
}

function BarreAvecRetour({ titre, onRetour, children }) {
  return (
    <>
      <div className="flex items-center gap-2 py-2" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
        <button onClick={onRetour} className="pl-3 flex items-center justify-center" aria-label="Retour">
          <ChevronLeft size={20} />
        </button>
        <span className="flex-1 text-center text-body-medium pr-7">{titre}</span>
      </div>
      {children}
    </>
  )
}

// =======================================================================
// Panneau : choix source photo (galerie ou couleur) -- même logique que
// l'écran "Choisir l'arrière-plan", mais importé en tant que bloc au-dessus.
// =======================================================================
const PALETTE = [
  '#FFFFFF', '#000000', '#C0392B', '#951B6E',
  '#FFC088', '#B983FF', '#2D4FC7', '#1C7FA0', '#FF8CFA',
  '#E01777', '#F2543D', '#FFCB05', '#A31257',
  '#C24118', '#EE7D00', '#FF9800', '#F5A623', '#9AA61B',
  '#4C8C2B', '#7A2FB5', '#FFEB3B', '#4A4A4A', '#A6A6A6',
]

function PanneauPhotoSource({ onRetour, onGalerie, onCouleur }) {
  return (
    <BarreAvecRetour titre="Fonctionnalité" onRetour={onRetour}>
      <div>
        <button onClick={onGalerie} className="w-full flex items-center gap-4 px-4 py-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
          <ImageIcon size={22} style={{ color: 'var(--text-primary)' }} />
          <span className="text-body" style={{ color: 'var(--text-primary)' }}>Galerie d'images</span>
        </button>
        <div className="grid grid-cols-8 gap-0 p-2">
          {PALETTE.map((c) => (
            <button key={c} onClick={() => onCouleur(c)} className="aspect-square rounded" style={{ backgroundColor: c }} aria-label={c} />
          ))}
        </div>
      </div>
    </BarreAvecRetour>
  )
}

// =======================================================================
// Panneau : édition d'un bloc texte
// =======================================================================
function PanneauTexte({ bloc, onChange, onRetour, onOuvrirPolices }) {
  return (
    <BarreAvecRetour titre="Texte" onRetour={onRetour}>
      <div className="p-3 space-y-3 max-h-72 overflow-auto">
        <textarea
          value={bloc.contenu}
          onChange={(e) => onChange({ contenu: e.target.value })}
          rows={2}
          placeholder="Écrivez votre texte…"
          className="w-full glass rounded-lg px-3 py-2 text-body resize-none"
          style={{ fontFamily: fontCss(bloc.police) }}
        />

        <button
          onClick={onOuvrirPolices}
          className="w-full flex items-center justify-between glass rounded-lg px-3 py-2"
        >
          <span className="text-body" style={{ fontFamily: fontCss(bloc.police) }}>{bloc.police}</span>
          <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>Police ›</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>Taille</span>
          <button onClick={() => onChange({ taille: Math.max(8, bloc.taille - 2) })} className="w-8 h-8 rounded-full glass flex items-center justify-center"><Minus size={16} /></button>
          <span className="text-body-medium w-8 text-center">{bloc.taille}</span>
          <button onClick={() => onChange({ taille: Math.min(200, bloc.taille + 2) })} className="w-8 h-8 rounded-full glass flex items-center justify-center"><Plus size={16} /></button>

          <input type="color" value={bloc.couleur} onChange={(e) => onChange({ couleur: e.target.value })} className="w-9 h-9 rounded ml-auto" />
        </div>

        <div className="flex items-center gap-2">
          <IconToggle icon={Bold} active={bloc.gras} onClick={() => onChange({ gras: !bloc.gras })} />
          <IconToggle icon={Italic} active={bloc.italique} onClick={() => onChange({ italique: !bloc.italique })} />
          <IconToggle icon={Underline} active={bloc.souligne} onClick={() => onChange({ souligne: !bloc.souligne })} />
          <span className="w-px h-6" style={{ backgroundColor: 'var(--glass-border)' }} />
          <IconToggle icon={AlignLeft} active={bloc.alignement === 'left'} onClick={() => onChange({ alignement: 'left' })} />
          <IconToggle icon={AlignCenter} active={bloc.alignement === 'center'} onClick={() => onChange({ alignement: 'center' })} />
          <IconToggle icon={AlignRight} active={bloc.alignement === 'right'} onClick={() => onChange({ alignement: 'right' })} />
        </div>

        <div className="flex items-center gap-3">
          <Palette size={18} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>Fond du bloc</span>
          <input
            type="color"
            value={bloc.fond || '#ffffff'}
            onChange={(e) => onChange({ fond: e.target.value })}
            className="w-9 h-9 rounded"
          />
          <button onClick={() => onChange({ fond: null })} className="text-caption underline" style={{ color: 'var(--text-secondary)' }}>
            Aucun
          </button>
        </div>
      </div>
    </BarreAvecRetour>
  )
}

function IconToggle({ icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-lg flex items-center justify-center"
      style={{ backgroundColor: active ? '#3b82f6' : 'transparent', color: active ? '#fff' : 'var(--text-primary)' }}
    >
      <Icon size={17} />
    </button>
  )
}

// =======================================================================
// Panneau : sélection de police (grille façon capture de référence)
// =======================================================================
function PanneauPolice({ policeActuelle, onChoisir, onRetour }) {
  return (
    <div className="max-h-[70vh] flex flex-col">
      <div className="flex items-center gap-2 py-3 px-2" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
        <button onClick={onRetour} aria-label="Retour"><ChevronLeft size={22} /></button>
        <span className="text-body-medium">Sélectionnez la police</span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-3 overflow-auto">
        {POLICES.map((p) => (
          <button
            key={p}
            onClick={() => onChoisir(p)}
            className="rounded-lg px-2 py-3 text-center text-caption border"
            style={{
              fontFamily: fontCss(p),
              borderColor: p === policeActuelle ? '#3b82f6' : 'var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

// =======================================================================
// Panneau : édition d'un bloc photo (Position / Opacité / Recadrer /
// Cloner / Retourner x2) -- reproduit la barre de l'image 2.
// =======================================================================
function PanneauPhoto({ bloc, onChange, onRetour, onSupprimer, onDupliquer, onOuvrirPosition, onEntrerEditionImage }) {
  return (
    <BarreAvecRetour titre="Fonctionnalité" onRetour={onRetour}>
      <p className="text-caption text-center pt-2 px-4" style={{ color: 'var(--text-secondary)' }}>
        Astuce : double-touchez l'image sur le canvas pour zoomer/déplacer l'image dans son cadre.
      </p>
      <div className="grid grid-cols-4">
        <ToolButton icon={Move} label="Position" onClick={onOuvrirPosition} />
        <OpaciteButton bloc={bloc} onChange={onChange} />
        <ToolButton icon={ZoomIn} label="Zoomer l'image" onClick={onEntrerEditionImage} />
        <ToolButton icon={Copy} label="Cloner" onClick={onDupliquer} />
        <ToolButton icon={FlipHorizontal} label="Retourner" onClick={() => onChange({ rotationFlipH: !bloc.rotationFlipH })} />
        <ToolButton icon={FlipVertical} label="Retourner" onClick={() => onChange({ rotationFlipV: !bloc.rotationFlipV })} />
        <FormeButton bloc={bloc} onChange={onChange} />
        <ToolButton icon={X} label="Supprimer" onClick={onSupprimer} />
      </div>
    </BarreAvecRetour>
  )
}

function FormeButton({ bloc, onChange }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="relative">
      <ToolButton icon={Shapes} label="Forme" onClick={() => setOuvert((v) => !v)} />
      {ouvert && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 glass rounded-lg p-2 z-20 flex gap-2">
          {OPTIONS_MASQUE.map((opt) => (
            <button
              key={opt.valeur}
              onClick={() => { onChange({ masque: opt.valeur }); setOuvert(false) }}
              className="flex flex-col items-center gap-1 p-1 rounded-lg"
              style={{ backgroundColor: bloc.masque === opt.valeur ? 'var(--accent)' : 'transparent' }}
            >
              <svg width="28" height="28" viewBox="0 0 1 1" style={{ color: bloc.masque === opt.valeur ? '#fff' : 'var(--text-primary)' }}>
                {opt.valeur === 'rectangle' ? (
                  <rect x="0.05" y="0.05" width="0.9" height="0.9" fill="currentColor" />
                ) : (
                  <g fill="currentColor">{MASQUES_SVG[opt.valeur]}</g>
                )}
              </svg>
              <span className="text-caption" style={{ fontSize: '10px', color: bloc.masque === opt.valeur ? '#fff' : 'var(--text-secondary)' }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function OpaciteButton({ bloc, onChange }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="relative">
      <ToolButton icon={ArrowUpDown} label="Opacité" onClick={() => setOuvert((v) => !v)} />
      {ouvert && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 glass rounded-lg p-3 w-40 z-20">
          <input
            type="range" min="0" max="1" step="0.05"
            value={bloc.opacite}
            onChange={(e) => onChange({ opacite: Number(e.target.value) })}
            className="w-full"
          />
          <p className="text-caption text-center mt-1">{Math.round(bloc.opacite * 100)}%</p>
        </div>
      )}
    </div>
  )
}

// =======================================================================
// Panneau : Position (4 flèches + zoom -/+) -- reproduit l'image 3.
// Le +/- de l'onglet "Relatif" zoome/dézoome l'image À L'INTÉRIEUR du
// cadre fixe (même valeur imgScale que le pincer sur le canvas) -- le
// bloc/cadre lui-même ne change jamais de taille ici.
// =======================================================================
// =======================================================================
// Panneau : détourage (suppression de couleur d'arrière-plan, sans IA).
// L'utilisateur touche l'image pour choisir la couleur à rendre
// transparente, ajuste la tolérance, prévisualise, puis valide ou passe.
// =======================================================================
function PanneauDetourage({ fichierEnAttente, onValider, onPasser, onRetour }) {
  const imgRef = useRef(null)
  const [couleurCible, setCouleurCible] = useState(null) // [r,g,b]
  const [tolerance, setTolerance] = useState(30)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [traitement, setTraitement] = useState(false)

  const genererApercu = async (cible, tol) => {
    if (!cible) return
    setTraitement(true)
    try {
      const blob = await supprimerCouleurImage(fichierEnAttente.file, cible, tol)
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob) })
    } finally {
      setTraitement(false)
    }
  }

  const gererClicImage = (e) => {
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width) * 100
    const yPct = ((e.clientY - rect.top) / rect.height) * 100
    const cible = lireCouleurPixel(img, xPct, yPct)
    setCouleurCible(cible)
    genererApercu(cible, tolerance)
  }

  const changerTolerance = (val) => {
    setTolerance(val)
    if (couleurCible) genererApercu(couleurCible, val)
  }

  const validerAvecDetourage = async () => {
    if (!couleurCible) { onValider(null); return }
    const blob = await supprimerCouleurImage(fichierEnAttente.file, couleurCible, tolerance)
    onValider(blob)
  }

  return (
    <BarreAvecRetour titre="Enlever l'arrière-plan" onRetour={onRetour}>
      <div className="px-4 py-3 flex flex-col items-center gap-3">
        <p className="text-caption text-center" style={{ color: 'var(--text-secondary)' }}>
          Touche une couleur sur l'image pour la rendre transparente
        </p>

        <div className="relative w-full max-w-xs" style={{ aspectRatio: '1' }}>
          <img
            ref={imgRef}
            src={previewUrl || fichierEnAttente.previewUrl}
            onClick={gererClicImage}
            className="w-full h-full object-contain cursor-crosshair"
            style={{
              backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)',
              backgroundSize: '16px 16px',
            }}
            alt="Aperçu à détourer"
          />
          {traitement && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
              <span className="text-caption">Traitement…</span>
            </div>
          )}
        </div>

        {couleurCible && (
          <div className="w-full max-w-xs flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>Couleur choisie</span>
              <span
                className="w-5 h-5 rounded-full border"
                style={{ backgroundColor: `rgb(${couleurCible[0]},${couleurCible[1]},${couleurCible[2]})` }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-caption w-16" style={{ color: 'var(--text-secondary)' }}>Tolérance</span>
              <input
                type="range" min="0" max="150" value={tolerance}
                onChange={(e) => changerTolerance(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-caption w-8 text-right">{tolerance}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 w-full max-w-xs pt-2">
          <button
            onClick={onPasser}
            className="flex-1 glass rounded-lg py-2 text-body-medium"
          >
            Passer
          </button>
          <button
            onClick={validerAvecDetourage}
            disabled={!couleurCible || traitement}
            className="flex-1 rounded-lg py-2 text-body-medium text-white"
            style={{ backgroundColor: 'var(--accent)', opacity: !couleurCible || traitement ? 0.5 : 1 }}
          >
            Valider
          </button>
        </div>
      </div>
    </BarreAvecRetour>
  )
}

function PanneauPosition({ bloc, onChange, onRetour }) {
  const [etape, setEtape] = useState(10)
  const [onglet, setOnglet] = useState('manuel')

  const deplacer = (dx, dy) => {
    onChange({
      x: Math.max(0, Math.min(100 - bloc.width, bloc.x + dx * (etape / 10))),
      y: Math.max(0, Math.min(100 - bloc.height, bloc.y + dy * (etape / 10))),
    })
  }

  const zoomerImageX = (delta) => {
    if (bloc.type !== 'photo') return
    onChange({ imgScaleX: Math.max(0.1, Math.min(5, bloc.imgScaleX + delta)) })
  }

  const zoomerImageY = (delta) => {
    if (bloc.type !== 'photo') return
    onChange({ imgScaleY: Math.max(0.1, Math.min(5, bloc.imgScaleY + delta)) })
  }

  return (
    <BarreAvecRetour titre="Fonctionnalité" onRetour={onRetour}>
      <div className="px-2">
        <div className="flex gap-6 text-body-medium py-2 justify-center">
          {['manuel', 'relatif', 'tourner'].map((o) => (
            <button
              key={o}
              onClick={() => setOnglet(o)}
              className="capitalize pb-1"
              style={{ color: onglet === o ? '#3b82f6' : 'var(--text-primary)', borderBottom: onglet === o ? '2px solid #3b82f6' : 'none' }}
            >
              {o}
            </button>
          ))}
        </div>

        {onglet === 'manuel' && (
          <div className="flex items-center justify-center gap-6 py-4">
            <button onClick={() => deplacer(0, -1)} className="w-10 h-10 flex items-center justify-center glass rounded-full"><ArrowUp size={20} /></button>
            <button onClick={() => deplacer(-1, 0)} className="w-10 h-10 flex items-center justify-center glass rounded-full"><ArrowLeftIcon size={20} /></button>

            <div className="flex items-center gap-2">
              <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>Étape</span>
              <button onClick={() => setEtape((v) => Math.max(1, v - 1))} className="w-8 h-8 rounded-full glass flex items-center justify-center"><Minus size={14} /></button>
              <input
                type="number"
                value={etape}
                onChange={(e) => setEtape(Number(e.target.value) || 1)}
                className="w-14 text-center glass rounded-lg px-1 py-1 text-caption"
              />
              <button onClick={() => setEtape((v) => v + 1)} className="w-8 h-8 rounded-full glass flex items-center justify-center"><Plus size={14} /></button>
            </div>

            <button onClick={() => deplacer(1, 0)} className="w-10 h-10 flex items-center justify-center glass rounded-full"><ArrowRight size={20} /></button>
            <button onClick={() => deplacer(0, 1)} className="w-10 h-10 flex items-center justify-center glass rounded-full"><ArrowDown size={20} /></button>
          </div>
        )}

        {onglet === 'relatif' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex items-center justify-center gap-4">
              <span className="text-caption w-24 text-right" style={{ color: 'var(--text-secondary)' }}>Zoom horizontal</span>
              <button onClick={() => zoomerImageX(-0.2)} className="w-10 h-10 rounded-full glass flex items-center justify-center"><Minus size={18} /></button>
              <span className="text-body-medium w-14 text-center">{Math.round(bloc.imgScaleX * 100)}%</span>
              <button onClick={() => zoomerImageX(0.2)} className="w-10 h-10 rounded-full glass flex items-center justify-center"><Plus size={18} /></button>
            </div>
            <div className="flex items-center justify-center gap-4">
              <span className="text-caption w-24 text-right" style={{ color: 'var(--text-secondary)' }}>Zoom vertical</span>
              <button onClick={() => zoomerImageY(-0.2)} className="w-10 h-10 rounded-full glass flex items-center justify-center"><Minus size={18} /></button>
              <span className="text-body-medium w-14 text-center">{Math.round(bloc.imgScaleY * 100)}%</span>
              <button onClick={() => zoomerImageY(0.2)} className="w-10 h-10 rounded-full glass flex items-center justify-center"><Plus size={18} /></button>
            </div>
          </div>
        )}

        {onglet === 'tourner' && (
          <div className="flex items-center justify-center gap-4 py-4">
            <RotateCcw size={20} />
            <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>Rotation non disponible pour ce bloc</span>
          </div>
        )}
      </div>
    </BarreAvecRetour>
  )
}
