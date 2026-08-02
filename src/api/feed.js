// src/api/feed.js
//
// Couche d'abstraction pour le feed principal : posts, appels_offre, follows,
// post_likes, post_comments, post_reposts.
//
// ⚠️ POINT DE FRICTION MIGRATION : fetchFeedPage() appelle supabase.rpc('get_feed_items', ...),
// une fonction SQL définie côté Postgres qui fait le tri fusionné posts+offres et la
// pagination. Aucune couche d'abstraction ne rend ce point transparent : le jour
// d'une migration hors Supabase, cette logique de tri doit être réécrite quelque
// part (en JS ici, ou dans le nouveau backend). Ce n'est pas un simple
// find-and-replace comme le reste de ce fichier.

import { supabase } from '../lib/supabase'
import * as storageApi from './storage'

const PAGE_SIZE = 10

export async function fetchFollowingIds(userId) {
  const { data } = await supabase.from('follows').select('followed_id').eq('follower_id', userId)
  return new Set((data || []).map((f) => f.followed_id))
}

export async function fetchFollowCounts(targetUserId) {
  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('followed_id', targetUserId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', targetUserId),
  ])
  return { followersCount: followersCount || 0, followingCount: followingCount || 0 }
}

export async function fetchUserHeaderName(userId) {
  const { data } = await supabase.from('users').select('nom_complet').eq('id', userId).maybeSingle()
  return data?.nom_complet || ''
}

export async function fetchFollowRows(targetUserId, tab) {
  const query =
    tab === 'followers'
      ? supabase
          .from('follows')
          .select('follower_id, users:follower_id(id, nom_complet, photo_url, role, profils_influenceur(verifie))')
          .eq('followed_id', targetUserId)
          .order('created_at', { ascending: false })
      : supabase
          .from('follows')
          .select('followed_id, users:followed_id(id, nom_complet, photo_url, role, profils_influenceur(verifie))')
          .eq('follower_id', targetUserId)
          .order('created_at', { ascending: false })

  const { data } = await query
  return (data || []).map((r) => r.users).filter(Boolean)
}

export async function followUser(followerId, targetUserId) {
  return supabase.from('follows').insert({ follower_id: followerId, followed_id: targetUserId })
}

export async function unfollowUser(followerId, targetUserId) {
  return supabase.from('follows').delete().eq('follower_id', followerId).eq('followed_id', targetUserId)
}

// Retourne les items de feed déjà triés et paginés côté serveur.
// Voir avertissement en haut de fichier : dépend de get_feed_items (RPC SQL).
async function fetchOrderedFeedItems({ limit, offset }) {
  const { data, error } = await supabase.rpc('get_feed_items', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) console.error('Erreur tri feed:', error)
  return data || []
}

