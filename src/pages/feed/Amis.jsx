import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import NoteBar from './NoteBar'

export default function Amis() {
  const navigate = useNavigate()

  return (
    <div>
      <header className="flex items-center gap-3 px-4 pt-6 pb-2 sticky top-0 z-30 bg-[var(--bg-primary)]">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="glass rounded-xl w-7 h-7 flex items-center justify-center"
        >
          <ArrowLeft size={14} />
        </button>
        <h1 className="text-h1">Amis</h1>
      </header>

      <NoteBar />
    </div>
  )
}
