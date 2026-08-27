import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from './contexts/AuthContext'
import { LoginScreen } from './screens/LoginScreen'
import { NameInputScreen } from './screens/NameInputScreen'
import { PointEntryScreen } from './screens/PointEntryScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { DicePage } from './screens/DicePage'
import { HistoryScreen } from './screens/HistoryScreen'
import { HistoryDetailScreen } from './screens/HistoryDetailScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { JoinGameScreen } from './screens/JoinGameScreen'
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NavBar } from './components/NavBar'

function PrivateRoute({ children }) {
  const { user, loading, username } = useAuth()
  if (loading) return <LoadingSkeleton />
  if (!user) return <Navigate to="/login" replace />
  if (!username) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading, username } = useAuth()
  if (loading) return <LoadingSkeleton />
  if (user && username) return <Navigate to="/name-input" replace />
  return children
}

export default function App() {
  const location = useLocation()
  const isLogin = location.pathname === '/login'

  return (
    <ErrorBoundary>
      <div className="min-h-screen" style={{ background: '#7a8aba' }}>
        {!isLogin && <NavBar />}
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={
              <PublicRoute>
                <LoginScreen />
              </PublicRoute>
            } />
            <Route path="/name-input" element={
              <PrivateRoute>
                <NameInputScreen />
              </PrivateRoute>
            } />
            <Route path="/point-entry/:gameId" element={
              <PrivateRoute>
                <PointEntryScreen />
              </PrivateRoute>
            } />
            <Route path="/results/:gameId" element={
              <PrivateRoute>
                <ResultsScreen />
              </PrivateRoute>
            } />
            <Route path="/dice" element={
              <PrivateRoute>
                <DicePage />
              </PrivateRoute>
            } />
            <Route path="/history" element={
              <PrivateRoute>
                <HistoryScreen />
              </PrivateRoute>
            } />
            <Route path="/history/:gameId" element={
              <PrivateRoute>
                <HistoryDetailScreen />
              </PrivateRoute>
            } />
            <Route path="/profile" element={
              <PrivateRoute>
                <ProfileScreen />
              </PrivateRoute>
            } />
            <Route path="/join" element={
              <PrivateRoute>
                <JoinGameScreen />
              </PrivateRoute>
            } />
            <Route path="/" element={<Navigate to="/name-input" replace />} />
            <Route path="*" element={<Navigate to="/name-input" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  )
}
