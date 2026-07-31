import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import NoteGrid from './NoteGrid'

export default function Amis() {
  const navigate = useNavigate()

  return (
    <div>
      <header className="flex items-center px-4 pt-6 pb-2 sticky top-0 z-30 bg-[var(--bg-primary)]">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="flex items-center justify-center"
        >
          <ChevronLeft size={26} />
        </button>
      </header>

      <NoteGrid />
    </div>
  )
}
