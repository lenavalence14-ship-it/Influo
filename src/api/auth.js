// src/api/auth.js
//
// Couche d'abstraction pour tout ce qui touche l'authentification et les
// profils utilisateur (users, profils_influenceur, profils_client).
//
// Règle : ce fichier est le SEUL endroit du projet qui doit appeler
// supabase.auth.* ou supabase.from('users'|'profils_influenceur'|'profils_client').
// Tout le reste de l'app (composants, contexts, hooks) passe par les
// fonctions exportées ici.
//
// Le jour d'une migration de backend : on ne réécrit QUE ce fichier.
// AuthContext.jsx et tous les composants ne bougent pas.

import { supabase } from '../lib/supabase'

// --- Session ---

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback) {
  // Retourne une fonction unsubscribe unifiée, indépendante de la forme
  // exacte du listener Supabase.
  const { data: listener } = supabase.auth.onAuthStateChange(callback)
  return () => listener.subscription.unsubscribe()
}

// Forme de retour neutre, indépendante du SDK Supabase : { user, session, error }.
// Aucun appelant ne doit dépendre de data.user / data.session à la Supabase.

export async function signUp({ email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  return { user: data?.user ?? null, session: data?.session ?? null, error }
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { user: data?.user ?? null, session: data?.session ?? null, error }
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function resetPasswordForEmail(email) {
  return supabase.auth.resetPasswordForEmail(email)
}

// --- Profils métier ---

export async function fetchUserRow(userId) {
  const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  return data
}

export async function fetchInfluencerProfile(userId) {
  const { data } = await supabase
    .from('profils_influenceur')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function fetchClientProfile(userId) {
  const { data } = await supabase
    .from('profils_client')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

// Charge les 3 lignes de profil en parallèle (comportement identique à
// l'original : un seul aller-retour réseau plutôt que 3 séquentiels).
export async function loadFullProfile(userId) {
  const [userRow, infRow, cliRow] = await Promise.all([
    fetchUserRow(userId),
    fetchInfluencerProfile(userId),
    fetchClientProfile(userId),
  ])
  return { userRow, infRow, cliRow }
}

export async function createUserRow({ id, role, email, nomComplet }) {
  const { error } = await supabase.from('users').insert({
    id,
    role,
    email,
    nom_complet: nomComplet,
  })
  return { error }
}

export async function createInfluencerProfile(userId) {
  return supabase.from('profils_influenceur').insert({ user_id: userId })
}

export async function createClientProfile(userId) {
  return supabase.from('profils_client').insert({ user_id: userId })
}

// Utilisé par le TOKEN_REFRESHED / SIGNED_IN listener pour resynchroniser
// le sélecteur de comptes locaux (accountSwitcher).
export async function fetchClientProfileIdByUserId(userId) {
  const { data } = await supabase.from('profils_client').select('id').eq('user_id', userId).maybeSingle()
  return data
}

export async function refreshSession(refreshToken) {
  return supabase.auth.refreshSession({ refresh_token: refreshToken })
}

export async function fetchUserDisplayInfo(userId) {
  const { data } = await supabase
    .from('users')
    .select('nom_complet, photo_url')
    .eq('id', userId)
    .maybeSingle()
  return data
}
