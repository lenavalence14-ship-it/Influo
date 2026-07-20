import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from '../lib/supabase'

// Enregistre le token push FCM de l'appareil dans Supabase pour l'utilisateur connecté.
// Ne fait rien sur le web (le plugin n'existe que sur Android/iOS natif) : la version web
// continue de fonctionner avec les notifications in-app existantes (table `notifications`).
export function usePushNotifications(userId) {
  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return

    let registrationListener
    let errorListener

    const setup = async () => {
      const perm = await PushNotifications.checkPermissions()
      let status = perm.receive

      if (status === 'prompt' || status === 'prompt-with-rationale') {
        const req = await PushNotifications.requestPermissions()
        status = req.receive
      }

      if (status !== 'granted') return

      registrationListener = await PushNotifications.addListener('registration', async (token) => {
        // upsert : un appareil ne doit avoir qu'une ligne, remplacée si le token change
        await supabase.from('push_tokens').upsert(
          {
            user_id: userId,
            token: token.value,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'token' }
        )
      })

      errorListener = await PushNotifications.addListener('registrationError', (err) => {
        console.error('Erreur enregistrement push:', err)
      })

      await PushNotifications.register()
    }

    setup()

    return () => {
      registrationListener?.remove()
      errorListener?.remove()
    }
  }, [userId])
}