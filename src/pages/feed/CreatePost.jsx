import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Image as ImageIcon, X, Type, Check, Music, Sticker, Sparkles,
  PenLine, AtSign, MoreHorizontal, ChevronDown, ChevronUp, Plus, Send,
} from 'lucide-react'
import { compressImage, compressVideo } from '../../lib/mediaCompression'
import DrawCanvas from './editor/DrawCanvas'
import FilterPicker, { getFilterCss } from './editor/FilterPicker'
import StickerPicker from './editor/StickerPicker'
import MentionPicker from './editor/MentionPicker'
import DraggableElement from './editor/DraggableElement'

const FORMATS = [
  { value: 'carre', label: '1:1', aspect: 'aspect-square' },
  { value: 'horizontal', label: '4:3', aspect: 'aspect-[4/3]' },
  { value: 'vertical', label: '2:3', aspect: 'aspect-[2/3]' },
  { value: 'vertical_45', label: '4:5', aspect: 'aspect-[4/5]' },
]

const TEXT_COLORS = ['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#eab308']

const PRIMARY_TOOLS = [
  { key: 'audio', icon: Music, label: 'Audio' },
  { key: 'texte', icon: Type, label: 'Texte' },
  { key: 'stickers', icon: Sticker, label: 'Superposition' },
  { key: 'filtre', icon: Sparkles, label: 'Filtre' },
]

const MORE_TOOLS = [
  { key: 'dessiner', icon: PenLine, label: 'Dessiner' },
  { key: 'mentionner', icon: AtSign, label: 'Mentionner' },
]

let uid = 0
const nextId = () => `el_${Date.now()}_${uid++}`

export default function CreatePost() {
  const [searchParams] = useSearchParams()
  const { postId } = useParams()
  const isEditing = Boolean(postId)
  const { influencerProfile } = useAuth()
  const navigate = useNavigate()

  const [isStory, setIsStory] = useState(searchParams.get('type') === 'story')
  const [loadingExisting, setLoadingExisting] = useState(isEditing)

  const [step, setStep] = useState(isEditing ? 'edit' : 'select')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [existingMediaUrls, setExistingMediaUrls] = useState([])
  const [existingMediaTypes, setExistingMediaTypes] = useState([])
  const [legende, setLegende] = useState('')
  const [format, setFormat] = useState(isStory ? 'vertical' : 'carre')
  const [loading, setLoading] = useState(false)

  // outils actifs
  const [activeTool, setActiveTool] = useState(null) // 'texte' | 'stickers' | 'filtre' | 'dessiner' | 'mentionner' | null
  const [showMore, setShowMore] = useState(false)

  // éléments superposés multiples (texte, sticker, mention)
  const [elements, setElements] = useState([])
  const [editingTextId, setEditingTextId] = useState(null)
  const [textDraft, setTextDraft] = useState('')
  const [textColor, setTextColor] = useState('#ffffff')

  // filtre + dessin
  const [filtre, setFiltre] = useState(null)
  const [dessinDataUrl, setDessinDataUrl] = useState(null)
  const [dessinFile, setDessinFile] = useState(null)

  const canvasRef = useRef(null)
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 700 })

  useEffect(() => {
    if (!isEditing) return
    const loadPost = async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, post_medias(media_url, position)')
        .eq('id', postId)
        .maybeSingle()

      if (data) {
        setIsStory(data.type === 'story')
        setLegende(data.legende || '')
        setFormat(data.crop_format || (data.type === 'story' ? 'vertical' : 'carre'))
        setFiltre(data.filtre || null)
        setElements(Array.isArray(data.elements) ? data.elements : [])
        // rétrocompatibilité : ancien texte simple -> élément
        if (data.texte_overlay && (!data.elements || data.elements.length === 0)) {
          setElements([{
            id: nextId(),
            type: 'texte',
            x: data.texte_x ?? 50,
            y: data.texte_y ?? 50,
            contenu: data.texte_overlay,
            couleur: data.texte_couleur || '#ffffff',
          }])
        }
        const sorted = [...(data.post_medias || [])].sort((a, b) => a.position - b.position)
        setExistingMediaUrls(sorted.map((m) => m.media_url))
        setExistingMediaTypes(sorted.map((m) => m.media_type || 'image'))
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
    setStep('edit')
  }

  const isVideoFile = (f) => f?.type?.startsWith('video/')
  const mainIsVideo = isEditing ? existingMediaTypes[0] === 'video' : isVideoFile(files[0])
  const displayMedias = isEditing ? existingMediaUrls : previews
  const mainPreview = displayMedias[0]

  // --- gestion des éléments ---
  const addTextElement = () => {
    setTextDraft('')
    setTextColor('#ffffff')
    const id = nextId()
    setElements((els) => [...els, { id, type: 'texte', x: 50, y: 50, contenu: '', couleur: '#ffffff' }])
    setEditingTextId(id)
    setActiveTool('texte')
  }

  const commitTextEdit = () => {
    if (!editingTextId) return
    setElements((els) =>
      textDraft.trim()
        ? els.map((el) => (el.id === editingTextId ? { ...el, contenu: textDraft, couleur: textColor } : el))
        : els.filter((el) => el.id !== editingTextId)
    )
    setEditingTextId(null)
    setActiveTool(null)
  }

  const addSticker = (emoji) => {
    setElements((els) => [...els, { id: nextId(), type: 'sticker', x: 50, y: 40, contenu: emoji }])
  }

  const addMention = (user) => {
    setElements((els) => [...els, { id: nextId(), type: 'mention', x: 50, y: 30, contenu: user.nom_complet, userId: user.id }])
    setActiveTool(null)
  }

  const moveElement = (id, x, y) => {
    setElements((els) => els.map((el) => (el.id === id ? { ...el, x, y } : el)))
  }

  const handleElementTap = (el) => {
    if (el.type === 'texte') {
      setTextDraft(el.contenu)
      setTextColor(el.couleur || '#ffffff')
      setEditingTextId(el.id)
      setActiveTool('texte')
    }
  }

  const handleToolClick = (key) => {
    setShowMore(false)
    if (key === 'texte') {
      addTextElement()
      return
    }
    setActiveTool((cur) => (cur === key ? null : key))
  }

  // --- publication ---
  const handlePublish = async () => {
    if (!isEditing && files.length === 0) return
    setLoading(true)

    let dessinUrl = null
    if (dessinFile) {
      const fileName = `${influencerProfile.id}/dessin-${Date.now()}.png`