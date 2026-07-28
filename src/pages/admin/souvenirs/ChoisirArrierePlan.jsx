import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Image as ImageIcon, Palette } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// Écran "Choisir l'arrière-plan" -- calqué sur TexCap. Deux options
// seulement (Galerie d'images, Couleurs) ; les options "Couleurs dégradées"
// et "Images artistiques" vues dans l'app de référence ne sont pas
// reprises ici, sur consigne explicite.
export default function ChoisirArrierePlan() {
  const { categorie } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleFichierChoisi = async (e) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setUploading(true)
    try {
      const chemin = `${categorie}/fond_${Date.now()}_${fichier.name}`
      const { error } = await supabase.storage
        .from('templates')
        .upload(chemin, fichier, { upsert: true, contentType: fichier.type })
      if (error) throw error
      const { data: pub } = supabase.storage.from('templates').getPublicUrl(chemin)
      navigate(`/admin/souvenirs/templates/${categorie}/editeur?fond_type=photo&fond_valeur=${encodeURIComponent(pub.publicUrl)}`)
    } catch (err) {
      console.error('Erreur upload image de fond', err)
      alert("Erreur lors de l'import de l'image.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header
        className="flex items-center gap-4 px-4"
        style={{ backgroundColor: 'var(--accent)', height: '96px', color: '#fff' }}
      >
        <button onClick={() => navigate(-1)} aria-label="Retour" className="flex items-center justify-center">
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-body-medium" style={{ fontSize: '17px', color: '#fff' }}>
          Choisir l'arrière-plan
        </h1>
      </header>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFichierChoisi}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center gap-4 px-4 py-4 border-b"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          <ImageIcon size={22} style={{ color: 'var(--text-primary)' }} />
          <span className="text-body" style={{ color: 'var(--text-primary)' }}>
            {uploading ? 'Import…' : "Galerie d'images"}
          </span>
        </button>

        <button
          onClick={() => navigate(`/admin/souvenirs/templates/${categorie}/couleurs`)}
          className="w-full flex items-center gap-4 px-4 py-4 border-b"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          <Palette size={22} style={{ color: 'var(--text-primary)' }} />
          <span className="text-body" style={{ color: 'var(--text-primary)' }}>Couleurs</span>
        </button>
      </div>
    </div>
  )
}
