import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// Création d'une note texte, façon "Nouvelle note" Facebook/Messenger
// (image de référence fournie). Une note dure 24h puis expire.
// IMPORTANT : chaque nouvelle note s'AJOUTE aux notes actives existantes de
// l'utilisateur, elle ne les remplace jamais. Les anciennes notes restent
// visibles jusqu'à leur expiration naturelle (24h) ou suppression manuelle
// par l'auteur depuis le viewer (façon status texte WhatsApp : plusieurs
// notes actives en même temps, chacune son propre segment).
export default function CreateNote() {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const handlePublish = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    const { error } = await supabase.from('notes').insert({
      user_id: user.id,
      contenu: text.trim(),
      expire_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    setSending(false)
    if (!error) navigate(-1)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center text-white">
          <X size={22} />
        </button>
        <p className="text-body-medium text-white">Nouvelle note</p>
        <button
          onClick={handlePublish}
          disabled={!text.trim() || sending}
          className="text-body-medium disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
        >
          Partager
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

      <p className="text-center text-caption text-white/50 px-8 pb-[max(20px,env(safe-area-inset-bottom))]">
        Ta note est visible par tes contacts pendant 24 heures.
      </p>
    </div>
  )
}
