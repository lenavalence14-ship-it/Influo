import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, Check, Lock, Unlock } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

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

      let imageUrl = fondType === 'photo' ? fondValeur : null
      if (fondType === 'couleur') {
        const canvas = document.createElement('canvas')
        canvas.width = 1080; canvas.height = 1620
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = fondValeur || '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        const path = `${categorie}/${templateRowId}.png`
        const { error: errUpload } = await supabase.storage.from('templates').upload(path, blob, { upsert: true, contentType: 'image/png' })
        if (errUpload) throw errUpload
        const { data: pub } = supabase.storage.from('templates').getPublicUrl(path)
        imageUrl = pub.publicUrl
      }

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
            <BlocValidation key={bloc.id} bloc={bloc} onToggle={() => toggleEditable(bloc.id)} />
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

// Rendu simplifié d'un bloc pour cet écran : pas de drag/resize, juste le
// contenu tel qu'édité + un état visuel éditable/figé au tap.
function BlocValidation({ bloc, onToggle }) {
  const style = {
    position: 'absolute',
    left: `${bloc.x}%`, top: `${bloc.y}%`,
    width: `${bloc.width}%`, height: `${bloc.height}%`,
    outline: bloc.editable ? '3px solid #22c55e' : '2px dashed rgba(0,0,0,0.25)',
    cursor: 'pointer',
  }

  return (
    <div style={style} onClick={onToggle}>
      {bloc.type === 'texte' && (
        <div
          className="w-full h-full flex overflow-hidden px-1 pointer-events-none"
          style={{
            fontWeight: bloc.gras ? 'bold' : 'normal',
            fontStyle: bloc.italique ? 'italic' : 'normal',
            textDecoration: bloc.souligne ? 'underline' : 'none',
            color: bloc.couleur,
            backgroundColor: bloc.fond || 'transparent',
            justifyContent: bloc.alignement === 'left' ? 'flex-start' : bloc.alignement === 'right' ? 'flex-end' : 'center',
            textAlign: bloc.alignement,
            fontSize: `${bloc.taille}px`,
            lineHeight: 1.25,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          <span style={{ width: '100%' }}>{bloc.contenu || ' '}</span>
        </div>
      )}

      {bloc.type === 'photo' && (
        <div
          className="w-full h-full pointer-events-none"
          style={{
            backgroundColor: bloc.imageType === 'couleur' ? bloc.imageValeur : undefined,
            backgroundImage: bloc.imageType === 'photo' ? `url(${bloc.imageValeur})` : undefined,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: bloc.opacite,
          }}
        />
      )}

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
    </div>
  )
}
