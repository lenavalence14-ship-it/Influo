import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { ArrowLeft, Plus, Trash2, Camera } from 'lucide-react'

const PLATEFORMES = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'snapchat', 'autre']

export default function EditProfile() {
  const { user, profile, influencerProfile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [nomComplet, setNomComplet] = useState(profile?.nom_complet || '')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(profile?.photo_url || '')
  const [bio, setBio] = useState(influencerProfile?.bio || '')
  const [pays, setPays] = useState(influencerProfile?.pays || '')
  const [ville, setVille] = useState(influencerProfile?.ville || '')
  const [reseaux, setReseaux] = useState([])
  const [loading, setLoading] = useState(false)

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const addReseau = () => {
    setReseaux((r) => [...r, { plateforme: 'instagram', nom_compte: '', lien_profil: '', nombre_abonnes: 0 }])
  }

  const updateReseau = (i, field, value) => {
    setReseaux((r) => r.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }

  const removeReseau = (i) => {
    setReseaux((r) => r.filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    setLoading(true)

    let photoUrl = profile?.photo_url || null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const fileName = `${user.id}/avatar-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, photoFile, {
        upsert: true,
      })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
        photoUrl = urlData.publicUrl
      }
    }

    await supabase.from('users').update({ nom_complet: nomComplet, photo_url: photoUrl }).eq('id', user.id)

    if (influencerProfile?.id) {
      await supabase.from('profils_influenceur').update({ bio, pays, ville }).eq('id', influencerProfile.id)

      for (const r of reseaux) {
        if (r.nom_compte) {
          await supabase.from('reseaux_sociaux').insert({
            influenceur_id: influencerProfile.id,
            plateforme: r.plateforme,
            nom_compte: r.nom_compte,
            lien_profil: r.lien_profil,
            nombre_abonnes: parseInt(r.nombre_abonnes, 10) || 0,
          })
        }
      }
    }

    await refreshProfile()
    setLoading(false)
    navigate('/profil')
  }

  return (
    <div className="px-5 pt-6 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-caption mb-6">
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-h1 mb-6">Modifier le profil</h1>

      <div className="space-y-4">
        <div className="flex justify-center mb-2">
          <label className="relative cursor-pointer">
            <img
              src={photoPreview || `https://api.dicebear.com/9.x/glass/svg?seed=${user?.id}`}
              alt=""
              className="w-24 h-24 rounded-full object-cover"
            />
            <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--text-primary)] flex items-center justify-center">
              <Camera size={15} className="text-[var(--bg-primary)]" />
            </div>
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </label>
        </div>

        <Input label="Nom complet" value={nomComplet} onChange={(e) => setNomComplet(e.target.value)} />

        {influencerProfile && (
          <>
            <label className="block">
              <span className="block text-body mb-2 text-[var(--text-secondary)] font-medium">Bio</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full rounded-2xl px-4 py-3 glass outline-none resize-none text-body"
              />
            </label>
            <Input label="Pays" value={pays} onChange={(e) => setPays(e.target.value)} />
            <Input label="Ville" value={ville} onChange={(e) => setVille(e.target.value)} />

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-body-medium">Réseaux sociaux</span>
                <button onClick={addReseau} className="glass rounded-full p-2">
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-3">
                {reseaux.map((r, i) => (
                  <div key={i} className="glass rounded-2xl p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <select
                        value={r.plateforme}
                        onChange={(e) => updateReseau(i, 'plateforme', e.target.value)}
                        className="bg-transparent text-body outline-none"
                      >
                        {PLATEFORMES.map((p) => (
                          <option key={p} value={p} className="bg-[var(--bg-elevated)]">{p}</option>
                        ))}
                      </select>
                      <button onClick={() => removeReseau(i)}>
                        <Trash2 size={16} className="text-[var(--text-secondary)]" />
                      </button>
                    </div>
                    <input
                      value={r.nom_compte}
                      onChange={(e) => updateReseau(i, 'nom_compte', e.target.value)}
                      placeholder="Nom du compte"
                      className="w-full bg-transparent text-body outline-none border-b border-[var(--border)] pb-1"
                    />
                    <input
                      value={r.lien_profil}
                      onChange={(e) => updateReseau(i, 'lien_profil', e.target.value)}
                      placeholder="Lien du profil"
                      className="w-full bg-transparent text-body outline-none border-b border-[var(--border)] pb-1"
                    />
                    <input
                      type="number"
                      value={r.nombre_abonnes}
                      onChange={(e) => updateReseau(i, 'nombre_abonnes', e.target.value)}
                      placeholder="Nombre d'abonnés"
                      className="w-full bg-transparent text-body outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Button fullWidth onClick={handleSave} disabled={loading} className="mt-2">
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}
