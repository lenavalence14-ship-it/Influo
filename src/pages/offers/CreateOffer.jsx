import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as offresApi from '../../api/offres'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'

const PLATEFORMES = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'autre']

export default function CreateOffer() {
  const { id } = useParams() // présent si mode édition
  const isEdit = Boolean(id)
  const { influencerProfile } = useAuth()
  const navigate = useNavigate()
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [prix, setPrix] = useState('')
  const [plateforme, setPlateforme] = useState('instagram')
  const [delaiJours, setDelaiJours] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingOffre, setLoadingOffre] = useState(isEdit)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    const load = async () => {
      const data = await offresApi.fetchOffre(id)
      if (data) {
        setTitre(data.titre || '')
        setDescription(data.description || '')
        setPrix(String(data.prix ?? ''))
        setPlateforme(data.plateforme || 'instagram')
        setDelaiJours(String(data.delai_jours ?? ''))
        setExistingPhotoUrl(data.photo_url)
      }
      setLoadingOffre(false)
    }
    load()
  }, [id, isEdit])

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: dbError } = isEdit
      ? await offresApi.updateOffre({
          offreId: id,
          influenceurId: influencerProfile.id,
          titre,
          description,
          prix,
          plateforme,
          delaiJours,
          photoFile,
          existingPhotoUrl,
        })
      : await offresApi.createOffre({
          influenceurId: influencerProfile.id,
          titre,
          description,
          prix,
          plateforme,
          delaiJours,
          photoFile,
          existingPhotoUrl,
        })

    setLoading(false)
    if (dbError) {
      setError(isEdit ? "Erreur lors de la modification." : "Erreur lors de la création de l'offre.")
      return
    }
    navigate('/profil')
  }

  if (loadingOffre) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  const displayedPhoto = photoPreview || existingPhotoUrl

  return (
    <div className="px-5 pt-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-caption mb-6">
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-h1 mb-6">{isEdit ? "Modifier l'offre" : 'Nouvelle offre'}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block cursor-pointer">
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden glass-strong">
            {displayedPhoto ? (
              <img src={displayedPhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
                <ImageIcon size={28} />
                <span className="text-body">Ajouter une photo</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
              <p className="text-white text-h1">{titre || 'Titre de ton offre'}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-white font-semibold">{prix ? `${prix} €` : '0 €'}</span>
                <span className="text-white/70 text-body">{delaiJours ? `${delaiJours}j de délai` : 'Délai'}</span>
              </div>
            </div>
          </div>
          <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        </label>
        <p className="text-caption -mt-3">
          Choisis une photo chic, elle sert de fond à ta carte d'offre.
        </p>

        <Input label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Post sponsorisé Instagram" required />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Décris ce que tu proposes" required />

        <div className="flex gap-3">
          <div className="flex-1">
            <Input label="Prix (€)" type="number" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="150" required />
          </div>
          <div className="flex-1">
            <Input label="Délai (jours)" type="number" value={delaiJours} onChange={(e) => setDelaiJours(e.target.value)} placeholder="7" required />
          </div>
        </div>

        <label className="block">
          <span className="block text-body mb-2 text-[var(--text-secondary)] font-medium">Plateforme</span>
          <select
            value={plateforme}
            onChange={(e) => setPlateforme(e.target.value)}
            className="w-full rounded-2xl px-4 py-3 glass text-[var(--text-primary)] outline-none appearance-none"
          >
            {PLATEFORMES.map((p) => (
              <option key={p} value={p} className="bg-[var(--bg-elevated)]">{p}</option>
            ))}
          </select>
        </label>

        {error && <p className="text-body text-red-400">{error}</p>}

        <Button type="submit" fullWidth disabled={loading}>
          {loading ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : "Publier l'offre"}
        </Button>
      </form>
    </div>
  )
}
