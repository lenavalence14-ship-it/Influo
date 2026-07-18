import PostCard from '../feed/PostCard'
import { useActiveStories } from '../../hooks/useActiveStories'

export default function InfluencerProfile() {
  const { id } = useParams() // id du profils_influenceur ; si absent, c'est "mon" profil
  const { user, profile, influencerProfile, signOut } = useAuth()
  const [target, setTarget] = useState(null)
  const [tab, setTab] = useState('publications')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [offres, setOffres] = useState([])
  const [reseaux, setReseaux] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const activeStoryIds = useActiveStories()