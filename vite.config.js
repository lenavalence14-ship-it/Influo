import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Influo',
        short_name: 'Influo',
        description: 'La plateforme qui connecte influenceurs et entreprises.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallbackDenylist: [/^\/admin/],
        // Cache runtime pour les médias servis par Supabase Storage (photos de profil,
        // images de posts, vidéos, miniatures). Sans ça, chaque retour sur le feed ou
        // le profil re-télécharge intégralement les mêmes fichiers depuis le réseau,
        // même si l'utilisateur les a déjà vus quelques secondes plus tôt.
        runtimeCaching: [
          {
            // miniatures et images : cache-first, elles ne changent jamais une fois publiées
            urlPattern: /\/storage\/v1\/object\/public\/.*\.(?:jpe?g|png|webp|gif)(\?.*)?$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'influo-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // fichiers vidéo : StaleWhileRevalidate, plus adapté à des fichiers volumineux
            // qu'on veut resservir immédiatement depuis le cache tout en les revalidant en fond
            urlPattern: /\/storage\/v1\/object\/public\/.*\.(?:mp4|webm|mov)(\?.*)?$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'influo-videos',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 3 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
        ],
      },
    }),
  ],
})
