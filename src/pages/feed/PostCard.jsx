import { memo, useEffect, useRef, useState } from 'react'
import { Heart, MessageCircle, Send, MoreHorizontal, X, Trash2, Pencil, Volume2, VolumeX, Repeat2, Bookmark } from 'lucide-react'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { InstagramIcon, TikTokIcon } from '../../components/ui/SocialIcons'
import Avatar from '../../components/ui/Avatar'
import BottomSheet from '../../components/ui/BottomSheet'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import CommentsSheet from './CommentsSheet'
import { useActiveStories } from '../../hooks/useActiveStories'
import { timeAgo } from '../../lib/time'
import { getFilterCss } from './editor/FilterPicker'
import { CROP_ASPECT_CLASSES, getCropTransformStyle } from '../../lib/mediaCrop'
import { getFontStyle } from './PhotoNoteEditor'

const cropClasses = CROP_ASPECT_CLASSES

// Rendu du texte overlay stocké sur un média (texte_overlay/x/y/couleur/police),
// en lecture seule (pas de drag ici, contrairement à l'éditeur) -- même
// positionnement (% ancré au centre) et même style que DraggableElement dans
// CreatePost.jsx/PhotoNoteEditor.jsx, pour un rendu identique à ce que
// l'utilisateur a validé à la publication.
function TextOverlay({ media }) {
  if (!media?.texte_overlay) return null
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{ left: `${media.texte_x ?? 50}%`, top: `${media.texte_y ?? 50}%` }}
    >
      <p
        className="text-center px-3 max-w-[80vw] whitespace-pre-wrap"
        style={{ color: media.texte_couleur || '#ffffff', fontSize: 28, textShadow: '0 1px 6px rgba(0,0,0,0.5)', ...getFontStyle(media.texte_police) }}
      >
        {media.texte_overlay}
      </p>
    </div>
  )
}

// Style de rendu d'UN média précis (photo ou vidéo), à partir de son crop
// zoom/pan stocké en base (post_medias.zoom/offset_x/offset_y/natural_width/
// natural_height). C'est la MÊME fonction (getCropTransformStyle, lib/mediaCrop)
// qu'utilise l'éditeur en aperçu temps réel : le feed ne recalcule jamais un
// cadrage différent, il rejoue exactement celui choisi à la publication.
function getMediaCropStyle(media, cropFormat) {
  return getCropTransformStyle({
    naturalWidth: media?.natural_width,
    naturalHeight: media?.natural_height,
    cropFormat,
    zoom: media?.zoom,
    offsetX: media?.offset_x,
    offsetY: media?.offset_y,
  })
}

