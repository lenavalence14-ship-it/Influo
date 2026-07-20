import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { saveAccount } from '../lib/accountSwitcher'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // ligne public.users
  const [influencerProfile, setInfluencerProfile] = useState(null) // ligne profils_influenceur si role=influenceur
  const [loading, setLoading] = useState(true)

  usePushNotifications(session?.user?.id)

  const loadProfile = async (userId) => {
    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    setProfile(userRow || null)

    if (userRow?.role === 'influenceur') {
      const { data: infRow } = await supabase
        .from('profils_influenceur')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      setInfluencerProfile(infRow || null)
    } else {
      setInfluencerProfile(null)
    }

    return userRow
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setInfluencerProfile(null)
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
      }
      await loadProfile(data.user.id)

      // Enregistre ce compte sur l'appareil pour le sélecteur de profils (façon Facebook),
      // seulement si l'inscription a directement ouvert une session (pas de confirmation email requise).
      if (data.session?.refresh_token) {
        await saveAccount({
          userId: data.user.id,
          nomComplet,
          email,
          photoUrl: null,
          refreshToken: data.session.refresh_token,
        })
      }
    }
    return { data, error: null }
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      const userRow = await loadProfile(data.user.id)

      // Enregistre/rafraîchit ce compte dans la liste des profils de cet appareil.
      if (data.session?.refresh_token) {
        await saveAccount({
          userId: data.user.id,
          nomComplet: userRow?.nom_complet || email,
          email,
          photoUrl: userRow?.photo_url || null,
          refreshToken: data.session.refresh_token,
        })
      }
    }
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setInfluencerProfile(null)
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
        loading,
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
