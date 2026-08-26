import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <motion.div
          animate={{ y: [0, -10, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-5xl drop-shadow-md"
        >
          🎲
        </motion.div>
      </div>
    )
  }

  if (configMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
        <motion.div
          className="card p-10 w-full max-w-md text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-20 h-20 rounded-2xl bg-bg-secondary flex items-center justify-center mx-auto mb-6 shadow-sm border border-ui-border">
            <span className="text-4xl">⚙️</span>
          </div>
          <h1 className="font-display text-display-sm text-text-primary mb-3">Setup Required</h1>
          <p className="text-text-secondary text-sm mb-6 leading-relaxed">
            Create a <code className="bg-bg-secondary border border-ui-border px-1.5 py-0.5 rounded text-xs font-mono text-text-primary">.env</code> file with your Firebase configuration to continue.
          </p>
          <pre className="text-left bg-[#1a1614] border border-[#2f2825] text-accent-primary text-xs p-5 rounded-xl overflow-x-auto font-mono leading-loose shadow-inner">
{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...`}
          </pre>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4 relative overflow-hidden">
      {/* Decorative background blobs with theme-aware opacity */}
      <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-accent-primary/10 rounded-full blur-[100px] pointer-events-none mix-blend-multiply dark:mix-blend-lighten" />
      <div className="absolute bottom-[-10%] left-[-20%] w-[500px] h-[500px] bg-accent-secondary/10 rounded-full blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-lighten" />

      <motion.div
        className="card p-10 w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="text-center mb-10">
          <motion.div
            className="text-7xl mb-6 inline-block drop-shadow-xl"
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            🎲
          </motion.div>
          <h1 className="font-display text-display-md text-text-primary mb-3 tracking-tight">
            Scorekeeper
          </h1>
          <p className="text-text-secondary font-medium">Track scores. Crown winners. Trash talk.</p>
        </div>

        <div className="min-h-[140px] flex flex-col justify-end">
          <AnimatePresence mode="wait">
            {!user && (
              <motion.div
                key="login-btn"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -2 }}
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-bg-elevated border border-ui-border hover:border-accent-primary/50 text-text-primary font-semibold px-6 py-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </motion.button>
                {submitError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-status-error text-sm mt-4 text-center font-medium"
                  >
                    {submitError}
                  </motion.p>
                )}
              </motion.div>
            )}

            {showUsernameForm && (
              <motion.form
                key="username-form"
                onSubmit={handleClaimUsername}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div className="text-left">
                  <label className="block text-label text-text-muted uppercase mb-2 font-display tracking-wider">
                    Choose your player name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={handleUsernameChange}
                      placeholder="e.g. tabletop_king"
                      className={`input-field pr-12 text-lg ${usernameError ? 'input-error' : usernameAvailable ? 'border-status-success focus:border-status-success focus:ring-status-success/20' : ''}`}
                      maxLength={20}
                      autoFocus
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {checkingUsername && (
                        <svg className="w-5 h-5 text-text-muted animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                      )}
                      {usernameAvailable && !checkingUsername && (
                        <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </motion.svg>
                      )}
                      {usernameError && !checkingUsername && (
                        <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 text-status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </motion.svg>
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {usernameError && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-status-error text-sm mt-2 font-medium">
                        {usernameError}
                      </motion.p>
                    )}
                    {usernameAvailable && !checkingUsername && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-status-success text-sm mt-2 font-medium">
                        Name available!
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={!usernameAvailable || checkingUsername || submitting}
                  className="btn-primary w-full py-4 text-lg"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Claiming...
                    </span>
                  ) : 'Enter Arena'}
                </motion.button>
                {submitError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-status-error text-sm text-center font-medium">{submitError}</motion.p>
                )}
              </motion.form>
            )}

            {showStartButton && (
              <motion.div
                key="start-actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="space-y-4"
              >
                <div className="bg-bg-secondary p-4 rounded-xl border border-ui-border text-center mb-6">
                  <p className="text-text-secondary text-sm mb-1">Playing as</p>
                  <p className="font-display text-xl font-bold text-accent-primary">{username}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -2 }}
                  onClick={() => navigate('/name-input')}
                  className="btn-primary w-full py-4 text-lg shadow-md"
                >
                  Start New Game
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/history')}
                  className="btn-secondary w-full py-3.5"
                >
                  View History
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
