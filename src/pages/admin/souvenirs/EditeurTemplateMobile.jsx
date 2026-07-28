import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, Check, Type, Shapes, Image as ImageIcon, Layers,
  X, ArrowUpDown, RotateCcw, Move, Copy, Crop, FlipHorizontal, FlipVertical,
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
    // recadrage : rectangle en % relatif à l'image elle-même (0-100)
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
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
  const [panneau, setPanneau] = useState(null) // 'texte' | 'photo' | 'photo_source' | 'police' | 'recadrer' | 'position' | null
  const canvasRef = useRef(null)
  const modeRecadrage = panneau === 'recadrer'

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

  const handleFichierChoisi = async (e) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    try {
      const chemin = `${categorie}/bloc_${Date.now()}_${fichier.name}`
      const { error } = await supabase.storage.from('templates').upload(chemin, fichier, { upsert: true, contentType: fichier.type })
      if (error) throw error
      const { data: pub } = supabase.storage.from('templates').getPublicUrl(chemin)
      const bloc = nouveauBlocPhoto('photo', pub.publicUrl)
      setBlocs((bs) => [...bs, bloc])
      setSelectedId(bloc.id)
      setPanneau('photo')
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

  // -------------------- Recadrage (drag des bords sur le canvas) --------------------
  const cropDragState = useRef(null)
  const startCropDrag = (e, bloc, cote) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    cropDragState.current = {
      id: bloc.id, cote, startX: point.clientX, startY: point.clientY,
      orig: { ...bloc.crop }, blocWpx: (bloc.width / 100) * rect.width, blocHpx: (bloc.height / 100) * rect.height,
    }
    window.addEventListener('mousemove', onCropMove)
    window.addEventListener('mouseup', onCropEnd)
    window.addEventListener('touchmove', onCropMove, { passive: false })
    window.addEventListener('touchend', onCropEnd)
  }

  const onCropMove = (e) => {
    if (!cropDragState.current) return
    e.preventDefault?.()
    const { id, cote, startX, startY, orig, blocWpx, blocHpx } = cropDragState.current
    const point = e.touches ? e.touches[0] : e
    const dxPct = ((point.clientX - startX) / blocWpx) * 100
    const dyPct = ((point.clientY - startY) / blocHpx) * 100
    const crop = { ...orig }
    if (cote === 'left') crop.left = Math.max(0, Math.min(85, orig.left + dxPct))
    if (cote === 'right') crop.right = Math.max(0, Math.min(85, orig.right - dxPct))
    if (cote === 'top') crop.top = Math.max(0, Math.min(85, orig.top + dyPct))
    if (cote === 'bottom') crop.bottom = Math.max(0, Math.min(85, orig.bottom - dyPct))
    updateBloc(id, { crop })
  }

  const onCropEnd = () => {
    cropDragState.current = null
    window.removeEventListener('mousemove', onCropMove)
    window.removeEventListener('mouseup', onCropEnd)
    window.removeEventListener('touchmove', onCropMove)
    window.removeEventListener('touchend', onCropEnd)
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
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
          className="relative w-full max-w-sm"
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
              modeRecadrage={modeRecadrage && bloc.id === selectedId}
              onSelect={(e) => { e.stopPropagation(); if (modeRecadrage) return; setSelectedId(bloc.id); setPanneau(bloc.type === 'texte' ? 'texte' : 'photo') }}
              onDragStart={(e) => { if (modeRecadrage) return; startDrag(e, bloc) }}
              onResizeStart={(e, handle) => startResize(e, bloc, handle)}
              onCropDrag={(e, cote) => startCropDrag(e, bloc, cote)}
            />
          ))}
        </div>
      </div>

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
            onOuvrirRecadrer={() => setPanneau('recadrer')}
          />
        )}

        {panneau === 'position' && selected && (
          <PanneauPosition
            bloc={selected}
            onChange={(patch) => updateBloc(selected.id, patch)}
            onRetour={() => setPanneau('photo')}
          />
        )}

        {panneau === 'recadrer' && selected && (
          <PanneauRecadrer
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
function BlocRendu({ bloc, selected, modeRecadrage, onSelect, onDragStart, onResizeStart, onCropDrag }) {
  const style = {
    position: 'absolute',
    left: `${bloc.x}%`, top: `${bloc.y}%`,
    width: `${bloc.width}%`, height: `${bloc.height}%`,
    outline: selected ? '2px solid #3b82f6' : 'none',
    cursor: modeRecadrage ? 'default' : 'move',
    touchAction: 'none',
  }

  return (
    <div style={style} onMouseDown={onDragStart} onTouchStart={onDragStart} onClick={onSelect}>
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
            alignItems: 'center',
            textAlign: bloc.alignement,
            fontSize: `${Math.max(6, bloc.height * 0.4)}cqh`,
            lineHeight: 1.1,
            containerType: 'size',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          <span style={{ width: '100%' }}>{bloc.contenu || ' '}</span>
        </div>
      )}

      {bloc.type === 'photo' && (
        <div
          className="w-full h-full overflow-hidden relative"
          style={{ opacity: bloc.opacite }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: bloc.imageType === 'couleur' ? bloc.imageValeur : undefined,
              backgroundImage: bloc.imageType === 'photo' ? `url(${bloc.imageValeur})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: `scaleX(${bloc.rotationFlipH ? -1 : 1}) scaleY(${bloc.rotationFlipV ? -1 : 1})`,
              clipPath: `inset(${bloc.crop.top}% ${bloc.crop.right}% ${bloc.crop.bottom}% ${bloc.crop.left}%)`,
            }}
          />
        </div>
      )}

      {selected && !modeRecadrage && (
        <>
          {['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map((h) => (
            <PoigneeResize key={h} handle={h} onStart={(e) => onResizeStart(e, h)} />
          ))}
        </>
      )}

      {modeRecadrage && bloc.type === 'photo' && (
        <>
          {/* Cadre de recadrage visible + 4 poignées de bord glissables */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: `${bloc.crop.top}%`, left: `${bloc.crop.left}%`,
              right: `${bloc.crop.right}%`, bottom: `${bloc.crop.bottom}%`,
              border: '2px dashed #fff', boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)',
            }}
          />
          <BarreCrop cote="top" bloc={bloc} onCropDrag={onCropDrag} />
          <BarreCrop cote="bottom" bloc={bloc} onCropDrag={onCropDrag} />
          <BarreCrop cote="left" bloc={bloc} onCropDrag={onCropDrag} />
          <BarreCrop cote="right" bloc={bloc} onCropDrag={onCropDrag} />
        </>
      )}
    </div>
  )
}

function BarreCrop({ cote, bloc, onCropDrag }) {
  const commun = { position: 'absolute', touchAction: 'none', zIndex: 20 }
  const style = {
    top: { ...commun, top: `${bloc.crop.top}%`, left: `${bloc.crop.left}%`, right: `${bloc.crop.right}%`, height: 14, marginTop: -7, cursor: 'ns-resize' },
    bottom: { ...commun, bottom: `${bloc.crop.bottom}%`, left: `${bloc.crop.left}%`, right: `${bloc.crop.right}%`, height: 14, marginBottom: -7, cursor: 'ns-resize' },
    left: { ...commun, left: `${bloc.crop.left}%`, top: `${bloc.crop.top}%`, bottom: `${bloc.crop.bottom}%`, width: 14, marginLeft: -7, cursor: 'ew-resize' },
    right: { ...commun, right: `${bloc.crop.right}%`, top: `${bloc.crop.top}%`, bottom: `${bloc.crop.bottom}%`, width: 14, marginRight: -7, cursor: 'ew-resize' },
  }[cote]

  return (
    <div
      style={style}
      onMouseDown={(e) => onCropDrag(e, cote)}
      onTouchStart={(e) => onCropDrag(e, cote)}
      className="bg-white/70 rounded"
    />
  )
}

function PoigneeResize({ handle, onStart }) {
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
      style={{ ...pos, position: 'absolute', borderColor: '#3b82f6', touchAction: 'none', zIndex: 10 }}
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
function PanneauPhoto({ bloc, onChange, onRetour, onSupprimer, onDupliquer, onOuvrirPosition, onOuvrirRecadrer }) {
  return (
    <BarreAvecRetour titre="Fonctionnalité" onRetour={onRetour}>
      <div className="grid grid-cols-4">
        <ToolButton icon={Move} label="Position" onClick={onOuvrirPosition} />
        <OpaciteButton bloc={bloc} onChange={onChange} />
        <ToolButton icon={Crop} label="Recadrer" onClick={onOuvrirRecadrer} />
        <ToolButton icon={Copy} label="Cloner" onClick={onDupliquer} />
        <ToolButton icon={FlipHorizontal} label="Retourner" onClick={() => onChange({ rotationFlipH: !bloc.rotationFlipH })} />
        <ToolButton icon={FlipVertical} label="Retourner" onClick={() => onChange({ rotationFlipV: !bloc.rotationFlipV })} />
        <ToolButton icon={X} label="Supprimer" onClick={onSupprimer} />
      </div>
    </BarreAvecRetour>
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
// =======================================================================
function PanneauPosition({ bloc, onChange, onRetour }) {
  const [etape, setEtape] = useState(10)
  const [onglet, setOnglet] = useState('manuel')

  const deplacer = (dx, dy) => {
    onChange({
      x: Math.max(0, Math.min(100 - bloc.width, bloc.x + dx * (etape / 10))),
      y: Math.max(0, Math.min(100 - bloc.height, bloc.y + dy * (etape / 10))),
    })
  }

  const zoom = (delta) => {
    const facteur = 1 + delta / 100
    const newW = Math.max(5, bloc.width * facteur)
    const newH = Math.max(5, bloc.height * facteur)
    onChange({
      width: newW, height: newH,
      x: bloc.x - (newW - bloc.width) / 2,
      y: bloc.y - (newH - bloc.height) / 2,
    })
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
          <div className="flex items-center justify-center gap-4 py-4">
            <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>Taille</span>
            <button onClick={() => zoom(-10)} className="w-10 h-10 rounded-full glass flex items-center justify-center"><Minus size={18} /></button>
            <span className="text-body-medium w-14 text-center">{Math.round(bloc.width)}%</span>
            <button onClick={() => zoom(10)} className="w-10 h-10 rounded-full glass flex items-center justify-center"><Plus size={18} /></button>
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

// =======================================================================
// Panneau : Recadrage manuel. Les poignées actives sont affichées
// directement sur le canvas (voir BarreCrop dans BlocRendu) ; ce panneau
// ne sert que d'instruction + bouton reset.
// =======================================================================
function PanneauRecadrer({ bloc, onChange, onRetour }) {
  return (
    <BarreAvecRetour titre="Recadrer" onRetour={onRetour}>
      <p className="text-caption text-center py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
        Glissez les bords en surbrillance directement sur l'image pour la recadrer.
      </p>
      <div className="pb-3 flex justify-center">
        <button
          onClick={() => onChange({ crop: { top: 0, right: 0, bottom: 0, left: 0 } })}
          className="text-caption underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          Réinitialiser le recadrage
        </button>
      </div>
    </BarreAvecRetour>
  )
}
