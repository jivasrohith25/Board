import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

export function LoginScreen() {
  const { user, username, loginWithGoogle, claimUsername, checkUsernameAvailability, checkingUsername, usernameError, usernameAvailable, loading, configMissing } = useAuth()
  const navigate = useNavigate()
  const [usernameInput, setUsernameInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [showUsernameForm, setShowUsernameForm] = useState(false)
  const [showStartButton, setShowStartButton] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (user && username) {
      setShowStartButton(true)
    } else if (user && !username) {
      setShowUsernameForm(true)
    }
  }, [user, username])

  const handleGoogleLogin = async () => {
    try {
      setSubmitError(null)
      await loginWithGoogle()
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setSubmitError('Login failed. Please try again.')
      }
    }
  }

  const handleUsernameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
    setUsernameInput(val)
    setSubmitError(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length >= 2) {
      debounceRef.current = setTimeout(() => {
        checkUsernameAvailability(val)
      }, 400)
    }
  }

  const handleClaimUsername = async (e) => {
    e.preventDefault()
    if (!usernameInput || !usernameAvailable || submitting) return

    setSubmitting(true)
    setSubmitError(null)

    const result = await claimUsername(usernameInput)

    if (result.success) {
      setShowUsernameForm(false)
      setShowStartButton(true)
    } else {
      setSubmitError(result.error)
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div className="animate-pulse-soft text-4xl">🎲</div>
      </div>
    )
  }

  if (configMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50 px-4">
        <motion.div
          className="card p-8 w-full max-w-sm text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-5xl mb-4">⚙️</div>
          <h1 className="text-xl font-bold text-warm-900 mb-2">Firebase Not Configured</h1>
          <p className="text-warm-500 text-sm mb-4">
            Create a <code className="bg-warm-100 px-1.5 py-0.5 rounded text-xs font-mono">.env</code> file with your Firebase config:
          </p>
          <pre className="text-left bg-warm-800 text-green-300 text-xs p-4 rounded-xl overflow-x-auto font-mono leading-relaxed">
{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...`}
          </pre>
          <p className="text-warm-400 text-xs mt-4">
            Copy from <code className="bg-warm-100 px-1 rounded">.env.example</code> and fill in values from the Firebase Console.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50 px-4">
      <motion.div
        className="card p-8 w-full max-w-sm text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="text-6xl mb-4"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          🎲
        </motion.div>
        <h1 className="text-2xl font-extrabold text-warm-900 mb-1">Board Game Scorekeeper</h1>
        <p className="text-warm-500 text-sm mb-8">Track scores, crown winners</p>

        {!user && (
          <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-warm-200 hover:border-warm-300 text-warm-800 font-semibold px-6 py-3 rounded-xl transition-all duration-150 hover:shadow-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </motion.button>
            {submitError && (
              <p className="text-danger-500 text-sm mt-3">{submitError}</p>
            )}
          </>
        )}

        {showUsernameForm && (
          <motion.form
            onSubmit={handleClaimUsername}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="text-left">
              <label className="block text-sm font-medium text-warm-700 mb-1">
                Choose your username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={handleUsernameChange}
                  placeholder="player_one"
                  className={`input-field pr-10 ${usernameError ? 'input-error' : usernameAvailable ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20' : ''}`}
                  maxLength={20}
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername && (
                    <svg className="w-5 h-5 text-warm-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  )}
                  {usernameAvailable && !checkingUsername && (
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {usernameError && !checkingUsername && (
                    <svg className="w-5 h-5 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              </div>
              {usernameError && (
                <p className="text-danger-500 text-xs mt-1">{usernameError}</p>
              )}
              {usernameAvailable && !checkingUsername && (
                <p className="text-green-600 text-xs mt-1">Username available!</p>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={!usernameAvailable || checkingUsername || submitting}
              className="btn-primary w-full"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Claiming…
                </span>
              ) : 'Claim Username'}
            </motion.button>
            {submitError && (
              <p className="text-danger-500 text-sm">{submitError}</p>
            )}
          </motion.form>
        )}

        {showStartButton && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-warm-600 mb-4 text-sm">
              Welcome, <span className="font-bold text-primary-600">{username}</span>!
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/name-input')}
              className="btn-primary w-full text-lg"
            >
              🎮 Start Gaming
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}