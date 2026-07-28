import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Image as ImageIcon, X, RotateCcw, Check } from 'lucide-react'
import { compressImage, compressVideo, generateVideoThumbnail, getMediaDimensions } from '../../lib/mediaCompression'
import { triggerHlsTranscode } from '../../lib/hlsTranscode'
import FilterPicker, { getFilterCss } from './editor/FilterPicker'
import DraggableElement from './editor/DraggableElement'
import { FONTS, getFontStyle } from './PhotoNoteEditor'
import HlsVideo from '../../components/HlsVideo'
import { usePostUpload } from '../../contexts/PostUploadContext'
import { CROP_ASPECT_CLASSES, getCropTransformStyle, getMinZoom, getCoverZoom, clampZoom, clampOffset } from '../../lib/mediaCrop'

const RATIOS = [
  { value: 'carre', label: 'Carré', aspect: 'aspect-square' },
  { value: 'vertical', label: 'Vertical', aspect: 'aspect-[9/16]' },
  { value: 'horizontal', label: 'Paysage', aspect: 'aspect-video' },
]

// Classes aspect-ratio par format, pour que le cadre d'édition adopte
// directement le ratio cible -- identiques à CROP_ASPECT_CLASSES (mediaCrop.js),
// réutilisées telles quelles pour rester alignées avec le rendu du feed.
const EDIT_ASPECT_CLASSES = CROP_ASPECT_CLASSES

const TEXT_COLORS = ['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#eab308']

