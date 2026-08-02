// src/api/messages.js
//
// Couche d'abstraction pour la messagerie : conversations (toutes variantes
// _biz/_pro/_influenceur/_sociale), messages (idem), et le cycle de vie des
// commandes rattachées à une conversation (paiement demandé → payé → livré →
// validé). Le paiement/wallet lui-même vit dans src/api/wallet.js ; le post
// de collaboration créé à la validation vit dans src/api/feed.js — ce fichier
// orchestre les deux car c'est ainsi que le flux métier fonctionne réellement.
//
// Realtime : les souscriptions passent par src/api/realtime.js, pas par des
// appels supabase.channel() directs ici.

import { supabase } from '../lib/supabase'
import * as walletApi from './wallet'
import * as feedApi from './feed'
import * as authApi from './auth'

// Contacts suggérés pour le partage d'un post : abonnements + abonnés
// (follows) union utilisateurs avec qui une conversation sociale existe déjà.
export async function fetchShareContacts(userId) {
  const [{ data: following }, { data: followers }, { data: convos }] = await Promise.all([
    supabase.from('follows').select('users:followed_id(id, nom_complet, photo_url)').eq('follower_id', userId),
    supabase.from('follows').select('users:follower_id(id, nom_complet, photo_url)').eq('followed_id', userId),
    supabase
      .from('conversations_sociale')
      .select('user_a:user_a_id(id, nom_complet, photo_url), user_b:user_b_id(id, nom_complet, photo_url)')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
  ])

  const byId = new Map()
  const addContact = (u) => {
    if (u && u.id !== userId && !byId.has(u.id)) byId.set(u.id, u)
  }
  following?.forEach((f) => addContact(f.users))
  followers?.forEach((f) => addContact(f.users))
  convos?.forEach((c) => {
    addContact(c.user_a)
    addContact(c.user_b)
  })

  return Array.from(byId.values())
}

// --- Commandes "biz" (client entreprise <-> client entreprise) ---
//
// ⚠️ POINT DE FRICTION MIGRATION : ce flux entier (création, paiement,
// livraison, confirmation) est implémenté par 4 fonctions SQL côté Postgres
// (create_commande_biz, pay_commande_biz, mark_delivered_commande_biz,
// confirm_reception_commande_biz), pas en JS ici. Contrairement au flux
// influenceur<->client (payCommande/confirmCommandeReception plus haut, qui
// orchestrent la logique en JS), cette logique métier n'est PAS visible dans
// ce fichier — elle vit en base. Migrer hors Supabase implique de retrouver
// et réécrire ces 4 fonctions SQL quelque part (ce fichier étant l'endroit
// naturel où les rapatrier en JS à ce moment-là).

export async function createCommandeBiz({ conversationId, montant, delaiLivraison }) {
  return supabase.rpc('create_commande_biz', {
    p_conversation_id: conversationId,
    p_montant: montant,
    p_delai_livraison: delaiLivraison || null,
  })
}

export async function payCommandeBiz(commandeId) {
  return supabase.rpc('pay_commande_biz', { p_commande_id: commandeId })
}

export async function markDeliveredCommandeBiz(commandeId) {
  return supabase.rpc('mark_delivered_commande_biz', { p_commande_id: commandeId })
}

export async function confirmReceptionCommandeBiz(commandeId) {
  return supabase.rpc('confirm_reception_commande_biz', { p_commande_id: commandeId })
}

// --- Commandes "pro" (utilisateur_simple <-> entreprise) ---
//
// Contrairement à "biz", la création de commande se fait par un insert
// direct (pas de RPC create_commande_pro) : la logique de calcul de
// commission vit donc ici en JS, pas en base — un bon signe pour la
// migration. Le paiement et la confirmation, eux, restent des RPC.
// ⚠️ pay_commande_pro et confirm_reception_commande_pro : mêmes réserves
// que pour "biz", logique métier en base à retrouver le jour venu.

