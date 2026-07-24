// Compresse une image en la redimensionnant si trop grande et en la réencodant en JPEG qualité 82%.
// Rapide, aucune dépendance externe (Canvas natif du navigateur).
export async function compressImage(file, { maxDimension = 1920, quality = 0.82 } = {}) {
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file)
  let { width, height } = bitmap

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob || blob.size >= file.size) return file // garde l'original si la compression n'a pas aidé

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
}

// Encode un AudioBuffer en fichier WAV (PCM 16-bit). Format simple et
// universellement supporté par tous les navigateurs/WebView, pas besoin de
// dépendance d'encodage mp3.
function audioBufferToWavFile(buffer, fileName) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const numFrames = buffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numFrames * blockAlign

  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // taille du sous-chunk fmt
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits par échantillon
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // Entrelace les canaux et convertit le float [-1,1] en PCM 16-bit signé
  const channels = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))

  let offset = 44
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new File([arrayBuffer], fileName, { type: 'audio/wav' })
}

// Découpe RÉELLEMENT un fichier audio source pour ne garder que le passage
// choisi (start -> start + duration), au lieu d'uploader le morceau entier.
// C'est ce que MusicPicker laisse choisir à l'utilisateur (fenêtre de 15 ou
// 20s glissée sur la timeline) : jusqu'ici cette fenêtre ne servait qu'à
// positionner la LECTURE côté NoteViewer, mais le fichier envoyé au storage
// restait le fichier source complet (potentiellement plusieurs Mo, plusieurs
// minutes) — ce qui alourdit l'upload en arrière-plan au point de le faire
// échouer silencieusement sur connexion lente / WebView Android. En ne
// gardant que le passage réellement utilisé, l'upload devient rapide et
// fiable, et le stockage n'accumule plus des morceaux entiers inutiles.
// Downsample à 44.1kHz pour garder un fichier WAV raisonnable (~1.7 Mo pour
// 20s stéréo, largement gérable en upload mobile).
export async function trimAudio(file, start, duration, { targetSampleRate = 44100 } = {}) {
  const arrayBuffer = await file.arrayBuffer()
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  const decodeCtx = new AudioContextClass()
  let decoded
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer)
  } finally {
    decodeCtx.close?.()
  }

  const startFrame = Math.max(0, Math.floor(start * decoded.sampleRate))
  const frameCount = Math.min(
    Math.floor(duration * decoded.sampleRate),
    decoded.length - startFrame
  )
  if (frameCount <= 0) throw new Error('Passage audio invalide (hors des limites du fichier).')

  // Rendu offline : extrait le segment ET le resample à targetSampleRate en
  // une seule passe, via un OfflineAudioContext de la bonne durée/taux.
  const renderedDuration = frameCount / decoded.sampleRate
  const offlineCtx = new OfflineAudioContext(
    decoded.numberOfChannels,
    Math.ceil(renderedDuration * targetSampleRate),
    targetSampleRate
  )

  // Copie uniquement le segment voulu dans un buffer source dédié (évite de
  // devoir gérer un offset de lecture négatif dans le graphe audio).
  const segmentBuffer = offlineCtx.createBuffer(decoded.numberOfChannels, frameCount, decoded.sampleRate)
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const channelData = decoded.getChannelData(c).subarray(startFrame, startFrame + frameCount)
    segmentBuffer.copyToChannel(new Float32Array(channelData), c)
  }

  const source = offlineCtx.createBufferSource()
  source.buffer = segmentBuffer
  source.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  const trimmedName = file.name.replace(/\.\w+$/, '') + '-trim.wav'
  return audioBufferToWavFile(rendered, trimmedName)
}

// Compresse une vidéo en réduisant sa résolution/bitrate via MediaRecorder natif du navigateur.
// Léger et rapide (pas de réencodage complet type ffmpeg), gain modéré mais sans délai lourd.
export async function compressVideo(file, { maxDimension = 1280, videoBitsPerSecond = 2_500_000 } = {}) {
  if (!file.type.startsWith('video/')) return file
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported?.('video/webm;codecs=vp9')) return file

  try {
    const videoUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = videoUrl
    video.muted = true
    video.playsInline = true

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve
      video.onerror = reject
    })

    let { videoWidth: width, videoHeight: height } = video
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    // si la vidéo est déjà petite, pas la peine de la retraiter
    if (width >= video.videoWidth && height >= video.videoHeight) {
      URL.revokeObjectURL(videoUrl)
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    const canvasStream = canvas.captureStream(30)
    const recorder = new MediaRecorder(canvasStream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond,
    })

    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    const recordingDone = new Promise((resolve) => { recorder.onstop = resolve })

    recorder.start()
    video.currentTime = 0
    await video.play()

    const drawFrame = () => {
      if (video.paused || video.ended) return
      ctx.drawImage(video, 0, 0, width, height)
      requestAnimationFrame(drawFrame)
    }
    drawFrame()

    await new Promise((resolve) => {
      video.onended = resolve
    })
    recorder.stop()
    await recordingDone

    URL.revokeObjectURL(videoUrl)

    const blob = new Blob(chunks, { type: 'video/webm' })
    if (blob.size >= file.size) return file // garde l'original si pas de gain réel

    return new File([blob], file.name.replace(/\.\w+$/, '.webm'), { type: 'video/webm' })
  } catch (err) {
    console.warn('Compression vidéo échouée, envoi du fichier original:', err)
    return file
  }
}

// Capture une frame de la vidéo (par défaut à 0.5s, pour éviter un premier frame souvent noir/flou)
// et la retourne comme fichier JPEG, utilisable comme miniature (poster) avant chargement de la vidéo.
export async function generateVideoThumbnail(file, { seekTime = 0.5, quality = 0.8 } = {}) {
  if (!file.type.startsWith('video/')) return null

  try {
    const videoUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = videoUrl
    video.muted = true
    video.playsInline = true

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve
      video.onerror = reject
    })

    // ne pas viser plus loin que la durée réelle de la vidéo (cas des vidéos très courtes)
    video.currentTime = Math.min(seekTime, video.duration / 2)

    await new Promise((resolve, reject) => {
      video.onseeked = resolve
      video.onerror = reject
    })

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    URL.revokeObjectURL(videoUrl)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return null

    return new File([blob], file.name.replace(/\.\w+$/, '-thumb.jpg'), { type: 'image/jpeg' })
  } catch (err) {
    console.warn('Génération de miniature vidéo échouée:', err)
    return null
  }
}
