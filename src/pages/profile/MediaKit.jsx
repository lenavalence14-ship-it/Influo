import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Camera, Pencil } from 'lucide-react'
import * as profileApi from '../../api/profile'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { compressImage, getMediaDimensions } from '../../lib/mediaCompression'
import { getCropTransformStyle } from '../../lib/mediaCrop'
import PhotoCropEditor from '../../components/PhotoCropEditor'
import { MEDIA_KIT_TEMPLATES } from '../feed/media-kit-templates'

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
  // Recadrage zoom/pan de la photo (voir lib/mediaCrop.js, format 'media_kit').
  // null quand aucun recadrage manuel n'a encore été fait sur CETTE photo :
  // getCropTransformStyle retombe alors sur son fallback (coverZoom, cadre
  // rempli sans bord vide), donc l'aperçu reste correct même sans recadrage.
  const [photoCrop, setPhotoCrop] = useState(null)
  const [showCropEditor, setShowCropEditor] = useState(false)
  const [abonnesInstagram, setAbonnesInstagram] = useState('')
  const [abonnesTiktok, setAbonnesTiktok] = useState('')

  // --- Champs propres à TemplateC (préfixés c_ pour ne rien mélanger avec A/B) ---
  const [cPays, setCPays] = useState('')
  const [cAPropos, setCAPropos] = useState('')
  const [cFondCouleur, setCFondCouleur] = useState('bordeaux') // 'bordeaux' | 'vert_sauge' | 'blanc_casse'
  // Tableau unifié : chaque ligne a une valeur TikTok + Instagram.
  const [cVuesMoyTiktok, setCVuesMoyTiktok] = useState('')
  const [cVuesMoyInstagram, setCVuesMoyInstagram] = useState('')
  const [cPctHommesTiktok, setCPctHommesTiktok] = useState('')
  const [cPctHommesInstagram, setCPctHommesInstagram] = useState('')
  const [cPctFemmesTiktok, setCPctFemmesTiktok] = useState('')
  const [cPctFemmesInstagram, setCPctFemmesInstagram] = useState('')
  const [cPctAutresTiktok, setCPctAutresTiktok] = useState('')
  const [cPctAutresInstagram, setCPctAutresInstagram] = useState('')
  const [cAge1824Tiktok, setCAge1824Tiktok] = useState('')
  const [cAge1824Instagram, setCAge1824Instagram] = useState('')
  const [cAge2534Tiktok, setCAge2534Tiktok] = useState('')
  const [cAge2534Instagram, setCAge2534Instagram] = useState('')
  const [cAge3544Tiktok, setCAge3544Tiktok] = useState('')
  const [cAge3544Instagram, setCAge3544Instagram] = useState('')
  const [cAge4554Tiktok, setCAge4554Tiktok] = useState('')
  const [cAge4554Instagram, setCAge4554Instagram] = useState('')
  // Nationalités : liste libre, chaque ligne { pays, pct_tiktok, pct_instagram }
  const [cNationalites, setCNationalites] = useState([])
  // 6 photos "polaroid" : chacune a son fichier/preview/crop propres.
  const [cGrillePhotos, setCGrillePhotos] = useState(
    Array.from({ length: 6 }, () => ({ file: null, preview: '', crop: null, existingUrl: '' }))
  )
  // Quel slot de la grille est en cours d'édition dans l'éditeur de crop
  // partagé (un seul éditeur plein écran à la fois, réutilisé pour les 6
  // photos, sans dupliquer le composant).
  const [cCropIndex, setCCropIndex] = useState(null)

  // Abonnés déjà connus via reseaux_sociaux (fallback si le champ manuel est vide).
  const autoInstagram = reseaux.find((r) => r.plateforme === 'instagram')?.nombre_abonnes
  const autoTiktok = reseaux.find((r) => r.plateforme === 'tiktok')?.nombre_abonnes

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const needReseaux = !location.state?.reseaux
      const { kit, reseaux: fetchedReseaux } = await profileApi.fetchMediaKitPage(user.id, needReseaux)
      if (cancelled) return

      if (kit) {
        setExistingKit(kit)
        setPrenom(kit.prenom)
        setNom(kit.nom)
        setSelectedCategories(kit.categories || [])
        setPhotoPreview(kit.photo_url || '')
        if (kit.photo_zoom != null) {
          setPhotoCrop({
            zoom: kit.photo_zoom,
            offsetX: kit.photo_offset_x ?? 0,
            offsetY: kit.photo_offset_y ?? 0,
            naturalWidth: kit.photo_natural_width,
            naturalHeight: kit.photo_natural_height,
          })
        }
        setAbonnesInstagram(kit.abonnes_instagram != null ? String(kit.abonnes_instagram) : '')
        setAbonnesTiktok(kit.abonnes_tiktok != null ? String(kit.abonnes_tiktok) : '')

        // --- Champs TemplateC ---
        setCPays(kit.c_pays || '')
        setCAPropos(kit.c_a_propos || '')
        setCFondCouleur(kit.fond_couleur_c || 'bordeaux')
        setCVuesMoyTiktok(kit.c_vues_moy_tiktok != null ? String(kit.c_vues_moy_tiktok) : '')
        setCVuesMoyInstagram(kit.c_vues_moy_instagram != null ? String(kit.c_vues_moy_instagram) : '')
        setCPctHommesTiktok(kit.c_pct_hommes_tiktok != null ? String(kit.c_pct_hommes_tiktok) : '')
        setCPctHommesInstagram(kit.c_pct_hommes_instagram != null ? String(kit.c_pct_hommes_instagram) : '')
        setCPctFemmesTiktok(kit.c_pct_femmes_tiktok != null ? String(kit.c_pct_femmes_tiktok) : '')
        setCPctFemmesInstagram(kit.c_pct_femmes_instagram != null ? String(kit.c_pct_femmes_instagram) : '')
        setCPctAutresTiktok(kit.c_pct_autres_tiktok != null ? String(kit.c_pct_autres_tiktok) : '')
        setCPctAutresInstagram(kit.c_pct_autres_instagram != null ? String(kit.c_pct_autres_instagram) : '')
        setCAge1824Tiktok(kit.age_18_24_tiktok != null ? String(kit.age_18_24_tiktok) : '')
        setCAge1824Instagram(kit.age_18_24_instagram != null ? String(kit.age_18_24_instagram) : '')
        setCAge2534Tiktok(kit.age_25_34_tiktok != null ? String(kit.age_25_34_tiktok) : '')
        setCAge2534Instagram(kit.age_25_34_instagram != null ? String(kit.age_25_34_instagram) : '')
        setCAge3544Tiktok(kit.age_35_44_tiktok != null ? String(kit.age_35_44_tiktok) : '')
        setCAge3544Instagram(kit.age_35_44_instagram != null ? String(kit.age_35_44_instagram) : '')
        setCAge4554Tiktok(kit.age_45_54_tiktok != null ? String(kit.age_45_54_tiktok) : '')
        setCAge4554Instagram(kit.age_45_54_instagram != null ? String(kit.age_45_54_instagram) : '')
        setCNationalites(kit.c_audience_nationalites || [])
        setCGrillePhotos(
          Array.from({ length: 6 }, (_, i) => {
            const n = i + 1
            const url = kit[`c_photo_grille_${n}_url`] || ''
            const zoom = kit[`c_photo_grille_${n}_zoom`]
            return {
              file: null,
              preview: url,
              existingUrl: url,
              crop: zoom != null ? {
                zoom,
                offsetX: kit[`c_photo_grille_${n}_offset_x`] ?? 0,
                offsetY: kit[`c_photo_grille_${n}_offset_y`] ?? 0,
                naturalWidth: kit[`c_photo_grille_${n}_natural_width`],
                naturalHeight: kit[`c_photo_grille_${n}_natural_height`],
              } : null,
            }
          })
        )
      } else {
        // Pas encore de media kit : on pré-remplit avec les infos du profil,
        // mais l'influenceur doit valider/compléter (mode édition d'office).
        setPrenom(initialSplit.prenom)
        setNom(initialSplit.nom)
        setPhotoPreview(profile?.photo_url || '')
        setEditing(true)
      }

      if (fetchedReseaux) setReseaux(fetchedReseaux)
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
    setPhotoCrop(null) // nouvelle photo : on efface le recadrage de l'ancienne, l'utilisateur en refait un
    setShowCropEditor(true)
  }

  const handleCropConfirm = (crop) => {
    setPhotoCrop(crop)
    setShowCropEditor(false)
  }

  // --- Handlers TemplateC : 6 photos de grille ---
  const handleGrillePhotoChange = (index, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCGrillePhotos((current) => {
      const next = [...current]
      next[index] = { ...next[index], file, preview: URL.createObjectURL(file), crop: null }
      return next
    })
    setCCropIndex(index)
  }

  const handleGrilleCropConfirm = (crop) => {
    if (cCropIndex == null) return
    setCGrillePhotos((current) => {
      const next = [...current]
      next[cCropIndex] = { ...next[cCropIndex], crop }
      return next
    })
    setCCropIndex(null)
  }

  const addNationalite = () => {
    setCNationalites((current) => [...current, { pays: '', pct_tiktok: '', pct_instagram: '' }])
  }
  const updateNationalite = (index, field, value) => {
    setCNationalites((current) => {
      const next = [...current]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }
  const removeNationalite = (index) => {
    setCNationalites((current) => current.filter((_, i) => i !== index))
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
        const { url, error: uploadError } = await profileApi.uploadMediaKitPhoto(user.id, compressed)
        if (uploadError) throw new Error("Échec de l'envoi de la photo : " + uploadError.message)
        photoUrl = url
      }

      // Champ manuel prioritaire ; sinon on retombe sur les chiffres réels du profil.
      const finalInstagram = abonnesInstagram.trim() !== '' ? parseInt(abonnesInstagram, 10) : (autoInstagram ?? null)
      const finalTiktok = abonnesTiktok.trim() !== '' ? parseInt(abonnesTiktok, 10) : (autoTiktok ?? null)

      // --- Upload des 6 photos de grille TemplateC (si nouveau fichier chacune) ---
      const grilleUrls = await Promise.all(
        cGrillePhotos.map(async (g, i) => {
          if (!g.file) return g.existingUrl || null
          const compressed = await compressImage(g.file, { maxDimension: 1200, quality: 0.85 })
          const { url, error: gridError } = await profileApi.uploadMediaKitPhoto(user.id, compressed)
          if (gridError) throw new Error(`Échec de l'envoi de la photo ${i + 1} de la grille : ` + gridError.message)
          return url
        })
      )

      const numOrNull = (v) => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : null)

      const grillePayload = {}
      cGrillePhotos.forEach((g, i) => {
        const n = i + 1
        grillePayload[`c_photo_grille_${n}_url`] = grilleUrls[i]
        grillePayload[`c_photo_grille_${n}_zoom`] = g.crop?.zoom ?? null
        grillePayload[`c_photo_grille_${n}_offset_x`] = g.crop?.offsetX ?? null
        grillePayload[`c_photo_grille_${n}_offset_y`] = g.crop?.offsetY ?? null
        grillePayload[`c_photo_grille_${n}_natural_width`] = g.crop?.naturalWidth ?? null
        grillePayload[`c_photo_grille_${n}_natural_height`] = g.crop?.naturalHeight ?? null
      })

      const nationalitesPayload = cNationalites
        .filter((n) => n.pays.trim() !== '')
        .map((n) => ({
          pays: n.pays.trim(),
          pct_tiktok: numOrNull(n.pct_tiktok),
          pct_instagram: numOrNull(n.pct_instagram),
        }))

      const payload = {
        influenceur_id: user.id,
        prenom: prenom.trim(),
        nom: nom.trim(),
        photo_url: photoUrl,
        photo_zoom: photoCrop?.zoom ?? null,
        photo_offset_x: photoCrop?.offsetX ?? null,
        photo_offset_y: photoCrop?.offsetY ?? null,
        photo_natural_width: photoCrop?.naturalWidth ?? null,
        photo_natural_height: photoCrop?.naturalHeight ?? null,
        categories: selectedCategories,
        abonnes_instagram: Number.isFinite(finalInstagram) ? finalInstagram : null,
        abonnes_tiktok: Number.isFinite(finalTiktok) ? finalTiktok : null,
        // --- Champs TemplateC ---
        c_pays: cPays.trim() || null,
        c_a_propos: cAPropos.trim() || null,
        fond_couleur_c: cFondCouleur,
        c_vues_moy_tiktok: numOrNull(cVuesMoyTiktok),
        c_vues_moy_instagram: numOrNull(cVuesMoyInstagram),
        c_pct_hommes_tiktok: numOrNull(cPctHommesTiktok),
        c_pct_hommes_instagram: numOrNull(cPctHommesInstagram),
        c_pct_femmes_tiktok: numOrNull(cPctFemmesTiktok),
        c_pct_femmes_instagram: numOrNull(cPctFemmesInstagram),
        c_pct_autres_tiktok: numOrNull(cPctAutresTiktok),
        c_pct_autres_instagram: numOrNull(cPctAutresInstagram),
        age_18_24_tiktok: numOrNull(cAge1824Tiktok),
        age_18_24_instagram: numOrNull(cAge1824Instagram),
        age_25_34_tiktok: numOrNull(cAge2534Tiktok),
        age_25_34_instagram: numOrNull(cAge2534Instagram),
        age_35_44_tiktok: numOrNull(cAge3544Tiktok),
        age_35_44_instagram: numOrNull(cAge3544Instagram),
        age_45_54_tiktok: numOrNull(cAge4554Tiktok),
        age_45_54_instagram: numOrNull(cAge4554Instagram),
        c_audience_nationalites: nationalitesPayload.length > 0 ? nationalitesPayload : null,
        ...grillePayload,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await profileApi.upsertMediaKit(payload)

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

          {/* Aperçu = exactement le cadre 4/3 qui sera affiché dans le Media
              Kit et repris dans le Feed (MediaKitSuggestion) -- pas un avatar
              rond, pour que ce que l'influenceur recadre ici soit bien ce
              qu'il voit ensuite en plein cadre. */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-full max-w-[220px] aspect-[4/3] rounded-lg overflow-hidden glass">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt=""
                  style={getCropTransformStyle({
                    naturalWidth: photoCrop?.naturalWidth,
                    naturalHeight: photoCrop?.naturalHeight,
                    cropFormat: 'media_kit',
                    zoom: photoCrop?.zoom,
                    offsetX: photoCrop?.offsetX,
                    offsetY: photoCrop?.offsetY,
                  })}
                />
              ) : (
                <label className="w-full h-full flex items-center justify-center cursor-pointer">
                  <Camera size={28} className="text-[var(--text-secondary)]" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              )}
            </div>
            <div className="flex gap-4">
              <label className="text-caption text-[var(--accent)] cursor-pointer">
                Changer la photo
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
              {photoPreview && (
                <button type="button" onClick={() => setShowCropEditor(true)} className="text-caption text-[var(--accent)]">
                  Repositionner
                </button>
              )}
            </div>
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

          {/* ================= Champs spécifiques au design "Tableau" (TemplateC) ================= */}
          <div className="pt-2 border-t border-[var(--text-secondary)]/10 space-y-5">
            <p className="text-caption-medium text-[var(--text-secondary)]">
              Champs pour le design "Tableau" (TemplateC) -- tous optionnels.
            </p>

            <Input label="Pays" value={cPays} onChange={(e) => setCPays(e.target.value)} placeholder="Optionnel" />

            <div>
              <span className="block text-caption-medium mb-2 text-[var(--text-secondary)]">
                À propos de moi ({cAPropos.length}/160)
              </span>
              <textarea
                value={cAPropos}
                onChange={(e) => setCAPropos(e.target.value.slice(0, 160))}
                maxLength={160}
                rows={3}
                placeholder="Optionnel"
                className="w-full rounded-2xl px-4 py-3 glass text-body text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--text-primary)]/30 transition-colors duration-200 resize-none"
              />
            </div>

            <div>
              <span className="block text-caption-medium mb-2 text-[var(--text-secondary)]">Couleur de fond</span>
              <div className="flex gap-2">
                {[
                  { key: 'bordeaux', label: 'Bordeaux', color: '#5c1a2e' },
                  { key: 'vert_sauge', label: 'Vert sauge', color: '#3a4a3f' },
                  { key: 'blanc_casse', label: 'Blanc cassé', color: '#f5f1ea' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setCFondCouleur(f.key)}
                    aria-label={f.label}
                    className={`w-9 h-9 rounded-full border-2 ${cFondCouleur === f.key ? 'border-[var(--accent)]' : 'border-transparent'}`}
                    style={{ backgroundColor: f.color }}
                  />
                ))}
              </div>
            </div>

            {/* Tableau Audience & Démographie -- une ligne = un label + 2 champs (TikTok / Instagram) */}
            <div>
              <span className="block text-caption-medium mb-2 text-[var(--text-secondary)]">
                Audience & Démographie
              </span>
              <div className="space-y-3">
                {[
                  { label: 'Vues moyennes', tiktok: cVuesMoyTiktok, setTiktok: setCVuesMoyTiktok, instagram: cVuesMoyInstagram, setInstagram: setCVuesMoyInstagram },
                  { label: 'Hommes %', tiktok: cPctHommesTiktok, setTiktok: setCPctHommesTiktok, instagram: cPctHommesInstagram, setInstagram: setCPctHommesInstagram },
                  { label: 'Femmes %', tiktok: cPctFemmesTiktok, setTiktok: setCPctFemmesTiktok, instagram: cPctFemmesInstagram, setInstagram: setCPctFemmesInstagram },
                  { label: 'Autres %', tiktok: cPctAutresTiktok, setTiktok: setCPctAutresTiktok, instagram: cPctAutresInstagram, setInstagram: setCPctAutresInstagram },
                  { label: '18-24 ans %', tiktok: cAge1824Tiktok, setTiktok: setCAge1824Tiktok, instagram: cAge1824Instagram, setInstagram: setCAge1824Instagram },
                  { label: '25-34 ans %', tiktok: cAge2534Tiktok, setTiktok: setCAge2534Tiktok, instagram: cAge2534Instagram, setInstagram: setCAge2534Instagram },
                  { label: '35-44 ans %', tiktok: cAge3544Tiktok, setTiktok: setCAge3544Tiktok, instagram: cAge3544Instagram, setInstagram: setCAge3544Instagram },
                  { label: '45-54 ans %', tiktok: cAge4554Tiktok, setTiktok: setCAge4554Tiktok, instagram: cAge4554Instagram, setInstagram: setCAge4554Instagram },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-caption text-[var(--text-secondary)]">{row.label}</span>
                    <Input type="number" placeholder="TikTok" value={row.tiktok} onChange={(e) => row.setTiktok(e.target.value)} />
                    <Input type="number" placeholder="Instagram" value={row.instagram} onChange={(e) => row.setInstagram(e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Nationalités : liste libre, chacune avec 2 valeurs */}
            <div>
              <span className="block text-caption-medium mb-2 text-[var(--text-secondary)]">Nationalités</span>
              <div className="space-y-2">
                {cNationalites.map((n, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <Input placeholder="Pays" value={n.pays} onChange={(e) => updateNationalite(i, 'pays', e.target.value)} />
                    <Input type="number" placeholder="TikTok %" value={n.pct_tiktok} onChange={(e) => updateNationalite(i, 'pct_tiktok', e.target.value)} />
                    <Input type="number" placeholder="Instagram %" value={n.pct_instagram} onChange={(e) => updateNationalite(i, 'pct_instagram', e.target.value)} />
                    <button type="button" onClick={() => removeNationalite(i)} aria-label="Supprimer" className="text-caption text-red-500 px-2">
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addNationalite} className="text-caption text-[var(--accent)]">
                  + Ajouter un pays
                </button>
              </div>
            </div>

            {/* 6 photos "polaroid" */}
            <div>
              <span className="block text-caption-medium mb-2 text-[var(--text-secondary)]">Photos (6)</span>
              <div className="grid grid-cols-3 gap-2">
                {cGrillePhotos.map((g, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden glass">
                      {g.preview ? (
                        <img
                          src={g.preview}
                          alt=""
                          style={getCropTransformStyle({
                            naturalWidth: g.crop?.naturalWidth,
                            naturalHeight: g.crop?.naturalHeight,
                            cropFormat: 'media_kit_c_grille',
                            zoom: g.crop?.zoom,
                            offsetX: g.crop?.offsetX,
                            offsetY: g.crop?.offsetY,
                          })}
                        />
                      ) : (
                        <label className="w-full h-full flex items-center justify-center cursor-pointer">
                          <Camera size={18} className="text-[var(--text-secondary)]" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleGrillePhotoChange(i, e)} />
                        </label>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <label className="text-[10px] text-[var(--accent)] cursor-pointer">
                        Changer
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleGrillePhotoChange(i, e)} />
                      </label>
                      {g.preview && (
                        <button type="button" onClick={() => setCCropIndex(i)} className="text-[10px] text-[var(--accent)]">
                          Recadrer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button fullWidth onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      ) : (
        <div className="space-y-8 pb-8">
          <p className="px-4 text-caption text-[var(--text-secondary)]">
            Voici les différents designs sous lesquels ton Media Kit peut apparaître dans le Feed
            (un design différent est tiré au hasard à chaque apparition).
          </p>
          {MEDIA_KIT_TEMPLATES.map((Template, i) => (
            <div key={i} className="mx-4 rounded-2xl overflow-hidden">
              <Template
                mediaKit={{
                  prenom: existingKit?.prenom,
                  nom: existingKit?.nom,
                  photo_url: existingKit?.photo_url,
                  photo_zoom: photoCrop?.zoom,
                  photo_offset_x: photoCrop?.offsetX,
                  photo_offset_y: photoCrop?.offsetY,
                  photo_natural_width: photoCrop?.naturalWidth,
                  photo_natural_height: photoCrop?.naturalHeight,
                  categories: existingKit?.categories || [],
                  abonnes_instagram: displayInstagram,
                  abonnes_tiktok: displayTiktok,
                  // --- Champs TemplateC ---
                  c_pays: existingKit?.c_pays,
                  c_a_propos: existingKit?.c_a_propos,
                  fond_couleur_c: existingKit?.fond_couleur_c,
                  c_vues_moy_tiktok: existingKit?.c_vues_moy_tiktok,
                  c_vues_moy_instagram: existingKit?.c_vues_moy_instagram,
                  c_pct_hommes_tiktok: existingKit?.c_pct_hommes_tiktok,
                  c_pct_hommes_instagram: existingKit?.c_pct_hommes_instagram,
                  c_pct_femmes_tiktok: existingKit?.c_pct_femmes_tiktok,
                  c_pct_femmes_instagram: existingKit?.c_pct_femmes_instagram,
                  c_pct_autres_tiktok: existingKit?.c_pct_autres_tiktok,
                  c_pct_autres_instagram: existingKit?.c_pct_autres_instagram,
                  age_18_24_tiktok: existingKit?.age_18_24_tiktok,
                  age_18_24_instagram: existingKit?.age_18_24_instagram,
                  age_25_34_tiktok: existingKit?.age_25_34_tiktok,
                  age_25_34_instagram: existingKit?.age_25_34_instagram,
                  age_35_44_tiktok: existingKit?.age_35_44_tiktok,
                  age_35_44_instagram: existingKit?.age_35_44_instagram,
                  age_45_54_tiktok: existingKit?.age_45_54_tiktok,
                  age_45_54_instagram: existingKit?.age_45_54_instagram,
                  c_audience_nationalites: existingKit?.c_audience_nationalites || [],
                  ...Object.fromEntries(
                    [1, 2, 3, 4, 5, 6].flatMap((n) => [
                      [`c_photo_grille_${n}_url`, existingKit?.[`c_photo_grille_${n}_url`]],
                      [`c_photo_grille_${n}_zoom`, existingKit?.[`c_photo_grille_${n}_zoom`]],
                      [`c_photo_grille_${n}_offset_x`, existingKit?.[`c_photo_grille_${n}_offset_x`]],
                      [`c_photo_grille_${n}_offset_y`, existingKit?.[`c_photo_grille_${n}_offset_y`]],
                      [`c_photo_grille_${n}_natural_width`, existingKit?.[`c_photo_grille_${n}_natural_width`]],
                      [`c_photo_grille_${n}_natural_height`, existingKit?.[`c_photo_grille_${n}_natural_height`]],
                    ])
                  ),
                }}
                onOpenProfile={() => {}}
              />
            </div>
          ))}
        </div>
      )}

      {showCropEditor && photoPreview && (
        <PhotoCropEditor
          imageSrc={photoPreview}
          cropFormat="media_kit"
          initialCrop={photoCrop}
          onCancel={() => setShowCropEditor(false)}
          onConfirm={handleCropConfirm}
        />
      )}

      {cCropIndex != null && cGrillePhotos[cCropIndex]?.preview && (
        <PhotoCropEditor
          imageSrc={cGrillePhotos[cCropIndex].preview}
          cropFormat="media_kit_c_grille"
          initialCrop={cGrillePhotos[cCropIndex].crop}
          onCancel={() => setCCropIndex(null)}
          onConfirm={handleGrilleCropConfirm}
        />
      )}
    </div>
  )
}
