import { Preferences } from '@capacitor/preferences'
import * as authApi from '../api/auth'

// Liste des comptes déjà connectés sur cet appareil, façon "changer de profil" Facebook.
// On stocke le refresh_token de chaque compte (jamais le mot de passe) pour pouvoir
// restaurer sa session en un clic, tant que ce refresh_token n'a pas expiré côté Supabase.
const STORAGE_KEY = 'influo_saved_accounts'

// PROBLÈME CORRIGÉ ICI : deux écrivains indépendants pouvaient modifier le refresh_token
// stocké d'un même compte EN MÊME TEMPS -- (1) le listener global onAuthStateChange de
// AuthContext.jsx, qui réagit à CHAQUE TOKEN_REFRESHED (y compris ceux déclenchés par un
// switchToAccount en cours), et (2) switchToAccount lui-même, qui écrit le nouveau token
// juste après avoir appelé refreshSession. Sans coordination, le dernier des deux à finir
// d'écrire "gagne" -- si c'est celui qui tenait une valeur périmée (capturée avant que
// l'autre ait fini), le storage se retrouve avec un refresh_token déjà consommé, que
// Supabase rejette ensuite avec "Refresh Token Not Found" au prochain essai.
//
// Le verrou ci-dessous sérialise, PAR userId, tout accès qui lit-puis-écrit ce storage
// (saveAccount, switchToAccount) : un appel concurrent sur le même compte attend que le
// précédent ait fini avant de lire l'état courant, au lieu de lire une valeur bientôt
// écrasée par l'autre.
const locksByUserId = new Map()

async function withAccountLock(userId, fn) {
  const previous = locksByUserId.get(userId) || Promise.resolve()
  let release
  const current = new Promise((resolve) => { release = resolve })
  locksByUserId.set(userId, previous.then(() => current))
  await previous
  try {
    return await fn()
  } finally {
    release()
    if (locksByUserId.get(userId) === current) locksByUserId.delete(userId)
  }
}

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
// Protégé par withAccountLock : voir le commentaire en haut de fichier -- sans ce
// verrou, un appel concurrent (ex: le listener TOKEN_REFRESHED pendant un switch)
// peut lire la liste AVANT l'écriture d'un autre appel, puis écraser son résultat.
export async function saveAccount({ userId, nomComplet, email, photoUrl, refreshToken }) {
  return withAccountLock(userId, async () => {
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
  })
}

// Retire un compte de la liste locale (bouton "Supprimer" dans l'écran de gestion).
// Ne déconnecte rien côté serveur, retire seulement le raccourci de cet appareil.
export async function removeAccount(userId) {
  return withAccountLock(userId, async () => {
    const accounts = await getSavedAccounts()
    const filtered = accounts.filter((a) => a.userId !== userId)
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(filtered) })
  })
}

// Tente de restaurer la session d'un compte enregistré à partir de son refresh_token.
// On ne retire l'entrée locale que si Supabase confirme que le token est invalide ou révoqué
// (ex: mot de passe changé, déconnexion globale). Une simple coupure réseau ou une erreur
// temporaire ne doit jamais faire disparaître le profil : sinon le bouton "Supprimer" dans
// Gérer les profils devient le seul moyen de perdre un profil, ce qui est le but recherché.
const INVALID_TOKEN_MESSAGES = [
  'invalid refresh token',
  'refresh token not found',
  'refresh token already used',
  'session not found',
  'user not found',
]

function isTokenDefinitivelyInvalid(error) {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  const textMatch = INVALID_TOKEN_MESSAGES.some((needle) => msg.includes(needle))
  // Supabase répond en 400/401 pour un refresh token mort ou révoqué, quel que soit le
  // libellé exact du message (qui peut varier selon la version de gotrue). On se base
  // aussi sur le code, pour ne pas dépendre uniquement d'un texte qui peut changer.
  const statusMatch = error.status === 400 || error.status === 401
  return textMatch || statusMatch
}

export async function switchToAccount(userId) {
  return withAccountLock(userId, async () => {
    const accounts = await getSavedAccounts()
    const account = accounts.find((a) => a.userId === userId)
    if (!account) return { error: new Error('Profil introuvable sur cet appareil') }

    // IMPORTANT : setSession({ access_token: '', refresh_token }) casse avec "Auth session
    // missing!" car un access_token vide n'est pas traité comme absent par le SDK. La méthode
    // correcte pour restaurer une session à partir d'un refresh_token seul est refreshSession.
    const { data, error } = await authApi.refreshSession(account.refreshToken)

    if (error) {
      // Uniquement si Supabase dit explicitement que le token est mort : on nettoie.
      // Toute autre erreur (réseau, timeout, serveur temporairement indisponible) laisse
      // le profil intact pour un nouvel essai.
      if (isTokenDefinitivelyInvalid(error)) {
        // Écriture directe (sans reprendre withAccountLock : on est déjà dans le verrou
        // de ce userId, un second withAccountLock imbriqué bloquerait indéfiniment).
        const current = await getSavedAccounts()
        await Preferences.set({
          key: STORAGE_KEY,
          value: JSON.stringify(current.filter((a) => a.userId !== userId)),
        })
      }
      return { error }
    }

    // Le refresh_token tourne à chaque utilisation : on met à jour la copie stockée
    // pour que le prochain clic utilise bien le token le plus récent. Écriture directe
    // (déjà dans le verrou de ce userId) plutôt qu'un saveAccount qui reprendrait le
    // verrou et bloquerait.
    if (data.session?.refresh_token) {
      const current = await getSavedAccounts()
      const filtered = current.filter((a) => a.userId !== userId)
      filtered.unshift({
        userId,
        nomComplet: account.nomComplet,
        email: account.email,
        photoUrl: account.photoUrl,
        refreshToken: data.session.refresh_token,
        savedAt: new Date().toISOString(),
      })
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(filtered) })
    }

    return { data, error: null }
  })
}