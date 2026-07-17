import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import MyProfileRouter from './components/MyProfileRouter'
import MyDashboardRouter from './components/MyDashboardRouter'

import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'

import Feed from './pages/feed/Feed'
import Search from './pages/feed/Search'
import Notifications from './pages/feed/Notifications'
import CreatePost from './pages/feed/CreatePost'

import InfluencerProfile from './pages/profile/InfluencerProfile'
import EditProfile from './pages/profile/EditProfile'

import CreateOffer from './pages/offers/CreateOffer'
import OfferDetail from './pages/offers/OfferDetail'

import ConversationsList from './pages/messages/ConversationsList'
import NewConversation from './pages/messages/NewConversation'
import Chat from './pages/messages/Chat'

import Wallet from './pages/wallet/Wallet'

import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLogin from './pages/admin/AdminLogin'

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user || profile?.role !== 'admin') return <Navigate to="/admin/connexion" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Signup />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />

      {/* Admin (séparé, pas de bottom nav) */}
      <Route path="/admin/connexion" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

      {/* App principale avec bottom nav */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Feed />} />
        <Route path="/recherche" element={<Search />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/publier" element={<CreatePost />} />
        <Route path="/profil" element={<MyProfileRouter />} />
        <Route path="/profil/modifier" element={<EditProfile />} />
        <Route path="/influenceur/:id" element={<InfluencerProfile />} />
        <Route path="/offre/nouvelle" element={<CreateOffer />} />
        <Route path="/offre/:id/modifier" element={<CreateOffer />} />
        <Route path="/offre/:id" element={<OfferDetail />} />
        <Route path="/messages" element={<ConversationsList />} />
        <Route path="/messages/nouveau" element={<NewConversation />} />
        <Route path="/messages/:id" element={<Chat />} />
        <Route path="/dashboard" element={<MyDashboardRouter />} />
        <Route path="/wallet" element={<Wallet />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
