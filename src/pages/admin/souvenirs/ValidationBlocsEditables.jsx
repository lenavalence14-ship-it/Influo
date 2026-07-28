import { useState, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, Check, Lock, Unlock } from 'lucide-react'
import html2canvas from 'html2canvas'
import { supabase } from '../../../lib/supabase'

// fontCss/MASQUES_SVG dupliqués depuis EditeurTemplateMobile.jsx : ce rendu
// doit être PIXEL-IDENTIQUE à celui de l'éditeur, sinon la vignette générée
// ici ne correspond plus à ce que l'admin a réellement construit (police,
// zoom/position de la photo dans son cadre, masque de découpe).
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

// ---------------------------------------------------------------------
// Étape intermédiaire entre l'édition d'un template et son enregistrement
// réel en base. L'admin tape sur chaque bloc pour décider s'il sera
// modifiable par l'utilisateur final (editable: true) ou figé
// (editable: false). Le clic sur "OK" fait l'enregistrement définitif,
// toujours dans la catégorie depuis laquelle "Ajouter un template" a été
// lancé (categorie vient de l'URL, jamais d'un choix libre ici).
// ---------------------------------------------------------------------

export default function ValidationBlocsEditables() {
  const { categorie } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [saving, setSaving] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const canvasRef = useRef(null)

  const etat = location.state || {}
  const fondType = etat.fondType
  const fondValeur = etat.fondValeur
  const templateId = etat.templateId // présent = on modifie un template existant (update), sinon création (insert)

  // Par défaut aucun bloc n'est éditable : l'admin doit choisir
  // explicitement ce que l'utilisateur pourra changer.
  const [blocs, setBlocs] = useState(
    (etat.blocs || []).map((b) => ({ ...b, editable: b.editable ?? false }))
  )

  // Si on arrive sur cet écran sans état (rechargement de page direct sur
  // l'URL, lien partagé, etc.), il n'y a rien à valider : on renvoie vers
  // l'éditeur pour repartir d'un état propre plutôt que de planter.
  if (!etat.blocs) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] gap-4 px-6 text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <p className="text-body">Aucun brouillon de template à valider.</p>
        <button
          onClick={() => navigate(`/admin/souvenirs/templates/${categorie}/editeur`)}
          className="px-4 py-2 rounded-full text-body-medium"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          Retour à l'éditeur
        </button>
      </div>
    )
  }

  const toggleEditable = (id) => {
    setBlocs((bs) => bs.map((b) => (b.id === id ? { ...b, editable: !b.editable } : b)))
  }

  // -------------------- Enregistrement réel en base --------------------
  const handleValider = async () => {
    setSaving(true)
    try {
      let templateRowId = templateId

      if (!templateRowId) {
        // Mode création : nouveau template, on lui attribue le prochain ordre
        // de la catégorie.
        const { data: existants, error: errOrdre } = await supabase
          .from('templates').select('ordre').eq('categorie', categorie)
          .order('ordre', { ascending: false }).limit(1)
        if (errOrdre) throw errOrdre
        const prochainOrdre = (existants?.[0]?.ordre ?? -1) + 1

        const { data: inserted, error: errInsert } = await supabase
          .from('templates')
          .insert({
            categorie,
            ordre: prochainOrdre,
            background_type: fondType,
            background_valeur: fondValeur,
            blocs, // inclut le flag editable par bloc
          })
          .select('id').single()
        if (errInsert) throw errInsert
        templateRowId = inserted.id
      } else {
        // Mode édition : on écrase le template existant, sans toucher à
        // son ordre ni en créer une copie.
        const { error: errUpdate } = await supabase
          .from('templates')
          .update({
            background_type: fondType,
            background_valeur: fondValeur,
            blocs,
          })
          .eq('id', templateRowId)
        if (errUpdate) throw errUpdate
      }

      // -------------------- Génération de la vraie vignette --------------------
      // On capture le canvas tel qu'affiché à l'écran (fond + tous les blocs,
      // avec leur zoom/position/police réels), et non plus juste le fond seul.
      // C'est ce screenshot qui devient l'image_url, dans tous les cas (fond
      // photo ou couleur) : avant ce correctif, un fond "couleur" recevait un
      // vrai rendu mais un fond "photo" gardait la photo brute sans les blocs.
      setCapturing(true)
      await new Promise((r) => requestAnimationFrame(r)) // laisser le DOM se repeindre sans les outlines
      const canvasEl = canvasRef.current
      const rendu = await html2canvas(canvasEl, {
        useCORS: true,
        backgroundColor: null,
        scale: 1080 / canvasEl.offsetWidth,
      })
      setCapturing(false)

      const blob = await new Promise((resolve) => rendu.toBlob(resolve, 'image/png'))
      const path = `${categorie}/${templateRowId}.png`
      const { error: errUpload } = await supabase.storage.from('templates').upload(path, blob, { upsert: true, contentType: 'image/png' })
      if (errUpload) throw errUpload
      const { data: pub } = supabase.storage.from('templates').getPublicUrl(path)
      const imageUrl = pub.publicUrl

      const { error: errUpdateImage } = await supabase.from('templates').update({ image_url: imageUrl }).eq('id', templateRowId)
      if (errUpdateImage) throw errUpdateImage

      // Toujours retour vers LA catégorie d'origine, jamais ailleurs.
      navigate(`/admin/souvenirs/templates/${categorie}`)
    } catch (err) {
      console.error('Erreur enregistrement template', err)
      alert(err?.message || JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }

  const nbEditables = blocs.filter((b) => b.editable).length

  return (
    <div className="flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', height: '100dvh' }}>
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{ backgroundColor: 'var(--accent)', height: '64px', color: '#fff' }}
      >
        <button onClick={() => navigate(-1)} aria-label="Retour" className="flex items-center justify-center">
          <ChevronLeft size={26} />
        </button>
        <span className="text-body-medium">Blocs modifiables</span>
        <button onClick={handleValider} disabled={saving} aria-label="Valider" className="flex items-center justify-center">
          <Check size={24} />
        </button>
      </header>

      <p className="text-caption text-center px-6 py-3 shrink-0" style={{ color: 'var(--text-secondary)' }}>
        Touche les blocs que l'utilisateur pourra modifier. Les autres resteront figés.
      </p>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div
          ref={canvasRef}
          className="relative w-full max-w-sm overflow-hidden"
          style={{
            aspectRatio: '2 / 3',
            backgroundColor: fondType === 'couleur' ? fondValeur : '#e0e0e0',
            backgroundImage: fondType === 'photo' && fondValeur ? `url(${fondValeur})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {blocs.map((bloc) => (
            <BlocValidation key={bloc.id} bloc={bloc} capturing={capturing} onToggle={() => toggleEditable(bloc.id)} />
          ))}
        </div>
      </div>

      <div className="shrink-0 px-6 pb-6 pt-2 text-center">
        <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
          {nbEditables === 0
            ? 'Aucun bloc éditable pour le moment.'
            : `${nbEditables} bloc${nbEditables > 1 ? 's' : ''} éditable${nbEditables > 1 ? 's' : ''} par l'utilisateur.`}
        </p>
      </div>
    </div>
  )
}

// Rendu d'un bloc pour cet écran : identique au rendu réel de l'éditeur
// (police, zoom/position photo, masque de découpe), + un état visuel
// éditable/figé au tap qui est masqué pendant la capture de la vignette
// pour ne pas polluer l'image enregistrée.
function BlocValidation({ bloc, capturing, onToggle }) {
  const style = {
    position: 'absolute',
    left: `${bloc.x}%`, top: `${bloc.y}%`,
    width: `${bloc.width}%`, height: `${bloc.height}%`,
    outline: capturing ? 'none' : bloc.editable ? '3px solid #22c55e' : '2px dashed rgba(0,0,0,0.25)',
    cursor: 'pointer',
  }

  return (
    <div style={style} onClick={onToggle}>
      {bloc.type === 'texte' && (
        <div
          className="w-full h-full flex overflow-hidden px-1 pointer-events-none"
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

      {!capturing && (
        <div
          className="absolute flex items-center justify-center rounded-full"
          style={{
            top: -10, right: -10, width: 24, height: 24,
            backgroundColor: bloc.editable ? '#22c55e' : 'rgba(0,0,0,0.4)',
            color: '#fff',
          }}
        >
          {bloc.editable ? <Unlock size={13} /> : <Lock size={13} />}
        </div>
      )}
    </div>
  )
}
