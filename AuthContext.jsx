import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
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
    const [{ data: userRow }, { data: infRow }, { data: cliRow }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      supabase.from('profils_influenceur').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('profils_client').select('*').eq('user_id', userId).maybeSingle(),
    ])

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
    supabase.auth.getSession().then(({ data: { session } }) => {
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
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id)
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          supabase
            .from('users')
            .select('nom_complet, photo_url')
            .eq('id', session.user.id)
            .maybeSingle()
            .then(({ data: userRow }) => {
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

    return () => listener.subscription.unsubscribe()
  }, [])

  const signUp = async ({ email, password, nomComplet, role }) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    if (data.user) {
      const { error: insertError } = await supabase.from('users').insert({
        id: data.user.id,
        role,
        email,
        nom_complet: nomComplet,
      })
      if (insertError) return { error: insertError }

      if (role === 'influenceur') {
        await supabase.from('profils_influenceur').insert({
          user_id: data.user.id,
        })
        // le wallet est créé par un trigger côté DB idéalement ; sinon on le crée ici en secours
      } else if (role === 'client') {
        await supabase.from('profils_client').insert({
          user_id: data.user.id,
        })
      }
      // 'utilisateur_simple' n'a pas de table de profil dédiée : rien à insérer de plus,
      // la ligne dans public.users (nom_complet, photo_url) lui suffit.
      await loadProfile(data.user.id)
    }
    return { data, error: null }
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      await loadProfile(data.user.id)
    }
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setInfluencerProfile(null)
    setClientProfile(null)
  }

  const resetPassword = async (email) => {
    return supabase.auth.resetPasswordForEmail(email)
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
