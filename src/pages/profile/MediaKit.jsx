import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Camera, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { compressImage } from '../../lib/mediaCompression'

// Catégories fixes proposées à l'influenceur, 3 maximum.
const CATEGORIES = [
  'Lifestyle', 'Mode & Beauté', 'Sport', 'Cuisine', 'Voyage', 'Tech',
  'Gaming', 'Musique', 'Humour', 'Éducation', 'Parentalité', 'Business',
]

// Sépare un nom complet ("Prénom Nom Nom2") en { prenom, nom } : le premier
// mot est le prénom, tout le reste (souvent juste un nom, parfois composé)
// forme le nom de famille.
function splitNomComplet(nomComplet) {
  const parts = (nomComplet || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { prenom: '', nom: '' }
  if (parts.length === 1) return { prenom: parts[0], nom: '' }
  return { prenom: parts[0], nom: parts.slice(1).join(' ') }
}

export default function MediaKit() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [editing, setEditing] = useState(false)

  const [existingKit, setExistingKit] = useState(null) // ligne media_kits déjà sauvegardée, si présente
  const [reseaux, setReseaux] = useState(location.state?.reseaux || [])

  const initialSplit = splitNomComplet(profile?.nom_complet)
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [abonnesInstagram, setAbonnesInstagram] = useState('')
  const [abonnesTiktok, setAbonnesTiktok] = useState('')

  // Abonnés déjà connus via reseaux_sociaux (fallback si le champ manuel est vide).
  const autoInstagram = reseaux.find((r) => r.plateforme === 'instagram')?.nombre_abonnes
  const autoTiktok = reseaux.find((r) => r.plateforme === 'tiktok')?.nombre_abonnes

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const requests = [
        supabase.from('media_kits').select('*').eq('influenceur_id', user.id).maybeSingle(),
      ]
      // Si l'appelant (InfluencerProfile) n'a pas déjà transmis les réseaux
      // sociaux via location.state, on va les chercher nous-mêmes.
      if (!location.state?.reseaux) {
        requests.push(supabase.from('reseaux_sociaux').select('*').eq('influenceur_id', user.id))
      }
      const results = await Promise.all(requests)
      if (cancelled) return

      const kitResult = results[0]
      if (kitResult.data) {
        setExistingKit(kitResult.data)
        setPrenom(kitResult.data.prenom)
        setNom(kitResult.data.nom)
        setSelectedCategories(kitResult.data.categories || [])
        setPhotoPreview(kitResult.data.photo_url || '')
        setAbonnesInstagram(kitResult.data.abonnes_instagram != null ? String(kitResult.data.abonnes_instagram) : '')
        setAbonnesTiktok(kitResult.data.abonnes_tiktok != null ? String(kitResult.data.abonnes_tiktok) : '')
      } else {
        // Pas encore de media kit : on pré-remplit avec les infos du profil,
        // mais l'influenceur doit valider/compléter (mode édition d'office).
        setPrenom(initialSplit.prenom)
        setNom(initialSplit.nom)
        setPhotoPreview(profile?.photo_url || '')
        setEditing(true)
      }

      if (results[1]) setReseaux(results[1].data || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const toggleCategorie = (cat) => {
    setSelectedCategories((current) => {
      if (current.includes(cat)) return current.filter((c) => c !== cat)
      if (current.length >= 3) return current // max 3, on ignore le clic au-delà
      return [...current, cat]
    })
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!prenom.trim() || !nom.trim()) {
      setErrorMsg('Prénom et nom sont obligatoires.')
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      let photoUrl = existingKit?.photo_url || null
      if (photoFile) {
        const compressed = await compressImage(photoFile, { maxDimension: 1024, quality: 0.85 })
        const ext = compressed.name.split('.').pop()
        const fileName = `${user.id}/media-kit-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('media-kits').upload(fileName, compressed, {
          upsert: true,
        })
        if (uploadError) throw new Error("Échec de l'envoi de la photo : " + uploadError.message)
        const { data: urlData } = supabase.storage.from('media-kits').getPublicUrl(fileName)
        photoUrl = urlData.publicUrl
      }

      // Champ manuel prioritaire ; sinon on retombe sur les chiffres réels du profil.
      const finalInstagram = abonnesInstagram.trim() !== '' ? parseInt(abonnesInstagram, 10) : (autoInstagram ?? null)
      const finalTiktok = abonnesTiktok.trim() !== '' ? parseInt(abonnesTiktok, 10) : (autoTiktok ?? null)

      const payload = {
        influenceur_id: user.id,
        prenom: prenom.trim(),
        nom: nom.trim(),
        photo_url: photoUrl,
        categories: selectedCategories,
        abonnes_instagram: Number.isFinite(finalInstagram) ? finalInstagram : null,
        abonnes_tiktok: Number.isFinite(finalTiktok) ? finalTiktok : null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('media_kits')
        .upsert(payload, { onConflict: 'influenceur_id' })
        .select()
        .single()

      if (error) throw new Error("Échec de l'enregistrement : " + error.message)

      setExistingKit(data)
      setEditing(false)
    } catch (err) {
      setErrorMsg(err.message || "Une erreur est survenue.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  const displayInstagram = existingKit?.abonnes_instagram ?? autoInstagram
  const displayTiktok = existingKit?.abonnes_tiktok ?? autoTiktok

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 glass">
        <button onClick={() => navigate(-1)} aria-label="Retour">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-body-medium flex-1">Media Kit</h1>
        {!editing && (
          <button onClick={() => setEditing(true)} aria-label="Modifier">
            <Pencil size={20} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="px-4 py-4 space-y-5">
          {errorMsg && <p className="text-caption text-red-500">{errorMsg}</p>}

          <div className="flex flex-col items-center gap-3">
            <label className="relative w-28 h-28 rounded-full overflow-hidden glass flex items-center justify-center cursor-pointer">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera size={28} className="text-[var(--text-secondary)]" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
            <span className="text-caption text-[var(--text-secondary)]">Toucher pour changer la photo</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" required />
            <Input label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" required />
          </div>

          <div>
            <span className="block text-caption-medium mb-2 text-[var(--text-secondary)]">
              Catégories ({selectedCategories.length}/3)
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const selected = selectedCategories.includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategorie(cat)}
                    className={`px-3 py-1.5 rounded-full text-caption-medium transition-colors ${
                      selected ? 'bg-[var(--accent)] text-white' : 'glass text-[var(--text-secondary)]'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Abonnés Instagram"
              type="number"
              value={abonnesInstagram}
              onChange={(e) => setAbonnesInstagram(e.target.value)}
              placeholder={autoInstagram != null ? String(autoInstagram) : 'Optionnel'}
            />
            <Input
              label="Abonnés TikTok"
              type="number"
              value={abonnesTiktok}
              onChange={(e) => setAbonnesTiktok(e.target.value)}
              placeholder={autoTiktok != null ? String(autoTiktok) : 'Optionnel'}
            />
          </div>
          <p className="text-caption text-[var(--text-secondary)] -mt-2">
            Laisse vide pour reprendre automatiquement le nombre d'abonnés de ton profil.
          </p>

          <Button fullWidth onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      ) : (
        <MediaKitCard
          prenom={existingKit?.prenom}
          nom={existingKit?.nom}
          photoUrl={existingKit?.photo_url}
          categories={existingKit?.categories || []}
          abonnesInstagram={displayInstagram}
          abonnesTiktok={displayTiktok}
        />
      )}
    </div>
  )
}

// Rendu visuel du media kit final, au format demandé (photo pleine largeur en
// haut, nom en grandes lettres espacées, bandeau catégories, chiffres en bas).
function MediaKitCard({ prenom, nom, photoUrl, categories, abonnesInstagram, abonnesTiktok }) {
  return (
    <div className="mx-4 mt-2 rounded-2xl overflow-hidden" style={{ backgroundColor: '#dcdcd4' }}>
      <div className="flex items-center justify-between px-5 pt-5 text-[11px] tracking-[0.2em] text-black/80 uppercase">
        <span>Media Kit</span>
        <span>Content Creator</span>
      </div>

      <div className="mx-5 mt-4 aspect-[4/3] rounded-lg overflow-hidden bg-black/10">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-black/30">
            <Camera size={32} />
          </div>
        )}
      </div>

      <div className="flex justify-between px-5 mt-5 text-black">
        <span className="text-[26px] tracking-[0.15em] uppercase">{prenom || 'Prénom'}</span>
        <span className="text-[26px] tracking-[0.15em] uppercase">{nom || 'Nom'}</span>
      </div>

      {categories.length > 0 && (
        <div className="px-5 mt-6">
          <div className="inline-block px-3 py-1.5" style={{ backgroundColor: '#2fae8f' }}>
            <span className="text-[13px] tracking-[0.2em] uppercase text-black">
              {categories.join(' • ')}
            </span>
          </div>
        </div>
      )}

      <div className="px-5 mt-8 pb-6 space-y-2 text-black">
        {abonnesInstagram != null && (
          <p className="text-right text-[14px] underline">Instagram Followers: {abonnesInstagram.toLocaleString()}</p>
        )}
        {abonnesTiktok != null && (
          <p className="text-[14px] underline">TikTok Followers: {abonnesTiktok.toLocaleString()}</p>
        )}
      </div>
    </div>
  )
}