export default function CreatePost() {
  const { postId } = useParams()
  const isEditing = Boolean(postId)
  const { influencerProfile, user } = useAuth()
  const { startUpload, updateProgress, finishUpload } = usePostUpload()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [loadingExisting, setLoadingExisting] = useState(isEditing)

  const [step, setStep] = useState(isEditing ? 'edit' : 'select') // 'select' | 'edit' | 'crop' | 'texte' | 'texte_post'
  const [textePostDraft, setTextePostDraft] = useState('') // contenu d'un post 100% texte (pas de média), distinct de textEl (overlay sur photo/vidéo)
  const [showFilters, setShowFilters] = useState(false)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [existingMediaUrls, setExistingMediaUrls] = useState([])
  const [existingMediaIds, setExistingMediaIds] = useState([])
  const [existingMediaTypes, setExistingMediaTypes] = useState([])
  const [existingHls, setExistingHls] = useState(null) // { status, playlistUrl, thumbnailUrl } pour le média principal
  const [legende, setLegende] = useState('')
  const [format, setFormat] = useState('carre')
  const [loading, setLoading] = useState(false)

  // Rotation : reste un réglage global au post (rare en pratique, une seule
  // valeur suffit). Le ratio (format) est commun au carrousel (nécessaire pour
  // un affichage uniforme des cadres), mais le CROP réel -- zoom + position de
  // l'image dans ce cadre -- est désormais INDÉPENDANT par média, comme le
  // filtre et le texte : chaque photo/vidéo du carrousel garde son propre
  // cadrage, même si toutes partagent le même ratio final.
  const [rotation, setRotation] = useState(0)

  // cropsParMedia[i] = { zoom, offsetX, offsetY, naturalWidth, naturalHeight }
  // naturalWidth/Height sont nécessaires pour calculer le zoom minimum qui
  // garantit qu'aucun espace vide n'apparaît (cf lib/mediaCrop.js).
  const [cropsParMedia, setCropsParMedia] = useState([])
  const [draftCropActive, setDraftCropActive] = useState({ zoom: 1, offsetX: 0, offsetY: 0 })

  // Filtre et texte superposé sont INDÉPENDANTS par média : un tableau, un
  // élément par item du carrousel (index aligné sur displayMedias/sortedMedias).
  // Pour un post simple (pas de carrousel), seul l'index 0 est utilisé.
  const [filtresParMedia, setFiltresParMedia] = useState([])
  const [textesParMedia, setTextesParMedia] = useState([]) // { contenu, x, y, couleur, police } | null, par index

  // Média actuellement affiché/édité dans l'écran principal (swipe du carrousel
  // en mode édition, cf. écran principal plus bas).
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)

  const [textDraft, setTextDraft] = useState('')
  const [textColor, setTextColor] = useState('#ffffff')
  const [textFont, setTextFont] = useState('Inter')

  // Accesseurs pratiques pour le média actif : le filtre/texte affiché et modifié
  // à l'écran est toujours celui de activeMediaIndex.
  const filtre = filtresParMedia[activeMediaIndex] ?? null
  const textEl = textesParMedia[activeMediaIndex] ?? null
  const setFiltre = (value) => {
    setFiltresParMedia((prev) => {
      const next = [...prev]
      next[activeMediaIndex] = value
      return next
    })
  }
  const setTextEl = (updater) => {
    setTextesParMedia((prev) => {
      const next = [...prev]
      const current = next[activeMediaIndex] ?? null
      next[activeMediaIndex] = typeof updater === 'function' ? updater(current) : updater
      return next
    })
  }

  // Crop (zoom/pan) du média actuellement affiché/édité. Défaut : zoom minimum
  // (calculé dès que naturalWidth/Height sont connus), centré -- garantit qu'à
  // l'ouverture d'un média jamais encore recadré, l'image remplit déjà tout le
  // cadre sans espace vide.
  const cropActif = cropsParMedia[activeMediaIndex] ?? { zoom: 1, offsetX: 0, offsetY: 0, naturalWidth: null, naturalHeight: null }
  const setCropMedia = (index, updater) => {
    setCropsParMedia((prev) => {
      const next = [...prev]
      const current = next[index] ?? { zoom: 1, offsetX: 0, offsetY: 0, naturalWidth: null, naturalHeight: null }
      next[index] = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
      return next
    })
  }

  useEffect(() => {
    if (!isEditing) return
    const loadPost = async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, post_medias(id, media_url, media_type, position, hls_status, hls_playlist_url, thumbnail_url, filtre, crop_format, zoom, offset_x, offset_y, natural_width, natural_height, texte_overlay, texte_x, texte_y, texte_couleur, texte_police)')
        .eq('id', postId)
        .maybeSingle()

      if (data) {
        setLegende(data.legende || '')
        setFormat(data.crop_format || 'carre')
        const sorted = [...(data.post_medias || [])].sort((a, b) => a.position - b.position)
        setExistingMediaUrls(sorted.map((m) => m.media_url))
        setExistingMediaIds(sorted.map((m) => m.id))
        setExistingMediaTypes(sorted.map((m) => m.media_type || 'image'))
        // Crop zoom/pan par média : chaque item du carrousel garde le sien.
        setCropsParMedia(sorted.map((m) => ({
          zoom: m.zoom ?? 1,
          offsetX: m.offset_x ?? 0,
          offsetY: m.offset_y ?? 0,
          naturalWidth: m.natural_width ?? null,
          naturalHeight: m.natural_height ?? null,
        })))
        // Filtre par média : chaque item du carrousel garde le sien (post_medias.filtre).
        // Fallback sur l'ancien filtre unique du post (data.filtre) pour un média qui
        // n'aurait pas encore de filtre propre enregistré (posts publiés avant ce
        // correctif) : mieux que de perdre silencieusement le filtre déjà visible.
        setFiltresParMedia(sorted.map((m) => m.filtre ?? data.filtre ?? null))
        setTextesParMedia(sorted.map((m, i) => {
          if (m.texte_overlay) {
            return {
              contenu: m.texte_overlay,
              couleur: m.texte_couleur || '#ffffff',
              police: m.texte_police || 'Inter',
              x: m.texte_x ?? 50,
              y: m.texte_y ?? 50,
            }
          }
          // Repli sur l'ancien champ unique du post, uniquement pour le 1er média
          // (posts publiés avant l'ajout des colonnes texte par média).
          if (i === 0 && data.texte_overlay) {
            return {
              contenu: data.texte_overlay,
              couleur: data.texte_couleur || '#ffffff',
              police: data.texte_police || 'Inter',
              x: data.texte_x ?? 50,
              y: data.texte_y ?? 50,
            }
          }
          return null
        }))
        if (sorted[0]?.media_type === 'video') {
          setExistingHls({
            status: sorted[0].hls_status,
            playlistUrl: sorted[0].hls_playlist_url,
            thumbnailUrl: sorted[0].thumbnail_url,
          })
        }
      }
      setLoadingExisting(false)
    }
    loadPost()
  }, [isEditing, postId])

  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length === 0) return
    setFiles(selected)
    setPreviews(selected.map((f) => URL.createObjectURL(f)))
    setFiltresParMedia(selected.map(() => null))
    setTextesParMedia(selected.map(() => null))
    // Crop par défaut : zoom minimum (rempli sans espace vide), centré. Les
    // dimensions naturelles sont encore inconnues à cet instant (lues de façon
    // asynchrone juste après) ; getCropTransformStyle traite naturalWidth/Height
    // nuls comme "zoom 1, pas de contrainte" en attendant, donc aucun flash
    // incohérent à l'écran.
    setCropsParMedia(selected.map(() => ({ zoom: 1, offsetX: 0, offsetY: 0, naturalWidth: null, naturalHeight: null })))
    setActiveMediaIndex(0)
    setStep('edit')

    // Lecture des dimensions réelles en arrière-plan, par fichier : dès qu'elles
    // sont connues, le zoom minimum peut être calculé correctement pour CE média.
    selected.forEach((file, i) => {
      getMediaDimensions(file).then(({ width, height }) => {
        if (!width || !height) return
        setCropsParMedia((prev) => {
          const next = [...prev]
          const current = next[i] ?? { zoom: 1, offsetX: 0, offsetY: 0 }
          const minZoom = getMinZoom(width, height, format)
          next[i] = { ...current, naturalWidth: width, naturalHeight: height, zoom: Math.max(current.zoom, minZoom) }
          return next
        })
      })
    })
  }

  const isVideoFile = (f) => f?.type?.startsWith('video/')
  const mainIsVideo = isEditing ? existingMediaTypes[0] === 'video' : isVideoFile(files[0])
  const displayMedias = isEditing ? existingMediaUrls : previews
  // Type par média (pas seulement le premier) : nécessaire pour un carrousel
  // mixte photos+vidéos — avant ce correctif, seul existingMediaTypes[0] (ou
  // files[0]) était regardé, donc dès que le PREMIER fichier était une photo,
  // isCarrousel passait à true mais chaque item du carrousel était quand même
  // rendu comme <img>, y compris les vidéos, qui s'affichaient donc figées
  // (juste la première frame, aucune lecture).
  const displayMediaTypes = isEditing
    ? existingMediaTypes
    : files.map((f) => (isVideoFile(f) ? 'video' : 'image'))
  const mainPreview = displayMedias[0]
  // Média actuellement swipé/édité dans le carrousel (filtre, texte). Le crop global,
  // lui, continue de se baser sur mainPreview (1er média) : c'est un réglage commun à
  // tout le carrousel, prévisualisé sur la 1ère image par simplicité, comme avant.
  const activeMedia = displayMedias[activeMediaIndex] ?? mainPreview
  const activeMediaIsVideo = displayMediaTypes[activeMediaIndex] === 'video'
  // Un carrousel peut désormais contenir une vidéo (pas seulement en position
  // 0) : la condition ne dépend donc plus de mainIsVideo, seulement du nombre
  // de fichiers. mainIsVideo ne sert plus qu'à choisir l'écran plein cadre
  // pour le cas vidéo UNIQUE (1 seul fichier, qui est une vidéo).
  const isCarrousel = displayMedias.length > 1

  const moveText = (_id, x, y) => setTextEl((prev) => (prev ? { ...prev, x, y } : prev))

  // --- publication ---
  const [publishError, setPublishError] = useState(null)

  const handlePublish = async () => {
    // Post 100% texte : pas de fichier, pas de post_medias, insert direct.
    // Ne passe jamais par la logique de compression/upload ci-dessous, qui ne
    // concerne que les posts avec média.
    if (step === 'texte_post') {
      if (!textePostDraft.trim()) return
      setLoading(true)
      setPublishError(null)
      const { error: texteError } = await supabase.from('posts').insert({
        influenceur_id: influencerProfile.id,
        type: 'texte',
        legende: textePostDraft.trim(),
      })
      setLoading(false)
      if (texteError) {
        setPublishError(texteError.message)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      navigate('/')
      return
    }

    if (!isEditing && files.length === 0) return
    setLoading(true)
    setPublishError(null)

    // Champs réellement globaux au post : la légende, et le ratio (crop_format)
    // -- commun au carrousel puisque tous ses éléments s'affichent au même
    // format. Le crop réel (zoom/pan), comme le filtre et le texte overlay,
    // est désormais indépendant par média, écrit directement sur chaque ligne
    // post_medias (voir plus bas).
    const commonFields = {
      legende,
      crop_format: format,
    }

    if (isEditing) {
      const { error: updateError } = await supabase.from('posts').update(commonFields).eq('id', postId)
      if (updateError) {
        setLoading(false)
        setPublishError(updateError.message)
        return
      }

      // Écrit le filtre, le texte ET le crop zoom/pan de CHAQUE média existant
      // sur sa propre ligne post_medias, indépendamment des autres. En
      // parallèle, comme pour l'upload, pour ne pas enchaîner N allers-retours
      // séquentiels.
      const existingIds = existingMediaIds
      const mediaUpdateErrors = (await Promise.all(
        existingIds.map((mediaId, i) => {
          if (!mediaId) return Promise.resolve(null)
          const t = textesParMedia[i]
          const c = cropsParMedia[i] ?? { zoom: 1, offsetX: 0, offsetY: 0 }
          return supabase
            .from('post_medias')
            .update({
              filtre: filtresParMedia[i] ?? null,
              texte_overlay: t?.contenu || null,
              texte_x: t?.x ?? null,
              texte_y: t?.y ?? null,
              texte_couleur: t?.couleur || null,
              texte_police: t?.police || null,
              crop_format: format,
              zoom: c.zoom,
              offset_x: c.offsetX,
              offset_y: c.offsetY,
              natural_width: c.naturalWidth ?? null,
              natural_height: c.naturalHeight ?? null,
            })
            .eq('id', mediaId)
            .then(({ error: mediaError }) => mediaError)
        })
      )).filter(Boolean)

      setLoading(false)
      if (mediaUpdateErrors.length > 0) {
        setPublishError(mediaUpdateErrors[0].message)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      navigate(-1)
      return
    }

    const hasVideo = files.some(isVideoFile)
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        influenceur_id: influencerProfile.id,
        // Priorité au carrousel dès qu'il y a plusieurs fichiers, même si l'un
        // d'eux est une vidéo : sinon 'video' l'emportait toujours sur
        // 'carrousel' (hasVideo testé en premier), et PostCard n'affichait
        // alors QUE le premier média (allMedias[0]) au lieu du carrousel
        // complet — la vidéo mélangée dans un carrousel de plusieurs fichiers
        // faisait disparaître les autres photos du post publié.
        type: files.length > 1 ? 'carrousel' : hasVideo ? 'video' : 'photo',
        ...commonFields,
      })
      .select()
      .single()

    if (error) {
      setLoading(false)
      setPublishError(error.message)
      return
    }

    // À partir d'ici, l'utilisateur n'attend plus : retour immédiat à l'accueil,
    // l'upload (compression + envoi des fichiers) continue en arrière-plan. La
    // progression est pilotée via PostUploadContext et affichée en cercle autour
    // du bouton "+" du feed (voir Feed.jsx).
    setLoading(false)
    navigate('/')
    startUpload(influencerProfile.id)

    const totalSteps = files.length * 2 // compression + upload, par fichier
    let doneSteps = 0
    const bumpProgress = () => {
      doneSteps += 1
      updateProgress(influencerProfile.id, Math.round((doneSteps / totalSteps) * 100))
    }

    // Chaque fichier du post (photo unique, carrousel, vidéo) est traité en parallèle :
    // compression + génération de miniature + upload, au lieu d'une boucle séquentielle
    // qui attend chaque étape de chaque fichier avant de passer au suivant. Pour un
    // carrousel de 5 photos, cela remplace 5 allers-retours réseau successifs par 5
    // en parallèle, et la publication se termine bien plus vite.
    await Promise.all(files.map(async (rawFile, i) => {
      const isVideo = isVideoFile(rawFile)

      // Compresse systématiquement avant upload : réduit le volume envoyé sur le réseau
      // (upload) ET le volume que chaque viewer devra ensuite télécharger (download),
      // ce qui est le levier de performance le plus direct sur connexion 4G.
      // La génération de la miniature vidéo se fait en parallèle de la compression,
      // pas après, car les deux lisent le fichier source indépendamment.
      const [file, thumbFile] = await Promise.all([
        isVideo ? compressVideo(rawFile) : compressImage(rawFile),
        isVideo ? generateVideoThumbnail(rawFile) : Promise.resolve(null),
      ])
      bumpProgress()

      // Dimensions naturelles du fichier RÉELLEMENT uploadé (après compression,
      // qui peut avoir changé la résolution) : ce sont elles qui doivent être
      // stockées, pour que le zoom minimum recalculé au rendu (feed) corresponde
      // exactement à ce que l'utilisateur a vu pendant l'édition. À défaut, on
      // retombe sur les dimensions lues à la sélection (cropsParMedia[i]).
      const compressedDims = await getMediaDimensions(file).catch(() => null)
      const naturalWidth = compressedDims?.width ?? cropsParMedia[i]?.naturalWidth ?? null
      const naturalHeight = compressedDims?.height ?? cropsParMedia[i]?.naturalHeight ?? null

      const fileName = `${influencerProfile.id}/${post.id}/${i}-${file.name}`

      const uploadTasks = [
        supabase.storage.from('posts').upload(fileName, file),
      ]

      let thumbName = null
      if (isVideo && thumbFile) {
        thumbName = `${influencerProfile.id}/${post.id}/${i}-thumb.jpg`
        uploadTasks.push(supabase.storage.from('posts').upload(thumbName, thumbFile))
      }

      await Promise.all(uploadTasks)
      bumpProgress()

      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
      const thumbnailUrl = thumbName
        ? supabase.storage.from('posts').getPublicUrl(thumbName).data.publicUrl
        : null

      const c = cropsParMedia[i] ?? { zoom: 1, offsetX: 0, offsetY: 0 }
      const { data: mediaRow } = await supabase
        .from('post_medias')
        .insert({
          post_id: post.id,
          media_url: urlData.publicUrl,
          media_type: isVideo ? 'video' : 'image',
          thumbnail_url: thumbnailUrl,
          position: i,
          filtre: filtresParMedia[i] ?? null,
          texte_overlay: textesParMedia[i]?.contenu || null,
          texte_x: textesParMedia[i]?.x ?? null,
          texte_y: textesParMedia[i]?.y ?? null,
          texte_couleur: textesParMedia[i]?.couleur || null,
          texte_police: textesParMedia[i]?.police || null,
          crop_format: format,
          zoom: c.zoom,
          offset_x: c.offsetX,
          offset_y: c.offsetY,
          natural_width: naturalWidth,
          natural_height: naturalHeight,
        })
        .select('id')
        .single()

      // Déclenche le transcodage HLS en arrière-plan, sans bloquer la publication :
      // le post part tout de suite avec le MP4 (media_url) en lecture immédiate,
      // et le player basculera sur le HLS (qualité adaptative) une fois prêt
      // (voir hls_status côté ReelsViewer). "Fire-and-forget" volontaire ici :
      // si ça échoue silencieusement, l'utilisateur voit quand même sa vidéo
      // en MP4 classique, ce n'est jamais bloquant pour lui.
      if (isVideo && mediaRow?.id) {
        triggerHlsTranscode({
          postMediaId: mediaRow.id,
          sourceUrl: urlData.publicUrl,
          storagePrefix: `${influencerProfile.id}/${post.id}/${i}-hls`,
        })
      }
    }))

    finishUpload(influencerProfile.id)
    // Le post et tous ses médias sont maintenant en base : invalide le cache
    // du feed (React Query) pour que le nouveau post apparaisse dès que
    // l'utilisateur revoit l'écran, sans qu'il ait à tirer pour rafraîchir
    // manuellement. Avant ce correctif, navigate('/') plus haut ramenait sur
    // un Feed qui réutilisait son cache existant, antérieur à la publication.
    queryClient.invalidateQueries({ queryKey: ['feed'] })

    // Notification interne : visible dans la cloche de l'app même si l'utilisateur
    // a quitté l'écran de publication depuis longtemps. Le déclenchement d'une vraie
    // notification push système (téléphone verrouillé, app fermée) suivra le même
    // principe côté serveur (fonction send-push), pas encore branché ici.
    if (user?.id) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'nouveau_post',
        contenu: 'Votre publication est en ligne.',
        lien_ref_id: post.id,
      })
    }
  }

  // (le spinner de chargement est rendu plus bas, après tous les Hooks)

  // ============================================================
  // ÉCRAN 1 — SÉLECTION
  // ============================================================
  // (le contenu est rendu plus bas, après tous les Hooks, pour respecter
  // les règles des Hooks React : ils doivent être appelés dans le même
  // ordre à chaque rendu, donc aucun `return` avant eux)
  const cropAreaRef = useRef(null)
  const videoRef = useRef(null)
  const editCarrouselRef = useRef(null)
  // état du geste en cours : pan (1 doigt/souris) ou pinch (2 doigts)
  const gestureState = useRef(null)

  const handleEditCarrouselScroll = () => {
    const el = editCarrouselRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setActiveMediaIndex(Math.max(0, Math.min(displayMedias.length - 1, index)))
  }
  const pendingEvent = useRef(null)
  const rafId = useRef(null)

  const minZoomActif = getMinZoom(draftCropActive.naturalWidth, draftCropActive.naturalHeight, format)

  const distanceBetween = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)

  const startGesture = (e) => {
    e.stopPropagation()
    const touches = e.touches
    if (touches && touches.length === 2) {
      gestureState.current = {
        type: 'pinch',
        startDist: distanceBetween(touches[0], touches[1]),
        startZoom: draftCropActive.zoom,
        start: { ...draftCropActive },
      }
    } else {
      const point = touches ? touches[0] : e
      gestureState.current = {
        type: 'pan',
        startX: point.clientX,
        startY: point.clientY,
        start: { ...draftCropActive },
      }
    }
  }

  const computeNextCrop = (e) => {
    const rect = cropAreaRef.current.getBoundingClientRect()
    const gesture = gestureState.current
    const minZoom = getMinZoom(gesture.start.naturalWidth, gesture.start.naturalHeight, format) // contain : plancher du zoom
    const coverZoom = getCoverZoom(gesture.start.naturalWidth, gesture.start.naturalHeight, format) // seuil pan autorisé

    if (gesture.type === 'pinch' && e.touches?.length === 2) {
      const dist = distanceBetween(e.touches[0], e.touches[1])
      const scaleFactor = dist / gesture.startDist
      const nextZoom = clampZoom(gesture.startZoom * scaleFactor, minZoom)
      return {
        ...gesture.start,
        zoom: nextZoom,
        offsetX: clampOffset(gesture.start.offsetX, nextZoom, coverZoom),
        offsetY: clampOffset(gesture.start.offsetY, nextZoom, coverZoom),
      }
    }

    const point = e.touches ? e.touches[0] : e
    const dx = ((point.clientX - gesture.startX) / rect.width) * 100
    const dy = ((point.clientY - gesture.startY) / rect.height) * 100
    return {
      ...gesture.start,
      offsetX: clampOffset(gesture.start.offsetX + dx, gesture.start.zoom, coverZoom),
      offsetY: clampOffset(gesture.start.offsetY + dy, gesture.start.zoom, coverZoom),
    }
  }

  const flushGesture = useCallback(() => {
    rafId.current = null
    if (!gestureState.current || !cropAreaRef.current || !pendingEvent.current) return
    setDraftCropActive(computeNextCrop(pendingEvent.current))
  }, [format])

  const onGestureMove = useCallback((e) => {
    if (!gestureState.current || !cropAreaRef.current) return
    // Passage pan -> pinch en cours de geste (2e doigt posé) : on redémarre
    // proprement le geste au lieu de mélanger deux logiques différentes.
    if (e.touches?.length === 2 && gestureState.current.type === 'pan') {
      startGesture(e)
    }
    pendingEvent.current = e
    if (rafId.current == null) rafId.current = requestAnimationFrame(flushGesture)
  }, [flushGesture])

  const endGesture = useCallback(() => {
    gestureState.current = null
    pendingEvent.current = null
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [])

  useEffect(() => {
    if (step !== 'crop') return
    window.addEventListener('pointermove', onGestureMove, { passive: true })
    window.addEventListener('pointerup', endGesture)
    window.addEventListener('touchmove', onGestureMove, { passive: true })
    window.addEventListener('touchend', endGesture)
    return () => {
      window.removeEventListener('pointermove', onGestureMove)
      window.removeEventListener('pointerup', endGesture)
      window.removeEventListener('touchmove', onGestureMove)
      window.removeEventListener('touchend', endGesture)
      if (rafId.current != null) cancelAnimationFrame(rafId.current)
    }
  }, [step, onGestureMove, endGesture])

  const openCrop = () => {
    setDraftCropActive(cropActif)
    setStep('crop')
  }
  // si les dimensions naturelles du média actif arrivent après l'ouverture de
  // l'écran crop (lecture async au moment de la sélection du fichier), on les
  // reporte dans le brouillon en cours dès qu'elles sont connues -- sinon le
  // zoom minimum resterait calculé sur des dimensions nulles tant que
  // l'utilisateur ne rouvre pas l'écran.
  useEffect(() => {
    if (step !== 'crop') return
    const latest = cropsParMedia[activeMediaIndex]
    if (latest?.naturalWidth && !draftCropActive.naturalWidth) {
      setDraftCropActive((prev) => ({ ...prev, naturalWidth: latest.naturalWidth, naturalHeight: latest.naturalHeight }))
    }
  }, [step, activeMediaIndex, cropsParMedia, draftCropActive.naturalWidth])
  const cancelCrop = () => setStep('edit')
  const confirmCrop = () => {
    setCropMedia(activeMediaIndex, draftCropActive)
    setStep('edit')
  }

  // choix d'un ratio : le cadre change de forme, donc le zoom minimum change
  // aussi pour CHAQUE média du carrousel (pas seulement l'actif) -- on
  // recalcule et on relève le zoom de chacun si besoin pour ne jamais laisser
  // d'espace vide après un changement de ratio.
  const applyRatio = (ratioValue) => {
    setFormat(ratioValue)
    setCropsParMedia((prev) => prev.map((c) => {
      const minZoom = getMinZoom(c.naturalWidth, c.naturalHeight, ratioValue)
      const coverZoom = getCoverZoom(c.naturalWidth, c.naturalHeight, ratioValue)
      const zoom = Math.max(c.zoom, minZoom)
      return {
        ...c,
        zoom,
        offsetX: clampOffset(c.offsetX, zoom, coverZoom),
        offsetY: clampOffset(c.offsetY, zoom, coverZoom),
      }
    }))
    setDraftCropActive((prev) => {
      const minZoom = getMinZoom(prev.naturalWidth, prev.naturalHeight, ratioValue)
      const coverZoom = getCoverZoom(prev.naturalWidth, prev.naturalHeight, ratioValue)
      const zoom = Math.max(prev.zoom, minZoom)
      return { ...prev, zoom, offsetX: clampOffset(prev.offsetX, zoom, coverZoom), offsetY: clampOffset(prev.offsetY, zoom, coverZoom) }
    })
  }

  // ---- écran texte ----
  const openTexte = () => {
    setTextDraft(textEl?.contenu || '')
    setTextColor(textEl?.couleur || '#ffffff')
    setTextFont(textEl?.police || 'Inter')
    setStep('texte')
  }
  const confirmTexte = () => {
    if (textDraft.trim()) {
      setTextEl((prev) => ({
        contenu: textDraft,
        couleur: textColor,
        police: textFont,
        x: prev?.x ?? 50,
        y: prev?.y ?? 50,
      }))
    } else {
      setTextEl(null)
    }
    setStep('edit')
  }

  // ============================================================
  // CHARGEMENT (édition d'un post existant)
  // ============================================================
  if (loadingExisting) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  // ============================================================
  // ÉCRAN 1 — SÉLECTION
  // ============================================================
  if (step === 'select') {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
        <header className="flex items-center justify-between px-4 pt-3 pb-2 h-14 shrink-0">
          <button onClick={() => navigate(-1)} aria-label="Fermer" className="w-9 h-9 flex items-center justify-center">
            <X size={22} />
          </button>
          <span className="text-body-medium">Nouvelle publication</span>
          <div className="w-9" />
        </header>

        <label className="flex-1 flex flex-col items-center justify-center px-6 gap-4 cursor-pointer">
          <div className="aspect-square w-full max-w-[380px] rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.04] flex flex-col items-center justify-center gap-3 text-white/50">
            <ImageIcon size={30} />
            <span className="text-body text-center px-6">Choisir des photos ou vidéos</span>
          </div>
          <span className="text-caption text-white/40 text-center max-w-[280px]">
            Ouvre la galerie de ton téléphone — tu peux sélectionner plusieurs fichiers
          </span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFilesChange}
            className="hidden"
          />
        </label>

        <button
          onClick={() => setStep('texte_post')}
          className="mx-6 mb-8 py-3 rounded-xl border border-white/15 bg-white/[0.04] text-body text-white/80"
        >
          Publier du texte
        </button>
      </div>
    )
  }

  // ============================================================
  // ÉCRAN TEXTE PUR — publication 100% texte, pas de média, pas de
  // légende séparée : ce textarea EST le contenu du post.
  // ============================================================
  if (step === 'texte_post') {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
        <header className="flex items-center justify-between px-4 pt-3 pb-2 h-14 shrink-0">
          <button onClick={() => setStep('select')} aria-label="Retour" className="w-9 h-9 flex items-center justify-center">
            <X size={22} />
          </button>
          <span className="text-body-medium">Publication texte</span>
          <button
            onClick={handlePublish}
            disabled={loading || !textePostDraft.trim()}
            className="text-body-medium px-2 py-2 disabled:opacity-40"
            style={{ color: 'var(--accent)' }}
          >
            {loading ? 'Publication…' : 'Publier'}
          </button>
        </header>

        <div className="flex-1 px-4 pt-4">
          <textarea
            autoFocus
            value={textePostDraft}
            onChange={(e) => setTextePostDraft(e.target.value)}
            placeholder="Exprime-toi…"
            className="w-full h-full bg-transparent text-[16px] leading-[22px] text-white placeholder-white/30 resize-none outline-none"
          />
        </div>

        {publishError && (
          <div className="px-4 pb-4 text-caption text-red-400">{publishError}</div>
        )}
      </div>
    )
  }

  // ============================================================
  // ÉCRAN CROP — cadre FIXE, image en zoom/pan (façon Instagram)
  // ============================================================
  // Style de rendu de l'image en cours d'édition : identique à
  // getCropTransformStyle, appliqué directement à draftCropActive (état en
  // cours de manipulation, pas encore confirmé). Le média affiché en édition
  // est celui du carrousel actuellement sélectionné (activeMediaIndex) : un
  // carrousel se recadre média par média, chacun garde son propre zoom/pan.
  const draftTransformStyle = getCropTransformStyle({
    naturalWidth: draftCropActive.naturalWidth,
    naturalHeight: draftCropActive.naturalHeight,
    cropFormat: format,
    zoom: draftCropActive.zoom,
    offsetX: draftCropActive.offsetX,
    offsetY: draftCropActive.offsetY,
  })

  if (step === 'crop') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black select-none">
        <div className="flex-1 relative flex items-center justify-center overflow-hidden px-4">
          <div
            ref={cropAreaRef}
            className={`relative w-full bg-black ${EDIT_ASPECT_CLASSES[format] || 'aspect-square'} overflow-hidden touch-none`}
            onPointerDown={startGesture}
            onTouchStart={startGesture}
          >
            {/* fond noir : au zoom minimum (contain), la photo entière est visible
                et laisse du vide sur les côtés ou en haut/bas selon son ratio --
                ce fond comble cet espace proprement (façon Instagram), plutôt
                que de laisser transparaître le fond de l'écran */}
            {activeMediaIsVideo ? (
              <video
                key={activeMedia}
                src={activeMedia}
                className="absolute inset-0 select-none pointer-events-none"
                style={{ ...draftTransformStyle, transform: `${draftTransformStyle.transform} rotate(${rotation}deg)` }}
                muted
                autoPlay
                loop
                playsInline
                preload="auto"
                draggable={false}
              />
            ) : (
              <img
                src={activeMedia}
                alt=""
                className="absolute inset-0 select-none pointer-events-none"
                draggable={false}
                style={{ ...draftTransformStyle, transform: `${draftTransformStyle.transform} rotate(${rotation}deg)` }}
              />
            )}

            {/* grille de composition (repères visuels uniquement, le cadre lui-même
                est la zone entière -- il ne bouge jamais, contrairement à l'ancien
                système à rectangle déplaçable) */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/25" />
              ))}
            </div>
          </div>
        </div>

        {/* navigation entre médias du carrousel : chaque média garde son propre
            zoom/pan, on doit donc confirmer le geste en cours avant de changer
            d'index (le crop en cours d'édition est déjà appliqué en continu à
            cropsParMedia via confirmCrop, ici on bascule juste l'aperçu) */}
        {isCarrousel && (
          <div className="flex items-center justify-center gap-2 pb-2">
            {displayMedias.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCropMedia(activeMediaIndex, draftCropActive)
                  setActiveMediaIndex(i)
                  setDraftCropActive(cropsParMedia[i] ?? { zoom: 1, offsetX: 0, offsetY: 0 })
                }}
                className={`w-2 h-2 rounded-full ${i === activeMediaIndex ? 'bg-white' : 'bg-white/30'}`}
                aria-label={`Média ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* choix de ratio — carré retiré uniquement pour une vidéo SEULE (pas en
            carrousel) : un carrousel garde toujours les 3 ratios. */}
        <div className="flex gap-2 px-4 pb-2">
          {RATIOS.filter((r) => !(mainIsVideo && !isCarrousel && r.value === 'carre')).map((r) => (
            <button
              key={r.value}
              onClick={() => applyRatio(r.value)}
              className={`flex-1 rounded-2xl py-3 text-caption-medium transition-colors ${
                format === r.value ? 'bg-white text-black' : 'bg-white/10 text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* zoom : slider explicite en plus du pinch, pour accessibilité et pour
            les appareils sans écran tactile multi-touch (souris) */}
        <div className="flex items-center gap-3 px-6 pb-2">
          <span className="text-white/50 text-caption">–</span>
          <input
            type="range"
            min={minZoomActif}
            max={3}
            step={0.01}
            value={draftCropActive.zoom}
            onChange={(e) => {
              const nextZoom = clampZoom(Number(e.target.value), minZoomActif)
              const coverZoomActif = getCoverZoom(draftCropActive.naturalWidth, draftCropActive.naturalHeight, format)
              setDraftCropActive((prev) => ({
                ...prev,
                zoom: nextZoom,
                offsetX: clampOffset(prev.offsetX, nextZoom, coverZoomActif),
                offsetY: clampOffset(prev.offsetY, nextZoom, coverZoomActif),
              }))
            }}
            className="flex-1 accent-white"
          />
          <span className="text-white/50 text-caption">+</span>
        </div>

        <div className="flex items-center justify-center pb-2">
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white"
          >
            <RotateCcw size={20} />
          </button>
        </div>

        <div
          className="flex items-center justify-between px-6 pb-6 pt-2"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <button onClick={cancelCrop} className="text-body-medium" style={{ color: 'var(--accent)' }}>
            Annuler
          </button>
          <button onClick={confirmCrop} className="text-body-medium" style={{ color: 'var(--accent)' }}>
            Terminé
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // ÉCRAN TEXTE — Aa, polices, couleur
  // ============================================================
  const filterCss = getFilterCss(filtre)

  if (step === 'texte') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black select-none">
        <div
          className="flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3"
          style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
        >
          <button onClick={confirmTexte} className="text-white text-body-medium">
            Terminé
          </button>
          <div className="flex items-center gap-2">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setTextColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${textColor === c ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
          <div
            className={`relative w-full ${EDIT_ASPECT_CLASSES[format] || 'aspect-square'} overflow-hidden`}
          >
            <img
              src={activeMedia}
              alt=""
              className="absolute inset-0 select-none"
              draggable={false}
              style={(() => {
                const s = getCropTransformStyle({ ...cropActif, cropFormat: format })
                return { ...s, filter: filterCss, transform: `${s.transform} rotate(${rotation}deg)` }
              })()}
            />
            <div className="absolute inset-0 flex items-center justify-center px-8 pointer-events-none">
              <textarea
                autoFocus
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="Ajouter du texte"
                rows={2}
                className="note-text-input pointer-events-auto w-full bg-transparent text-center outline-none resize-none"
                style={{ color: textColor, fontSize: 28, textShadow: '0 1px 6px rgba(0,0,0,0.6)', ...getFontStyle(textFont) }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto px-4 py-4 shrink-0">
          {FONTS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTextFont(f.key)}
              className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
                textFont === f.key ? 'bg-white text-black' : 'bg-white/10 text-white'
              }`}
              style={f.style}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ============================================================
  // ÉCRAN PRINCIPAL
  // ============================================================
  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col select-none">
      <div
        className="flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => (isEditing ? navigate(-1) : setStep('select'))}
          className="w-9 h-9 flex items-center justify-center text-white"
        >
          <X size={22} />
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={openCrop}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={openTexte}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold text-[15px]"
          >
            Aa
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        <div
          className={`relative w-full ${EDIT_ASPECT_CLASSES[format] || 'aspect-square'} overflow-hidden`}
        >
          {mainIsVideo && !isCarrousel ? (
            isEditing && existingHls?.status === 'ready' && existingHls?.playlistUrl ? (
              <HlsVideo
                videoRef={videoRef}
                hlsPlaylistUrl={existingHls.playlistUrl}
                fallbackMp4Url={mainPreview}
                poster={existingHls.thumbnailUrl}
                className="absolute inset-0"
                style={{ ...getCropTransformStyle({ ...cropActif, cropFormat: format }), filter: filterCss }}
                loop
                muted={false}
                controls
                autoPlay
                preload="metadata"
              />
            ) : (
              <video
                key={mainPreview}
                src={mainPreview}
                className="absolute inset-0"
                style={{ ...getCropTransformStyle({ ...cropActif, cropFormat: format }), filter: filterCss }}
                controls
                autoPlay
                playsInline
              />
            )
          ) : isCarrousel ? (
            <>
              <div
                ref={editCarrouselRef}
                onScroll={handleEditCarrouselScroll}
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory"
              >
                {displayMedias.map((p, i) => {
                  const cropStyleMedia = getCropTransformStyle({ ...(cropsParMedia[i] ?? {}), cropFormat: format })
                  return displayMediaTypes[i] === 'video' ? (
                    <div key={i} className="relative w-full h-full shrink-0 snap-center overflow-hidden">
                      <video
                        src={p}
                        className="absolute inset-0"
                        style={{ ...cropStyleMedia, filter: getFilterCss(filtresParMedia[i]) }}
                        controls
                        playsInline
                        preload="metadata"
                      />
                    </div>
                  ) : (
                    <div key={i} className="relative w-full h-full shrink-0 snap-center overflow-hidden">
                      <img
                        src={p}
                        alt=""
                        className="absolute inset-0 select-none"
                        draggable={false}
                        style={{ ...cropStyleMedia, filter: getFilterCss(filtresParMedia[i]) }}
                      />
                    </div>
                  )
                })}
              </div>

              {/* indicateur i/N, identique à l'affichage du feed (PostCard.jsx) */}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[12px] leading-[16px] font-medium">
                {activeMediaIndex + 1}/{displayMedias.length}
              </div>

              {/* points de progression, identiques à l'affichage du feed */}
              <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
                {(() => {
                  const total = displayMedias.length
                  const maxDots = 8
                  let start = 0
                  if (total > maxDots) {
                    start = Math.min(Math.max(0, activeMediaIndex - Math.floor(maxDots / 2)), total - maxDots)
                  }
                  const visibleCount = Math.min(total, maxDots)
                  return Array.from({ length: visibleCount }).map((_, offset) => {
                    const i = start + offset
                    const active = i === activeMediaIndex
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
            <img
              src={mainPreview}
              alt=""
              className="absolute inset-0 select-none"
              draggable={false}
              style={(() => {
                const s = getCropTransformStyle({ ...cropActif, cropFormat: format })
                return { ...s, filter: filterCss, transform: `${s.transform} rotate(${rotation}deg)` }
              })()}
            />
          )}

          {textEl && (
            <DraggableElement element={textEl} onMove={moveText}>
              <p
                className="text-center px-3 max-w-[80vw] whitespace-pre-wrap"
                style={{ color: textEl.couleur, fontSize: 28, textShadow: '0 1px 6px rgba(0,0,0,0.5)', ...getFontStyle(textEl.police) }}
              >
                {textEl.contenu}
              </p>
            </DraggableElement>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="shrink-0 bg-black/95 pt-2" style={{ animation: 'slideUpPanel 0.2s ease-out' }}>
          <p className="text-center text-white/60 text-caption pb-1">Filtres</p>
          <FilterPicker imageUrl={activeMedia} isVideo={activeMediaIsVideo} value={filtre} onChange={setFiltre} />
        </div>
      )}

      <div className="px-4 pt-2">
        <textarea
          value={legende}
          onChange={(e) => setLegende(e.target.value)}
          rows={2}
          placeholder="Écris une légende..."
          className="w-full rounded-2xl px-4 py-3 bg-white/10 text-white outline-none resize-none text-body placeholder:text-white/50"
        />
      </div>

      {publishError && (
        <div className="px-4 pt-2">
          <p className="text-caption text-red-400">{publishError}</p>
        </div>
      )}

      <div
        className="flex items-center justify-between px-4 pt-2"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <button onClick={() => (isEditing ? navigate(-1) : setStep('select'))} className="text-white text-body-medium px-2 py-2">
          Annuler
        </button>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="text-white text-body-medium px-2 py-2"
        >
          Filtres
        </button>
        <button onClick={handlePublish} disabled={loading} className="text-body-medium px-2 py-2 disabled:opacity-40" style={{ color: 'var(--accent)' }}>
          {loading ? '...' : isEditing ? 'Enregistrer' : 'Publier'}
        </button>
      </div>

      <style>{`
        @keyframes slideUpPanel {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .note-text-input::placeholder {
          color: rgba(255, 255, 255, 0.75);
          text-shadow: 0 1px 6px rgba(0,0,0,0.6);
        }
      `}</style>
    </div>
  )
}