export async function createCommandePro({ conversationId, utilisateurId, clientId, montant }) {
  const commission = +(montant * 0.1).toFixed(2)
  const montantNet = +(montant - commission).toFixed(2)
  const { data } = await supabase
    .from('commandes_pro')
    .insert({
      conversation_id: conversationId,
      utilisateur_id: utilisateurId,
      client_id: clientId,
      montant,
      commission,
      montant_net: montantNet,
      status: 'paiement_demande',
    })
    .select()
    .single()
  return data
}

export async function payCommandePro(commandeId) {
  return supabase.rpc('pay_commande_pro', { p_commande_id: commandeId })
}

export async function markDeliveredCommandePro(commandeId) {
  return supabase.from('commandes_pro').update({ status: 'en_attente_validation' }).eq('id', commandeId)
}

export async function confirmReceptionCommandePro(commandeId) {
  return supabase.rpc('confirm_reception_commande_pro', { p_commande_id: commandeId })
}

// --- Variantes génériques (conversations_biz, _pro, _sociale, _influenceur) ---
//
// Ces 4 variantes partagent la même mécanique que conversations/messages
// (ci-dessous) mais sur des tables différentes, avec des colonnes de lecture
// différentes selon le "côté" (client_a/client_b, user_a/user_b, etc.).
// Plutôt que dupliquer 4 fois la même logique dans les composants Chat*.jsx,
// ces fonctions prennent le nom de table en paramètre.

export async function fetchConversationGeneric(table, conversationId, selectClause) {
  const { data } = await supabase.from(table).select(selectClause).eq('id', conversationId).maybeSingle()
  return data
}

export async function fetchMessagesGeneric(table, conversationId) {
  const { data } = await supabase
    .from(table)
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  return data || []
}

export async function markConversationReadGeneric(table, conversationId, readField) {
  return supabase.from(table).update({ [readField]: new Date().toISOString() }).eq('id', conversationId)
}

export async function touchConversationGeneric(table, conversationId) {
  return supabase.from(table).update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
}

export async function sendMessageGeneric(table, conversationTable, { conversationId, senderId, contenu, fichierUrl = null, fichierType = null, isSystem = false, sharedPostId = null }) {
  const payload = {
    conversation_id: conversationId,
    sender_id: senderId,
    contenu,
    fichier_url: fichierUrl,
    fichier_type: fichierType,
    is_system: isSystem,
  }
  // shared_post_id n'existe que sur messages_sociale : on ne l'ajoute au
  // payload que si explicitement fourni, pour ne pas faire échouer l'insert
  // sur les tables qui n'ont pas cette colonne (messages, _pro, _biz, _influenceur).
  if (sharedPostId !== null) payload.shared_post_id = sharedPostId

  const { data, error } = await supabase.from(table).insert(payload).select().single()
  if (!error) await touchConversationGeneric(conversationTable, conversationId)
  return { data, error }
}