async function fetchPostsByIds(postIds) {
  if (!postIds.length) return []
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, legende, crop_format, type, created_at, commande_id, filtre,
      audio_url, audio_start, audio_duration,
      post_medias(media_url, media_type, thumbnail_url, position, filtre, zoom, offset_x, offset_y, natural_width, natural_height),
      profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
      utilisateur:utilisateur_id(id, nom_complet, photo_url),
      client:client_id(id, nom_complet, photo_url),
      commandes!posts_commande_id_fkey(lien_instagram, lien_tiktok)
    `)
    .in('id', postIds)
  if (error) console.error('Erreur chargement feed:', error)
  return data || []
}

async function fetchOffersByIds(offerIds) {
  if (!offerIds.length) return []
  const { data, error } = await supabase
    .from('appels_offre')
    .select('id, contenu, couleur, created_at, profils_client(id, user_id, users(nom_complet, photo_url))')
    .in('id', offerIds)
  if (error) console.error('Erreur chargement appels offre:', error)
  return data || []
}

async function fetchPostEngagement(postIds) {
  if (!postIds.length) return { likes: [], comments: [], reposts: [] }
  const [{ data: likes }, { data: comments }, { data: reposts }] = await Promise.all([
    supabase.from('post_likes').select('post_id, user_id, created_at, users(nom_complet)').in('post_id', postIds),
    supabase.from('post_comments').select('post_id').in('post_id', postIds),
    supabase.from('post_reposts').select('post_id, user_id').in('post_id', postIds),
  ])
  return { likes: likes || [], comments: comments || [], reposts: reposts || [] }
}

// Crée le post "collaboration vérifiée" généré automatiquement quand une
// commande est livrée puis validée par le client (voir Chat.jsx).
export async function createCollabPost({ influenceurId, mediaType, cropFormat, commandeId, clientId }) {
  const { data } = await supabase
    .from('posts')
    .insert({
      influenceur_id: influenceurId,
      type: mediaType === 'video' ? 'video' : 'photo',
      crop_format: cropFormat || 'carre',
      commande_id: commandeId,
      client_id: clientId,
    })
    .select()
    .single()
  return data
}

export async function addPostMedia({ postId, mediaUrl, mediaType, thumbnailUrl }) {
  return supabase.from('post_medias').insert({
    post_id: postId,
    media_url: mediaUrl,
    media_type: mediaType || 'image',
    thumbnail_url: thumbnailUrl || null,
    position: 0,
  })
}

// Déclenche le trigger notify_on_new_post côté DB pour notifier les abonnés
// des deux comptes impliqués dans la collaboration.
export async function addPostAuteurs(auteurs) {
  if (!auteurs.length) return
  return supabase.from('post_auteurs').insert(auteurs)
}

export async function fetchSinglePost(postId, userId) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, legende, crop_format, type, created_at, commande_id, filtre,
      post_medias(media_url, media_type, thumbnail_url, position, filtre, zoom, offset_x, offset_y, natural_width, natural_height),
      profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
      client:client_id(id, nom_complet, photo_url),
      commandes!posts_commande_id_fkey(lien_instagram, lien_tiktok)
    `)
    .eq('id', postId)
    .maybeSingle()

  if (error || !data) return { notFound: true }

  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('post_likes').select('post_id, user_id').eq('post_id', data.id),
    supabase.from('post_comments').select('post_id').eq('post_id', data.id),
  ])

  return {
    post: {
      ...data,
      like_count: likes?.length || 0,
      liked_by_me: likes?.some((l) => l.user_id === userId) || false,
      comment_count: comments?.length || 0,
    },
  }
}

const REELS_PAGE_SIZE = 20

// ⚠️ POINT DE FRICTION MIGRATION : comme fetchFeedPage, dépend d'un RPC SQL
// (get_reels_ids) pour le tri repost-aware. Voir avertissement en tête de
// fichier.
export async function fetchReels(userId) {
  const { data: ordered, error: orderError } = await supabase.rpc('get_reels_ids', {
    p_limit: REELS_PAGE_SIZE,
    p_offset: 0,
  })
  if (orderError) console.error('Erreur tri reels:', orderError)
  if (!ordered || ordered.length === 0) return []

  const orderedIds = ordered.map((o) => o.post_id)

  const { data } = await supabase
    .from('posts')
    .select(`
      id, legende, created_at, filtre, client_id, crop_format,
      post_medias(media_url, media_type, thumbnail_url, position, hls_status, hls_playlist_url, zoom, offset_x, offset_y, natural_width, natural_height),
      profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
      client:client_id(id, nom_complet, photo_url)
    `)
    .in('id', orderedIds)

  const postIds = (data || []).map((p) => p.id)
  const [{ data: likes }, { data: commentCounts }, { data: reposts }] = await Promise.all([
    postIds.length ? supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds) : Promise.resolve({ data: [] }),
    postIds.length ? supabase.from('post_comments').select('post_id').in('post_id', postIds) : Promise.resolve({ data: [] }),
    postIds.length ? supabase.from('post_reposts').select('post_id, user_id').in('post_id', postIds) : Promise.resolve({ data: [] }),
  ])

  const byId = new Map((data || []).map((p) => [p.id, p]))

  return orderedIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => ({
      ...p,
      like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
      liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === userId) || false,
      comment_count: commentCounts?.filter((c) => c.post_id === p.id).length || 0,
      repost_count: reposts?.filter((r) => r.post_id === p.id).length || 0,
      reposted_by_me: reposts?.some((r) => r.post_id === p.id && r.user_id === userId) || false,
    }))
}

