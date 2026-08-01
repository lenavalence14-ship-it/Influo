import { supabase } from './supabase'

// Envoie un post en partage à un utilisateur donné, sans passer par l'écran
// Chat (voir SharePostSheet.jsx -- "on sélectionne, on appuie sur Envoyer,
// ça part directement", pas besoin d'ouvrir la conversation).
//
// Même logique de recherche de conversation existante que
// NewConversationSociale.jsx (l'un ou l'autre peut être user_a/user_b) :
// on réutilise la conversation si elle existe déjà, sinon on la crée.
export async function sendPostToUser({ myId, otherUserId, postId }) {
  const { data: existing } = await supabase
    .from('conversations_sociale')
    .select('id')
    .or(
      `and(user_a_id.eq.${myId},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${myId})`
    )
    .maybeSingle()

  let conversationId = existing?.id

  if (!conversationId) {
    const { data: created, error: createError } = await supabase
      .from('conversations_sociale')
      .insert({ user_a_id: myId, user_b_id: otherUserId })
      .select('id')
      .single()
    if (createError || !created) throw createError || new Error('Échec création conversation')
    conversationId = created.id
  }

  const { error: insertError } = await supabase.from('messages_sociale').insert({
    conversation_id: conversationId,
    sender_id: myId,
    contenu: null,
    shared_post_id: postId,
    is_system: false,
  })
  if (insertError) throw insertError

  await supabase
    .from('conversations_sociale')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return conversationId
}

// Envoie à plusieurs destinataires (max géré côté UI par SharePostSheet, pas
// ici) : on tente chacun indépendamment pour qu'un échec sur une personne
// n'empêche pas l'envoi aux autres, et on remonte la liste des échecs.
export async function sendPostToUsers({ myId, otherUserIds, postId }) {
  const results = await Promise.allSettled(
    otherUserIds.map((otherUserId) => sendPostToUser({ myId, otherUserId, postId }))
  )
  const failedUserIds = otherUserIds.filter((_, i) => results[i].status === 'rejected')
  return { failedUserIds, succeededCount: otherUserIds.length - failedUserIds.length }
}
