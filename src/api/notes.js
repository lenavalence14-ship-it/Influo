// src/api/notes.js
//
// Couche d'abstraction pour les notes (statuts texte/photo éphémères, 24h) :
// notes, note_likes, note_reposts, note_views. Upload de médias via
// src/api/storage.js.

import { supabase } from '../lib/supabase'
import * as storageApi from './storage'

const NOTE_LIFETIME_MS = 24 * 60 * 60 * 1000

// Utilisateurs, tous rôles confondus (hors admin), pour afficher un cercle
// neutre même pour ceux qui n'ont jamais posté de note.
export async function fetchAllUsersForNoteBar() {
  const { data } = await supabase.from('users').select('id, nom_complet, photo_url, role').neq('role', 'admin')
  return data || []
}

export async function fetchActiveNotes() {
  const { data } = await supabase
    .from('notes')
    .select('id, user_id, contenu, created_at, expire_at, repost_of, photo_url, filtre, crop, zoom, texte_overlay, texte_x, texte_y, texte_couleur, texte_police, audio_url, audio_start, audio_duration, users(id, nom_complet, photo_url, role)')
    .order('created_at', { ascending: true })
  return data || []
}
export async function updateNoteText(noteId, userId, contenu) {
  return supabase.from('notes').update({ contenu }).eq('id', noteId).eq('user_id', userId)
}

export async function createTextNote({ userId, contenu }) {
  return supabase.from('notes').insert({
    user_id: userId,
    contenu,
    expire_at: new Date(Date.now() + NOTE_LIFETIME_MS).toISOString(),
  })
}

export async function uploadNotePhoto(userId, compressedBlob) {
  const fileName = `${userId}/note-${Date.now()}.jpg`
  const { error } = await storageApi.uploadFile('posts', fileName, compressedBlob)
  if (error) return { error }
  return { url: storageApi.getPublicUrl('posts', fileName) }
}

export async function uploadNoteAudio(userId, trimmedBlob) {
  const fileName = `${userId}/note-audio-${Date.now()}.wav`
  const { error } = await storageApi.uploadFile('posts', fileName, trimmedBlob)
  if (error) return { error }
  return { url: storageApi.getPublicUrl('posts', fileName) }
}

export async function insertPhotoNote({ userId, photoUrl, filtre, crop, zoom, texte, audioUrl, audioDuration }) {
  return supabase.from('notes').insert({
    user_id: userId,
    contenu: texte?.contenu || ' ',
    photo_url: photoUrl,
    filtre,
    crop,
    zoom: zoom ?? 1,
    texte_overlay: texte?.contenu || null,
    texte_x: texte?.x ?? 50,
    texte_y: texte?.y ?? 50,
    texte_couleur: texte?.couleur || '#ffffff',
    texte_police: texte?.police || 'Inter',
    audio_url: audioUrl,
    audio_start: audioUrl ? 0 : null,
    audio_duration: audioUrl ? audioDuration : null,
    expire_at: new Date(Date.now() + NOTE_LIFETIME_MS).toISOString(),
  })
}

export async function fetchNoteForEdit(noteId) {
  const { data } = await supabase.from('notes').select('id, contenu, user_id').eq('id', noteId).maybeSingle()
  return data
}

// --- Engagement sur une note (likes, vues, reposts) ---

export async function fetchNoteLikeCount(noteId) {
  const { count } = await supabase.from('note_likes').select('id', { count: 'exact', head: true }).eq('note_id', noteId)
  return count || 0
}

export async function fetchMyNoteLike(noteId, userId) {
  const { data } = await supabase.from('note_likes').select('id').eq('note_id', noteId).eq('user_id', userId).maybeSingle()
  return !!data
}

export async function fetchMyNoteRepost(noteId, userId) {
  const { data } = await supabase.from('note_reposts').select('id').eq('note_id', noteId).eq('user_id', userId).maybeSingle()
  return !!data
}

export async function fetchNoteRepostIds(originalNoteId) {
  const { data } = await supabase.from('notes').select('id').eq('repost_of', originalNoteId)
  return (data || []).map((r) => r.id)
}

export async function fetchNoteViewers(noteIds) {
  const { data } = await supabase
    .from('note_views')
    .select('user_id, created_at, users(id, nom_complet, photo_url)')
    .in('note_id', noteIds)
    .order('created_at', { ascending: false })
  return data || []
}

export async function recordNoteView(noteId, userId) {
  return supabase
    .from('note_views')
    .upsert({ note_id: noteId, user_id: userId }, { onConflict: 'note_id,user_id', ignoreDuplicates: true })
}

export async function likeNote(noteId, userId) {
  return supabase.from('note_likes').insert({ note_id: noteId, user_id: userId })
}

export async function unlikeNote(noteId, userId) {
  return supabase.from('note_likes').delete().eq('note_id', noteId).eq('user_id', userId)
}

export async function notifyNoteLike({ noteAuthorId, likerName, noteId, likerId }) {
  return supabase.from('notifications').insert({
    user_id: noteAuthorId,
    type: 'note_like',
    contenu: `${likerName || 'Quelqu\u2019un'} a aimé ta note`,
    lien_ref_id: noteId,
    from_user_id: likerId,
  })
}

export async function repostNote({ originalId, originalContenu, userId }) {
  const { error } = await supabase.from('notes').insert({
    user_id: userId,
    contenu: originalContenu,
    repost_of: originalId,
    expire_at: new Date(Date.now() + NOTE_LIFETIME_MS).toISOString(),
  })
  if (error) return { error }
  await supabase.from('note_reposts').insert({ note_id: originalId, user_id: userId })
  return { error: null }
}

export async function notifyNoteRepost({ originalAuthorId, reposterName, originalId, reposterId }) {
  return supabase.from('notifications').insert({
    user_id: originalAuthorId,
    type: 'note_repost',
    contenu: `${reposterName || 'Quelqu\u2019un'} a republié ta note`,
    lien_ref_id: originalId,
    from_user_id: reposterId,
  })
}

export async function deleteNote(noteId) {
  return supabase.from('notes').delete().eq('id', noteId)
}
