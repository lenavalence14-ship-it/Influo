// src/api/offres.js
//
// Couche d'abstraction pour les offres de service publiées par les
// influenceurs (table offres) et les appels d'offre publiés par les clients
// (table appels_offre). Les commandes qui en découlent sont dans
// src/api/messages.js (elles sont rattachées à une conversation).

import { supabase } from '../lib/supabase'
import * as storageApi from './storage'

export async function fetchOffre(offreId) {
  const { data } = await supabase.from('offres').select('*').eq('id', offreId).maybeSingle()
  return data
}

export async function fetchOffresByInfluencer(influenceurId) {
  const { data } = await supabase
    .from('offres')
    .select('*')
    .eq('influenceur_id', influenceurId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function createOffre({ influenceurId, titre, description, prix, plateforme, delaiJours, photoFile, existingPhotoUrl }) {
  let photoUrl = existingPhotoUrl || null
  if (photoFile) {
    const fileName = `${influenceurId}/${Date.now()}-${photoFile.name}`
    const { error: uploadError } = await storageApi.uploadFile('offres', fileName, photoFile)
    if (uploadError) return { error: uploadError }
    photoUrl = storageApi.getPublicUrl('offres', fileName)
  }

  const payload = {
    titre,
    description,
    prix: parseFloat(prix),
    plateforme,
    delai_jours: parseInt(delaiJours, 10),
    photo_url: photoUrl,
  }

  return supabase.from('offres').insert({ ...payload, influenceur_id: influenceurId, actif: true })
}

export async function updateOffre({ offreId, influenceurId, titre, description, prix, plateforme, delaiJours, photoFile, existingPhotoUrl }) {
  let photoUrl = existingPhotoUrl || null
  if (photoFile) {
    const fileName = `${influenceurId}/${Date.now()}-${photoFile.name}`
    const { error: uploadError } = await storageApi.uploadFile('offres', fileName, photoFile)
    if (uploadError) return { error: uploadError }
    photoUrl = storageApi.getPublicUrl('offres', fileName)
  }

  const payload = {
    titre,
    description,
    prix: parseFloat(prix),
    plateforme,
    delai_jours: parseInt(delaiJours, 10),
    photo_url: photoUrl,
  }

  return supabase.from('offres').update(payload).eq('id', offreId)
}

export async function deleteOffre(offreId) {
  return supabase.from('offres').delete().eq('id', offreId)
}

// --- Appels d'offre (publiés par un client, apparaissent dans le feed) ---

export async function fetchAppelOffre(appelOffreId) {
  const { data, error } = await supabase
    .from('appels_offre')
    .select('id, contenu, couleur, client_id')
    .eq('id', appelOffreId)
    .single()
  return { data, error }
}

export async function updateAppelOffre(appelOffreId, { contenu, couleur }) {
  return supabase.from('appels_offre').update({ contenu, couleur }).eq('id', appelOffreId)
}

export async function createAppelOffre({ clientId, contenu, couleur }) {
  return supabase.from('appels_offre').insert({ client_id: clientId, contenu, couleur })
}

export async function fetchAppelsOffreByClient(clientId) {
  const { data } = await supabase
    .from('appels_offre')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function deleteAppelOffre(appelOffreId) {
  return supabase.from('appels_offre').delete().eq('id', appelOffreId)
}
