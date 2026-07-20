import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePushNotifications } from '../hooks/usePushNotifications'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // ligne public.users
  const [influencerProfile, setInfluencerProfile] = useState(null) // ligne profils_influenceur si role=influenceur
  const [clientProfile, setClientProfile] = useState(null) // ligne profils_client si role=client
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
      setClientProfile(null)
    } else if (userRow?.role === 'client') {
      const { data: cliRow } = await supabase
        .from('profils_client')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
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
      } else if (role === 'client') {
        await supabase.from('profils_client').insert({
          user_id: data.user.id,
        })
      }
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
