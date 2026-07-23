import { useState, useRef, useEffect, useCallback } from 'react'
import { Music, Play, Pause, X, Trash2 } from 'lucide-react'

// Durées de note disponibles quand il y a de la musique (façon Instagram :
// pas de trim au sample près, juste "quelle fenêtre de X secondes je garde").
const DURATIONS = [15, 20]

// Formatte des secondes en m:ss pour affichage (ex: 83.4 -> "1:23").
function formatTime(s) {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * Écran plein écran pour choisir une musique depuis la galerie/fichiers du
 * téléphone et rogner un passage de 15 ou 20 secondes qui deviendra la durée
 * d'affichage de la note (façon Instagram : la note "dure" ce que dure
 * l'extrait choisi).
 *
 * IMPORTANT : on ne découpe PAS le fichier audio ici (pas de ffmpeg côté
 * client). On garde le fichier source complet + un point de départ
 * (`start`) + une durée (`duration`). La lecture (preview ici, et plus tard
 * dans NoteViewer) se fait en positionnant `audio.currentTime = start` puis
 * en coupant après `duration` secondes. C'est amplement suffisant : la note
 * n'est jamais réexportée en vidéo, donc il n'y a jamais besoin du fichier
 * physiquement raccourci.
 *
 * onDone(null)               -> musique retirée (bouton "Retirer")
 * onDone({ file, start, duration }) -> musique choisie et validée
 */
export default function MusicPicker({ initial, onCancel, onDone }) {
  const [file, setFile] = useState(initial?.file || null)
  const [objectUrl, setObjectUrl] = useState(null)
  const [totalDuration, setTotalDuration] = useState(0)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [duration, setDuration] = useState(initial?.duration || 15) // 15 ou 20
  const [start, setStart] = useState(initial?.start || 0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  const audioRef = useRef(null)
  const fileInputRef = useRef(null)
  const trackRef = useRef(null) // zone timeline pour calculer les positions au drag
  const stopTimeoutRef = useRef(null)
  const dragRef = useRef(null) // { startX, startLeft, trackWidth }

  // Charge les métadonnées (durée totale) dès qu'un fichier est choisi.
  useEffect(() => {
    if (!file) return
    setLoadingMeta(true)
    setError(null)
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleLoadedMetadata = () => {
    const d = audioRef.current?.duration || 0
    setLoadingMeta(false)
    if (!Number.isFinite(d) || d <= 0) {
      setError("Impossible de lire ce fichier audio.")
      return
    }
    setTotalDuration(d)
    // Si le morceau est plus court que la durée de note choisie, on réduit
    // la durée de note automatiquement à la durée du morceau (mini 3s pour
    // rester utilisable).
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

  // À chaque changement de start/duration pendant la lecture, on redémarre
  // proprement pour que le preview reflète toujours la fenêtre courante.
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

  // ---- déplacement de la fenêtre de sélection sur la timeline ----
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

  const confirm = () => {
    if (!file) return
    onDone({ file, start, duration })
  }

  const remove = () => {
    onDone(null)
  }

  const windowLeftPct = totalDuration ? (start / totalDuration) * 100 : 0
  const windowWidthPct = totalDuration ? (duration / totalDuration) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handlePickFile}
      />

      <div
        className="flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
      >
        <button onClick={onCancel} className="w-9 h-9 flex items-center justify-center text-white">
          <X size={22} />
        </button>
        <p className="text-body-medium text-white">Musique</p>
        <button
          onClick={confirm}
          disabled={!file || loadingMeta || !!error}
          className="text-body-medium px-2 disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
        >
          OK
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {!file && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-3 text-white/80"
          >
            <span
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'var(--accent)' }}
            >
              <Music size={26} className="text-white" />
            </span>
            <span className="text-body">Choisir une musique depuis la galerie</span>
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
            </div>

            {error && <p className="text-caption text-red-400">{error}</p>}

            {!error && !loadingMeta && totalDuration > 0 && (
              <>
                {/* Durée de la note : 15s ou 20s */}
                <div className="w-full flex items-center gap-2">
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

                {/* Timeline : la fenêtre colorée = le passage qui sera joué.
                    On la fait glisser horizontalement pour choisir le refrain
                    ou le passage voulu. */}
                <div className="w-full">
                  <p className="text-white/50 text-caption pb-2">
                    Glisse pour choisir le passage ({formatTime(start)} – {formatTime(start + duration)})
                  </p>
                  <div
                    ref={trackRef}
                    className="relative w-full h-14 rounded-xl bg-white/10 overflow-hidden touch-none"
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
                      <div className="w-1 h-6 rounded-full bg-white/60 mx-0.5" />
                      <div className="w-1 h-6 rounded-full bg-white/60 mx-0.5" />
                    </div>
                  </div>
                </div>
              </>
            )}

            <button onClick={remove} className="flex items-center gap-2 text-white/60 text-body-medium mt-2">
              <Trash2 size={16} />
              Retirer la musique
            </button>
          </>
        )}
      </div>
    </div>
  )
}
