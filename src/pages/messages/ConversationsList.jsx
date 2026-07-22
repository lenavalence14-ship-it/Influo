import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { timeShort } from '../../lib/time'
import NoteBar from '../feed/NoteBar'

// Un message supprimé "pour moi" ne doit jamais apparaître dans MON aperçu
// (deleted_for est propre à chacun, l'autre le voit toujours normalement).
// Un message supprimé "pour tous" en revanche RESTE le dernier message de la
// conversation : il doit continuer à apparaître comme aperçu, mais sous forme
// de "Ce message a été supprimé", pas disparaître au profit du message précédent.
function isVisibleForMe(m, myId) {
  if (!m) return false
  if (m.deleted_for?.includes(myId)) return false
  return true
}

export default function ConversationsList() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const { user, profile, influencerProfile, clientProfile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      try {
        let normalQuery = supabase
          .from('conversations')
          .select(`
            id, updated_at, client_last_read_at, influenceur_last_read_at,
            client:client_id(nom_complet, photo_url),
            profils_influenceur(id, verifie, users(nom_complet, photo_url)),
            offres(titre),
            messages(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
          `)
          .order('updated_at', { ascending: false })

        if (profile?.role === 'influenceur' && influencerProfile) {
          normalQuery = normalQuery.eq('influenceur_id', influencerProfile.id)
        } else {
          normalQuery = normalQuery.eq('client_id', user.id)
        }

        let proQuery = null
        if (profile?.role === 'utilisateur_simple') {
          proQuery = supabase
            .from('conversations_pro')
            .select(`
              id, updated_at, utilisateur_last_read_at, client_last_read_at,
              client:client_id(id, users(nom_complet, photo_url)),
              messages_pro(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
            `)
            .eq('utilisateur_id', user.id)
            .order('updated_at', { ascending: false })
        } else if (profile?.role === 'client' && clientProfile?.id) {
          proQuery = supabase
            .from('conversations_pro')
            .select(`
              id, updated_at, utilisateur_last_read_at, client_last_read_at,
              utilisateur:utilisateur_id(nom_complet, photo_url),
              messages_pro(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
            `)
            .eq('client_id', clientProfile.id)
            .order('updated_at', { ascending: false })
        }

        // conversations_biz = entreprise ↔ entreprise (nouveau système, symétrique :
        // le compte peut être client_a ou client_b selon qui a démarré la conversation).
        let bizQuery = null
        if (profile?.role === 'client' && clientProfile?.id) {
          bizQuery = supabase
            .from('conversations_biz')
            .select(`
              id, updated_at, client_a_id, client_b_id, client_a_last_read_at, client_b_last_read_at,
              client_a:client_a_id(id, users(nom_complet, photo_url)),
              client_b:client_b_id(id, users(nom_complet, photo_url)),
              messages_biz(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
            `)
            .or(`client_a_id.eq.${clientProfile.id},client_b_id.eq.${clientProfile.id}`)
            .order('updated_at', { ascending: false })
        }

        // conversations_sociale = utilisateur_simple ↔ utilisateur_simple, même logique
        // symétrique que conversations_biz mais référence users.id directement.
        let socialeQuery = null
        if (profile?.role === 'utilisateur_simple') {
          socialeQuery = supabase
            .from('conversations_sociale')
            .select(`
              id, updated_at, user_a_id, user_b_id, user_a_last_read_at, user_b_last_read_at,
              user_a:user_a_id(id, nom_complet, photo_url),
              user_b:user_b_id(id, nom_complet, photo_url),
              messages_sociale(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
            `)
            .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
            .order('updated_at', { ascending: false })
        }

        const [normalResult, proResult, bizResult, socialeResult] = await Promise.all([
          normalQuery,
          proQuery ? proQuery : Promise.resolve({ data: [] }),
          bizQuery ? bizQuery : Promise.resolve({ data: [] }),
          socialeQuery ? socialeQuery : Promise.resolve({ data: [] }),
        ])

        // Chaque requête Supabase peut échouer sans throw (elle renvoie { error }) :
        // avant, une erreur ici passait inaperçue et laissait le spinner tourner
        // indéfiniment puisque rien ne le signalait ni ne redonnait la main au rendu.
        for (const r of [normalResult, proResult, bizResult, socialeResult]) {
          if (r?.error) console.error('Erreur chargement conversations :', r.error)
        }

        const normalized = [
          ...(normalResult?.data || []).map((c) => ({ ...c, kind: 'normal' })),
          ...((proResult?.data) || []).map((c) => ({ ...c, kind: 'pro' })),
          ...((bizResult?.data) || []).map((c) => ({ ...c, kind: 'biz' })),
          ...((socialeResult?.data) || []).map((c) => ({ ...c, kind: 'sociale' })),
        ].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))

        setConversations(normalized)
      } catch (err) {
        // Une exception JS (réseau, timeout...) ne doit plus laisser le spinner
        // tourner indéfiniment : on l'affiche vide plutôt que de bloquer l'écran.
        console.error('Erreur chargement conversations :', err)
        setConversations([])
      } finally {
        setLoading(false)
      }
    }
    if (user) load()
  }, [user, profile, influencerProfile, clientProfile])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  const getOther = (c) => {
    if (c.kind === 'biz') {
      const isSideA = c.client_a_id === clientProfile?.id
      return isSideA ? c.client_b?.users : c.client_a?.users
    }
    if (c.kind === 'sociale') {
      const isSideA = c.user_a_id === user?.id
      return isSideA ? c.user_b : c.user_a
    }
    if (c.kind === 'pro') {
      return profile?.role === 'client' ? c.utilisateur : c.client?.users
    }
    const isInfluencer = profile?.role === 'influenceur'
    return isInfluencer ? c.client : c.profils_influenceur?.users
  }

  const filtered = conversations.filter((c) => {
    if (!query.trim()) return true
    return getOther(c)?.nom_complet?.toLowerCase().includes(query.trim().toLowerCase())
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

      <NoteBar />

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center mx-4">
          <p className="text-[var(--text-secondary)]">
            {conversations.length === 0 ? 'Aucune conversation pour le moment.' : 'Aucun résultat.'}
          </p>
        </div>
      ) : (
        <div className="px-2">
          {filtered.map((c) => {
            const isPro = c.kind === 'pro'
            const isBiz = c.kind === 'biz'
            const isSociale = c.kind === 'sociale'
            const isInfluencer = profile?.role === 'influenceur'
            const other = getOther(c)

            const rawMsgList = isBiz ? c.messages_biz : isPro ? c.messages_pro : isSociale ? c.messages_sociale : c.messages
            // On exclut d'abord les messages que MOI j'ai supprimés (pour moi ou pour
            // tous) : mon aperçu ne doit jamais s'appuyer dessus, même si l'autre les
            // voit encore de son côté.
            const myVisibleMsgs = (rawMsgList || [])
              .filter((m) => isVisibleForMe(m, user?.id))
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

            const lastMsg = myVisibleMsgs[myVisibleMsgs.length - 1]

            let myReadAt = null
            let otherReadAt = null
            let lastMsgIsMine = false

            if (isBiz) {
              const isSideA = c.client_a_id === clientProfile?.id
              myReadAt = isSideA ? c.client_a_last_read_at : c.client_b_last_read_at
              otherReadAt = isSideA ? c.client_b_last_read_at : c.client_a_last_read_at
              lastMsgIsMine = lastMsg?.sender_id === clientProfile?.id
            } else if (isSociale) {
              const isSideA = c.user_a_id === user?.id
              myReadAt = isSideA ? c.user_a_last_read_at : c.user_b_last_read_at
              otherReadAt = isSideA ? c.user_b_last_read_at : c.user_a_last_read_at
              lastMsgIsMine = lastMsg?.sender_id === user?.id
            } else if (isPro) {
              const isUtilisateur = profile?.role === 'utilisateur_simple'
              myReadAt = isUtilisateur ? c.utilisateur_last_read_at : c.client_last_read_at
              otherReadAt = isUtilisateur ? c.client_last_read_at : c.utilisateur_last_read_at
              lastMsgIsMine = lastMsg?.sender_id === user.id
            } else {
              myReadAt = isInfluencer ? c.influenceur_last_read_at : c.client_last_read_at
              otherReadAt = isInfluencer ? c.client_last_read_at : c.influenceur_last_read_at
              lastMsgIsMine = lastMsg?.sender_id === user.id
            }

            const seenByOther = lastMsgIsMine && otherReadAt && lastMsg?.created_at && new Date(otherReadAt) > new Date(lastMsg.created_at)

            // Un message supprimé pour tous ne doit jamais compter comme "nouveau
            // message" (il n'y a plus rien à lire), ni faire gonfler "X nouveaux
            // messages" — mais il reste le dernier message affiché en aperçu.
            const unreadReceived = myVisibleMsgs.filter(
              (m) => !m.is_system && !m.is_deleted_for_all && m.sender_id !== user?.id && (!myReadAt || new Date(m.created_at) > new Date(myReadAt))
            )
            const isUnread = !lastMsgIsMine && unreadReceived.length > 0

            let previewText
            if (!lastMsg) {
              previewText = !isBiz && !isSociale && !isPro && c.offres?.titre ? `Offre : ${c.offres.titre}` : 'Nouvelle conversation'
            } else if (lastMsg.is_deleted_for_all) {
              previewText = 'Ce message a été supprimé'
            } else if (isUnread && unreadReceived.length > 1) {
              previewText = `${unreadReceived.length} nouveaux messages`
            } else if (lastMsgIsMine) {
              previewText = `Vous : ${lastMsg.contenu || (lastMsg.fichier_url ? 'Pièce jointe' : '')}`
            } else {
              previewText = lastMsg.contenu || (lastMsg.fichier_url ? 'Pièce jointe' : '')
            }

            const targetRoute = isBiz
              ? `/messages/biz/${c.id}`
              : isSociale
              ? `/messages/sociale/${c.id}`
              : isPro
              ? `/messages/pro/${c.id}`
              : `/messages/${c.id}`

            return (
              <div
                key={`${c.kind}-${c.id}`}
                onClick={() => navigate(targetRoute)}
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
                    {!isBiz && !isSociale && !isPro && !isInfluencer && c.profils_influenceur?.verifie && <VerifiedBadge size={14} />}
                  </p>
                  <p
                    className={`text-caption truncate ${
                      lastMsg?.is_deleted_for_all
                        ? 'italic text-[var(--text-secondary)]'
                        : isUnread
                        ? 'text-[var(--text-primary)] font-bold'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {previewText}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {lastMsg?.created_at && (
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {timeShort(lastMsg.created_at)}
                    </span>
                  )}
                  {isUnread ? (
                    <span className="w-2 h-2 rounded-full" style={{ background: '#a00' }} />
                  ) : (
                    seenByOther && (
                      <img
                        src={other?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${c.id}`}
                        alt="Vu"
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    )
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
