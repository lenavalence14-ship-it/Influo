// Serveur du site Influo, à faire tourner sur Render en Web Service (build
// command: npm run build, start command: npm start) -- remplace le Static
// Site actuel, qui ne peut pas exécuter de code par requête.
//
// Rôle unique : pour /post/:id, aller chercher le post dans Supabase et
// injecter les balises Open Graph (og:image, og:title, og:description)
// dans le HTML avant de le servir. C'est nécessaire parce que WhatsApp (et
// les autres apps qui génèrent un aperçu de lien) ne charge jamais le
// JavaScript React : il lit uniquement le HTML brut de la première
// réponse. Un Static Site sert toujours le même index.html figé, donc ne
// peut jamais afficher l'image/titre du post partagé -- d'où ce serveur.
//
// Pour toutes les autres routes, comportement identique à l'ancien Static
// Site : fichiers statiques du build, puis fallback SPA (React Router
// prend le relais côté client).
import express from 'express'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const indexPath = path.join(distDir, 'index.html')

// Si les variables d'env manquent, on ne fait pas planter tout le serveur :
// les og:tags dynamiques seront simplement absents et /post/:id retombera
// sur le HTML de base (comportement identique à l'ancien Static Site),
// plutôt que de rendre le site entier inaccessible.
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
if (!supabase) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes : og:tags désactivés pour /post/:id')
}

const app = express()

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function fetchPostForOg(id) {
  if (!supabase) return null
  const { data } = await supabase
    .from('posts')
    .select(`
      id, legende,
      post_medias(media_url, media_type, position),
      profils_influenceur(users(nom_complet)),
      utilisateur:utilisateur_id(nom_complet)
    `)
    .eq('id', id)
    .maybeSingle()
  return data
}

app.get('/post/:id', async (req, res, next) => {
  try {
    const post = await fetchPostForOg(req.params.id)
    let html = fs.readFileSync(indexPath, 'utf-8')

    if (post) {
      const authorName = post.profils_influenceur?.users?.nom_complet || post.utilisateur?.nom_complet || 'Influo'
      const media = post.post_medias?.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]
      const ogImage = media?.media_type === 'video' ? '' : media?.media_url || ''
      const title = escapeHtml(authorName)
      const description = escapeHtml(post.legende || `Publication de ${authorName} sur Influo`)

      const ogTags = `
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : ''}
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(`${req.protocol}://${req.get('host')}${req.originalUrl}`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ''}
  `

      html = html.replace('</head>', `${ogTags}\n  </head>`)
    }

    res.set('Content-Type', 'text/html')
    res.send(html)
  } catch (err) {
    console.error('Échec génération OG tags pour /post/:id :', err)
    next()
  }
})

app.use(express.static(distDir))

app.get('*', (req, res) => {
  res.sendFile(indexPath)
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Influo server listening on port ${port}`)
})
