import { Plus, Heart, MessageCircle, Send, MoreVertical, Video } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

export default function VideoComingSoon() {
  const { profile } = useAuth()

  return (
    <div className="fixed inset-0 z-30 bg-black text-white">
      {/* zone vidéo : occupe tout l'écran dès maintenant (c'est ici que la vraie vidéo s'affichera plus tard) */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/5 to-black">
        <div className="flex flex-col items-center gap-3 text-white/50 px-8 text-center">
          <Video size={40} />
          <p className="text-body">Les réels collab arrivent bientôt.</p>
        </div>
      </div>

      {/* header : flotte par-dessus la vidéo, + à gauche (importera un réel au lancement), "Réel collab" centré */}
      <div className="absolute top-0 left-0 right-0 flex items-center px-4 pt-3 pb-2 z-10 bg-gradient-to-b from-black/60 to-transparent">
        <button
          aria-label="Importer un réel"
          className="w-9 h-9 flex items-center justify-center"
        >
          <Plus size={22} />
        </button>
        <p className="absolute left-1/2 -translate-x-1/2 text-body-medium">Réel collab</p>
      </div>

      {/* colonne d'actions à droite, façon Reels, flotte par-dessus */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-10">
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

      {/* bas : profil, nom, badge vérifié Influo — flotte par-dessus, au-dessus de la bottom nav */}
      <div className="absolute left-3 bottom-24 right-16 flex items-center gap-2.5 z-10">
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
  )
}
