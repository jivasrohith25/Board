import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { LoginScreen } from './screens/LoginScreen'
import { NameInputScreen } from './screens/NameInputScreen'
import { PointEntryScreen } from './screens/PointEntryScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { DicePage } from './screens/DicePage'
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { ErrorBoundary } from './components/ErrorBoundary'

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
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-warm-50">
        <Routes>
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
          <Route path="/" element={<Navigate to="/name-input" replace />} />
          <Route path="*" element={<Navigate to="/name-input" replace />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}