// Publie un souvenir (template rempli par l'utilisateur) comme un post
// standard dans le feed : upload de l'image finale, création du post, du
// media associé.
export async function publishSouvenirPost({ userId, legende, imageBlob }) {
  const { data: post, error: errPost } = await supabase
    .from('posts')
    .insert({ utilisateur_id: userId, type: 'photo', legende: legende || null, crop_format: 'souvenir' })
    .select()
    .single()
  if (errPost) throw errPost

  const cheminFinal = `${userId}/${post.id}/0-souvenir.jpg`
  const { error: errUploadFinal } = await storageApi.uploadFile('posts', cheminFinal, imageBlob, { contentType: 'image/jpeg' })
  if (errUploadFinal) throw errUploadFinal
  const mediaUrl = storageApi.getPublicUrl('posts', cheminFinal)

  const { error: errMedia } = await supabase.from('post_medias').insert({
    post_id: post.id,
    media_url: mediaUrl,
    media_type: 'image',
    position: 0,
  })
  if (errMedia) throw errMedia

  return post
}

export async function uploadSouvenirBlocPhoto(userId, templateId, blocId, file) {
  const chemin = `souvenirs/${userId}/${templateId}-${blocId}-${Date.now()}.jpg`
  const { error } = await storageApi.uploadFile('posts', chemin, file, { contentType: file.type })
  if (error) throw error
  return storageApi.getPublicUrl('posts', chemin)
}

export async function fetchPostForEdit(postId) {
  const { data } = await supabase
    .from('posts')
    .select('*, post_medias(id, media_url, media_type, position, hls_status, hls_playlist_url, thumbnail_url, filtre, crop_format, zoom, offset_x, offset_y, natural_width, natural_height, texte_overlay, texte_x, texte_y, texte_couleur, texte_police)')
    .eq('id', postId)
    .maybeSingle()
  return data
}

// --- Création / édition de post ---

export async function createTextPost({ influenceurId, legende }) {
  return supabase.from('posts').insert({ influenceur_id: influenceurId, type: 'texte', legende })
}

export async function updatePostCommonFields(postId, fields) {
  return supabase.from('posts').update(fields).eq('id', postId)
}

export async function updatePostMedia(mediaId, fields) {
  const { error } = await supabase.from('post_medias').update(fields).eq('id', mediaId)
  return error
}

export async function createPost({ influenceurId, type, ...commonFields }) {
  return supabase.from('posts').insert({ influenceur_id: influenceurId, type, ...commonFields }).select().single()
}

export async function insertPostMedia(fields) {
  return supabase.from('post_medias').insert(fields).select('id').single()
}

export async function notifyNewPost({ userId, postId }) {
  return supabase.from('notifications').insert({
    user_id: userId,
    type: 'nouveau_post',
    contenu: 'Votre publication est en ligne.',
    lien_ref_id: postId,
  })
}

// --- Commentaires ---

export async function fetchPostComments(postId, userId) {
  const { data } = await supabase
    .from('post_comments')
    .select('id, contenu, created_at, parent_comment_id, user_id, users(nom_complet, photo_url, profils_influenceur(id, verifie))')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  const list = data || []
  const commentIds = list.map((c) => c.id)
  const { data: likes } = commentIds.length
    ? await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
    : { data: [] }

  return list.map((c) => ({
    ...c,
    like_count: likes?.filter((l) => l.comment_id === c.id).length || 0,
    liked_by_me: likes?.some((l) => l.comment_id === c.id && l.user_id === userId) || false,
  }))
}

