// src/api/profile.js
//
// Couche d'abstraction pour les écrans de profil affichés (influenceur,
// client entreprise, utilisateur simple) et leur édition. Les profils
// eux-mêmes (au sens auth : quel rôle a cet utilisateur) restent dans
// src/api/auth.js ; ce fichier couvre ce qui est affiché SUR la page profil
// (posts, offres, réseaux sociaux, collaborations, kit média).

import { supabase } from '../lib/supabase'
import * as storageApi from './storage'

export async function fetchClientProfileViewPage(clientUserId) {
  const [{ data: userRow }, { data: cliRow }, { data: postsData }] = await Promise.all([
    supabase.from('users').select('id, nom_complet, photo_url').eq('id', clientUserId).maybeSingle(),
    supabase.from('profils_client').select('*').eq('user_id', clientUserId).maybeSingle(),
    supabase
      .from('posts')
      .select(`
        id, legende, crop_format, created_at, type, filtre, commande_id,
        post_medias(media_url, media_type, thumbnail_url, position),
        profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
        client:client_id(id, nom_complet, photo_url),
        commandes!posts_commande_id_fkey(lien_instagram, lien_tiktok)
      `)
      .eq('client_id', clientUserId)
      .in('type', ['photo', 'carrousel', 'video'])
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  const postIds = (postsData || []).map((p) => p.id)
  const { data: likes } = postIds.length
    ? await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
    : { data: [] }

  return {
    entreprise: userRow || null,
    clientProfile: cliRow || null,
    posts: (postsData || []).map((p) => ({
      ...p,
      like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
      liked_by_me: false,
    })),
  }
}

export async function fetchSimpleUserProfileViewPage(userId) {
  const [{ data: userRow }, { data: postsData }] = await Promise.all([
    supabase.from('users').select('id, nom_complet, photo_url').eq('id', userId).maybeSingle(),
    supabase
      .from('posts')
      .select(`
        id, legende, crop_format, created_at, type, filtre, commande_id,
        post_medias(media_url, media_type, thumbnail_url, position),
        profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
        client:client_id(id, nom_complet, photo_url),
        commandes!posts_commande_id_fkey(lien_instagram, lien_tiktok)
      `)
      .eq('client_id', userId)
      .in('type', ['photo', 'carrousel', 'video'])
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  return {
    utilisateur: userRow || null,
    posts: (postsData || []).map((p) => ({ ...p, like_count: 0, liked_by_me: false })),
  }
}

export async function fetchSimpleUserPosts(userId, currentUserId) {
  const { data: postsData } = await supabase
    .from('posts')
    .select(`
      id, legende, crop_format, created_at, type, filtre,
      post_medias(media_url, media_type, thumbnail_url, position)
    `)
    .eq('client_id', userId)
    .in('type', ['photo', 'carrousel', 'video'])
    .order('created_at', { ascending: false })
    .limit(60)

  const postIds = (postsData || []).map((p) => p.id)
  const { data: likes } = postIds.length
    ? await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
    : { data: [] }

  return (postsData || []).map((p) => ({
    ...p,
    like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
    liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === currentUserId) || false,
  }))
}

export async function fetchClientCollabPosts(clientUserId, currentUserId) {
  const { data: postsData } = await supabase
    .from('posts')
    .select(`
      id, legende, crop_format, created_at, type, filtre,
      post_medias(media_url, media_type, thumbnail_url, position),
      profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url))
    `)
    .eq('client_id', clientUserId)
    .in('type', ['photo', 'carrousel', 'video'])
    .order('created_at', { ascending: false })
    .limit(60)

  const postIds = (postsData || []).map((p) => p.id)
  const { data: likes } = postIds.length
    ? await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
    : { data: [] }

  return (postsData || []).map((p) => ({
    ...p,
    like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
    liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === currentUserId) || false,
  }))
}

export async function fetchReseauxSociaux(influenceurId) {
  const { data } = await supabase.from('reseaux_sociaux').select('*').eq('influenceur_id', influenceurId)
  return data || []
}

export async function uploadAvatar(userId, compressedFile) {
  const ext = compressedFile.name.split('.').pop()
  const fileName = `${userId}/avatar-${Date.now()}.${ext}`
  const { error } = await storageApi.uploadFile('avatars', fileName, compressedFile)
  if (error) return { error }
  return { url: storageApi.getPublicUrl('avatars', fileName) }
}

export async function updateUserRow(userId, fields) {
  return supabase.from('users').update(fields).eq('id', userId)
}

export async function updateInfluencerBio(influencerProfileId, { bio, pays, ville }) {
  return supabase.from('profils_influenceur').update({ bio, pays, ville }).eq('id', influencerProfileId)
}

export async function updateClientBio(clientProfileId, { bio, pays, ville }) {
  return supabase.from('profils_client').update({ bio, pays, ville }).eq('id', clientProfileId)
}

export async function syncReseauxSociaux({ influenceurId, existants, nouveaux, deletedIds }) {
  await Promise.all([
    ...existants.map((r) =>
      supabase
        .from('reseaux_sociaux')
        .update({
          plateforme: r.plateforme,
          nom_compte: r.nom_compte,
          lien_profil: r.lien_profil,
          nombre_abonnes: parseInt(r.nombre_abonnes, 10) || 0,
        })
        .eq('id', r.id)
    ),
    ...nouveaux.map((r) =>
      supabase.from('reseaux_sociaux').insert({
        influenceur_id: influenceurId,
        plateforme: r.plateforme,
        nom_compte: r.nom_compte,
        lien_profil: r.lien_profil,
        nombre_abonnes: parseInt(r.nombre_abonnes, 10) || 0,
      })
    ),
    ...deletedIds.map((id) => supabase.from('reseaux_sociaux').delete().eq('id', id)),
  ])
}

export async function fetchMediaKitPage(userId, needReseaux) {
  const requests = [supabase.from('media_kits').select('*').eq('influenceur_id', userId).maybeSingle()]
  if (needReseaux) {
    requests.push(supabase.from('reseaux_sociaux').select('*').eq('influenceur_id', userId))
  }
  const results = await Promise.all(requests)
  return {
    kit: results[0].data || null,
    reseaux: results[1] ? results[1].data || [] : null,
  }
}

export async function uploadMediaKitPhoto(userId, compressedFile) {
  const ext = compressedFile.name.split('.').pop()
  const fileName = `${userId}/media-kit-${Date.now()}.${ext}`
  const { error } = await storageApi.uploadFile('media-kits', fileName, compressedFile)
  if (error) return { error }
  return { url: storageApi.getPublicUrl('media-kits', fileName) }
}

export async function upsertMediaKit(payload) {
  return supabase.from('media_kits').upsert(payload, { onConflict: 'influenceur_id' }).select().single()
}

// --- Page profil influenceur ---

export async function fetchInfluencerOffres(influenceurId, onlyActive) {
  let query = supabase.from('offres').select('*').eq('influenceur_id', influenceurId).order('created_at', { ascending: false })
  if (onlyActive) query = query.eq('actif', true)
  const { data } = await query
  return data || []
}

export async function toggleOffreActive(offreId, nextActive) {
  return supabase.from('offres').update({ actif: nextActive }).eq('id', offreId)
}

export async function deleteOffreFromProfile(offreId) {
  return supabase.from('offres').delete().eq('id', offreId)
}

// Charge tout ce qu'affiche la page profil influenceur en un minimum
// d'allers-retours : profil, posts, offres, réseaux, puis engagement +
// comptage des collaborations vérifiées (post_auteurs).
export async function fetchInfluencerProfilePage({ targetId, isMe, currentUserId }) {
  const offresQuery = () => {
    let q = supabase.from('offres').select('*').eq('influenceur_id', targetId).order('created_at', { ascending: false })
    return isMe ? q : q.eq('actif', true)
  }

  const [{ data: prof }, { data: postsData }, { data: offresData }, { data: reseauxData }] = await Promise.all([
    supabase.from('profils_influenceur').select('*, users(nom_complet, photo_url, email)').eq('id', targetId).maybeSingle(),
    supabase
      .from('posts')
      .select(`
        id, legende, crop_format, created_at, type, filtre, client_id, audio_url,
        post_medias(media_url, media_type, thumbnail_url, position, filtre, zoom, offset_x, offset_y, natural_width, natural_height),
        profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)),
        client:client_id(id, nom_complet, photo_url)
      `)
      .eq('influenceur_id', targetId)
      .in('type', ['photo', 'carrousel', 'video', 'texte'])
      .order('created_at', { ascending: false })
      .limit(60),
    offresQuery(),
    supabase.from('reseaux_sociaux').select('*').eq('influenceur_id', targetId),
  ])

  const postIds = (postsData || []).map((p) => p.id)
  const { data: likes } = postIds.length
    ? await supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
    : { data: [] }

  const enrichedPosts = (postsData || []).map((p) => ({
    ...p,
    like_count: likes?.filter((l) => l.post_id === p.id).length || 0,
    liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === currentUserId) || false,
  }))

  const clientCounts = new Map()
  for (const p of enrichedPosts) {
    if (!p.client) continue
    const existing = clientCounts.get(p.client.id)
    if (existing) existing.count += 1
    else clientCounts.set(p.client.id, { ...p.client, count: 1 })
  }
  const brandCircles = Array.from(clientCounts.values()).sort((a, b) => b.count - a.count)

  let collabCount = 0
  let collabPhotoCount = 0
  let collabVideoCount = 0

  if (postIds.length > 0) {
    const { data: auteurs } = await supabase.from('post_auteurs').select('post_id').in('post_id', postIds)
    const countByPost = {}
    for (const a of auteurs || []) {
      countByPost[a.post_id] = (countByPost[a.post_id] || 0) + 1
    }
    const collabPostIds = Object.keys(countByPost).filter((pid) => countByPost[pid] > 1)
    const typeByPostId = {}
    for (const p of enrichedPosts) typeByPostId[p.id] = p.type

    for (const pid of collabPostIds) {
      if (typeByPostId[pid] === 'video') collabVideoCount++
      else collabPhotoCount++
    }
    collabCount = collabPostIds.length
  }

  return {
    target: prof,
    posts: enrichedPosts,
    offres: offresData || [],
    reseaux: reseauxData || [],
    brandCircles,
    collabCount,
    collabPhotoCount,
    collabVideoCount,
  }
}
