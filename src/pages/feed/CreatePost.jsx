import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { ArrowLeft, Image as ImageIcon, X } from 'lucide-react'

const FORMATS = [
  { value: 'carre', label: 'Carré · 1:1' },
  { value: 'horizontal', label: 'Horizontal · 4:3' },
  { value: 'vertical', label: 'Vertical · 4:5' },
]

export default function CreatePost() {
  const [searchParams] = useSearchParams()
  const isStory = searchParams.get('type') === 'story'
  const { influencerProfile } = useAuth()
  const navigate = useNavigate()

  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [legende, setLegende] = useState('')
  const [format, setFormat] = useState('carre')
  const [loading, setLoading] = useState(false)

  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files || [])
    setFiles(selected)
    setPreviews(selected.map((f) => URL.createObjectURL(f)))
  }

  const handlePublish = async () => {
    if (files.length === 0) return
    setLoading(true)

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        influenceur_id: influencerProfile.id,
        type: isStory ? 'story' : files.length > 1 ? 'carrousel' : 'photo',
        legende: isStory ? null : legende,
        crop_format: format,
        expire_at: isStory ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      setLoading(false)
      return
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileName = `${influencerProfile.id}/${post.id}/${i}-${file.name}`
      await supabase.storage.from('posts').upload(fileName, file)
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
      await supabase.from('post_medias').insert({ post_id: post.id, media_url: urlData.publicUrl, position: i })
    }

    setLoading(false)
    navigate('/')
  }

  return (
    <div className="px-5 pt-6 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="font-display text-2xl font-bold mb-6">
        {isStory ? 'Nouvelle story' : 'Nouvelle publication'}
      </h1>

      <label className="block cursor-pointer mb-4">
        {previews.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden glass">
                <img src={p} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="aspect-square rounded-3xl glass-strong flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
            <ImageIcon size={28} />
            <span className="text-sm">Choisir {isStory ? 'une photo' : 'une ou plusieurs photos'}</span>
          </div>
        )}
        <input type="file" accept="image/*" multiple={!isStory} onChange={handleFilesChange} className="hidden" />
      </label>

      {!isStory && (
        <>
          <label className="block mb-4">
            <span className="block text-sm mb-2 text-[var(--text-secondary)] font-medium">Format de recadrage</span>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={`flex-1 rounded-2xl py-2.5 text-xs font-medium transition-colors ${
                    format === f.value ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'glass'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </label>

          <label className="block mb-6">
            <span className="block text-sm mb-2 text-[var(--text-secondary)] font-medium">Légende</span>
            <textarea
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              rows={3}
              placeholder="Écris une légende..."
              className="w-full rounded-2xl px-4 py-3 glass outline-none resize-none text-sm"
            />
          </label>
        </>
      )}

      <Button fullWidth onClick={handlePublish} disabled={loading || files.length === 0}>
        {loading ? 'Publication...' : 'Publier'}
      </Button>
    </div>
  )
}
