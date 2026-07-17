import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function ConversationsList() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const { user, profile, influencerProfile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      let query = supabase
        .from('conversations')
        .select(`
          id, updated_at,
          client:client_id(nom_complet, photo_url),
          profils_influenceur(id, users(nom_complet, photo_url)),
          offres(titre),
          messages(contenu, created_at, is_system)
        `)
        .order('updated_at', { ascending: false })

      if (profile?.role === 'influenceur' && influencerProfile) {
        query = query.eq('influenceur_id', influencerProfile.id)
      } else {
        query = query.eq('client_id', user.id)
      }

      const { data } = await query
      setConversations(data || [])
      setLoading(false)
    }
    if (user) load()
  }, [user, profile, influencerProfile])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-h1">Messages</h1>
      </header>

      {conversations.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center mx-4">
          <p className="text-[var(--text-secondary)]">Aucune conversation pour le moment.</p>
        </div>
      ) : (
        <div className="px-2">
          {conversations.map((c) => {
            const isInfluencer = profile?.role === 'influenceur'
            const other = isInfluencer ? c.client : c.profils_influenceur?.users
            const lastMsg = c.messages?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

            return (
              <div
                key={c.id}
                onClick={() => navigate(`/messages/${c.id}`)}
                className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors"
              >
                <img
                  src={other?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${c.id}`}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-body-medium">{other?.nom_complet}</p>
                  <p className="text-caption truncate">
                    {lastMsg?.contenu || (c.offres?.titre && `Offre : ${c.offres.titre}`) || 'Nouvelle conversation'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
