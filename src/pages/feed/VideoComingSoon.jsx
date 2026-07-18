import { Plus, Heart, MessageCircle, Send, MoreVertical, Video } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

export default function VideoComingSoon() {
  const { profile } = useAuth()

  return (
    <div className="fixed inset-0 z-30 bg-black flex flex-col text-white">
      {/* header : + à gauche (importera un réel au lancement), "Réel collab" centré */}
      <div className="flex items-center px-4 pt-4 pb-2 relative shrink-0 z-10">
        <button
          aria-label="Importer un réel"
          className="w-9 h-9 flex items-center justify-center"
        >
          <Plus size={22} />
        </button>
        <p className="absolute left-1/2 -translate-x-1/2 text-body-medium">Réel collab</p>
      </div>

      {/* zone vidéo : placeholder, la fonctionnalité n'est pas encore active */}
      <div className="flex-1 relative flex items-center justify-center bg-gradient-to-b from-white/5 to-black">
        <div className="flex flex-col items-center gap-3 text-white/50 px-8 text-center">
          <Video size={40} />
          <p className="text-body">Les réels collab arrivent bientôt.</p>
        </div>

        {/* colonne d'actions à droite, façon Reels */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
          <button className="flex flex-col items-center gap-1" aria-label="J'aime">
            <Heart size={26} />
          </button>
          <button className="flex flex-col items-center gap-1" aria-label="Commenter">
            <MessageCircle size={26} />
          </button>
          <button className="flex flex-col items-center gap-1" aria-label="Partager">
            <Send size={24} />
          </button>
          <button className="flex flex-col items-center gap-1" aria-label="Plus d'options">
            <MoreVertical size={24} />
          </button>
        </div>

        {/* bas : profil, nom, badge vérifié Influo */}
        <div className="absolute left-3 bottom-6 right-16 flex items-center gap-2.5">
          <img
            src={profile?.photo_url || `https://api.dicebear.com/9.x/glass/svg?seed=${profile?.id}`}
            alt=""
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
          <p className="text-body-medium flex items-center gap-1.5 truncate">
            {profile?.nom_complet}
            <VerifiedBadge size={14} />
          </p>
        </div>
      </div>
    </div>
  )
}
