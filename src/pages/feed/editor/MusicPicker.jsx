import { useState, useRef, useEffect, useCallback } from 'react'
import { Music, Play, Pause, Trash2, Check } from 'lucide-react'

// Durées de note disponibles quand il y a de la musique (façon Instagram :
// pas de trim au sample près, juste "quelle fenêtre de X secondes je garde").
const DURATIONS = [15, 20]

function formatTime(s) {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * Panneau musique — PAS un écran séparé. Rendu par PhotoNoteEditor comme un
 * panneau qui glisse depuis le bas (même pattern que FilterPicker), donc la
 * photo en arrière-plan reste visible pendant toute la sélection/le trim.
 *
 * On ne découpe PAS le fichier audio ici (pas de ffmpeg côté client) : on
 * garde le fichier source complet + { start, duration }. La lecture
 * (preview ici, et plus tard dans NoteViewer) se fait en positionnant
 * `audio.currentTime = start` puis en coupant après `duration` secondes.
 *
 * onChange(null | { file, start, duration }) — appelé en live à chaque
 * choix (fichier, durée, position glissée). PhotoNoteEditor lit juste l'état
 * courant `musique` au moment de "Publier", pas besoin d'un bouton "OK"
 * séparé qui changerait d'écran.
 * onClose() — replie le panneau (bouton Music retoggle, ou "Terminé" ici).
 */
export default function MusicPicker({ initial, onClose, onChange }) {
  const [file, setFile] = useState(initial?.file || null)
  const [objectUrl, setObjectUrl] = useState(null)
  const [totalDuration, setTotalDuration] = useState(0)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [duration, setDuration] = useState(initial?.duration || 15)
  const [start, setStart] = useState(initial?.start || 0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  const audioRef = useRef(null)
  const fileInputRef = useRef(null)
  const trackRef = useRef(null)
  const stopTimeoutRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    if (!file) return
    setLoadingMeta(true)
    setError(null)
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Remonte le choix courant au parent à chaque changement pertinent, une
  // fois les métadonnées chargées (pas de remontée tant qu'on ne connaît pas
  // encore la durée réelle du morceau).
  useEffect(() => {
    if (!file || loadingMeta || error) return
    onChange({ file, start, duration })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, start, duration, loadingMeta, error])

  const handleLoadedMetadata = () => {
    const d = audioRef.current?.duration || 0
    setLoadingMeta(false)
    if (!Number.isFinite(d) || d <= 0) {
      setError("Impossible de lire ce fichier audio.")
      return
    }
    setTotalDuration(d)
    setDuration((d0) => Math.min(d0, Math.max(3, Math.floor(d))))
    setStart((s0) => Math.max(0, Math.min(s0, Math.max(0, d - duration))))
  }

  const clearStopTimeout = () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current)
      stopTimeoutRef.current = null
    }
  }

  const handlePickFile = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFile(f)
    setStart(0)
    setPlaying(false)
    clearStopTimeout()
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      clearStopTimeout()
      setPlaying(false)
      return
    }
    audio.currentTime = start
    audio.play().catch(() => {})
    setPlaying(true)
    clearStopTimeout()
    stopTimeoutRef.current = setTimeout(() => {
      audio.pause()
      setPlaying(false)
    }, duration * 1000)
  }

  useEffect(() => {
    if (!playing) return
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = start
    clearStopTimeout()
    stopTimeoutRef.current = setTimeout(() => {
      audio.pause()
      setPlaying(false)
    }, duration * 1000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, duration])

  useEffect(() => clearStopTimeout, [])

  const maxStart = Math.max(0, totalDuration - duration)

  const startDrag = (e) => {
    if (!trackRef.current) return
    e.stopPropagation()
    const point = e.touches ? e.touches[0] : e
    const rect = trackRef.current.getBoundingClientRect()
    dragRef.current = { startX: point.clientX, startLeft: start, trackWidth: rect.width }
  }

  const onDragMove = useCallback(
    (e) => {
      if (!dragRef.current || !totalDuration) return
      const point = e.touches ? e.touches[0] : e
      const { startX, startLeft, trackWidth } = dragRef.current
      const dxRatio = (point.clientX - startX) / trackWidth
      const dxSeconds = dxRatio * totalDuration
      setStart(Math.max(0, Math.min(maxStart, startLeft + dxSeconds)))
    },
    [totalDuration, maxStart]
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', endDrag)
    return () => {
      window.removeEventListener('pointermove', onDragMove)
      window.removeEventListener('pointerup', endDrag)
    }
  }, [onDragMove, endDrag])

  const remove = () => {
    audioRef.current?.pause()
    clearStopTimeout()
    setPlaying(false)
    setFile(null)
    setTotalDuration(0)
    setStart(0)
    onChange(null)
  }

  const windowLeftPct = totalDuration ? (start / totalDuration) * 100 : 0
  const windowWidthPct = totalDuration ? (duration / totalDuration) * 100 : 0

  return (
    <div className="px-4 pb-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handlePickFile}
      />

      <div className="flex items-center justify-between pb-2">
        <p className="text-white/60 text-caption">Musique</p>
        <button onClick={onClose} className="flex items-center gap-1 text-body-medium" style={{ color: 'var(--accent)' }}>
          <Check size={16} />
          Terminé
        </button>
      </div>

      {!file && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white/10"
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
            <Music size={16} className="text-white" />
          </span>
          <span className="text-white text-body">Choisir une musique depuis la galerie</span>
        </button>
      )}

      {file && (
        <>
          <audio
            ref={audioRef}
            src={objectUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setPlaying(false)}
          />

          <div className="w-full flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center shrink-0"
            >
              <Music size={18} className="text-white" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-white text-body truncate">{file.name}</p>
              <p className="text-white/50 text-caption">{formatTime(totalDuration)} au total</p>
            </div>
            <button
              onClick={togglePlay}
              disabled={loadingMeta || !!error}
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
            >
              {playing ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
            </button>
            <button onClick={remove} className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Trash2 size={16} className="text-white" />
            </button>
          </div>

          {error && <p className="text-caption text-red-400 pt-2">{error}</p>}

          {!error && !loadingMeta && totalDuration > 0 && (
            <>
              <div className="w-full flex items-center gap-2 pt-3">
                {DURATIONS.filter((d) => d <= Math.max(3, Math.floor(totalDuration))).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDuration(d)
                      setStart((s) => Math.max(0, Math.min(s, Math.max(0, totalDuration - d))))
                    }}
                    className="flex-1 rounded-full py-2 text-body-medium"
                    style={{
                      background: duration === d ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    {d}s
                  </button>
                ))}
              </div>

              <div className="w-full pt-3">
                <p className="text-white/50 text-caption pb-2">
                  Glisse pour choisir le passage ({formatTime(start)} – {formatTime(start + duration)})
                </p>
                <div
                  ref={trackRef}
                  className="relative w-full h-12 rounded-xl bg-white/10 overflow-hidden touch-none"
                >
                  <div
                    onPointerDown={startDrag}
                    className="absolute top-0 bottom-0 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing"
                    style={{
                      left: `${windowLeftPct}%`,
                      width: `${windowWidthPct}%`,
                      background: 'var(--accent)',
                      minWidth: 24,
                    }}
                  >
                    <div className="w-1 h-5 rounded-full bg-white/60 mx-0.5" />
                    <div className="w-1 h-5 rounded-full bg-white/60 mx-0.5" />
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
