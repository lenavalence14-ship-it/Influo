import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Avatar from '../../../components/ui/Avatar'

export default function MentionPicker({ onPick }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([])
        return
      }
      const { data } = await supabase
        .from('users')
        .select('id, nom_complet, photo_url')
        .ilike('nom_complet', `%${query}%`)
        .limit(8)
      setResults(data || [])
    }
    const t = setTimeout(search, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="px-4 pb-4 pt-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher une personne..."
        autoFocus
        className="w-full h-11 rounded-2xl px-4 bg-white/10 text-white outline-none text-body placeholder:text-white/50 mb-2"
      />
      <div className="max-h-[180px] overflow-y-auto space-y-1">
        {results.map((u) => (
          <button
            key={u.id}
            onClick={() => onPick(u)}
            className="w-full flex items-center gap-3 py-2 px-1 text-left"
          >
            <Avatar src={u.photo_url} seed={u.id} size="sm" />
            <span className="text-body text-white">{u.nom_complet}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
