import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import * as feedApi from '../../api/feed'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { profileRoute } from '../../lib/profileRoute'

// Liste des abonnés (followers) ou abonnements (following) d'un utilisateur, avec
// bouton Suivre/Abonné inline pour chaque ligne — comme sur Instagram. Un seul écran
// gère les deux modes ("followers" | "following") suivant le paramètre d'URL.
export default function FollowList() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'following' ? 'following' : 'followers'
  const [tab, setTab] = useState(initialTab)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [myFollowingIds, setMyFollowingIds] = useState(new Set())
  const [headerName, setHeaderName] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)

      const headerNameResult = await feedApi.fetchUserHeaderName(id)
      if (!cancelled) setHeaderName(headerNameResult)

      const people = await feedApi.fetchFollowRows(id, tab)
      if (cancelled) return

      setRows(people)

      if (user?.id) {
        const myIds = await feedApi.fetchFollowingIds(user.id)
        if (!cancelled) setMyFollowingIds(myIds)
      }

      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id, tab, user?.id])

  const toggleFollow = async (targetId) => {
    if (!user?.id || targetId === user.id) return
    const alreadyFollowing = myFollowingIds.has(targetId)

    setMyFollowingIds((prev) => {
      const next = new Set(prev)
      if (alreadyFollowing) next.delete(targetId)
      else next.add(targetId)
      return next
    })

    if (alreadyFollowing) {
      await feedApi.unfollowUser(user.id, targetId)
    } else {
      await feedApi.followUser(user.id, targetId)
    }
  }

  return (
    <div>
      <header className="flex items-center gap-3 px-4 pt-6 pb-1">
        <button onClick={() => navigate(-1)} aria-label="Retour" className="w-8 h-8 flex items-center justify-center -ml-1">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-h1 truncate">{headerName}</h1>
      </header>

      <div className="flex px-4 mt-2 border-b border-[var(--border)]">
        {[
          { key: 'followers', label: 'Abonnés' },
          { key: 'following', label: 'Abonnements' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-3 text-body-medium text-center border-b-2 -mb-px transition-colors"
            style={{
              borderColor: tab === t.key ? 'var(--text-primary)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center mx-4 py-16">
          <p className="text-body text-[var(--text-secondary)]">
            {tab === 'followers' ? 'Aucun abonné pour le moment.' : "Ne suit personne pour l'instant."}
          </p>
        </div>
      ) : (
        <div>
          {rows.map((p) => {
            const isMe = p.id === user?.id
            const isFollowing = myFollowingIds.has(p.id)
            return (
              <div key={p.id} className="w-full flex items-center gap-3 px-4 py-2.5">
                <button
                  onClick={() => navigate(profileRoute(p.id, p.role))}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <Avatar src={p.photo_url} seed={p.id} size="lg" />
                  <div className="min-w-0">
                    <p className="text-small-medium flex items-center gap-1 truncate">
                      <span className="truncate">{p.nom_complet}</span>
                      {p.profils_influenceur?.verifie && <VerifiedBadge size={13} />}
                    </p>
                  </div>
                </button>
                {!isMe && (
                  <Button
                    variant={isFollowing ? 'glass' : 'primary'}
                    shape="rect"
                    className="shrink-0"
                    onClick={() => toggleFollow(p.id)}
                  >
                    {isFollowing ? 'Abonné' : 'Suivre'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
