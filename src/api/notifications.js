// src/api/notifications.js
//
// Couche d'abstraction pour les notifications (table notifications) et
// push_tokens.

import { supabase } from '../lib/supabase'

const POST_TYPES = [
  'like', 'comment', 'comment_collab',
  'nouveau_post', 'nouveau_reel', 'nouvelle_collab', 'nouveau_reel_collab',
  'reply', 'reply_content', 'comment_like',
  'post_repost', 'repost_activity_like', 'repost_activity_comment', 'repost_activity_repost',
]

export async function fetchNotifications(userId) {
  const { data } = await supabase
    .from('notifications')
    .select('*, from_user:from_user_id(nom_complet, photo_url, role, profils_influenceur(id, verifie))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  const postIds = (data || [])
    .filter((n) => POST_TYPES.includes(n.type) && n.lien_ref_id)
    .map((n) => n.lien_ref_id)

  let mediaByPostId = {}
  if (postIds.length > 0) {
    const { data: medias } = await supabase
      .from('post_medias')
      .select('post_id, media_url, media_type, thumbnail_url, position')
      .in('post_id', postIds)
      .order('position', { ascending: true })
    mediaByPostId = (medias || []).reduce((acc, m) => {
      if (!acc[m.post_id]) acc[m.post_id] = { url: m.media_url, type: m.media_type, thumbnailUrl: m.thumbnail_url }
      return acc
    }, {})
  }

  return (data || []).map((n) => ({
    ...n,
    post_thumbnail: POST_TYPES.includes(n.type) ? mediaByPostId[n.lien_ref_id] : null,
  }))
}

export async function markNotificationRead(notificationId) {
  return supabase.from('notifications').update({ lu: true }).eq('id', notificationId)
}

// --- Push tokens ---

export async function upsertPushToken({ userId, token, platform }) {
  return supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform },
    { onConflict: 'token' }
  )
}

export async function deletePushToken(token) {
  return supabase.from('push_tokens').delete().eq('token', token)
}
