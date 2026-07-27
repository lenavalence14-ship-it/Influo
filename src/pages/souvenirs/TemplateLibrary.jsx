import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Bibliothèque de templates (grille de vignettes façon Canva) pour une
// catégorie donnée (slug lu depuis l'URL, ex: 'bonne-fete-nouvelle-annee').
// La vignette cliquée EST le template final tel quel pour l'instant --
// l'édition (changer texte/photos) sera construite dans une étape
// ultérieure, pas ici. En attendant cette édition, cliquer ouvre juste un
// aperçu plein écran du visuel choisi.
async function fetchTemplates(categorie) {
  const { data, error } = await supabase
    .from('templates')
    .select('id, image_url, ordre')
    .eq('categorie', categorie)
    .order('ordre', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export default function TemplateLibrary() {
  const { categorie } = useParams()
  const navigate = useNavigate()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', categorie],
    queryFn: () => fetchTemplates(categorie),
    enabled: Boolean(categorie),
  })

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="w-9 h-9 rounded-full flex items-center justify-center glass"
          style={{ color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-display" style={{ color: 'var(--text-primary)', fontSize: '18px' }}>
          Choisissez un modèle
        </h1>
      </header>

      {isLoading && (
        <div className="px-4 pt-10 text-center text-body" style={{ color: 'var(--text-secondary)' }}>
          Chargement…
        </div>
      )}

      {!isLoading && templates.length === 0 && (
        <div className="px-4 pt-10 text-center text-body" style={{ color: 'var(--text-secondary)' }}>
          Aucun modèle disponible pour l'instant. Revenez bientôt !
        </div>
      )}

      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/souvenirs/apercu/${t.id}`)}
            className="glass rounded-2xl overflow-hidden aspect-[3/4] active:scale-[0.97] transition-transform duration-150"
          >
            <img src={t.image_url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
