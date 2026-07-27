import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// Écran de publication d'un appel d'offre par un client : texte uniquement,
// pas de média -- symétrique à l'écran "Publier du texte" des influenceurs
// (CreatePost.jsx, step 'texte_post'), mais insère dans appels_offre (table
// séparée) plutôt que dans posts, puisque l'auteur est un profils_client et
// non un profils_influenceur.
export default function PublierOffre() {
  const { clientProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [contenu, setContenu] = useState('')
  const [loading, setLoading] = useState(false)
  const [publishError, setPublishError] = useState(null)

  const handlePublish = async () => {
    if (!contenu.trim() || !clientProfile?.id) return
    setLoading(true)
    setPublishError(null)

    const { error } = await supabase.from('appels_offre').insert({
      client_id: clientProfile.id,
      contenu: contenu.trim(),
    })

    setLoading(false)
    if (error) {
      setPublishError(error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['feed'] })
    navigate('/')
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-4 pt-3 pb-2 h-14 shrink-0">
        <button onClick={() => navigate(-1)} aria-label="Fermer" className="w-9 h-9 flex items-center justify-center">
          <X size={22} />
        </button>
        <span className="text-body-medium">Appel d'offre</span>
        <button
          onClick={handlePublish}
          disabled={loading || !contenu.trim()}
          className="text-body-medium px-2 py-2 disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
        >
          {loading ? 'Publication…' : 'Publier'}
        </button>
      </header>

      <div className="flex-1 px-4 pt-4">
        <textarea
          autoFocus
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder="Décris ton appel d'offre…"
          className="w-full h-full bg-transparent text-[16px] leading-[22px] text-white placeholder-white/30 resize-none outline-none"
        />
      </div>

      {publishError && (
        <div className="px-4 pb-4 text-caption text-red-400">{publishError}</div>
      )}
    </div>
  )
}
