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

const RATIO_VALUES: Record<string, number> = { carre: 1, horizontal: 4 / 3, vertical: 9 / 16, vertical_45: 4 / 5 }

function computeMinZoom(width: number, height: number, cropFormat: string) {
  const frameRatio = RATIO_VALUES[cropFormat] || 1
  const mediaRatio = width / height
  return mediaRatio > frameRatio ? mediaRatio / frameRatio : frameRatio / mediaRatio
}

// Lit largeur/hauteur d'un JPEG/PNG à partir des seuls octets d'en-tête
// (pas besoin de télécharger le fichier entier, juste les premiers Ko).
function readImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // PNG : signature puis chunk IHDR à l'offset fixe 16/20
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }

  // JPEG : parcourt les marqueurs jusqu'à trouver un SOFn (0xC0-0xCF sauf C4/C8/CC)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xff) { offset++; continue }
      const marker = bytes[offset + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2
        continue
      }
      const segmentLength = view.getUint16(offset + 2)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = view.getUint16(offset + 5)
        const width = view.getUint16(offset + 7)
        return { width, height }
      }
      offset += 2 + segmentLength
    }
  }

  return null
}

// Parse minimal d'un MP4/MOV : cherche l'atome tkhd (dans moov/trak) qui
// contient la largeur/hauteur d'affichage de la piste (format fixed-point
// 16.16, d'où le >> 16). Suffisant pour les fichiers produits par le
// compresseur vidéo de l'app (mp4/webm classiques H.264).
function readMp4Dimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  function findAtom(start: number, end: number, type: string): { start: number; end: number } | null {
    let o = start
    while (o < end - 8) {
      const size = view.getUint32(o)
      const atomType = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7])
      if (size < 8) break
      if (atomType === type) return { start: o + 8, end: o + size }
      o += size
    }
    return null
  }

  const moov = findAtom(0, bytes.length, 'moov')
  if (!moov) return null
  const trak = findAtom(moov.start, moov.end, 'trak')
  if (!trak) return null
  const tkhd = findAtom(trak.start, trak.end, 'tkhd')
  if (!tkhd) return null

  // largeur/hauteur sont les 8 derniers octets de l'atome tkhd, en fixed-point 16.16
  const width = view.getUint32(tkhd.end - 8) >> 16
  const height = view.getUint32(tkhd.end - 4) >> 16
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
