import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

// Lecteur vidéo unique qui choisit automatiquement entre HLS adaptatif
// (qualité qui s'ajuste à la bande passante détectée, comme TikTok/YouTube)
// et MP4 classique en secours (vidéos pas encore transcodées, ou transcodage
// échoué — voir hls_status côté CreatePost/service de transcodage).
//
// Pourquoi hls.js et pas juste <video src="master.m3u8"> : Safari/iOS lit le
// HLS nativement, mais Chrome/Android (donc la majorité des utilisateurs sur
// l'app Capacitor Android) ne le lit PAS nativement — hls.js réimplémente le
// parsing HLS en JS pour ces navigateurs. Sans ça, la vidéo ne démarre jamais
// sur Android.
export default function HlsVideo({
  videoRef, // peut être une ref objet ({current}) ou une callback ref (el) => {...}
  hlsPlaylistUrl,
  fallbackMp4Url,
  poster,
  loop,
  muted,
  preload,
  onLoadedData,
  className,
  style,
}) {
  const hlsInstanceRef = useRef(null)
  // Ref interne toujours de type objet : nécessaire pour que hls.js puisse
  // s'attacher à l'élément <video>, même quand le parent (ReelsViewer) passe
  // une callback ref plutôt qu'un objet ref classique.
  const internalRef = useRef(null)

  const setRefs = (el) => {
    internalRef.current = el
    if (typeof videoRef === 'function') videoRef(el)
    else if (videoRef) videoRef.current = el
  }

  useEffect(() => {
    const video = internalRef.current
    if (!video) return

    // Nettoie toute instance hls.js précédente avant d'en créer une nouvelle
    // (évite les fuites mémoire quand ce composant est réutilisé pour un autre reel).
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy()
      hlsInstanceRef.current = null
    }

    const useHls = Boolean(hlsPlaylistUrl)

    if (!useHls) {
      // Pas de HLS prêt (transcodage en cours, échoué, ou vidéo ancienne) :
      // lecture directe du MP4, comportement identique à avant.
      video.src = fallbackMp4Url
      return
    }

    const canPlayNativeHls = video.canPlayType('application/vnd.apple.mpegurl')

    if (canPlayNativeHls) {
      // Safari / iOS : lecture native, pas besoin de hls.js, plus léger.
      video.src = hlsPlaylistUrl
      return
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Limite le buffer en avance pour économiser la data mobile : pas besoin
        // de précharger 30s de vidéo en 720p si l'utilisateur peut swiper dans 2s.
        maxBufferLength: 15,
        // -1 = laisse hls.js choisir automatiquement le niveau de départ selon sa
        // propre estimation de bande passante (voir abrEwmaDefaultEstimate), au
        // lieu de forcer systématiquement la qualité la plus basse (360p) pour
        // tout le monde. Sur un Reel plein écran, démarrer en 360p par défaut est
        // visiblement flou même pour un utilisateur en bonne connexion — ce n'est
        // pas ce que font TikTok/Instagram, qui n'utilisent le niveau minimal que
        // comme filet de sécurité pour les connexions réellement mauvaises.
        startLevel: -1,
        // Hypothèse de départ avant la 1ère mesure réelle, le temps que hls.js
        // affine avec les segments déjà téléchargés (preload de la vidéo suivante,
        // voir ReelsViewer). 1.5 Mbps est une hypothèse raisonnable pour de la 4G
        // correcte — nettement moins pessimiste que 500kbps, qui forçait quasi
        // toujours le premier choix vers 360p.
        abrEwmaDefaultEstimate: 1_500_000,
      })
      hls.loadSource(hlsPlaylistUrl)
      hls.attachMedia(video)
      hlsInstanceRef.current = hls

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn('[HlsVideo] erreur fatale hls.js, repli sur MP4:', data.type)
          hls.destroy()
          hlsInstanceRef.current = null
          video.src = fallbackMp4Url
        }
      })
    } else {
      // Navigateur sans hls.js ni support natif (très rare) : repli MP4.
      video.src = fallbackMp4Url
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy()
        hlsInstanceRef.current = null
      }
    }
  }, [hlsPlaylistUrl, fallbackMp4Url])

  return (
    <video
      ref={setRefs}
      poster={poster}
      className={className}
      style={style}
      loop={loop}
      muted={muted}
      playsInline
      preload={preload}
      onLoadedData={onLoadedData}
    />
  )
}
