import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Check, Type, Smile, Shapes, Image as ImageIcon, Layers, Paintbrush } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// Écran d'édition -- calqué sur TexCap (image 3). Le canvas central prend
// le fond choisi à l'étape précédente (photo en 4:5, ou couleur pleine).
// Les 6 boutons de la barre "Fonctionnalité" sont volontairement sans
// logique pour l'instant (consigne explicite) -- seuls < et ✓ sont actifs.
export default function EditeurTemplateMobile() {
  const { categorie } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [saving, setSaving] = useState(false)

  const fondType = searchParams.get('fond_type') // 'couleur' | 'photo'
  const fondValeur = searchParams.get('fond_valeur') // couleur hex, ou URL photo

  const handleEnregistrer = async () => {
    setSaving(true)
    try {
      // 1) déterminer le prochain ordre dans CETTE catégorie uniquement
      const { data: existants, error: errOrdre } = await supabase
        .from('templates')
        .select('ordre')
        .eq('categorie', categorie)
        .order('ordre', { ascending: false })
        .limit(1)
      if (errOrdre) throw errOrdre
      const prochainOrdre = (existants?.[0]?.ordre ?? -1) + 1

      // 2) insérer le template -- categorie verrouillée depuis l'URL dès
      // l'entrée dans le flux, jamais redemandée ici. Le fond choisi est
      // stocké directement sur templates (background_type/background_valeur),
      // pas détourné via template_layers. image_url (thumbnail) renseignée
      // après génération (étape 3).
      const { data: inserted, error: errInsert } = await supabase
        .from('templates')
        .insert({
          categorie,
          ordre: prochainOrdre,
          background_type: fondType,
          background_valeur: fondValeur,
        })
        .select('id')
        .single()
      if (errInsert) throw errInsert

      // 3) générer la thumbnail à partir du fond. Photo -> on réutilise
      // directement l'URL déjà uploadée. Couleur -> rendu canvas uni.
      let imageUrl = fondType === 'photo' ? fondValeur : null
      if (fondType === 'couleur') {
        const canvas = document.createElement('canvas')
        canvas.width = 1080
        canvas.height = 1350
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = fondValeur || '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        const path = `${categorie}/${inserted.id}.png`
        const { error: errUpload } = await supabase.storage
          .from('template-thumbnails')
          .upload(path, blob, { upsert: true, contentType: 'image/png' })
        if (errUpload) throw errUpload
        const { data: pub } = supabase.storage.from('template-thumbnails').getPublicUrl(path)
        imageUrl = pub.publicUrl
      }

      // 4) mettre à jour image_url sur le template créé
      const { error: errUpdate } = await supabase
        .from('templates')
        .update({ image_url: imageUrl })
        .eq('id', inserted.id)
      if (errUpdate) throw errUpdate

      navigate(`/admin/souvenirs/templates/${categorie}`)
    } catch (err) {
      console.error('Erreur enregistrement template', err)
      alert("Erreur lors de l'enregistrement du template.")
    } finally {
      setSaving(false)
    }
  }

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

      <div className="flex-1 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div
          className="w-full max-w-sm"
          style={{
            aspectRatio: '4 / 5',
            backgroundColor: fondType === 'couleur' ? fondValeur : '#e0e0e0',
            backgroundImage: fondType === 'photo' && fondValeur ? `url(${fondValeur})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>

      <div className="shrink-0">
        <div
          className="text-center py-2 text-body-medium"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          Fonctionnalité
        </div>
        <div className="grid grid-cols-4">
          <ToolButton icon={Type} label="Ajouter du te…" />
          <ToolButton icon={Smile} label="Autocollant" />
          <ToolButton icon={Shapes} label="Forme" />
          <ToolButton icon={ImageIcon} label="Photo" />
          <ToolButton icon={Layers} label="Arrière-plan" />
          <ToolButton icon={Paintbrush} label="Dessiner à la…" />
        </div>
      </div>
    </div>
  )
}

// Boutons sans route/logique pour l'instant -- consigne explicite.
function ToolButton({ icon: Icon, label }) {
  return (
    <button className="flex flex-col items-center gap-1.5 py-3">
      <Icon size={22} style={{ color: 'var(--text-primary)' }} />
      <span className="text-caption truncate px-1" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </button>
  )
}