export async function editMessageGeneric(table, messageId, newContent) {
  const { data } = await supabase
    .from(table)
    .update({ contenu: newContent, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .select()
    .single()
  return data
}

export async function deleteMessageForMeGeneric(table, message, userId) {
  const nextDeletedFor = [...(message.deleted_for || []), userId]
  const { data } = await supabase
    .from(table)
    .update({ deleted_for: nextDeletedFor })
    .eq('id', message.id)
    .select()
    .single()
  return data
}

export async function deleteMessageForEveryoneGeneric(table, messageId) {
  const { data } = await supabase
    .from(table)
    .update({ is_deleted_for_all: true, contenu: null, fichier_url: null })
    .eq('id', messageId)
    .select()
    .single()
  return data
}

export async function fetchLatestCommandeGeneric(table, conversationId) {
  const { data } = await supabase
    .from(table)
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// Charge toutes les conversations pertinentes pour l'utilisateur courant,
// tous "kinds" confondus (normal, pro, biz, sociale, influenceur), selon son
// rôle. Chaque erreur de sous-requête est loguée mais n'empêche pas les
// autres résultats de s'afficher (une requête Supabase peut échouer sans
// throw : elle renvoie { error } silencieusement).
export async function fetchAllConversations({ user, profile, influencerProfile, clientProfile }) {
  let normalQuery = supabase
    .from('conversations')
    .select(`
      id, updated_at, client_last_read_at, influenceur_last_read_at,
      client:client_id(nom_complet, photo_url),
      profils_influenceur(id, verifie, users(nom_complet, photo_url)),
      offres(titre),
      messages(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
    `)
    .order('updated_at', { ascending: false })

  if (profile?.role === 'influenceur' && influencerProfile) {
    normalQuery = normalQuery.eq('influenceur_id', influencerProfile.id)
  } else {
    normalQuery = normalQuery.eq('client_id', user.id)
  }

  let proQuery = null
  if (profile?.role === 'utilisateur_simple') {
    proQuery = supabase
      .from('conversations_pro')
      .select(`
        id, updated_at, utilisateur_last_read_at, client_last_read_at,
        client:client_id(id, users(nom_complet, photo_url)),
        messages_pro(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
      `)
      .eq('utilisateur_id', user.id)
      .order('updated_at', { ascending: false })
  } else if (profile?.role === 'client' && clientProfile?.id) {
    proQuery = supabase
      .from('conversations_pro')
      .select(`
        id, updated_at, utilisateur_last_read_at, client_last_read_at,
        utilisateur:utilisateur_id(nom_complet, photo_url),
        messages_pro(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
      `)
      .eq('client_id', clientProfile.id)
      .order('updated_at', { ascending: false })
  }

  let bizQuery = null
  if (profile?.role === 'client' && clientProfile?.id) {
    bizQuery = supabase
      .from('conversations_biz')
      .select(`
        id, updated_at, client_a_id, client_b_id, client_a_last_read_at, client_b_last_read_at,
        client_a:client_a_id(id, users(nom_complet, photo_url)),
        client_b:client_b_id(id, users(nom_complet, photo_url)),
        messages_biz(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
      `)
      .or(`client_a_id.eq.${clientProfile.id},client_b_id.eq.${clientProfile.id}`)
      .order('updated_at', { ascending: false })
  }

  let socialeQuery = null
  if (profile?.role === 'utilisateur_simple') {
    socialeQuery = supabase
      .from('conversations_sociale')
      .select(`
        id, updated_at, user_a_id, user_b_id, user_a_last_read_at, user_b_last_read_at,
        user_a:user_a_id(id, nom_complet, photo_url),
        user_b:user_b_id(id, nom_complet, photo_url),
        messages_sociale(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all, shared_post_id)
      `)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })
  }

  let influenceurQuery = null
  if (profile?.role === 'influenceur') {
    influenceurQuery = supabase
      .from('conversations_influenceur')
      .select(`
        id, updated_at, user_a_id, user_b_id, user_a_last_read_at, user_b_last_read_at,
        user_a:user_a_id(id, nom_complet, photo_url),
        user_b:user_b_id(id, nom_complet, photo_url),
        messages_influenceur(id, contenu, created_at, is_system, sender_id, deleted_for, is_deleted_for_all)
      `)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })
  }

  const [normalResult, proResult, bizResult, socialeResult, influenceurResult] = await Promise.all([
    normalQuery,
    proQuery || Promise.resolve({ data: [] }),
    bizQuery || Promise.resolve({ data: [] }),
    socialeQuery || Promise.resolve({ data: [] }),
    influenceurQuery || Promise.resolve({ data: [] }),
  ])

  for (const r of [normalResult, proResult, bizResult, socialeResult, influenceurResult]) {
    if (r?.error) console.error('Erreur chargement conversations :', r.error)
  }

  return [
    ...(normalResult?.data || []).map((c) => ({ ...c, kind: 'normal' })),
    ...(proResult?.data || []).map((c) => ({ ...c, kind: 'pro' })),
    ...(bizResult?.data || []).map((c) => ({ ...c, kind: 'biz' })),
    ...(socialeResult?.data || []).map((c) => ({ ...c, kind: 'sociale' })),
    ...(influenceurResult?.data || []).map((c) => ({ ...c, kind: 'influenceur' })),
  ].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
}

