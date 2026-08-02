import * as messagesApi from '../api/messages'

// Envoie un post en partage à un utilisateur donné, sans passer par l'écran
// Chat (voir SharePostSheet.jsx -- "on sélectionne, on appuie sur Envoyer,
// ça part directement", pas besoin d'ouvrir la conversation).
//
// Même logique de recherche de conversation existante que
// NewConversationSociale.jsx (l'un ou l'autre peut être user_a/user_b) :
// on réutilise la conversation si elle existe déjà, sinon on la crée.
export async function sendPostToUser({ myId, otherUserId, postId }) {
  const { conversationId, error } = await messagesApi.findOrCreateSymmetricConversation({
    table: 'conversations_sociale',
    sideAField: 'user_a_id',
    sideBField: 'user_b_id',
    myId,
    otherId: otherUserId,
    insertFields: { user_a_id: myId, user_b_id: otherUserId },
  })
  if (error) throw error || new Error('Échec création conversation')

  const { error: insertError } = await messagesApi.sendMessageGeneric('messages_sociale', 'conversations_sociale', {
    conversationId,
    senderId: myId,
    contenu: null,
    sharedPostId: postId,
  })
  if (insertError) throw insertError

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