// Légende avec troncature façon Instagram : le texte est coupé pile là où
// s'arrêterait la moitié de la 2e ligne visuelle, et "...voir plus" est collé
// directement à la suite du texte coupé (pas en dessous, pas un bloc séparé).
// Contrairement à un clip par hauteur de boîte (qui coupe n'importe où dans
// le rendu final), on cherche ici le nombre de caractères exact à garder par
// recherche binaire sur la largeur réelle rendue, dans une copie invisible du
// texte mesurée en pixels -- donc la coupure tombe bien "en plein milieu" de
// la 2e ligne, comme demandé, et pas seulement à une hauteur donnée.
function CaptionWithSeeMore({ legende, authorName, hasLikeLine }) {
  const [expanded, setExpanded] = useState(false)
  const [cutIndex, setCutIndex] = useState(null) // null = pas encore mesuré, ou pas besoin de couper
  const containerRef = useRef(null) // <p> visible, sert de référence de largeur/police
  const measureRef = useRef(null) // clone caché, même style, pour mesurer sans affecter le rendu

  useEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    // largeur disponible pour le texte = largeur du <p>, moins la largeur du
    // nom d'auteur + son espace (ils sont sur la même ligne, en display:inline)
    const authorSpan = container.querySelector('[data-author]')
    const authorWidth = authorSpan ? authorSpan.getBoundingClientRect().width : 0
    const fullWidth = container.getBoundingClientRect().width
    const lineHeight = parseFloat(getComputedStyle(container).lineHeight) || 16

    measure.style.width = `${fullWidth}px`
    measure.textContent = legende

    // hauteur réelle du texte à pleine largeur, une fois le nom déduit de la
    // première ligne seulement (measure a la même largeur totale que container,
    // donc on simule le début de ligne en mettant un espaceur invisible de la
    // largeur du nom d'auteur, exactement comme le fera le rendu final)
    const spacerWidth = authorWidth
    measure.style.textIndent = `${spacerWidth}px`
    const fullHeight = measure.getBoundingClientRect().height

    // si le texte tient sur 1 ligne complète (en tenant compte du nom devant),
    // pas besoin de "voir plus"
    if (fullHeight <= lineHeight + 1) {
      setCutIndex(null)
      return
    }

    // cible : hauteur de 1 ligne pleine + moitié de la 2e ligne
    const targetHeight = lineHeight * 1.5

    // recherche binaire du nombre de caractères qui, une fois rendus (avec le
    // même textIndent simulant le nom d'auteur), donnent une hauteur proche
    // de targetHeight sans la dépasser
    let lo = 0
    let hi = legende.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi + 1) / 2)
      measure.textContent = legende.slice(0, mid) + '...voir plus'
      const h = measure.getBoundingClientRect().height
      if (h <= targetHeight) {
        lo = mid
      } else {
        hi = mid - 1
      }
    }
    setCutIndex(lo < legende.length ? lo : null)
  }, [legende])

  const displayText = expanded || cutIndex === null ? legende : legende.slice(0, cutIndex)

  return (
    <p ref={containerRef} className={`px-3 leading-[16px] ${hasLikeLine ? 'pt-0.5' : 'pt-1'}`} style={{ color: 'var(--text-primary)' }}>
      <span data-author className="font-medium mr-1 text-[13px]">{authorName}</span>
      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        {displayText}
        {!expanded && cutIndex !== null && (
          <>
            ...
            <button onClick={() => setExpanded(true)} className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              voir plus
            </button>
          </>
        )}
        {expanded && cutIndex !== null && (
          <>
            {' '}
            <button onClick={() => setExpanded(false)} className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              voir moins
            </button>
          </>
        )}
      </span>
      {/* clone invisible utilisé uniquement pour mesurer, jamais affiché */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="text-[12px]"
        style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', top: -9999, left: -9999, pointerEvents: 'none' }}
      />
    </p>
  )
}