// --- Démarrage de conversation ---

export async function fetchOffreWithInfluencer(offreId) {
  const { data } = await supabase
    .from('offres')
    .select('*, profils_influenceur(id, verifie, users(nom_complet))')
    .eq('id', offreId)
    .maybeSingle()
  return data
}

export async function fetchInfluencerBasic(influenceurId) {
  const { data } = await supabase
    .from('profils_influenceur')
    .select('id, verifie, users(nom_complet)')
    .eq('id', influenceurId)
    .maybeSingle()
  return data
}

// Trouve ou crée la conversation (variante par défaut) client <-> influenceur,
// puis y envoie le premier message.
export async function findOrCreateConversation({ userId, influenceurId, offreId, firstMessage }) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('client_id', userId)
    .eq('influenceur_id', influenceurId)
    .maybeSingle()

  let conversationId = existing?.id

  if (!conversationId) {
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ client_id: userId, influenceur_id: influenceurId, offre_id: offreId || null })
      .select('id')
      .single()
    if (error) return { error }
    conversationId = conv.id
  }

  await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, contenu: firstMessage })
  return { conversationId }
}

// Trouve ou crée une conversation symétrique (biz/sociale/influenceur), où
// n'importe lequel des deux comptes peut être "a" ou "b". Ne crée aucun
// premier message : ces variantes redirigent directement vers le chat vide.
export async function findOrCreateSymmetricConversation({ table, sideAField, sideBField, myId, otherId, insertFields }) {
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .or(`and(${sideAField}.eq.${myId},${sideBField}.eq.${otherId}),and(${sideAField}.eq.${otherId},${sideBField}.eq.${myId})`)
    .maybeSingle()

  if (existing) return { conversationId: existing.id, created: false }

  const { data: created, error } = await supabase.from(table).insert(insertFields).select().single()
  if (error || !created) return { error }
  return { conversationId: created.id, created: true }
}

