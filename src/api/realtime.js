// src/api/realtime.js
//
// ⚠️ POINT DE FRICTION MIGRATION MAJEUR.
//
// Les subscriptions temps réel (postgres_changes) sont une fonctionnalité
// propre à Supabase Realtime, bâtie sur la réplication logique de Postgres.
// Aucun autre backend (Firebase, un serveur custom avec WebSocket, etc.)
// n'a la même API. Cette couche masque la syntaxe d'appel, mais PAS le
// concept sous-jacent : le jour d'une migration, il faudra probablement
// remplacer entièrement le mécanisme (ex: WebSocket custom + pub/sub côté
// serveur), pas juste réécrire l'intérieur de ces fonctions.
//
// Objectif ici : que TOUT le code de souscription temps réel de l'app passe
// par ce fichier, pour qu'il n'y ait qu'un seul endroit à regarder ce jour-là.

import { supabase } from '../lib/supabase'

// Souscrit à des changements Postgres sur une table, filtrés, pour un salon donné.
// `handlers` : { INSERT: fn, UPDATE: fn, DELETE: fn } (au moins une clé).
// Retourne une fonction unsubscribe.
export function subscribeToTable({ channelName, table, filter, handlers }) {
  let channel = supabase.channel(channelName)

  for (const [event, handler] of Object.entries(handlers)) {
    channel = channel.on(
      'postgres_changes',
      { event, schema: 'public', table, filter },
      handler
    )
  }

  channel.subscribe()

  return () => supabase.removeChannel(channel)
}
