import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Aperçu plein écran d'un template choisi dans la bibliothèque. Pas
// d'édition ici -- étape volontairement pas construite (viendra plus tard :
// modifier texte/photos sur ce visuel).
async function fetchTemplate(id) {
  const { data, error } = await supabase.from('templates').select('id, image_url').eq('id', id).single()
  if (error) throw error
  return data
}

export default function TemplatePreview() {
  const { templateId } = useParams()
  const navigate = useNavigate()

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => fetchTemplate(templateId),
    enabled: Boolean(templateId),
  })

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
      </header>

      <div className="flex-1 flex items-center justify-center px-4 pb-6">
        {isLoading && <span className="text-white/60 text-body">Chargement…</span>}
        {template && (
          <img src={template.image_url} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
        )}
      </div>
    </div>
  )
}
