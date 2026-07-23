import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import { mkdtemp, readFile, readdir, rm } from 'fs/promises'
import { createWriteStream } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import https from 'https'

const app = express()
app.use(express.json())

// CORS : sans ça, le navigateur bloque silencieusement (erreur "Failed to fetch")
// toute requête venant du frontend (origine différente : influo-7yfp.onrender.com
// appelle influo-transcode.onrender.com). On autorise largement ici car ce endpoint
// est déjà protégé par le secret partagé (voir vérif plus bas), donc ouvrir CORS
// ne l'expose pas davantage.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Clé service_role : nécessaire pour écrire dans Storage et mettre à jour
// post_medias sans passer par les policies RLS pensées pour le client.
// Ne JAMAIS exposer cette clé côté frontend — elle ne vit que sur ce serveur.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Clé partagée simple pour vérifier que l'appel vient bien de ton app et pas
// de n'importe qui sur internet (ce endpoint est public sur Render).
const SHARED_SECRET = process.env.TRANSCODE_SHARED_SECRET

const BUCKET = 'posts'

// Les 3 qualités demandées. maxrate/bufsize bornent le débit pour un streaming
// stable sur réseau mobile instable (évite les pics de débit qui font stutter).
const RENDITIONS = [
  { name: '360p', height: 360, videoBitrate: '800k', maxrate: '856k', bufsize: '1200k', audioBitrate: '96k' },
  { name: '480p', height: 480, videoBitrate: '1400k', maxrate: '1498k', bufsize: '2100k', audioBitrate: '128k' },
  { name: '720p', height: 720, videoBitrate: '2800k', maxrate: '2996k', bufsize: '4200k', audioBitrate: '128k' },
]

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath)
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Échec téléchargement source: HTTP ${res.statusCode}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', reject)
  })
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args)
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-800)}`))
    })
  })
}

// Génère les 3 renditions HLS + une master playlist qui les référence toutes,
// pour que hls.js puisse choisir automatiquement selon la bande passante.
async function transcodeToHls(inputPath, outDir) {
  for (const r of RENDITIONS) {
    const renditionDir = path.join(outDir, r.name)
    await import('fs/promises').then((fs) => fs.mkdir(renditionDir, { recursive: true }))

    // -vf scale : redimensionne en gardant le ratio, hauteur fixée à r.height
    // -hls_time 4 : segments de 4s, bon compromis démarrage rapide / overhead
    // -hls_playlist_type vod : playlist figée (vidéo déjà uploadée, pas de live)
    await runFFmpeg([
      '-i', inputPath,
      '-vf', `scale=-2:${r.height}`,
      '-c:v', 'h264', '-profile:v', 'main', '-preset', 'veryfast',
      '-b:v', r.videoBitrate, '-maxrate', r.maxrate, '-bufsize', r.bufsize,
      '-c:a', 'aac', '-b:a', r.audioBitrate, '-ac', '2',
      '-hls_time', '4',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(renditionDir, 'seg_%03d.ts'),
      path.join(renditionDir, 'index.m3u8'),
    ])
  }

  // Master playlist : liste les 3 qualités avec leur bande passante approx,
  // c'est ce fichier que hls.js charge en premier côté client.
  const bandwidthOf = (r) => {
    const kbps = parseInt(r.videoBitrate) + parseInt(r.audioBitrate)
    return kbps * 1000
  }
  const heightToWidth = { 360: 640, 480: 854, 720: 1280 }

  const master = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    ...RENDITIONS.flatMap((r) => [
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidthOf(r)},RESOLUTION=${heightToWidth[r.height]}x${r.height}`,
      `${r.name}/index.m3u8`,
    ]),
  ].join('\n')

  await import('fs/promises').then((fs) => fs.writeFile(path.join(outDir, 'master.m3u8'), master))
}

// Upload récursif de tout le dossier HLS généré vers Supabase Storage,
// en gardant la même arborescence (master.m3u8, 360p/index.m3u8, 360p/seg_000.ts, ...).
async function uploadHlsDir(localDir, storagePrefix) {
  const entries = await readdir(localDir, { withFileTypes: true })
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name)
    const storagePath = `${storagePrefix}/${entry.name}`
    if (entry.isDirectory()) {
      await uploadHlsDir(localPath, storagePath)
    } else {
      const content = await readFile(localPath)
      const contentType = entry.name.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'video/mp2t'
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, content, { contentType, upsert: true })
      if (error) throw new Error(`Upload ${storagePath} échoué: ${error.message}`)
    }
  }
}

app.post('/transcode', async (req, res) => {
  const { postMediaId, sourceUrl, storagePrefix, secret } = req.body

  if (secret !== SHARED_SECRET) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  if (!postMediaId || !sourceUrl || !storagePrefix) {
    return res.status(400).json({ error: 'postMediaId, sourceUrl et storagePrefix requis' })
  }

  // On répond immédiatement : le transcodage prend du temps (dizaines de
  // secondes à quelques minutes selon la durée vidéo) et le client n'a pas
  // à attendre — il publie le post tout de suite avec le MP4 en fallback,
  // le HLS arrive en arrière-plan et le player bascule dessus une fois prêt.
  res.status(202).json({ status: 'processing' })

  let workDir
  try {
    workDir = await mkdtemp(path.join(tmpdir(), 'transcode-'))
    const inputPath = path.join(workDir, 'source.mp4')
    const outDir = path.join(workDir, 'hls')

    await downloadFile(sourceUrl, inputPath)
    await transcodeToHls(inputPath, outDir)
    await uploadHlsDir(outDir, storagePrefix)

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(`${storagePrefix}/master.m3u8`)

    await supabase
      .from('post_medias')
      .update({ hls_status: 'ready', hls_playlist_url: urlData.publicUrl })
      .eq('id', postMediaId)

    console.log(`[transcode] OK postMediaId=${postMediaId}`)
  } catch (err) {
    console.error(`[transcode] ÉCHEC postMediaId=${postMediaId}:`, err.message)
    await supabase
      .from('post_medias')
      .update({ hls_status: 'failed', hls_error: String(err.message).slice(0, 500) })
      .eq('id', postMediaId)
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
})

app.get('/health', (_req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 10000
app.listen(PORT, () => console.log(`Transcode service listening on ${PORT}`))
