import { createContext, useContext, useEffect, useState } from 'react'
import * as authApi from '../api/auth'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { saveAccount } from '../lib/accountSwitcher'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // ligne public.users
  const [influencerProfile, setInfluencerProfile] = useState(null) // ligne profils_influenceur si role=influenceur
  const [clientProfile, setClientProfile] = useState(null) // ligne profils_client si role=client
  // `loading` ne concerne plus que la session (lecture locale, quasi
  // instantanée grâce à persistSession:true côté client Supabase). Avant, ce
  // même flag restait à true jusqu'à la fin de loadProfile (2-3 requêtes
  // réseau), donc ProtectedRoute affichait un écran blanc plein écran à
  // chaque ouverture d'app le temps que le profil arrive -- alors que la
  // session, elle, était déjà connue depuis longtemps.
  const [loading, setLoading] = useState(true)
  // `profileLoading` couvre uniquement le chargement du profil métier
  // (users/profils_influenceur/profils_client). Les écrans peuvent choisir
  // de l'ignorer (afficher l'UI avec un profil vide puis se remplir) plutôt
  // que de bloquer dessus comme avant.
  const [profileLoading, setProfileLoading] = useState(true)

  // "utilisateur_simple" = compte grand public, sans bio/ville/collab vérifiée.
  // Il n'a pas de table dédiée en base : ce booléen dérivé du rôle suffit à piloter
  // l'UI (EditProfile, MyProfileRouter, Search) sans complexifier le schéma pour
  // un rôle qui n'a besoin d'aucune donnée métier supplémentaire.
  const isUtilisateurSimple = profile?.role === 'utilisateur_simple'

  usePushNotifications(session?.user?.id)

  const loadProfile = async (userId) => {
    // Avant : on attendait la ligne "users" pour connaître le rôle, PUIS on
    // lançait la requête profils_influenceur/profils_client -- deux
    // aller-retours réseau en série. On ne connaît pas le rôle à l'avance,
    // mais rien n'empêche de lancer les deux requêtes de rôle en parallèle
    // avec celle de "users" : une seule des deux renverra une ligne, l'autre
    // renverra simplement null (elle est filtrée sur user_id, donc gratuite
    // en cas de mauvais rôle). Ça remplace 2 aller-retours séquentiels par 1
    // seul aller-retour (les 3 requêtes en vol en même temps).
    const { userRow, infRow, cliRow } = await authApi.loadFullProfile(userId)

    setProfile(userRow || null)

    if (userRow?.role === 'influenceur') {
      setInfluencerProfile(infRow || null)
      setClientProfile(null)
    } else if (userRow?.role === 'client') {
      setClientProfile(cliRow || null)
      setInfluencerProfile(null)
    } else {
      setInfluencerProfile(null)
      setClientProfile(null)
    }

    return userRow
  }

  useEffect(() => {
    authApi.getSession().then((session) => {
      setSession(session)
      // `loading` tombe ici, dès que la session est connue -- ProtectedRoute
      // peut déjà décider "connecté ou pas" et afficher l'app. Le profil se
      // charge en parallèle, sans bloquer ce premier rendu.
      setLoading(false)
      if (session?.user) {
        setProfileLoading(true)
        loadProfile(session.user.id).finally(() => setProfileLoading(false))
      } else {
        setProfileLoading(false)
      }
    })

    // Le token stocké dans "profils enregistrés sur cet appareil" (accountSwitcher) doit être
    // tenu à jour à chaque fois que Supabase le rafraîchit automatiquement en arrière-plan
    // (autoRefreshToken: true). Sans ça, ce token devient obsolète dès le premier rafraîchissement,
    // et le sélecteur de profils échoue en pensant que la session est morte alors qu'elle est
    // juste désynchronisée de son côté.
    const unsubscribe = authApi.onAuthStateChange((event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id)
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          authApi.fetchUserDisplayInfo(session.user.id).then((userRow) => {
            saveAccount({
              userId: session.user.id,
              nomComplet: userRow?.nom_complet || session.user.email,
              email: session.user.email,
              photoUrl: userRow?.photo_url || null,
              refreshToken: session.refresh_token,
            })
          })
        }
      } else {
        setProfile(null)
        setInfluencerProfile(null)
        setClientProfile(null)
      }
    })

    return unsubscribe
  }, [])

  const signUp = async ({ email, password, nomComplet, role }) => {
    const { user, error } = await authApi.signUp({ email, password })
    if (error) return { error }

    if (user) {
      const { error: insertError } = await authApi.createUserRow({
        id: user.id,
        role,
        email,
        nomComplet,
      })
      if (insertError) return { error: insertError }

      if (role === 'influenceur') {
        await authApi.createInfluencerProfile(user.id)
        // le wallet est créé par un trigger côté DB idéalement ; sinon on le crée ici en secours
      } else if (role === 'client') {
        await authApi.createClientProfile(user.id)
      }
      // 'utilisateur_simple' n'a pas de table de profil dédiée : rien à insérer de plus,
      // la ligne dans public.users (nom_complet, photo_url) lui suffit.
      await loadProfile(user.id)
    }
    return { user, error: null }
  }

  const signIn = async ({ email, password }) => {
    const { user, session, error } = await authApi.signIn({ email, password })
    if (!error && user) {
      await loadProfile(user.id)
    }
    return { user, session, error }
  }

  const signOut = async () => {
    await authApi.signOut()
    setProfile(null)
    setInfluencerProfile(null)
    setClientProfile(null)
  }

  const resetPassword = async (email) => {
    return authApi.resetPasswordForEmail(email)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        profile,
        influencerProfile,
        clientProfile,
        isUtilisateurSimple,
        loading,
        profileLoading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        refreshProfile: () => session?.user && loadProfile(session.user.id),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
