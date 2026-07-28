import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X, Check, ImagePlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Aperçu + édition d'un template choisi dans la bibliothèque.
// L'utilisateur ne peut modifier QUE les blocs marqués `editable: true`
// par l'admin au moment de la création du template (voir
// admin/souvenirs/ValidationBlocsEditables.jsx). Les autres blocs sont
// affichés tels quels et ne réagissent à aucune interaction.
async function fetchTemplate(id) {
  const { data, error } = await supabase
    .from('templates')
    .select('id, image_url, background_type, background_valeur, blocs')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export default function TemplatePreview() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => fetchTemplate(templateId),
    enabled: Boolean(templateId),
  })

  // Copie locale modifiable des blocs, initialisée dès que le template
  // est chargé. On ne modifie jamais le template original en base : ce
  // sont les valeurs de contenu (texte tapé, photo choisie) que
  // l'utilisateur produit pour SON souvenir.
  const [blocsLocaux, setBlocsLocaux] = useState(null)
  const [blocActifId, setBlocActifId] = useState(null)

  if (blocsLocaux === null && template?.blocs) {
    setBlocsLocaux(template.blocs)
  }

  const blocs = blocsLocaux || template?.blocs || []
  const blocActif = blocs.find((b) => b.id === blocActifId) || null

  const majContenuTexte = (id, contenu) => {
    setBlocsLocaux((bs) => bs.map((b) => (b.id === id ? { ...b, contenu } : b)))
  }

  const handleChoisirPhoto = () => {
    fileInputRef.current?.click()
  }

  const handleFichierChoisi = (e) => {
    const fichier = e.target.files?.[0]
    if (!fichier || !blocActifId) return
    const previewUrl = URL.createObjectURL(fichier)
    setBlocsLocaux((bs) => bs.map((b) => (b.id === blocActifId ? { ...b, imageType: 'photo', imageValeur: previewUrl } : b)))
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Fermer"
          className="w-9 h-9 rounded-full flex items-center justify-center glass"
          style={{ color: '#fff' }}
        >
          <X size={18} />
        </button>
        {blocActif && (
          <button
            onClick={() => setBlocActifId(null)}
            aria-label="Terminer la modification"
            className="w-9 h-9 rounded-full flex items-center justify-center glass"
            style={{ color: '#fff' }}
          >
            <Check size={18} />
          </button>
        )}
      </header>

      <div className="flex-1 flex items-center justify-center px-4 pb-6 overflow-hidden">
        {isLoading && <span className="text-white/60 text-body">Chargement…</span>}

        {template && blocs.length === 0 && (
          // Templates créés avant l'ajout des blocs éditables : on
          // retombe sur l'ancien rendu (simple image), rien de cassé.
          <img src={template.image_url} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
        )}

        {template && blocs.length > 0 && (
          <div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              aspectRatio: '4 / 5',
              backgroundColor: template.background_type === 'couleur' ? template.background_valeur : '#e0e0e0',
              backgroundImage: template.background_type === 'photo' && template.background_valeur ? `url(${template.background_valeur})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {blocs.map((bloc) => (
              <BlocUtilisateur
                key={bloc.id}
                bloc={bloc}
                actif={bloc.id === blocActifId}
                onActiver={() => bloc.editable && setBlocActifId(bloc.id)}
                onChangeTexte={(val) => majContenuTexte(bloc.id, val)}
                onChoisirPhoto={handleChoisirPhoto}
              />
            ))}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFichierChoisi} className="hidden" />
    </div>
  )
}

function BlocUtilisateur({ bloc, actif, onActiver, onChangeTexte, onChoisirPhoto }) {
  const style = {
    position: 'absolute',
    left: `${bloc.x}%`, top: `${bloc.y}%`,
    width: `${bloc.width}%`, height: `${bloc.height}%`,
    outline: bloc.editable ? (actif ? '2px solid #3b82f6' : '2px dashed rgba(255,255,255,0.8)') : 'none',
    // Les blocs non éditables ne captent aucune interaction : ils sont
    // visuellement figés, comme demandé.
    pointerEvents: bloc.editable ? 'auto' : 'none',
    cursor: bloc.editable ? 'pointer' : 'default',
  }

  return (
    <div style={style} onClick={!actif ? onActiver : undefined}>
      {bloc.type === 'texte' && (
        actif ? (
          <textarea
            autoFocus
            value={bloc.contenu}
            onChange={(e) => onChangeTexte(e.target.value)}
            className="w-full h-full px-1 bg-transparent resize-none outline-none"
            style={{
              fontWeight: bloc.gras ? 'bold' : 'normal',
              fontStyle: bloc.italique ? 'italic' : 'normal',
              textDecoration: bloc.souligne ? 'underline' : 'none',
              color: bloc.couleur,
              textAlign: bloc.alignement,
              fontSize: `${bloc.taille}px`,
              lineHeight: 1.25,
            }}
          />
        ) : (
          <div
            className="w-full h-full flex overflow-hidden px-1"
            style={{
              fontWeight: bloc.gras ? 'bold' : 'normal',
              fontStyle: bloc.italique ? 'italic' : 'normal',
              textDecoration: bloc.souligne ? 'underline' : 'none',
              color: bloc.couleur,
              backgroundColor: bloc.fond || 'transparent',
              justifyContent: bloc.alignement === 'left' ? 'flex-start' : bloc.alignement === 'right' ? 'flex-end' : 'center',
              textAlign: bloc.alignement,
              fontSize: `${bloc.taille}px`,
              lineHeight: 1.25,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            <span style={{ width: '100%' }}>{bloc.contenu || ' '}</span>
          </div>
        )
      )}

      {bloc.type === 'photo' && (
        <div className="w-full h-full relative">
          <div
            className="w-full h-full"
            style={{
              backgroundColor: bloc.imageType === 'couleur' ? bloc.imageValeur : undefined,
              backgroundImage: bloc.imageType === 'photo' ? `url(${bloc.imageValeur})` : undefined,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              opacity: bloc.opacite,
            }}
          />
          {bloc.editable && actif && (
            <button
              onClick={(e) => { e.stopPropagation(); onChoisirPhoto() }}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              aria-label="Changer la photo"
            >
              <ImagePlus size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
