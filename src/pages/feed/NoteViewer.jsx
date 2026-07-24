import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Heart, Repeat2, Send, Eye, ArrowLeft, MoreVertical, Music } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { timeAgo } from '../../lib/time'
import { profileRoute } from '../../lib/profileRoute'
import { getFilterCss as getNoteFilterCss } from './editor/FilterPicker'

const SEGMENT_DURATION_MS = 5000

// Une note avec musique dure le temps du passage audio choisi (15 ou 20s
// selon ce qui a été sélectionné dans MusicPicker) au lieu des 5s standard.
function getSegmentDurationMs(item) {
  const audioDuration = item?.original?.audio_duration
  if (audioDuration && Number.isFinite(audioDuration) && audioDuration > 0) {
    return audioDuration * 1000
  }
  return SEGMENT_DURATION_MS
}

// Viewer plein écran pour les notes texte, façon statuts texte WhatsApp.
//
// STRUCTURE : `groups` est une liste de groupes, un groupe = une personne +
// la liste de ses items actifs (notes perso et/ou reposts qu'elle a faits),
// triés du plus ancien au plus récent. Le viewer se déplace :
//   - de SEGMENT en SEGMENT à l'intérieur d'un groupe (auto-défilement),
//   - de GROUPE en GROUPE une fois tous les segments du groupe épuisés.
// La barre de progression en haut ne représente QUE les segments du groupe
// courant (jamais le total de toutes les personnes).
//
// AUTO-DÉFILEMENT : chaque segment dure SEGMENT_DURATION_MS. À la fin, passage
// automatique au segment/groupe suivant. Appui long (pointerdown maintenu)
// met en pause l'anim ET le timer ; relâcher (pointerup / pointerleave)
// reprend exactement là où c'était (comme WhatsApp/Instagram).
//
// VUES : quand je regarde une note qui n'est pas la mienne, j'enregistre une
// vue dans note_views (idempotent, une fois par personne/note). Si c'est ma
// note, un bouton "Vu par X" ouvre la liste des vues.
//
// VUES SUR REPOST vs ORIGINAL : les vues comptabilisées sur l'item ORIGINAL
// (isMine sur une note originale) = vues reçues directement sur l'original +
// somme des vues reçues sur tous ses reposts (cumulé, façon WhatsApp/Insta
// "vues totales du statut"). Les vues comptabilisées sur un REPOST (isMine
// sur un repost) = uniquement les vues reçues sur CE repost précis, pas
// celles de l'original ni des autres reposts.
//
// Like : tout le monde, peu importe le rôle. Notifie le propriétaire de
// L'ITEM OUVERT (si repost, le republieur est notifié).
// Répondre : seulement si viewer.role === auteur.role (même rôle).
// Republier : tout le monde, peu importe le rôle, sauf soi-même. Crée une
// nouvelle ligne notes (repost_of = note ORIGINALE, pas le repost qu'on
// regarde) + note_reposts + notifie l'auteur ORIGINAL. Le nouvel item
// apparaît dans LA BARRE DE TOUT LE MONDE (pas seulement pour la personne
// depuis laquelle on a republié) puisque NoteBar affiche tous les items de
// tous les utilisateurs.
export default function NoteViewer({ groups, startGroupIndex, onClose }) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progressKey, setProgressKey] = useState(0) // force le redémarrage de l'anim CSS
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [reposted, setReposted] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [showViewers, setShowViewers] = useState(false)
  const [viewersList, setViewersList] = useState([])
  const [viewCount, setViewCount] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const [direction, setDirection] = useState(1) // 1 = next (slide vers la gauche), -1 = prev (slide vers la droite)
  const navigate = useNavigate()

  const timerRef = useRef(null)
  const remainingRef = useRef(SEGMENT_DURATION_MS)
  const startedAtRef = useRef(0)
  const audioRef = useRef(null) // <audio> injecté pour les notes avec musique

  const group = groups[groupIndex]
  const items = group?.items || []

  // Précharge la photo suivante ET précédente (dans le groupe courant, ou le
  // premier/dernier segment du groupe voisin en bout de liste) pour que le
  // glissement ne montre jamais une image en train de charger : le
  // navigateur a déjà l'image en cache au moment où le slide démarre.
  // Précharge aussi la musique du segment suivant/précédent, pour la même
  // raison — pas de nouveau <audio> pour ça, juste un fetch en arrière-plan
  // qui remplit le cache HTTP du navigateur, réutilisé par le vrai <audio>
  // quand on y arrive vraiment.
  useEffect(() => {
    const preload = (url) => {
      if (!url) return
      const img = new Image()
      img.src = url
    }
    const preloadAudio = (url) => {
      if (!url) return
      const a = new window.Audio()
      a.preload = 'auto'
      a.src = url
    }
    const nextItem = items[segmentIndex + 1] || groups[groupIndex + 1]?.items?.[0]
    const prevItem = items[segmentIndex - 1] || (groupIndex > 0 ? groups[groupIndex - 1]?.items?.at?.(-1) : undefined)
    preload(nextItem?.original?.photo_url)
    preload(prevItem?.original?.photo_url)
    preloadAudio(nextItem?.original?.audio_url)
    preloadAudio(prevItem?.original?.audio_url)
  }, [groupIndex, segmentIndex, groups])
  const current = items[segmentIndex]

  // Le fond flouté doit disparaître quand l'image nette (avec son zoom
  // choisi en édition) couvre déjà 100% du cadre dans les deux axes — sinon
  // il reste visible en dépassement même à fort zoom, quel que soit le
  // ratio de l'image. object-contain + scale() ne garantit pas un
  // recouvrement exact ; on le mesure réellement via les dimensions
  // naturelles de l'image comparées au cadre.
  const sharpImgRef = useRef(null)
  const [fullyCovers, setFullyCovers] = useState(false)

  const checkCoverage = useCallback(() => {
    const img = sharpImgRef.current
    if (!img || !img.naturalWidth || !img.naturalHeight) return
    const zoom = typeof current?.original?.zoom === 'number' && current.original.zoom > 0
      ? current.original.zoom
      : 1
    const frameW = img.clientWidth
    const frameH = img.clientHeight
    if (!frameW || !frameH) return
    // Dimensions du rectangle "contain" de base (avant zoom) à l'intérieur du cadre
    const imgRatio = img.naturalWidth / img.naturalHeight
    const frameRatio = frameW / frameH
    let baseW, baseH
    if (imgRatio > frameRatio) {
      baseW = frameW
      baseH = frameW / imgRatio
    } else {
      baseH = frameH
      baseW = frameH * imgRatio
    }
    const scaledW = baseW * zoom
    const scaledH = baseH * zoom
    // Marge d'1px pour tolérer les arrondis de sous-pixel
    setFullyCovers(scaledW >= frameW - 1 && scaledH >= frameH - 1)
  }, [current?.original?.zoom])

  const handleSharpImgLoad = useCallback(() => {
    checkCoverage()
  }, [checkCoverage])

  useEffect(() => {
    checkCoverage()
    window.addEventListener('resize', checkCoverage)
    return () => window.removeEventListener('resize', checkCoverage)
  }, [checkCoverage])

  const { user, profile } = useAuth()

  // Barre de statut système (heure, batterie, réseau) : on ne peut pas la
  // flouter (rendue par le système, hors du DOM du WebView). Règle simple,
  // la même partout dans l'app y compris ici en story : thème clair -> texte
  // noir, thème sombre -> texte blanc. Réagit à chaque changement de
  // segment/thème puisqu'on peut naviguer texte <-> photo sans refermer le
  // viewer.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const isLight = document.documentElement.classList.contains('light')
    const themeBg = isLight ? '#f5f5f5' : '#0a0a0a'

    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
    StatusBar.setBackgroundColor({ color: themeBg }).catch(() => {})
    StatusBar.setStyle({ style: isLight ? Style.Dark : Style.Light }).catch(() => {})
    return () => {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
      StatusBar.setBackgroundColor({ color: themeBg }).catch(() => {})
      StatusBar.setStyle({ style: isLight ? Style.Dark : Style.Light }).catch(() => {})
    }
  }, [current, groupIndex, segmentIndex])
  const note = current?.entry
  const author = current?.original?.users

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const goNextSegment = useCallback(() => {
    clearTimer()
    setDirection(1)
    if (segmentIndex < items.length - 1) {
      setSegmentIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1)
      setSegmentIndex(0)
    } else {
      onClose()
    }
  }, [segmentIndex, items.length, groupIndex, groups.length, onClose])

  const goPrevSegment = useCallback(() => {
    clearTimer()
    setDirection(-1)
    if (segmentIndex > 0) {
      setSegmentIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex((g) => g - 1)
      setSegmentIndex(Math.max(0, (prevGroup?.items?.length || 1) - 1))
    }
  }, [segmentIndex, groupIndex, groups])

  // Démarre / redémarre le timer d'auto-défilement à chaque changement de
  // segment ou de groupe (segment neuf = durée pleine).
  //
  // Pour un segment AVEC musique : on n'affiche/démarre le timer visuel
  // qu'une fois l'audio prêt à jouer sans coupure (canplaythrough), au lieu
  // de lancer barre de progression ET chargement audio en parallèle à
  // l'aveugle — c'est ce décalage (barre qui avance pendant que le son
  // charge encore) qui donnait l'impression que "la musique arrive en
  // retard". Le préchargement ci-dessus (segment suivant/précédent) fait
  // que la plupart du temps ce cas ne se produit même plus : l'audio est
  // déjà en cache quand on arrive sur le segment.
  useEffect(() => {
    const item = items[segmentIndex]
    const audioUrl = item?.original?.audio_url
    const audio = audioRef.current

    const startTimer = (durationMs) => {
      remainingRef.current = durationMs
      setProgressKey((k) => k + 1)
      if (!paused) {
        startedAtRef.current = Date.now()
        clearTimer()
        timerRef.current = setTimeout(goNextSegment, durationMs)
      }
    }

    if (!audioUrl || !audio) {
      startTimer(getSegmentDurationMs(item))
      return clearTimer
    }

    // Segment avec musique : prépare l'audio et attend qu'il soit prêt
    // avant de démarrer le timer visuel (et la lecture).
    let cancelled = false
    audio.pause()
    audio.src = audioUrl
    audio.currentTime = item.original.audio_start || 0

    const onReady = () => {
      if (cancelled) return
      startTimer(getSegmentDurationMs(item))
      if (!paused) audio.play().catch(() => {})
    }

    let cleanupListener = () => {}
    if (audio.readyState >= 3) {
      // Déjà bufferisé (cas fréquent grâce au préchargement) : pas
      // d'attente supplémentaire, démarre tout de suite.
      onReady()
    } else {
      audio.addEventListener('canplaythrough', onReady, { once: true })
      // Filet de sécurité : si canplaythrough ne se déclenche jamais
      // (réseau capricieux), on démarre quand même après 2s pour ne pas
      // bloquer la story indéfiniment.
      const fallback = setTimeout(onReady, 2000)
      cleanupListener = () => {
        audio.removeEventListener('canplaythrough', onReady)
        clearTimeout(fallback)
      }
    }

    return () => {
      cancelled = true
      cleanupListener()
      clearTimer()
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, segmentIndex])

  // Pause / reprise (appui long) : synchronise le son avec le timer visuel.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    if (paused) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
  }, [paused])

  const handlePauseStart = () => {
    if (paused) return
    setPaused(true)
    clearTimer()
    const elapsed = Date.now() - startedAtRef.current
    remainingRef.current = Math.max(0, remainingRef.current - elapsed)
  }

  const handlePauseEnd = () => {
    if (!paused) return
    setPaused(false)
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(goNextSegment, remainingRef.current)
  }

  // Charge like/repost/vues à chaque changement d'item affiché, et
  // enregistre une vue si ce n'est pas ma propre note.
  useEffect(() => {
    if (!note) return
    let cancelled = false
    const isMine = note.user_id === user?.id

    const load = async () => {
      const { count } = await supabase
        .from('note_likes')
        .select('id', { count: 'exact', head: true })
        .eq('note_id', note.id)
      const { data: mine } = await supabase
        .from('note_likes')
        .select('id')
        .eq('note_id', note.id)
        .eq('user_id', user?.id)
        .maybeSingle()
      const { data: myRepost } = await supabase
        .from('note_reposts')
        .select('id')
        .eq('note_id', note.id)
        .eq('user_id', user?.id)
        .maybeSingle()
      if (!cancelled) {
        setLikeCount(count || 0)
        setLiked(!!mine)
        setReposted(!!myRepost)
      }

      if (isMine) {
        // Mes vues : sur un repost -> uniquement ses propres vues.
        // Sur une note originale -> ses vues + celles de tous ses reposts.
        let noteIds = [note.id]
        if (!note.repost_of) {
          const { data: reposts } = await supabase.from('notes').select('id').eq('repost_of', note.id)
          if (reposts?.length) noteIds = [note.id, ...reposts.map((r) => r.id)]
        }
        const { data: views } = await supabase
          .from('note_views')
          .select('user_id, created_at, users(id, nom_complet, photo_url)')
          .in('note_id', noteIds)
          .order('created_at', { ascending: false })
        if (!cancelled) {
          setViewCount(views?.length || 0)
          setViewersList(views || [])
        }
      } else if (user?.id) {
        await supabase
          .from('note_views')
          .upsert({ note_id: note.id, user_id: user.id }, { onConflict: 'note_id,user_id', ignoreDuplicates: true })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [note?.id, user?.id])

  if (!current || !note) return null

  const isMine = note.user_id === user?.id

  const myRole = profile?.role
  const theirRole = author?.role
  const canReply =
    !isMine &&
    myRole &&
    theirRole &&
    (myRole === theirRole || myRole === 'client' || theirRole === 'client')

  const handleLike = async () => {
    if (liked) {
      setLiked(false)
      setLikeCount((c) => Math.max(0, c - 1))
      await supabase.from('note_likes').delete().eq('note_id', note.id).eq('user_id', user.id)
      return
    }
    setLiked(true)
    setLikeCount((c) => c + 1)
    await supabase.from('note_likes').insert({ note_id: note.id, user_id: user.id })
    if (!isMine) {
      await supabase.from('notifications').insert({
        user_id: note.user_id,
        type: 'note_like',
        contenu: `${profile?.nom_complet || 'Quelqu\u2019un'} a aimé ta note`,
        lien_ref_id: note.id,
        from_user_id: user.id,
      })
    }
  }

  const handleRepost = async () => {
    if (reposted || isMine) return
    setReposted(true)
    const originalId = current.original.id
    const { error } = await supabase.from('notes').insert({
      user_id: user.id,
      contenu: current.original.contenu,
      repost_of: originalId,
      expire_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    if (error) {
      setReposted(false)
      return
    }
    await supabase.from('note_reposts').insert({ note_id: originalId, user_id: user.id })
    await supabase.from('notifications').insert({
      user_id: current.original.user_id,
      type: 'note_repost',
      contenu: `${profile?.nom_complet || 'Quelqu\u2019un'} a republié ta note`,
      lien_ref_id: originalId,
      from_user_id: user.id,
    })
  }

  const handleDelete = async () => {
    if (!isMine) return
    clearTimer()
    await supabase.from('notes').delete().eq('id', note.id)
    // Retire l'item localement et avance ; si c'était le dernier segment du
    // dernier groupe, ferme le viewer.
    if (items.length > 1) {
      goNextSegment()
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1)
      setSegmentIndex(0)
    } else {
      onClose()
    }
  }

  const handleReply = async (textOverride) => {
    const messageText = (textOverride ?? replyText).trim()
    if (!messageText || !canReply || sending) return
    setSending(true)

    const myRole = profile.role
    const theirRole = author.role
    const otherUserId = note.user_id

    let table, messagesTable, aField, bField, myId, otherId, conversationId

    if (myRole === theirRole) {
      myId = user.id
      otherId = otherUserId
      if (myRole === 'influenceur') {
        table = 'conversations_influenceur'
        messagesTable = 'messages_influenceur'
        aField = 'user_a_id'
        bField = 'user_b_id'
      } else if (myRole === 'client') {
        table = 'conversations_biz'
        messagesTable = 'messages_biz'
        aField = 'client_a_id'
        bField = 'client_b_id'
        const [{ data: mine }, { data: theirs }] = await Promise.all([
          supabase.from('profils_client').select('id').eq('user_id', user.id).maybeSingle(),
          supabase.from('profils_client').select('id').eq('user_id', otherUserId).maybeSingle(),
        ])
        if (!mine || !theirs) {
          setSending(false)
          return
        }
        myId = mine.id
        otherId = theirs.id
      } else {
        table = 'conversations_sociale'
        messagesTable = 'messages_sociale'
        aField = 'user_a_id'
        bField = 'user_b_id'
      }

      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .or(`and(${aField}.eq.${myId},${bField}.eq.${otherId}),and(${aField}.eq.${otherId},${bField}.eq.${myId})`)
        .maybeSingle()

      conversationId = existing?.id
      if (!conversationId) {
        const { data: created, error } = await supabase.from(table).insert({ [aField]: myId, [bField]: otherId }).select().single()
        if (error || !created) {
          setSending(false)
          return
        }
        conversationId = created.id
      }
    } else if (myRole === 'client' && theirRole === 'influenceur') {
      table = 'conversations'
      messagesTable = 'messages'
      const { data: theirInfluenceurProfile } = await supabase
        .from('profils_influenceur')
        .select('id')
        .eq('user_id', otherUserId)
        .maybeSingle()
      if (!theirInfluenceurProfile) {
        setSending(false)
        return
      }
      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq('client_id', user.id)
        .eq('influenceur_id', theirInfluenceurProfile.id)
        .maybeSingle()
      conversationId = existing?.id
      if (!conversationId) {
        const { data: created, error } = await supabase
          .from(table)
          .insert({ client_id: user.id, influenceur_id: theirInfluenceurProfile.id })
          .select()
          .single()
        if (error || !created) {
          setSending(false)
          return
        }
        conversationId = created.id
      }
    } else if (myRole === 'influenceur' && theirRole === 'client') {
      table = 'conversations'
      messagesTable = 'messages'
      const { data: myInfluenceurProfile } =