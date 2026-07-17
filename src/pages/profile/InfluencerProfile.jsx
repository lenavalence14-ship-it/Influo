import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import Button from '../../components/ui/Button'
import { LogOut } from 'lucide-react'

export default function InfluencerProfile() {
  const { id } = useParams() // id du profils_influenceur ; si absent, c'est "mon" profil
  const { user, profile, influencerProfile, signOut } = useAuth()
  const [target, setTarget] = useState(null)
  const [tab, setTab] = useState('publications')
  const [posts, setPosts] = useState([])
  const [offres, setOffres] = useState([])
  const [reseaux, setReseaux] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const targetId = id || influencerProfile?.id
  const isMe = !id || id === influencerProfile?.id

  const reloadOffres = async () => {
    const offresQuery = supabase.from('offres').select('*').eq('influenceur_id', targetId).order('created_at', { ascending: false })
    const { data } = isMe ? await offresQuery : await offresQuery.eq('actif', true)
    setOffres(data || [])
  }

  const offresAffichees = isMe ? offres : offres.filter((o) => o.actif)

  useEffect(() => {
    if (!targetId) { setLoading(false); return }

    const load = async () => {
      const { data: prof } = await supabase
        .from('profils_influenceur')
        .select('*, users(nom_complet, photo_url, email)')
        .eq('id', targetId)
        .maybeSingle()
      setTarget(prof)

      const { data: postsData } = await supabase
        .from('posts')
        .select('id, legende, crop_format, post_medias(media_url)')
        .eq('influenceur_id', targetId)
        .in('type', ['photo', 'carrousel'])
        .order('created_at', { ascending: false })
      setPosts(postsData || [])

      const offresQuery = supabase.from('offres').select('*').eq('influenceur_id', targetId).order('created_at', { ascending: false })
      const { data: offresData } = isMe ? await offresQuery : await offresQuery.eq('actif', true)
      setOffres(offresData || [])

      const { data: reseauxData } = await supabase
        .from('reseaux_sociaux')
        .select('*')
        .eq('influenceur_id', targetId)
      setReseaux(reseauxData || [])

      setLoading(false)
    }
    load()
  }, [targetId])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (!target) {
    return (
      <div className="p-6 text-center text-[var(--text-secondary)]">
        Profil introuvable.
      </div>
    )
  }

  const totalAbonnes = reseaux.reduce((sum, r) => sum + (r.nombre_abonnes || 0), 0)

  return (
    <div>
      {/* header profil */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-5">
          <img
            src={target.users?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${target.id}`}
            alt=""
            className="w-20 h-20 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <h1 className="font-display font-bold text-lg">{target.users?.nom_complet}</h1>
              {target.verifie && <VerifiedBadge size={17} />}
            </div>
            <div className="flex gap-4 text-sm">
              <span><strong>{posts.length}</strong> <span className="text-[var(--text-secondary)]">publications</span></span>
              <span><strong>{totalAbonnes.toLocaleString()}</strong> <span className="text-[var(--text-secondary)]">abonnés</span></span>
              <span><strong>{offres.length}</strong> <span className="text-[var(--text-secondary)]">offres</span></span>
            </div>
          </div>
        </div>

        {target.bio && <p className="text-sm mt-4">{target.bio}</p>}
        {(target.pays || target.ville) && (
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {[target.ville, target.pays].filter(Boolean).join(', ')}
          </p>
        )}

        {/* réseaux sociaux en pills */}
        {reseaux.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {reseaux.map((r) => (
              <a
                key={r.id}
                href={r.lien_profil}
                target="_blank"
                rel="noreferrer"
                className="glass rounded-full px-3 py-1.5 text-xs font-medium"
              >
                {r.plateforme} · {r.nombre_abonnes?.toLocaleString()}
              </a>
            ))}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {isMe ? (
            <>
              <Button variant="glass" fullWidth onClick={() => navigate('/profil/modifier')}>
                Modifier le profil
              </Button>
              <Button variant="glass" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
            </>
          ) : (
            <>
              <Button fullWidth>Suivre</Button>
              <Button variant="glass" fullWidth onClick={() => navigate(`/messages/nouveau?influenceur=${target.id}`)}>
                Contacter
              </Button>
            </>
          )}
        </div>

        {isMe && (
          <button
            onClick={async () => { await signOut(); navigate('/connexion') }}
            className="flex items-center gap-2 text-sm text-red-400 mt-4"
          >
            <LogOut size={15} /> Se déconnecter
          </button>
        )}
      </div>

      {/* onglets */}
      <div className="flex border-t border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-base)]/90 backdrop-blur-xl z-20">
        <button
          onClick={() => setTab('publications')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'publications' ? 'border-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'
          }`}
        >
          Publications
        </button>
        <button
          onClick={() => setTab('offres')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'offres' ? 'border-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'
          }`}
        >
          Offres
        </button>
      </div>

      {/* contenu onglet */}
      {tab === 'publications' ? (
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {posts.length === 0 ? (
            <div className="col-span-3 py-16 text-center text-[var(--text-secondary)] text-sm">
              Aucune publication.
            </div>
          ) : (
            posts.map((p) => (
              <div key={p.id} className="aspect-square bg-black/20">
                {p.post_medias?.[0]?.media_url && (
                  <img src={p.post_medias[0].media_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {isMe && (
            <button
              onClick={() => navigate('/offre/nouvelle')}
              className="glass rounded-2xl px-4 py-3 text-sm font-medium w-full"
            >
              + Nouvelle offre
            </button>
          )}
          {offresAffichees.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-secondary)] text-sm">
              Aucune offre disponible.
            </div>
          ) : (
            offresAffichees.map((o) => (
              <OfferCard key={o.id} offre={o} editable={isMe} onChange={reloadOffres} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function OfferCard({ offre, editable, onChange }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleToggleActive = async (e) => {
    e.stopPropagation()
    await supabase.from('offres').update({ actif: !offre.actif }).eq('id', offre.id)
    setMenuOpen(false)
    onChange?.()
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!window.confirm('Supprimer cette offre définitivement ?')) return
    await supabase.from('offres').delete().eq('id', offre.id)
    setMenuOpen(false)
    onChange?.()
  }

  const handleEdit = (e) => {
    e.stopPropagation()
    navigate(`/offre/${offre.id}/modifier`)
  }

  return (
    <div
      className="glass-strong rounded-3xl overflow-hidden cursor-pointer relative"
      onClick={() => navigate(`/offre/${offre.id}`)}
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-white/10 to-transparent">
        {offre.photo_url ? (
          <img src={offre.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] text-sm">
            Aucune image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {!offre.actif && (
          <div className="absolute top-3 left-3 glass rounded-full px-2.5 py-1 text-xs text-white">
            Désactivée
          </div>
        )}

        {editable && (
          <div className="absolute top-3 right-3">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((m) => !m) }}
              className="glass rounded-full p-2 text-white"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 glass-strong rounded-2xl overflow-hidden w-40 z-10">
                <button onClick={handleEdit} className="block w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10">
                  Modifier
                </button>
                <button onClick={handleToggleActive} className="block w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10">
                  {offre.actif ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={handleDelete} className="block w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/10">
                  Supprimer
                </button>
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-white font-display font-bold text-lg">{offre.titre}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white font-semibold">{offre.prix} €</span>
            <span className="text-white/70 text-sm">{offre.delai_jours}j de délai</span>
          </div>
        </div>
      </div>
    </div>
  )
}
