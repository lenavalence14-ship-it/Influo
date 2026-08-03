// src/api/storage.js
//
// Couche d'abstraction pour le stockage de fichiers (photos, vidéos, pièces
// jointes de messagerie). Aujourd'hui : Supabase Storage. Le jour d'une
// migration, seul ce fichier change (S3, Cloudflare R2, etc. ont des API
// différentes mais le même besoin : upload, url publique, url signée).

import { supabase } from '../lib/supabase'

// Domaine du Worker Cloudflare qui fait proxy + cache vers Supabase Storage
// (voir le code du Worker : réduit la latence pour les utilisateurs loin de
// la région Supabase eu-west-1, en servant les fichiers déjà vus depuis le
// cache Cloudflare réparti dans le monde plutôt que de repasser par Supabase
// à chaque fois). Uniquement pour les buckets publics -- 'messagerie' est
// privé (signed URLs, jamais public), donc jamais concerné par ce proxy.
const CDN_WORKER_URL = 'https://influo.ged-green14.workers.dev'

export async function uploadFile(bucket, path, file, options) {
  return supabase.storage.from(bucket).upload(path, file, options)
}

export function getPublicUrl(bucket, path) {
  // Sert directement depuis le CDN Worker : même chemin que Supabase
  // Storage public (/<bucket>/<path>), le Worker se charge d'aller chercher
  // et mettre en cache derrière.
  return `${CDN_WORKER_URL}/${bucket}/${path}`
}

export async function getSignedUrl(bucket, path, expiresInSeconds) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
  return data?.signedUrl || null
}

// Génère une image (frame) à partir d'une vidéo, pour servir de miniature.
// Pas d'appel réseau ici (pur navigateur), mais colocalisé car toujours
// utilisé juste avant un upload de vidéo.
export function generateVideoThumbnail(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = URL.createObjectURL(file)
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2)
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(video.src)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('thumbnail vide'))), 'image/jpeg', 0.8)
    }
    video.onerror = () => reject(new Error('lecture vidéo impossible'))
  })
}
