import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { ArrowLeft } from 'lucide-react'

export default function OfferDetail() {
  const { id } = useParams()
  const [offre, setOffre] = useState(null)
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('offres')
        .select('*, profils_influenceur(id, verifie, users(nom_complet, photo_url))')
        .eq('id', id)
        .maybeSingle()
      setOffre(data)
      setLoading(false)
    }
    load()
  }, [id])

  const handleContact = () => {
    navigate(`/messages/nouveau?offre=${id}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (!offre) {
    return <div className="p-6 text-center text-[var(--text-secondary)]">Offre introuvable.</div>
  }

  const canContact = profile?.role === 'client'

  return (
    <div>
      <button onClick={() => navigate(-1)} className="absolute top-6 left-5 z-20 glass rounded-full p-3">
        <ArrowLeft size={18} />
      </button>

      <div className="relative aspect-[4/3] w-full">
        {offre.photo_url ? (
          <img src={offre.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-black/20 to-transparent" />
      </div>

      <div className="px-5 -mt-10 relative z-10">
        <div className="glass-strong rounded-2xl p-5">
          <h1 className="text-h1 mb-1">{offre.titre}</h1>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-h1">{offre.prix} €</span>
            <span className="text-[var(--text-secondary)] text-body">{offre.delai_jours} jours de délai</span>
            <span className="glass rounded-full px-3 py-1 text-caption">{offre.plateforme}</span>
          </div>
          <p className="text-caption mb-6">{offre.description}</p>

          <div className="flex items-center gap-3 py-3 border-t border-[var(--border)]">
            <img
              src={offre.profils_influenceur?.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${offre.influenceur_id}`}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex items-center gap-2">
              <span className="text-body-medium">{offre.profils_influenceur?.users?.nom_complet}</span>
              {offre.profils_influenceur?.verifie && <VerifiedBadge size={15} />}
            </div>
          </div>

          {canContact && (
            <Button fullWidth onClick={handleContact} className="mt-2">
              Entrer en contact
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