// Trouve ou crée une conversation "pro" (asymétrique : utilisateur_simple <-> entreprise).
export async function findOrCreateConversationPro({ userId, clientId }) {
  const { data: existing } = await supabase
    .from('conversations_pro')
    .select('id')
    .eq('utilisateur_id', userId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (existing) return { conversationId: existing.id, created: false }

  const { data: created, error } = await supabase
    .from('conversations_pro')
    .insert({ utilisateur_id: userId, client_id: clientId })
    .select()
    .single()
  if (error || !created) return { error }
  return { conversationId: created.id, created: true }
}

// --- Réponse à une note (le viewer permet de répondre à n'importe quel
// couple de rôles compatibles, chacun avec sa propre table de conversation) ---
//
// Résout (ou crée) la conversation appropriée entre "moi" et l'auteur de la
// note, quel que soit le couple de rôles. Retourne { table, messagesTable,
// conversationId } ou { error } si un profil intermédiaire est introuvable.
export async function resolveReplyToNoteConversation({ myRole, theirRole, myUserId, otherUserId }) {
  if (myRole === theirRole) {
    let table, messagesTable, aField, bField, myId, otherId

    if (myRole === 'influenceur') {
      table = 'conversations_influenceur'
      messagesTable = 'messages_influenceur'
      aField = 'user_a_id'
      bField = 'user_b_id'
      myId = myUserId
      otherId = otherUserId
    } else if (myRole === 'client') {
      table = 'conversations_biz'
      messagesTable = 'messages_biz'
      aField = 'client_a_id'
      bField = 'client_b_id'
      const [mine, theirs] = await Promise.all([
        authApi.fetchClientProfileIdByUserId(myUserId),
        authApi.fetchClientProfileIdByUserId(otherUserId),
      ])
      if (!mine || !theirs) return { error: true }
      myId = mine.id
      otherId = theirs.id
    } else {
      table = 'conversations_sociale'
      messagesTable = 'messages_sociale'
      aField = 'user_a_id'
      bField = 'user_b_id'
      myId = myUserId
      otherId = otherUserId
    }

    const { conversationId, error } = await findOrCreateSymmetricConversation({
      table,
      sideAField: aField,
      sideBField: bField,
      myId,
      otherId,
      insertFields: { [aField]: myId, [bField]: otherId },
    })
    if (error) return { error }
    return { table, messagesTable, conversationId }
  }

  if (myRole === 'client' && theirRole === 'influenceur') {
    const theirInfluenceurProfile = await authApi.fetchInfluencerProfile(otherUserId)
    if (!theirInfluenceurProfile) return { error: true }
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', myUserId)
      .eq('influenceur_id', theirInfluenceurProfile.id)
      .maybeSingle()
    let conversationId = existing?.id
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ client_id: myUserId, influenceur_id: theirInfluenceurProfile.id })
        .select()
        .single()
      if (error || !created) return { error: true }
      conversationId = created.id
    }
    return { table: 'conversations', messagesTable: 'messages', conversationId }
  }

  if (myRole === 'influenceur' && theirRole === 'client') {
    const myInfluenceurProfile = await authApi.fetchInfluencerProfile(myUserId)
    if (!myInfluenceurProfile) return { error: true }
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', otherUserId)
      .eq('influenceur_id', myInfluenceurProfile.id)
      .maybeSingle()
    let conversationId = existing?.id
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ client_id: otherUserId, influenceur_id: myInfluenceurProfile.id })
        .select()
        .single()
      if (error || !created) return { error: true }
      conversationId = created.id
    }
    return { table: 'conversations', messagesTable: 'messages', conversationId }
  }

  if (myRole === 'client' && theirRole === 'utilisateur_simple') {
    const myClientProfile = await authApi.fetchClientProfileIdByUserId(myUserId)
    if (!myClientProfile) return { error: true }
    const { conversationId, error } = await findOrCreateConversationPro({
      userId: otherUserId,
      clientId: myClientProfile.id,
    })
    if (error) return { error }
    return { table: 'conversations_pro', messagesTable: 'messages_pro', conversationId }
  }

  if (myRole === 'utilisateur_simple' && theirRole === 'client') {
    const theirClientProfile = await authApi.fetchClientProfileIdByUserId(otherUserId)
    if (!theirClientProfile) return { error: true }
    const { conversationId, error } = await findOrCreateConversationPro({
      userId: myUserId,
      clientId: theirClientProfile.id,
    })
    if (error) return { error }
    return { table: 'conversations_pro', messagesTable: 'messages_pro', conversationId }
  }

  return { error: true }
}

export async function sendNoteReply({ messagesTable, table, conversationId, senderId, contenu, replyToNoteId, replyToNoteContenu }) {
  await supabase.from(messagesTable).insert({
    conversation_id: conversationId,
    sender_id: senderId,
    contenu,
    is_system: false,
    reply_to_note_id: replyToNoteId,
    reply_to_note_contenu: replyToNoteContenu,
  })
  await touchConversationGeneric(table, conversationId)
}

// --- Conversations (variante par défaut : influenceur <-> client) ---

export async function fetchConversation(conversationId) {
  const { data } = await supabase
    .from('conversations')
    .select('*, client:client_id(nom_complet, photo_url), profils_influenceur(id, verifie, user_id, users(nom_complet, photo_url)), offres(*)')
    .eq('id', conversationId)
    .maybeSingle()
  return data
}

export async function markConversationRead(conversationId, readField) {
  return supabase
    .from('conversations')
    .update({ [readField]: new Date().toISOString() })
    .eq('id', conversationId)
}

export async function touchConversation(conversationId) {
  return supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
}

// --- Messages ---

export async function fetchMessages(conversationId) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  return data || []
}

