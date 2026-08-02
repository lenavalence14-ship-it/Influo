// src/api/wallet.js
//
// Couche d'abstraction pour tout ce qui touche l'argent : wallets,
// wallet_transactions, paiements, moyens_paiement, retraits.
//
// Règle : seul ce fichier doit appeler supabase.from('wallets'|'wallet_transactions'
// |'paiements'|'moyens_paiement'|'retraits').

import { supabase } from '../lib/supabase'

export async function fetchWallet(influenceurId) {
  const { data } = await supabase
    .from('wallets')
    .select('*')
    .eq('influenceur_id', influenceurId)
    .maybeSingle()
  return data
}

export async function updateWallet(walletId, fields) {
  return supabase.from('wallets').update(fields).eq('id', walletId)
}

export async function recordWalletTransaction({ walletId, commandeId, type, montant }) {
  return supabase.from('wallet_transactions').insert({
    wallet_id: walletId,
    commande_id: commandeId,
    type,
    montant,
  })
}

// Verrouille les fonds d'une commande payée sur le wallet de l'influenceur.
export async function lockFundsForCommande(commande) {
  const wallet = await fetchWallet(commande.influenceur_id)
  if (!wallet) return null

  await updateWallet(wallet.id, {
    solde_verrouille: +(wallet.solde_verrouille + commande.montant_net).toFixed(2),
    revenus_totaux: +(wallet.revenus_totaux + commande.montant_net).toFixed(2),
  })
  await recordWalletTransaction({
    walletId: wallet.id,
    commandeId: commande.id,
    type: 'paiement_verrouille',
    montant: commande.montant_net,
  })
  return wallet
}

// Déverrouille les fonds d'une commande validée (fonds disponibles pour l'influenceur).
export async function unlockFundsForCommande(commande) {
  const wallet = await fetchWallet(commande.influenceur_id)
  if (!wallet) return null

  await updateWallet(wallet.id, {
    solde_verrouille: +(wallet.solde_verrouille - commande.montant_net).toFixed(2),
    solde_disponible: +(wallet.solde_disponible + commande.montant_net).toFixed(2),
  })
  await recordWalletTransaction({
    walletId: wallet.id,
    commandeId: commande.id,
    type: 'deverrouillage',
    montant: commande.montant_net,
  })
  return wallet
}

export async function createPaiement({ commandeId, montant, commission }) {
  const { data } = await supabase
    .from('paiements')
    .insert({
      commande_id: commandeId,
      montant,
      commission,
      provider_simule: 'mock',
      reussi: true,
    })
    .select()
    .single()
  return data
}

export async function fetchMoyensPaiement(influenceurId) {
  const { data } = await supabase.from('moyens_paiement').select('*').eq('influenceur_id', influenceurId)
  return data || []
}

export async function addMoyenPaiement({ influenceurId, provider, numero }) {
  return supabase.from('moyens_paiement').insert({ influenceur_id: influenceurId, provider, numero })
}

export async function fetchWalletTransactions(walletId, limit = 20) {
  const { data } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

export async function fetchRetraits(influenceurId) {
  const { data } = await supabase
    .from('retraits')
    .select('*')
    .eq('influenceur_id', influenceurId)
    .order('created_at', { ascending: false })
  return data || []
}

// Crée une demande de retrait et débite immédiatement le solde disponible
// (le solde reflète "engagé", pas encore "réellement transféré" -- le
// virement lui-même est traité par un process séparé selon `status`).
export async function createRetrait(fields) {
  return supabase.from('retraits').insert(fields)
}

export async function withdrawFunds({ influenceurId, walletId, moyenPaiementId, montant, soldeDisponibleActuel }) {
  await createRetrait({
    influenceur_id: influenceurId,
    moyen_paiement_id: moyenPaiementId,
    montant,
    status: 'en_attente',
  })
  await updateWallet(walletId, {
    solde_disponible: +(soldeDisponibleActuel - montant).toFixed(2),
  })
}
