// src/api/dashboard.js
//
// Couche d'abstraction pour les écrans de dashboard (statistiques agrégées).

import { supabase } from '../lib/supabase'

export async function fetchClientDashboard(userId) {
  const { count: nbConv } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', userId)
  const { data: cmds } = await supabase.from('commandes').select('*').eq('client_id', userId).order('created_at', { ascending: false })

  let paiements = []
  if (cmds?.length) {
    const { data: pmts } = await supabase.from('paiements').select('*').in('commande_id', cmds.map((c) => c.id))
    paiements = pmts || []
  }

  return {
    conversations: nbConv || 0,
    commandes: cmds || [],
    paiements,
  }
}

// --- Dashboard admin ---

export async function fetchAdminStats() {
  const { count: nbUsers } = await supabase.from('users').select('*', { count: 'exact', head: true })
  const { count: nbInfluenceurs } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'influenceur')
  const { count: nbClients } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client')
  const { data: paiementsData } = await supabase.from('paiements').select('montant, commission')
  const { data: retraitsData } = await supabase.from('retraits').select('montant').eq('status', 'traite')

  const chiffreAffaires = paiementsData?.reduce((s, p) => s + Number(p.montant), 0) || 0
  const commissions = paiementsData?.reduce((s, p) => s + Number(p.commission), 0) || 0
  const totalRetraits = retraitsData?.reduce((s, r) => s + Number(r.montant), 0) || 0

  return {
    nbUsers: nbUsers || 0,
    nbInfluenceurs: nbInfluenceurs || 0,
    nbClients: nbClients || 0,
    nbPaiements: paiementsData?.length || 0,
    chiffreAffaires,
    commissions,
    totalRetraits,
  }
}

export async function fetchAdminUsers() {
  const { data } = await supabase
    .from('users')
    .select('*, profils_influenceur(id, verifie)')
    .order('created_at', { ascending: false })
  return data || []
}

export async function fetchAdminOffres() {
  const { data } = await supabase.from('offres').select('*, profils_influenceur(users(nom_complet))').order('created_at', { ascending: false })
  return data || []
}

export async function fetchAdminPaiements() {
  const { data } = await supabase.from('paiements').select('*').order('created_at', { ascending: false })
  return data || []
}

export async function fetchAdminRetraits() {
  const { data } = await supabase.from('retraits').select('*, profils_influenceur(users(nom_complet))').order('created_at', { ascending: false })
  return data || []
}

export async function updateRetraitStatus(retraitId, status) {
  return supabase.from('retraits').update({ status }).eq('id', retraitId)
}

export async function toggleInfluencerVerified(profilId, nextValue) {
  return supabase.from('profils_influenceur').update({ verifie: nextValue }).eq('id', profilId)
}

export async function fetchInfluencerDashboard(influenceurId) {
  const [{ data: wallet }, { count: nbCommandes }, { count: nbConversations }, { count: nbOffres }] = await Promise.all([
    supabase.from('wallets').select('*').eq('influenceur_id', influenceurId).maybeSingle(),
    supabase.from('commandes').select('*', { count: 'exact', head: true }).eq('influenceur_id', influenceurId),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('influenceur_id', influenceurId),
    supabase.from('offres').select('*', { count: 'exact', head: true }).eq('influenceur_id', influenceurId),
  ])

  return {
    revenusTotaux: wallet?.revenus_totaux || 0,
    revenusDisponibles: wallet?.solde_disponible || 0,
    revenusVerrouilles: wallet?.solde_verrouille || 0,
    nbCommandes: nbCommandes || 0,
    nbConversations: nbConversations || 0,
    nbOffres: nbOffres || 0,
  }
}
