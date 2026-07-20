// Edge Function Supabase : envoie une notification push via Firebase Cloud Messaging (API v1)
// dès qu'une ligne est ajoutée dans la table `notifications`.
//
// Variables d'environnement requises (à définir avec `supabase secrets set`) :
// - FIREBASE_PROJECT_ID          : l'ID de ton projet Firebase (ex: influo-app-70781)
// - FIREBASE_CLIENT_EMAIL        : depuis le fichier de clé de compte de service Firebase
// - FIREBASE_PRIVATE_KEY         : idem (attention aux \n à échapper)
// - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY : déjà injectées automatiquement par Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TYPE_TITLES: Record<string, string> = {
  like: 'Nouveau like',
  comment: 'Nouveau commentaire',
  commande: 'Nouvelle commande',
  retrait: 'Retrait',
}

async function getGoogleAccessToken() {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n')

  const jwtHeader = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const jwtClaim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const unsigned = `${enc(jwtHeader)}.${enc(jwtClaim)}`

  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  )
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const jwt = `${unsigned}.${encodedSig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  return data.access_token as string
}

Deno.serve(async (req) => {
  try {
    const { user_id, type, contenu } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id)

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no tokens' }), { status: 200 })
    }

    const accessToken = await getGoogleAccessToken()
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')!

    const title = TYPE_TITLES[type] || 'Influo'
    const body = contenu || 'Vous avez une nouvelle notification'

    const results = await Promise.all(
      tokens.map((t) =>
        fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: { title, body },
              android: {
                priority: 'high',
                notification: {
                  sound: 'default',
                  channel_id: 'default',
                },
              },
            },
          }),
        })
      )
    )

    return new Response(JSON.stringify({ sent: results.length }), { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
