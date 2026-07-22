import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import MyProfileRouter from './components/MyProfileRouter'
import MyDashboardRouter from './components/MyDashboardRouter'

// ProfilePicker (sélecteur de profils façon Facebook) est la première chose qu'un
// utilisateur non connecté voit désormais : reste en import statique pour éviter
// un flash de chargement au tout premier écran de l'app.
import ProfilePicker from './pages/auth/ProfilePicker'
import SwitchAccount from './pages/auth/SwitchAccount'

// Tout le reste est chargé à la demande (code-splitting par route) : le bundle initial
// ne contient plus l'éditeur de post, l'admin, le wallet, la messagerie, etc.
// Cela réduit fortement le JS à parser/exécuter au démarrage, donc le temps d'ouverture de l'app.
const Signup = lazy(() => import('./pages/auth/Signup'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ManageProfiles = lazy(() => import('./pages/auth/ManageProfiles'))

const Feed = lazy(() => import('./pages/feed/Feed'))
const Search = lazy(() => import('./pages/feed/Search'))
const Notifications = lazy(() => import('./pages/feed/Notifications'))
const CreatePost = lazy(() => import('./pages/feed/CreatePost'))
const ReelsViewer = lazy(() => import('./pages/feed/ReelsViewer'))
const PostDetail = lazy(() => import('./pages/feed/PostDetail'))

const InfluencerProfile = lazy(() => import('./pages/profile/InfluencerProfile'))
const EditProfile = lazy(() => import('./pages/profile/EditProfile'))
const ClientProfileView = lazy(() => import('./pages/profile/ClientProfileView'))
const SimpleUserProfileView = lazy(() => import('./pages/profile/SimpleUserProfileView'))
const FollowList = lazy(() => import('./pages/profile/FollowList'))

const CreateOffer = lazy(() => import('./pages/offers/CreateOffer'))
const OfferDetail = lazy(() => import('./pages/offers/OfferDetail'))

const ConversationsList = lazy(() => import('./pages/messages/ConversationsList'))
const NewConversation = lazy(() => import('./pages/messages/NewConversation'))
const Chat = lazy(() => import('./pages/messages/Chat'))
const ChatPro = lazy(() => import('./pages/messages/ChatPro'))
const NewConversationPro = lazy(() => import('./pages/messages/NewConversationPro'))
const ChatBiz = lazy(() => import('./pages/messages/ChatBiz'))
const NewConversationBiz = lazy(() => import('./pages/messages/NewConversationBiz'))
const ChatSociale = lazy(() => import('./pages/messages/ChatSociale'))
const NewConversationSociale = lazy(() => import('./pages/messages/NewConversationSociale'))

const Wallet = lazy(() => import('./pages/wallet/Wallet'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))

function RouteFallback() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )
}

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user || profile?.role !== 'admin') return <Navigate to="/admin/connexion" replace />
  return children
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Auth */}
        <Route path="/profils" element={<ProfilePicker />} />
        <Route path="/profils/gerer" element={<ManageProfiles />} />
        <Route path="/connexion" element={<SwitchAccount />} />
        <Route path="/inscription" element={<Signup />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />

        {/* Admin (séparé, pas de bottom nav) */}
        <Route path="/admin/connexion" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        {/* Chat pro (utilisateur <-> entreprise) : placé avant /messages/:id pour que
            "pro" ne soit jamais capturé comme un id de conversation normale. */}
        <Route
          path="/messages/pro/nouveau"
          element={
            <ProtectedRoute>
              <NewConversationPro />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/pro/:id"
          element={
            <ProtectedRoute>
              <ChatPro />
            </ProtectedRoute>
          }
        />

        {/* Chat entreprise <-> entreprise : même raisonnement, placé avant /messages/:id */}
        <Route
          path="/messages/biz/nouveau"
          element={
            <ProtectedRoute>
              <NewConversationBiz />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/biz/:id"
          element={
            <ProtectedRoute>
              <ChatBiz />
            </ProtectedRoute>
          }
        />

        {/* Chat utilisateur_simple <-> utilisateur_simple : même raisonnement, placé avant /messages/:id */}
        <Route
          path="/messages/sociale/nouveau"
          element={
            <ProtectedRoute>
              <NewConversationSociale />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/sociale/:id"
          element={
            <ProtectedRoute>
              <ChatSociale />
            </ProtectedRoute>
          }
        />

        {/* Chat (séparé, pas de bottom nav — plein écran comme Messenger) */}
        <Route
          path="/messages/:id"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

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
          <Route path="/publier/:postId/modifier" element={<CreatePost />} />
          <Route path="/video" element={<ReelsViewer />} />
          <Route path="/video/:postId" element={<ReelsViewer />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/profil" element={<MyProfileRouter />} />
          <Route path="/profil/modifier" element={<EditProfile />} />
          <Route path="/influenceur/:id" element={<InfluencerProfile />} />
          <Route path="/entreprise/:id" element={<ClientProfileView />} />
          <Route path="/utilisateur/:id" element={<SimpleUserProfileView />} />
          <Route path="/profil/:id/abonnes" element={<FollowList />} />
          <Route path="/offre/nouvelle" element={<CreateOffer />} />
          <Route path="/offre/:id/modifier" element={<CreateOffer />} />
          <Route path="/offre/:id" element={<OfferDetail />} />
          <Route path="/messages" element={<ConversationsList />} />
          <Route path="/messages/nouveau" element={<NewConversation />} />
          <Route path="/dashboard" element={<MyDashboardRouter />} />
          <Route path="/wallet" element={<Wallet />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