export async function sendMessage({ conversationId, senderId, contenu, fichierUrl = null, fichierType = null }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      contenu,
      fichier_url: fichierUrl,
      fichier_type: fichierType,
      is_system: false,
    })
    .select()
    .single()
  if (!error) await touchConversation(conversationId)
  return { data, error }
}

export async function sendSystemMessage({ conversationId, contenu, fichierUrl = null }) {
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: null,
    contenu,
    fichier_url: fichierUrl,
    is_system: true,
  })
  await touchConversation(conversationId)
}

export async function editMessage(messageId, newContent) {
  const { data } = await supabase
    .from('messages')
    .update({ contenu: newContent, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .select()
    .single()
  return data
}

export async function deleteMessageForMe(message, userId) {
  const nextDeletedFor = [...(message.deleted_for || []), userId]
  const { data } = await supabase
    .from('messages')
    .update({ deleted_for: nextDeletedFor })
    .eq('id', message.id)
    .select()
    .single()
  return data
}

export async function deleteMessageForEveryone(messageId) {
  const { data } = await supabase
    .from('messages')
    .update({ is_deleted_for_all: true, contenu: null, fichier_url: null })
    .eq('id', messageId)
    .select()
    .single()
  return data
}

// --- Commandes rattachées à une conversation ---

export async function fetchLatestCommande(conversationId) {
  const { data } = await supabase
    .from('commandes')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function requestPayment({ conversationId, clientId, influenceurId, offreId, montant }) {
  const commission = +(montant * 0.1).toFixed(2)
  const montantNet = +(montant - commission).toFixed(2)

  const { data } = await supabase
    .from('commandes')
    .insert({
      conversation_id: conversationId,
      client_id: clientId,
      influenceur_id: influenceurId,
      offre_id: offreId,
      montant,
      commission,
      montant_net: montantNet,
      status: 'paiement_demande',
    })
    .select()
    .single()
  return data
}

// Paye une commande : crée le paiement, met à jour son statut, verrouille les
// fonds sur le wallet de l'influenceur.
export async function payCommande(commande) {
  const paiement = await walletApi.createPaiement({
    commandeId: commande.id,
    montant: commande.montant,
    commission: commande.commission,
  })
  await supabase.from('commandes').update({ status: 'paiement_effectue' }).eq('id', commande.id)
  await walletApi.lockFundsForCommande(commande)
  return paiement
}

export async function markCommandeDelivered({ commandeId, fields }) {
  return supabase.from('commandes').update({ status: 'en_attente_validation', ...fields }).eq('id', commandeId)
}

export async function linkPostToCommande(commandeId, postId) {
  return supabase.from('commandes').update({ post_id: postId }).eq('id', commandeId)
}

// Valide la réception d'une commande : marque "terminee", crée le post de
// collaboration vérifiée dans le feed, déverrouille les fonds.
export async function confirmCommandeReception(commande, conversation) {
  await supabase.from('commandes').update({ status: 'terminee' }).eq('id', commande.id)

  if (commande.media_livraison_url) {
    const newPost = await feedApi.createCollabPost({
      influenceurId: commande.influenceur_id,
      mediaType: commande.media_type,
      cropFormat: commande.media_crop_format,
      commandeId: commande.id,
      clientId: commande.client_id,
    })

    if (newPost) {
      await feedApi.addPostMedia({
        postId: newPost.id,
        mediaUrl: commande.media_livraison_url,
        mediaType: commande.media_type,
        thumbnailUrl: commande.media_thumbnail_url,
      })
      await linkPostToCommande(commande.id, newPost.id)

      const influenceurUserId = conversation?.profils_influenceur?.user_id
      const auteurs = [
        influenceurUserId ? { post_id: newPost.id, user_id: influenceurUserId, role: 'influenceur' } : null,
        commande.client_id ? { post_id: newPost.id, user_id: commande.client_id, role: 'entreprise' } : null,
      ].filter(Boolean)
      await feedApi.addPostAuteurs(auteurs)
    }
  }

  await walletApi.unlockFundsForCommande(commande)
}
