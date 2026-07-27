import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MoreHorizontal, Bookmark, Heart, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import BottomSheet from '../../components/ui/BottomSheet'

// Bibliothèque de templates (grille masonry façon Pinterest) pour une
// catégorie donnée (slug lu depuis l'URL, ex: 'bonne-fete-nouvelle-annee').
// La vignette cliquée EST le template final tel quel pour l'instant --
// l'édition (changer texte/photos) sera construite dans une étape
// ultérieure, pas ici. Onglets "Tout" / "Favoris" scopés à CETTE catégorie
// (chaque bibliothèque a ses propres favoris, pas un espace global).
async function fetchTemplates(categorie) {
  const { data, error } = await supabase
    .from('templates')
    .select('id, image_url, ordre')
    .eq('categorie', categorie)
    .order('ordre', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchFavoriteIds(userId, categorie) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('template_favoris')
    .select('template_id, templates!inner(categorie)')
    .eq('user_id', userId)
    .eq('templates.categorie', categorie)
  if (error) throw error
  return (data || []).map((f) => f.template_id)
}

// Répartit les templates entre 2 colonnes en assignant toujours la carte
// suivante à la colonne dont la hauteur cumulée est la plus faible à cet
// instant -- c'est ce qui crée un vrai désalignement Pinterest (pas un simple
// décalage figé), à condition qu'au moins une carte ait une hauteur
// différente des autres (ici : la carte Favoris épinglée, en paysage).
function assignMasonryColumns(items) {
  const colHeights = [0, 0]
  const columns = [[], []]
  for (const item of items) {
    const col = colHeights[0] <= colHeights[1] ? 0 : 1
    columns[col].push(item)
    colHeights[col] += item.heightRatio
  }
  return columns
}

export default function TemplateLibrary() {
  const { categorie } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('tout') // 'tout' | 'favoris'
  const [menuTemplateId, setMenuTemplateId] = useState(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', categorie],
    queryFn: () => fetchTemplates(categorie),
    enabled: Boolean(categorie),
  })

  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['template-favoris', user?.id, categorie],
    queryFn: () => fetchFavoriteIds(user?.id, categorie),
    enabled: Boolean(user?.id && categorie),
  })

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const toggleFavori = async (templateId) => {
    setMenuTemplateId(null)
    const isFav = favoriteSet.has(templateId)
    // optimiste : met à jour le cache local avant la réponse serveur
    queryClient.setQueryData(['template-favoris', user?.id, categorie], (old = []) =>
      isFav ? old.filter((id) => id !== templateId) : [...old, templateId]
    )
    if (isFav) {
      await supabase.from('template_favoris').delete().match({ template_id: templateId, user_id: user.id })
    } else {
      await supabase.from('template_favoris').insert({ template_id: templateId, user_id: user.id })
    }
  }

  const visibleTemplates = tab === 'favoris' ? templates.filter((t) => favoriteSet.has(t.id)) : templates

  // items masonry : chaque template normal a heightRatio=1 (ratio 4:5 fixe
  // entre eux) ; la carte Favoris épinglée (uniquement dans l'onglet "Tout")
  // a un heightRatio plus petit (paysage) pour amorcer le désalignement.
  const masonryItems = useMemo(() => {
    const base = visibleTemplates.map((t) => ({ type: 'template', id: t.id, image_url: t.image_url, heightRatio: 1 }))
    const withFavoris = tab === 'tout'
      ? [{ type: 'favoris-card', id: '__favoris__', heightRatio: 0.55 }, ...base]
      : base
    if (isAdmin && tab === 'tout') {
      return [{ type: 'add-template-card', id: '__add_template__', heightRatio: 0.55 }, ...withFavoris]
    }
    return withFavoris
  }, [visibleTemplates, tab, isAdmin])

  const columns = assignMasonryColumns(masonryItems)

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="w-9 h-9 rounded-full flex items-center justify-center glass"
          style={{ color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-display" style={{ color: 'var(--text-primary)', fontSize: '18px' }}>
          Choisissez un modèle
        </h1>
      </header>

      {/* onglets Tout / Favoris, scopés à cette catégorie uniquement */}
      <div className="flex items-center gap-6 px-4 pt-2 pb-3">
        <button
          onClick={() => setTab('tout')}
          className="text-body-medium pb-1"
          style={{
            color: tab === 'tout' ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderBottom: tab === 'tout' ? '2px solid var(--text-primary)' : '2px solid transparent',
          }}
        >
          Tout
        </button>
        <button
          onClick={() => setTab('favoris')}
          className="text-body-medium pb-1"
          style={{
            color: tab === 'favoris' ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderBottom: tab === 'favoris' ? '2px solid var(--text-primary)' : '2px solid transparent',
          }}
        >
          Favoris
        </button>
      </div>

      {isLoading && (
        <div className="px-4 pt-10 text-center text-body" style={{ color: 'var(--text-secondary)' }}>
          Chargement…
        </div>
      )}

      {!isLoading && tab === 'tout' && templates.length === 0 && (
        <div className="px-4 pt-10 text-center text-body" style={{ color: 'var(--text-secondary)' }}>
          Aucun modèle disponible pour l'instant. Revenez bientôt !
        </div>
      )}

      {!isLoading && tab === 'favoris' && visibleTemplates.length === 0 && (
        <div className="px-4 pt-10 text-center text-body" style={{ color: 'var(--text-secondary)' }}>
          Aucun favori dans cette bibliothèque pour l'instant.
        </div>
      )}

      {!isLoading && masonryItems.length > 0 && (
        <div className="px-4 grid grid-cols-2 gap-3 items-start">
          {columns.map((col, colIndex) => (
            <div key={colIndex} className="flex flex-col gap-3">
              {col.map((item) =>
                item.type === 'favoris-card' ? (
                  <button
                    key={item.id}
                    onClick={() => setTab('favoris')}
                    className="glass rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-[0.97] transition-transform duration-150"
                    style={{ aspectRatio: '5 / 3', color: 'var(--text-primary)' }}
                  >
                    <Bookmark size={24} />
                    <span className="text-caption font-medium">Favoris</span>
                  </button>
                ) : item.type === 'add-template-card' ? (
                  <button
                    key={item.id}
                    className="glass-strong rounded-2xl flex flex-col items-center justify-center gap-2"
                    style={{ aspectRatio: '5 / 3', color: 'var(--text-primary)' }}
                  >
                    <Plus size={24} />
                    <span className="text-caption font-medium">Ajouter un template</span>
                  </button>
                ) : (
                  <div key={item.id} className="relative">
                    <button
                      onClick={() => navigate(`/souvenirs/apercu/${item.id}`)}
                      className="glass rounded-2xl overflow-hidden w-full active:scale-[0.97] transition-transform duration-150 block"
                      style={{ aspectRatio: '4 / 5' }}
                    >
                      <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                    </button>
                    {!isAdmin && (
                    <button
                      onClick={() => setMenuTemplateId(item.id)}
                      aria-label="Options"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center glass"
                      style={{ color: '#fff' }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    )}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {menuTemplateId && (
        <BottomSheet onClose={() => setMenuTemplateId(null)}>
          <button
            onClick={() => toggleFavori(menuTemplateId)}
            className="w-full flex items-center gap-3 px-5 py-3 text-body"
            style={{ color: 'var(--text-primary)' }}
          >
            <Heart size={18} fill={favoriteSet.has(menuTemplateId) ? 'currentColor' : 'none'} />
            {favoriteSet.has(menuTemplateId) ? 'Retirer des favoris' : 'Mettre en favoris'}
          </button>
        </BottomSheet>
      )}
    </div>
  )
}