function PostCard({ post, onDeleted, autoOpenComments = false, priority = false, muted: mutedProp, onToggleMute: onToggleMuteProp }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [commentCount, setCommentCount] = useState(post.comment_count || 0)
  const [showComments, setShowComments] = useState(autoOpenComments)
  const [showMenu, setShowMenu] = useState(false)
  const [deleted, setDeleted] = useState(false)
  // le son est partagé entre toutes les vidéos du feed quand le parent (Feed.jsx)
  // passe muted/onToggleMute ; sinon (ex: PostDetail, une seule carte affichée)
  // on retombe sur un état local propre à cette carte
  const [localMuted, setLocalMuted] = useState(true)
  const muted = mutedProp ?? localMuted
  const onToggleMute = onToggleMuteProp ?? (() => setLocalMuted((m) => !m))
  // le média (vidéo) n'est monté dans le DOM que quand la carte approche de l'écran.
  // Pour les toutes premières cartes du feed (priority), on le monte immédiatement
  // pour éviter un flash vide au premier affichage.
  const [mediaMounted, setMediaMounted] = useState(priority)
  const videoRef = useRef(null)
  const mediaContainerRef = useRef(null)
  const carrouselRef = useRef(null)
  const [carrouselIndex, setCarrouselIndex] = useState(0)

  const influencer = post.profils_influenceur
  const isOwner = influencer?.user_id === user?.id

  // collaboration vérifiée : ce post découle d'une commande validée
  const isCollabVerifiee = Boolean(post.commande_id)
  const client = post.client
  const lienInstagram = post.commandes?.lien_instagram
  const lienTiktok = post.commandes?.lien_tiktok

  const toggleLike = async () => {
    if (liked) {
      setLiked(false)
      setLikeCount((c) => c - 1)
      await supabase.from('post_likes').delete().match({ post_id: post.id, user_id: user.id })
    } else {
      setLiked(true)
      setLikeCount((c) => c + 1)
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Supprimer définitivement cette publication ?')) return
    setShowMenu(false)
    await supabase.from('posts').delete().eq('id', post.id)
    setDeleted(true)
    onDeleted?.(post.id)
  }

  const allMedias = post.post_medias || []
  const isCarrousel = allMedias.length > 1
  const mediaUrl = allMedias[0]?.media_url
  const thumbnailUrl = allMedias[0]?.thumbnail_url
  const isVideo = post.type === 'video' || allMedias[0]?.media_type === 'video'

  // Monte le <video> dans le DOM dès que la carte est à moins de ~1 écran de distance
  // du viewport (lazy loading + préchargement de "la vidéo visible et la suivante").
  // Avant le montage, seule l'image poster (thumbnail réelle) est affichée : aucune
  // requête réseau vidéo n'est émise tant que la carte n'approche pas de l'écran.
  useEffect(() => {
    if (!isVideo || mediaMounted) return
    const container = mediaContainerRef.current
    if (!container) return

    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMediaMounted(true)
          mountObserver.disconnect()
        }
      },
      { rootMargin: '1000px 0px' }
    )
    mountObserver.observe(container)
    return () => mountObserver.disconnect()
  }, [isVideo, mediaMounted])

  // autoplay muet quand la vidéo est bien visible à l'écran, pause sinon (comme Instagram)
  useEffect(() => {
    if (!isVideo || !mediaMounted) return
    const video = videoRef.current
    if (!video) return

    const playObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: [0, 0.6, 1] }
    )
    playObserver.observe(video)
    return () => playObserver.disconnect()
  }, [isVideo, mediaMounted])

  const sortedMedias = allMedias.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const handleCarrouselScroll = () => {
    const el = carrouselRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setCarrouselIndex(Math.max(0, Math.min(sortedMedias.length - 1, index)))
  }

  if (deleted) return null

  return (
    <article className="mb-3 animate-fade-in feed-native">
      <div className="feed-surface overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link to={`/influenceur/${influencer?.id}`} className="flex items-center gap-2 shrink-0">
              <Avatar src={influencer?.users?.photo_url} seed={influencer?.id} size="sm" ring={activeStoryIds.has(influencer?.id)} />
              <div className="flex items-center gap-1">
                <span className="text-[13px] leading-[16px] font-medium">{influencer?.users?.nom_complet}</span>
                {influencer?.verifie && <VerifiedBadge size={12} />}
              </div>
            </Link>

            {isCollabVerifiee && client && (
              <>
                <span className="text-[var(--text-secondary)] opacity-40 shrink-0">|</span>
                <Link to={`/entreprise/${client.id}`} className="flex items-center gap-1 min-w-0">
                  <Avatar src={client.photo_url} seed={client.nom_complet} size="sm" />
                  <span className="text-[13px] leading-[16px] font-medium truncate">{client.nom_complet}</span>
                </Link>
              </>
            )}
          </div>

          {isOwner && (
            <button
              onClick={() => setShowMenu(true)}
              aria-label="Options"
              className="w-9 h-9 -mr-1.5 flex items-center justify-center text-[var(--text-secondary)] shrink-0"
            >
              <MoreHorizontal size={19} />
            </button>
          )}
        </div>

        {/* media */}
        {mediaUrl && (
          <div
            ref={mediaContainerRef}
            className={`w-full ${cropClasses[post.crop_format] || 'aspect-square'} bg-black/20 overflow-hidden relative`}
          >
            {isVideo ? (
              <>
                <button
                  onClick={() => navigate(`/video/${post.id}`)}
                  className="absolute inset-0 w-full h-full block"
                  aria-label="Voir le réel"
                >
                  {/* La miniature réelle (thumbnail_url) s'affiche immédiatement, y compris avant
                      que la balise <video> ne soit montée. Jamais d'icône vidéo grise par défaut :
                      s'il n'y a pas encore de thumbnail (post très ancien sans miniature générée),
                      on affiche simplement le fond neutre, pas un pictogramme. */}
                  {thumbnailUrl && !mediaMounted && (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      loading={priority ? 'eager' : 'lazy'}
                      decoding="async"
                      className="absolute inset-0"
                      style={{ ...getMediaCropStyle(allMedias[0], post.crop_format), filter: getFilterCss(post.filtre) }}
                    />
                  )}
                  {mediaMounted && (
                    <video
                      ref={videoRef}
                      src={mediaUrl}
                      poster={thumbnailUrl || undefined}
                      className="absolute inset-0"
                      style={{ ...getMediaCropStyle(allMedias[0], post.crop_format), filter: getFilterCss(post.filtre) }}
                      muted={muted}
                      loop
                      playsInline
                      preload="metadata"
                    />
                  )}
                </button>
                <TextOverlay media={allMedias[0]} />
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleMute() }}
                  aria-label={muted ? 'Activer le son' : 'Couper le son'}
                  className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </>
            ) : isCarrousel ? (
              <>
                <div
                  ref={carrouselRef}
                  onScroll={handleCarrouselScroll}
                  className="flex w-full h-full overflow-x-auto snap-x snap-mandatory"
                >
                  {sortedMedias.map((m, i) => (
                    <div key={i} className="relative w-full h-full shrink-0 snap-center overflow-hidden">
                      {m.media_type === 'video' ? (
                        <video
                          src={m.media_url}
                          poster={m.thumbnail_url || undefined}
                          className="absolute inset-0"
                          style={{ ...getMediaCropStyle(m, post.crop_format), filter: getFilterCss(m.filtre ?? post.filtre) }}
                          muted
                          loop
                          playsInline
                          controls
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={m.media_url}
                          alt=""
                          loading={priority && i === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="absolute inset-0 select-none"
                          style={{ ...getMediaCropStyle(m, post.crop_format), filter: getFilterCss(m.filtre ?? post.filtre) }}
                        />
                      )}
                      <TextOverlay media={m} />
                    </div>
                  ))}
                </div>

                {/* compteur photo visitée / total, façon Instagram */}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[12px] leading-[16px] font-medium">
                  {carrouselIndex + 1}/{sortedMedias.length}
                </div>

                {/* points de progression, fenêtre glissante si beaucoup d'items */}
                <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
                  {(() => {
                    const total = sortedMedias.length
                    const maxDots = 8
                    let start = 0
                    if (total > maxDots) {
                      start = Math.min(Math.max(0, carrouselIndex - Math.floor(maxDots / 2)), total - maxDots)
                    }
                    const visibleCount = Math.min(total, maxDots)
                    return Array.from({ length: visibleCount }).map((_, offset) => {
                      const i = start + offset
                      const active = i === carrouselIndex
                      return (
                        <span
                          key={i}
                          className="rounded-full transition-all duration-200"
                          style={{
                            width: active ? 12 : 5,
                            height: 5,
                            backgroundColor: active ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
                          }}
                        />
                      )
                    })
                  })()}
                </div>
              </>
            ) : (
              <div className="w-full h-full relative overflow-hidden">
                <img
                  src={mediaUrl}
                  alt=""
                  loading={priority ? 'eager' : 'lazy'}
                  decoding="async"
                  className="absolute inset-0 select-none"
                  style={{ ...getMediaCropStyle(allMedias[0], post.crop_format), filter: getFilterCss(post.filtre) }}
                />
                <TextOverlay media={allMedias[0]} />
              </div>
            )}
          </div>
        )}

        {/* actions -- design et ordre repris d'Instagram : like, commentaire,
            repost, partager groupés à gauche, enregistrer seul à l'extrémité
            droite. Repost et Enregistrer sont ajoutés à l'identique visuel
            d'Instagram mais sans comportement (pas de onClick) : la base n'a
            pas encore ces fonctionnalités. Partager reste tel qu'avant
            (présent, non fonctionnel). */}
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-4">
            <button onClick={toggleLike} className="active:scale-90 transition-transform duration-200">
              <Heart size={24} className={liked ? 'fill-[var(--accent)] text-[var(--accent)]' : ''} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setShowComments((s) => !s)}
              className="flex items-center gap-1.5 active:scale-90 transition-transform duration-200"
            >
              <MessageCircle size={24} strokeWidth={1.75} />
              {commentCount > 0 && <span className="text-[12px] leading-[15px] font-medium">{commentCount}</span>}
            </button>
            {/* Repost : pas encore de fonctionnalité côté base, affiché sans onClick */}
            <button className="active:scale-90 transition-transform duration-200">
              <Repeat2 size={24} strokeWidth={1.75} />
            </button>
            <button className="active:scale-90 transition-transform duration-200">
              <Send size={22} strokeWidth={1.75} />
            </button>
          </div>
          {/* Enregistrer : pas encore de fonctionnalité côté base, affiché sans onClick */}
          <button className="active:scale-90 transition-transform duration-200">
            <Bookmark size={24} strokeWidth={1.75} />
          </button>
        </div>

        {(lienInstagram || lienTiktok) && (
          <div className="flex items-center gap-2 px-3 pt-2 flex-wrap">
            {lienInstagram && (
              <a
                href={lienInstagram}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 feed-pill rounded-full pl-2.5 pr-3 py-1 text-[12px] leading-[15px] font-medium active:scale-95 transition-transform duration-200"
              >
                Voir sur <InstagramIcon size={12} />
              </a>
            )}
            {lienTiktok && (
              <a
                href={lienTiktok}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 feed-pill rounded-full pl-2.5 pr-3 py-1 text-[12px] leading-[15px] font-medium active:scale-95 transition-transform duration-200"
              >
                Voir sur <TikTokIcon size={12} />
              </a>
            )}
          </div>
        )}

        {/* "Aimé par {dernier liker} et d'autres personnes", façon Instagram.
            N'existe que s'il y a au moins un like -- sinon aucun espace n'est
            réservé, on passe directement à la légende. */}
        {likeCount > 0 && (
          <p className="px-3 pt-2 text-[13px] leading-[16px]" style={{ color: 'var(--text-primary)' }}>
            Aimé par <span className="font-medium">{post.last_liker_name || 'quelqu\u2019un'}</span>
            {likeCount > 1 && <> et d'autres personnes</>}
          </p>
        )}

        {/* caption avec "voir plus" : tronquée à ~1.5 ligne via line-clamp-2,
            avec un texte de repli "... voir plus" affiché seulement quand le
            contenu réel dépasse cette hauteur. Au clic, bascule vers l'affichage
            complet (expanded). */}
        {post.legende && (
          <CaptionWithSeeMore legende={post.legende} authorName={influencer?.users?.nom_complet} hasLikeLine={likeCount > 0} />
        )}
        {post.created_at && (
          <p className="px-3 pb-2 pt-1 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {timeAgo(post.created_at)}
          </p>
        )}
      </div>

      {showComments && (
        <CommentsSheet
          postId={post.id}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => setCommentCount((c) => c + 1)}
        />
      )}

      {showMenu && (
        <BottomSheet onClose={() => setShowMenu(false)}>
          <button
            onClick={() => { setShowMenu(false); navigate(`/publier/${post.id}/modifier`) }}
            className="w-full flex items-center gap-3 px-5 py-3 text-body"
          >
            <Pencil size={18} /> Modifier la publication
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-3 px-5 py-3 text-body text-[var(--accent)]"
          >
            <Trash2 size={18} /> Supprimer la publication
          </button>
          <button
            onClick={() => setShowMenu(false)}
            className="w-full flex items-center gap-3 px-5 py-3 text-body text-[var(--text-secondary)]"
          >
            <X size={18} /> Annuler
          </button>
        </BottomSheet>
      )}
    </article>
  )
}

// évite les re-renders de toutes les cartes du feed quand une seule change
// (like, pagination qui ajoute des posts, etc.) : ne re-render que si les props
// pertinentes de CETTE carte ont changé.
export default memo(PostCard, (prev, next) => (
  prev.post === next.post &&
  prev.onDeleted === next.onDeleted &&
  prev.autoOpenComments === next.autoOpenComments &&
  prev.priority === next.priority &&
  prev.muted === next.muted &&
  prev.onToggleMute === next.onToggleMute
))
