import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { X, Check, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { OFFER_COLOR_PALETTE, getContrastTextColor } from '../../lib/offerColors'

// Écran de publication ET de modification d'un appel d'offre par un client :
// texte uniquement, pas de média -- symétrique à l'écran "Publier du texte"
// des influenceurs (CreatePost.jsx, step 'texte_post'), mais insère/update
// dans appels_offre (table séparée) plutôt que dans posts, puisque l'auteur
// est un profils_client et non un profils_influenceur. Le mode édition
// (route /publier-offre/:offerId/modifier) reprend le même pattern que
// CreatePost pour /publier/:postId/modifier.
//
// Deux étapes : 'texte' (contenu de l'offre) puis 'couleur' (choix du
// bandeau, adapté à la palette de marque du client -- null = var(--accent)
// par défaut). La publication/l'enregistrement réel se fait à la fin de
// l'étape couleur, pas à la fin de l'étape texte.
export default function PublierOffre() {
  const { clientProfile } = useAuth()
  const { offerId } = useParams()
  const isEditing = Boolean(offerId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState('texte') // 'texte' | 'couleur'
  const [contenu, setContenu] = useState('')
  const [couleur, setCouleur] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingOffer, setLoadingOffer] = useState(isEditing)
  const [publishError, setPublishError] = useState(null)

  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('appels_offre')
      .select('id, contenu, couleur, client_id')
      .eq('id', offerId)
      .single()
      .then(({ data, error }) => {
        if (error || !data || data.client_id !== clientProfile?.id) {
          // pas trouvé ou pas propriétaire : retour au feed plutôt que de
          // laisser un écran vide/incohérent
          navigate('/')
          return
        }
        setContenu(data.contenu)
        setCouleur(data.couleur || null)
        setLoadingOffer(false)
      })
  }, [isEditing, offerId, clientProfile?.id, navigate])

  const handlePublish = async () => {
    if (!contenu.trim() || !clientProfile?.id) return
    setLoading(true)
    setPublishError(null)

    const { error } = isEditing
      ? await supabase.from('appels_offre').update({ contenu: contenu.trim(), couleur }).eq('id', offerId)
      : await supabase.from('appels_offre').insert({ client_id: clientProfile.id, contenu: contenu.trim(), couleur })

    setLoading(false)
    if (error) {
      setPublishError(error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['feed'] })
    navigate('/')
  }

  if (loadingOffer) {
    return <div className="fixed inset-0 z-[100] bg-black" />
  }

  if (step === 'couleur') {
    const previewBg = couleur || 'var(--accent)'
    const previewText = couleur ? getContrastTextColor(couleur) : '#ffffff'

    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
        <header className="flex items-center justify-between px-4 pt-3 pb-2 h-14 shrink-0">
          <button onClick={() => setStep('texte')} aria-label="Retour" className="w-9 h-9 flex items-center justify-center">
            <ArrowLeft size={22} />
          </button>
          <span className="text-body-medium">Couleur du bandeau</span>
          <button
            onClick={handlePublish}
            disabled={loading}
            className="text-body-medium px-2 py-2 disabled:opacity-40"
            style={{ color: 'var(--accent)' }}
          >
            {loading ? '…' : isEditing ? 'Enregistrer' : 'Publier'}
          </button>
        </header>

        <div className="flex-1 px-4 pt-2 overflow-y-auto">
          <p className="text-body text-[var(--text-secondary)] mb-4">
            Choisissez la couleur du bandeau adaptée à votre couleur principale.
          </p>

          {/* aperçu en direct de la bande telle qu'elle apparaîtra dans le feed */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg mb-6"
            style={{ backgroundColor: previewBg, color: previewText }}
          >
            <span className="text-[13px] leading-[16px] font-medium">Votre entreprise</span>
            <span className="text-[13px] leading-[16px] font-medium">Appel d'offre</span>
          </div>

          <div className="grid grid-cols-7 gap-3 pb-8">
            <button
              onClick={() => setCouleur(null)}
              aria-label="Couleur par défaut de l'application"
              className="aspect-square rounded-full flex items-center justify-center border-2"
              style={{
                backgroundColor: 'var(--accent)',
                borderColor: couleur === null ? '#ffffff' : 'transparent',
              }}
            >
              {couleur === null && <Check size={16} color={getContrastTextColor('#000000')} />}
            </button>
            {OFFER_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setCouleur(c)}
                aria-label={`Couleur ${c}`}
                className="aspect-square rounded-full flex items-center justify-center border-2"
                style={{ backgroundColor: c, borderColor: couleur === c ? '#ffffff' : 'transparent' }}
              >
                {couleur === c && <Check size={16} color={getContrastTextColor(c)} />}
              </button>
            ))}
          </div>
        </div>

        {publishError && (
          <div className="px-4 pb-4 text-caption text-red-400">{publishError}</div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-4 pt-3 pb-2 h-14 shrink-0">
        <button onClick={() => navigate(-1)} aria-label="Fermer" className="w-9 h-9 flex items-center justify-center">
          <X size={22} />
        </button>
        <span className="text-body-medium">{isEditing ? "Modifier l'appel d'offre" : "Appel d'offre"}</span>
        <button
          onClick={() => setStep('couleur')}
          disabled={!contenu.trim()}
          className="text-body-medium px-2 py-2 disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
        >
          Terminé
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
    </div>
  )
}
