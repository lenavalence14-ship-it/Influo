import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { timeShort } from '../../lib/time'
import StoryBar from '../feed/StoryBar'

export default function ConversationsList() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const { user, profile, influencerProfile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      let query = supabase
        .from('conversations')
        .select(`
          id, updated_at, client_last_read_at, influenceur_last_read_at,
          client:client_id(nom_complet, photo_url),
          profils_influenceur(id, verifie, users(nom_complet, photo_url)),
          offres(titre),
          messages(contenu, created_at, is_system, sender_id)
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

  const filtered = conversations.filter((c) => {
    if (!query.trim()) return true
    const isInfluencer = profile?.role === 'influenceur'
    const other = isInfluencer ? c.client : c.profils_influenceur?.users
    return other?.nom_complet?.toLowerCase().includes(query.trim().toLowerCase())
  })

  return (
    <div>
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-h1 mb-4">Discussion</h1>
        <div className="glass rounded-full flex items-center gap-2 px-4 h-11">
          <Search size={16} className="text-[var(--text-secondary)] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher"
            className="flex-1 bg-transparent outline-none text-body placeholder:text-[var(--text-secondary)]"
          />
        </div>
      </header>

      <StoryBar />

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center mx-4">
          <p className="text-[var(--text-secondary)]">
            {conversations.length === 0 ? 'Aucune conversation pour le moment.' : 'Aucun résultat.'}
          </p>
        </div>
      ) : (
        <div className="px-2">
          {filtered.map((c) => {
            const isInfluencer = profile?.role === 'influenceur'
            const other = isInfluencer ? c.client : c.profils_influenceur?.users
            const lastMsg = c.messages?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

            // "vu" façon Messenger : petit avatar de l'autre, si mon dernier message a été lu
            const otherReadAt = isInfluencer ? c.client_last_read_at : c.influenceur_last_read_at
            const lastMsgIsMine = lastMsg?.sender_id === user.id
            const seenByOther = lastMsgIsMine && otherReadAt && lastMsg?.created_at && new Date(otherReadAt) > new Date(lastMsg.created_at)

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
                  <p className="text-body-medium flex items-center gap-1.5">
                    {other?.nom_complet}
                    {!isInfluencer && c.profils_influenceur?.verifie && <VerifiedBadge size={14} />}
                  </p>
                  <p className="text-caption truncate">
                    {lastMsg?.contenu || (c.offres?.titre && `Offre : ${c.offres.titre}`) || 'Nouvelle conversation'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {lastMsg?.created_at && (
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {timeShort(lastMsg.created_at)}
                    </span>
                  )}
                  {seenByOther && (
                    <img
                      src={other?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${c.id}`}
                      alt="Vu"
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}