export async function createComment({ postId, userId, contenu, parentCommentId = null }) {
  return supabase.from('post_comments').insert({
    post_id: postId,
    user_id: userId,
    contenu,
    parent_comment_id: parentCommentId,
  })
}

export async function likeComment(commentId, userId) {
  return supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId })
}

export async function unlikeComment(commentId, userId) {
  return supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: userId })
}

// --- Engagement sur un post individuel (like, repost, suppression) ---

export async function likePost(postId, userId) {
  return supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
}

export async function unlikePost(postId, userId) {
  return supabase.from('post_likes').delete().match({ post_id: postId, user_id: userId })
}

// Dernier like restant sur un post (pour "Aimé par {nom} et d'autres personnes").
export async function fetchLastLiker(postId) {
  const { data } = await supabase
    .from('post_likes')
    .select('created_at, users(nom_complet)')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0]?.users?.nom_complet || null
}

// Nom d'affichage résolu directement en base (pas depuis le contexte Auth,
// qui peut ne pas être à jour au moment du clic).
export async function fetchUserDisplayName(userId) {
  const { data } = await supabase.from('users').select('nom_complet').eq('id', userId).single()
  return data?.nom_complet || null
}

export async function repostPost(postId, userId) {
  return supabase.from('post_reposts').insert({ post_id: postId, user_id: userId })
}

export async function unrepostPost(postId, userId) {
  return supabase.from('post_reposts').delete().match({ post_id: postId, user_id: userId })
}

export async function deletePost(postId) {
  return supabase.from('posts').delete().eq('id', postId)
}

// Récupère une page de feed : items triés (RPC) + posts/offres + compteurs
// d'engagement, assemblés dans l'ordre décidé par get_feed_items.
export async function fetchFeedPage({ userId, pageParam = 0 }) {
  const offset = pageParam * PAGE_SIZE

  const ordered = await fetchOrderedFeedItems({ limit: PAGE_SIZE, offset })
  if (ordered.length === 0) return { posts: [], nextPage: null }

  const postIds = ordered.filter((o) => o.item_type === 'post').map((o) => o.item_id)
  const offerIds = ordered.filter((o) => o.item_type === 'offre').map((o) => o.item_id)

  const [postRows, offerRows, { likes, comments, reposts }] = await Promise.all([
    fetchPostsByIds(postIds),
    fetchOffersByIds(offerIds),
    fetchPostEngagement(postIds),
  ])

  const postById = new Map(postRows.map((p) => [p.id, p]))
  const offerById = new Map(offerRows.map((o) => [o.id, o]))

  const posts = ordered
    .map((o) => {
      if (o.item_type === 'offre') {
        const offer = offerById.get(o.item_id)
        if (!offer) return null
        return { item_type: 'offre', ...offer }
      }
      const p = postById.get(o.item_id)
      if (!p) return null
      const postLikes = likes.filter((l) => l.post_id === p.id)
      const postReposts = reposts.filter((r) => r.post_id === p.id)
      const lastLike = postLikes.length
        ? postLikes.reduce((latest, l) => (new Date(l.created_at) > new Date(latest.created_at) ? l : latest))
        : null
      return {
        item_type: 'post',
        ...p,
        like_count: postLikes.length,
        liked_by_me: postLikes.some((l) => l.user_id === userId),
        comment_count: comments.filter((c) => c.post_id === p.id).length,
        last_liker_name: lastLike?.users?.nom_complet || null,
        repost_count: postReposts.length,
        reposted_by_me: postReposts.some((r) => r.user_id === userId),
      }
    })
    .filter(Boolean)

  return { posts, nextPage: ordered.length === PAGE_SIZE ? pageParam + 1 : null }
}
