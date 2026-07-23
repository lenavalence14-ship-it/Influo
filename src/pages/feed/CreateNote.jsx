import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { X, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { compressImage } from '../../lib/mediaCompression'
import PhotoNoteEditor from './PhotoNoteEditor'
import { useNoteUpload } from '../../contexts/NoteUploadContext'

// Création (et édition) d'une note texte, façon "Nouvelle note"
// Facebook/Messenger (image de référence fournie). Une note dure 24h puis
// expire.
// IMPORTANT : chaque nouvelle note s'AJOUTE aux notes actives existantes de
// l'utilisateur, elle ne les remplace jamais. Les anciennes notes restent
// visibles jusqu'à leur expiration naturelle (24h) ou suppression manuelle
// par l'auteur depuis le viewer (façon status texte WhatsApp : plusieurs
// notes actives en même temps, chacune son propre segment).
//
// MODE ÉDITION : si l'URL contient ?edit=<noteId>, on charge le contenu de
// cette note existante, on pré-remplit le champ, et "Partager" devient
// "Enregistrer" -> update au lieu d'insert (expire_at n'est PAS prolongé).
//
// NOTE PHOTO : depuis cet écran, un bouton "Ajouter une photo" permet de
// choisir une image du téléphone puis d'ouvrir PhotoNoteEditor (crop, texte,
// filtre). Comme une note texte, une note photo expire au bout de 24h.
export default function CreateNote() {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const fileInputRef = useRef(null)
  const { startUpload, finishUpload } = useNoteUpload()

  // état de l'édition photo : null tant qu'aucune photo n'est choisie.
  // Il n'y a plus d'état "photoEdit" intermédiaire : dès que l'éditeur photo
  // valide avec "Publier", la note part directement en fond (voir
  // handlePhotoEditorDone) et cet écran redevient vide.
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('notes')
      .select('id, contenu, user_id')
      .eq('id', editId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data && data.user_id === user?.id) setText(data.contenu || '')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId, user?.id])

  const handlePickPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  // Publication réelle d'une note photo : compression + upload + insert.
  // Volontairement PAS awaité par l'appelant (fire-and-forget) : l'écran se
  // ferme immédiatement après l'appel et l'utilisateur revient au feed,
  // pendant que ceci continue en arrière-plan. startUpload/finishUpload
  // pilotent l'anneau lumineux tournant autour de l'avatar pendant ce temps.
  const publishPhotoNoteInBackground = async (userId, editedResult) => {
    startUpload(userId)
    try {
      const compressed = await compressImage(editedResult.file)
      const fileName = `${userId}/note-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('posts').upload(fileName, compressed)
      if (uploadError) return
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)

      await supabase.from('notes').insert({
        user_id: userId,
        contenu: editedResult.texte?.contenu || ' ',
        photo_url: urlData.publicUrl,
        filtre: editedResult.filtre,
        crop: editedResult.crop,
        texte_overlay: editedResult.texte?.contenu || null,
        texte_x: editedResult.texte?.x ?? 50,
        texte_y: editedResult.texte?.y ?? 50,
        texte_couleur: editedResult.texte?.couleur || '#ffffff',
        texte_police: editedResult.texte?.police || 'Inter',
        expire_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
    } finally {
      finishUpload(userId)
    }
  }

  // Appelé quand on appuie sur "Publier" dans l'éditeur photo (plus d'écran
  // intermédiaire pour les photos) : on lance la publication en tâche de
  // fond et on ferme tout de suite l'éditeur pour revenir au feed.
  const handlePhotoEditorDone = (result) => {
    publishPhotoNoteInBackground(user.id, result)
    navigate(-1)
  }

  const handlePhotoEditorCancel = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  // Note texte uniquement désormais (le cas photo est géré directement par
  // handlePhotoEditorDone ci-dessus, sans repasser par cet écran).
  const handlePublish = async () => {
    if (sending) return
    if (!text.trim()) return
    setSending(true)
    const { error } = editId
      ? await supabase.from('notes').update({ contenu: text.trim() }).eq('id', editId).eq('user_id', user.id)
      : await supabase.from('notes').insert({
          user_id: user.id,
          contenu: text.trim(),
          expire_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
    setSending(false)
    if (!error) navigate(-1)
  }

  // Écran d'édition photo (crop / texte / filtre) affiché par-dessus tant
  // qu'une photo est en cours de choix. Dès que "Publier" est pressé dans
  // l'éditeur, handlePhotoEditorDone publie en fond et quitte cet écran :
  // on ne revient donc jamais ici avec une photo "validée en attente".
  if (photoFile) {
    return (
      <PhotoNoteEditor
        file={photoFile}
        previewUrl={photoPreview}
        onCancel={handlePhotoEditorCancel}
        onDone={handlePhotoEditorDone}
      />
    )
  }

  const canPublish = Boolean(text.trim())

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePickPhoto}
      />

      <div className="flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center text-white">
          <X size={22} />
        </button>
        <p className="text-body-medium text-white">{editId ? 'Modifier la note' : 'Nouvelle note'}</p>
        <button
          onClick={handlePublish}
          disabled={!canPublish || sending || loading}
          className="text-body-medium disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
        >
          {editId ? 'Enregistrer' : 'Partager'}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          <div className="relative">
            {text.trim() && (
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-[#3a3a3c] text-white rounded-3xl rounded-bl-md px-4 py-2.5 max-w-[240px] text-center text-body">
                {text}
              </div>
            )}
            <img
              src={profile?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${user?.id}`}
              alt=""
              className="w-24 h-24 rounded-full object-cover"
            />
          </div>

          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Partagez vos idées…"
            maxLength={100}
            className="w-full bg-transparent text-white text-center text-body outline-none placeholder-white/50"
          />
        </div>

      {!editId && (
        <div className="px-4 pb-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{ background: '#1c1c1e' }}
          >
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              <ImageIcon size={18} className="text-white" />
            </span>
            <span className="text-white text-body">Ajouter une photo</span>
          </button>
        </div>
      )}

      <p className="text-center text-caption text-white/50 px-8 pb-[max(20px,env(safe-area-inset-bottom))]">
        Ta note est visible par tes contacts pendant 24 heures.
      </p>
    </div>
  )
}
