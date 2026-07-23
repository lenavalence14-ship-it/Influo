// URL du 2e service Render (transcodage FFmpeg), distinct du service qui héberge
// le frontend. À définir dans les variables d'environnement Vite (.env) :
// VITE_TRANSCODE_SERVICE_URL=https://influo-transcode.onrender.com
// VITE_TRANSCODE_SHARED_SECRET=une-chaine-secrete-partagee-avec-le-serveur
const SERVICE_URL = import.meta.env.VITE_TRANSCODE_SERVICE_URL
const SHARED_SECRET = import.meta.env.VITE_TRANSCODE_SHARED_SECRET

// Fire-and-forget volontaire : on ne veut jamais que la publication d'un post
// attende la fin du transcodage HLS (qui peut prendre 30s à plusieurs minutes).
// Le post est publiable immédiatement avec le MP4 classique en media_url ;
// le HLS arrive plus tard et le player bascule dessus automatiquement une fois
// hls_status = 'ready' (voir ReelsViewer). Les erreurs sont juste loguées :
// un échec de transcodage ne doit jamais empêcher l'utilisateur de publier.
export function triggerHlsTranscode({ postMediaId, sourceUrl, storagePrefix }) {
  // DEBUG TEMPORAIRE : alertes visibles à l'écran pour diagnostiquer pourquoi
  // le transcodage ne se déclenche pas. À retirer une fois le problème trouvé.
  alert('[DEBUG] triggerHlsTranscode appelé. SERVICE_URL=' + SERVICE_URL + ' | SECRET défini=' + Boolean(SHARED_SECRET))

  if (!SERVICE_URL) {
    alert('[DEBUG] VITE_TRANSCODE_SERVICE_URL est vide/non défini, arrêt ici')
    console.warn('[hlsTranscode] VITE_TRANSCODE_SERVICE_URL non configurée, HLS désactivé')
    return
  }

  fetch(`${SERVICE_URL}/transcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postMediaId,
      sourceUrl,
      storagePrefix,
      secret: SHARED_SECRET,
    }),
  }).then((res) => {
    alert('[DEBUG] Réponse reçue du service transcode: HTTP ' + res.status)
  }).catch((err) => {
    alert('[DEBUG] fetch a échoué: ' + err.message)
    console.warn('[hlsTranscode] échec du déclenchement (le post reste en MP4):', err)
  })
}