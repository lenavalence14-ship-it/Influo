import { Preferences } from '@capacitor/preferences'
import { supabase } from './supabase'

// Liste des comptes déjà connectés sur cet appareil, façon "changer de profil" Facebook.
// On stocke le refresh_token de chaque compte (jamais le mot de passe) pour pouvoir
// restaurer sa session en un clic, tant que ce refresh_token n'a pas expiré côté Supabase.
const STORAGE_KEY = 'influo_saved_accounts'

// Lit la liste brute stockée sur l'appareil. Toujours un tableau, jamais null.
export async function getSavedAccounts() {
  const { value } = await Preferences.get({ key: STORAGE_KEY })
  if (!value) return []
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

// À appeler juste après une connexion réussie (signIn) : ajoute ou met à jour
// l'entrée de ce compte dans la liste locale de l'appareil.
export async function saveAccount({ userId, nomComplet, email, photoUrl, refreshToken }) {
  const accounts = await getSavedAccounts()
  const filtered = accounts.filter((a) => a.userId !== userId)
  filtered.unshift({
    userId,
    nomComplet: nomComplet || email,
    email,
    photoUrl: photoUrl || null,
    refreshToken,
    savedAt: new Date().toISOString(),
  })
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(filtered) })
}

// Retire un compte de la liste locale (bouton "Supprimer" dans l'écran de gestion).
// Ne déconnecte rien côté serveur, retire seulement le raccourci de cet appareil.
export async function removeAccount(userId) {
  const accounts = await getSavedAccounts()
  const filtered = accounts.filter((a) => a.userId !== userId)
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(filtered) })
}

// Tente de restaurer la session d'un compte enregistré à partir de son refresh_token.
// Si le token a expiré ou a été révoqué, Supabase renvoie une erreur : dans ce cas
// on retire l'entrée périmée de la liste locale pour ne pas la laisser trainer.
export async function switchToAccount(userId) {
  const accounts = await getSavedAccounts()
  const account = accounts.find((a) => a.userId === userId)
  if (!account) return { error: new Error('Profil introuvable sur cet appareil') }

  const { data, error } = await supabase.auth.setSession({
    access_token: '',
    refresh_token: account.refreshToken,
  })

  if (error) {
    await removeAccount(userId)
    return { error }
  }

  // Le refresh_token tourne à chaque utilisation : on met à jour la copie stockée
  // pour que le prochain clic utilise bien le token le plus récent.
  if (data.session?.refresh_token) {
    await saveAccount({
      userId,
      nomComplet: account.nomComplet,
      email: account.email,
      photoUrl: account.photoUrl,
      refreshToken: data.session.refresh_token,
    })
  }

  return { data, error: null }
}
