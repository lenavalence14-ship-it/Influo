// Edge Function ponctuelle : migre les post_medias publiés AVANT le nouveau
// système de crop zoom/pan. Pour chacun, lit les dimensions réelles du
// fichier et écrit natural_width/height + un zoom par défaut qui garantit
// que le média remplit tout le cadre (offset reste à 0 = centré). Une fois
// exécutée, le feed n'a plus jamais à improviser un cadrage pour ces posts.
//
// Se déclenche manuellement une fois : POST /migrate-crops (aucun corps requis).
// Sans dépendance binaire (pas de ffprobe en Edge Function) : les dimensions
// vidéo sont lues en parsant directement l'atome 'moov'/'tkhd' du conteneur MP4.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RATIO_VALUES: Record<string, number> = { carre: 1, horizontal: 16 / 9, vertical: 9 / 16, vertical_45: 4 / 5 }

function computeMinZoom(width: number, height: number, cropFormat: string) {
  const frameRatio = RATIO_VALUES[cropFormat] || 1
  const mediaRatio = width / height
  return mediaRatio > frameRatio ? mediaRatio / frameRatio : frameRatio / mediaRatio
}

// Lit largeur/hauteur d'un JPEG/PNG/WEBP à partir des octets du fichier.
function readImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // PNG : signature puis chunk IHDR à l'offset fixe 16/20
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }

  // WEBP (VP8/VP8L/VP8X) : certains exports mobiles renomment en .jpg par erreur
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    const fourCC = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
    if (fourCC === 'VP8 ') {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
    }
    if (fourCC === 'VP8X') {
      const width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1
      const height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1
      return { width, height }
    }
  }

  // JPEG : parcourt les marqueurs jusqu'à trouver un SOFn. Certains fichiers
  // (notamment issus de traitements mobiles) ont un premier octet parasite ou
  // un padding entre marqueurs (0xFF répétés) : on avance marqueur par
  // marqueur en tolérant plusieurs 0xFF consécutifs avant le code, au lieu de
  // s'arrêter à la première incohérence.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset < bytes.length - 4) {
      if (bytes[offset] !== 0xff) { offset++; continue }
      // tolère un padding de 0xFF avant le vrai code marqueur
      let markerOffset = offset + 1
      while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset++
      const marker = bytes[markerOffset]
      // marqueurs sans segment de longueur : on avance d'un octet seulement
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset = markerOffset + 1
        continue
      }
      if (markerOffset + 2 >= bytes.length) break
      const segmentLength = view.getUint16(markerOffset + 1)
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSOF) {
        const height = view.getUint16(markerOffset + 4)
        const width = view.getUint16(markerOffset + 6)
        if (width && height) return { width, height }
      }
      if (segmentLength < 2) break // segment invalide, éviter boucle infinie
      offset = markerOffset + 1 + segmentLength
    }
  }

  return null
}

// Parse un MP4/MOV : cherche l'atome tkhd (dans moov/trak) qui contient la
// largeur/hauteur d'affichage de la piste. Recherche récursive à travers
// toute l'arborescence d'atomes (pas seulement au premier niveau), et gère le
// cas où 'moov' est placé après 'mdat' (fichier non "faststart", fréquent sur
// exports mobiles) puisqu'on a déjà téléchargé le fichier entier de toute façon.
function readMp4Dimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  function findAtomRecursive(start: number, end: number, path: string[]): { start: number; end: number } | null {
    let o = start
    while (o < end - 8) {
      let size = Number(view.getUint32(o))
      const atomType = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7])
      let headerSize = 8
      if (size === 1) {
        // taille étendue 64 bits (rare, mais présente sur certains exports)
        const high = view.getUint32(o + 8)
        const low = view.getUint32(o + 12)
        size = high * 2 ** 32 + low
        headerSize = 16
      }
      if (size < 8) break
      if (atomType === path[0]) {
        const contentStart = o + headerSize
        const contentEnd = o + size
        if (path.length === 1) return { start: contentStart, end: contentEnd }
        // conteneurs qui ont des octets de version/flags avant leurs enfants (ex: pas ici pour moov/trak/mdia, mais stbl a besoin d'aller dans stsd etc — non nécessaire pour tkhd)
        const found = findAtomRecursive(contentStart, contentEnd, path.slice(1))
        if (found) return found
      }
      o += size
    }
    return null
  }

  const tkhd = findAtomRecursive(0, bytes.length, ['moov', 'trak', 'tkhd'])
  if (!tkhd) return null

  // largeur/hauteur sont les 8 derniers octets de l'atome tkhd, en fixed-point 16.16
  if (tkhd.end - tkhd.start < 8) return null
  const width = view.getUint32(tkhd.end - 8) >>> 16
  const height = view.getUint32(tkhd.end - 4) >>> 16
  if (!width || !height) return null
  return { width, height }
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: medias, error } = await supabase
      .from('post_medias')
      .select('id, media_url, media_type, crop_format, posts(crop_format)')
      .is('natural_width', null)

    if (error) throw error

    const results: Array<{ id: string; ok: boolean; detail: string }> = []

    for (const media of medias || []) {
      try {
        const res = await fetch(media.media_url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const bytes = new Uint8Array(await res.arrayBuffer())

        const dims = media.media_type === 'video'
          ? readMp4Dimensions(bytes)
          : readImageDimensions(bytes)

        if (!dims) throw new Error('dimensions introuvables')

        const cropFormat = media.crop_format || (media.posts as { crop_format?: string } | null)?.crop_format || 'carre'
        const zoom = computeMinZoom(dims.width, dims.height, cropFormat)

        const { error: updateError } = await supabase
          .from('post_medias')
          .update({
            natural_width: dims.width,
            natural_height: dims.height,
            zoom,
          })
          .eq('id', media.id)

        if (updateError) throw updateError
        results.push({ id: media.id, ok: true, detail: `${dims.width}x${dims.height}` })
      } catch (err) {
        results.push({ id: media.id, ok: false, detail: String(err) })
      }
    }

    const okCount = results.filter((r) => r.ok).length
    return new Response(JSON.stringify({ total: results.length, ok: okCount, failed: results.length - okCount, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
