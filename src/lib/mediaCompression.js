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
