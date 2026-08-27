import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

export function LoginScreen() {
  const { user, username, displayName, loginWithGoogle, claimUsername, checkUsernameAvailability, checkingUsername, usernameError, usernameAvailable, loading, configMissing } = useAuth()
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
      debounceRef.current = setTimeout(() => checkUsernameAvailability(val), 400)
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#7a8aba' }}>
        <motion.div animate={{ y: [0, -10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} style={{ fontSize: '48px' }}>
          🎲
        </motion.div>
      </div>
    )
  }

  if (configMissing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#7a8aba', padding: '16px' }}>
        <motion.div className="ds-form-panel" style={{ width: '100%', maxWidth: '480px', textAlign: 'center', padding: '32px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ fontSize: '36px', marginBottom: '24px' }}>⚙️</div>
          <h1 style={{ fontFamily: 'Arial Black, Arial', fontSize: '20px', fontWeight: '900', color: '#21242e', marginBottom: '12px' }}>SETUP REQUIRED</h1>
          <p style={{ fontSize: '12px', color: '#3d4f97', marginBottom: '24px' }}>
            Create a <code style={{ background: '#dedede', padding: '2px 6px', borderRadius: '2px', fontSize: '11px', border: '1px solid #5a5f8c' }}>.env</code> file with your Firebase configuration.
          </p>
          <pre style={{ textAlign: 'left', background: '#21242e', color: '#ecab37', fontSize: '11px', padding: '16px', borderRadius: '6px', border: '2px solid #3d4f97', overflowX: 'auto', lineHeight: '1.8' }}>
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#7a8aba',
      backgroundImage: 'url(/bg/main_page.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      position: 'relative',
      padding: '16px',
    }}>
      {/* Overlay to ensure readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(122, 138, 186, 0.75) 0%, rgba(33, 36, 46, 0.6) 100%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '440px',
          background: '#21242e',
          border: 'none',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '3px solid rgba(0,0,0,0.5)',
          borderRadius: '0',
          padding: '32px',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '4px 4px',
        }}
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Title area */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <motion.div
            style={{ fontSize: '56px', marginBottom: '16px', display: 'inline-block' }}
            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            🎲
          </motion.div>
          <h1 style={{
            fontFamily: 'Arial Black, Arial',
            fontSize: '32px',
            fontWeight: '900',
            color: '#ffffff',
            lineHeight: '1',
            margin: '0 0 8px 0',
            textShadow: '2px 2px 0 #3d4f97, 4px 4px 0 rgba(0,0,0,0.3)',
            letterSpacing: '-1px',
          }}>
            SCOREKEEPER
          </h1>
          <p style={{ fontSize: '13px', fontWeight: '700', color: '#e48600', letterSpacing: '0.5px', margin: 0 }}>
            Track scores. Crown winners. Trash talk.
          </p>
        </div>

        <div style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <AnimatePresence mode="wait">
            {!user && (
              <motion.div key="login-btn" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGoogleLogin}
                  className="ds-btn-submit"
                  style={{ width: '100%', fontSize: '12px', padding: '16px 24px' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    CONTINUE WITH GOOGLE
                  </span>
                </motion.button>
                {submitError && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{ color: '#e60012', fontSize: '12px', marginTop: '16px', textAlign: 'center', fontWeight: '700' }}>
                    {submitError}
                  </motion.p>
                )}
              </motion.div>
            )}

            {showUsernameForm && (
              <motion.form key="username-form" onSubmit={handleClaimUsername} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ecab37', marginBottom: '8px' }}>
                    CHOOSE YOUR PLAYER NAME
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={handleUsernameChange}
                      placeholder="e.g. tabletop_king"
                      className={`ds-input ${usernameError ? 'input-error' : ''}`}
                      style={{
                        width: '100%',
                        height: 'auto',
                        padding: '12px 48px 12px 12px',
                        fontSize: '14px',
                        background: '#ffffff',
                        border: `2px solid ${usernameError ? '#e60012' : usernameAvailable ? '#15803d' : '#5a5f8c'}`,
                        borderRadius: '2px',
                        outline: 'none',
                      }}
                      maxLength={20}
                      autoFocus
                    />
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                      {checkingUsername && (
                        <svg style={{ width: '18px', height: '18px', color: '#60619c', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                      )}
                      {usernameAvailable && !checkingUsername && (
                        <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: '18px', height: '18px', color: '#15803d' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </motion.svg>
                      )}
                      {usernameError && !checkingUsername && (
                        <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: '18px', height: '18px', color: '#e60012' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </motion.svg>
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {usernameError && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ color: '#e60012', fontSize: '12px', marginTop: '8px', fontWeight: '700' }}>
                        {usernameError}
                      </motion.p>
                    )}
                    {usernameAvailable && !checkingUsername && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ color: '#15803d', fontSize: '12px', marginTop: '8px', fontWeight: '700' }}>
                        Name available!
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={!usernameAvailable || checkingUsername || submitting}
                  className="ds-btn-submit"
                  style={{ width: '100%', padding: '16px 24px' }}
                >
                  {submitting ? 'CLAIMING...' : 'ENTER ARENA'}
                </motion.button>
                {submitError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#e60012', fontSize: '12px', textAlign: 'center', marginTop: '12px', fontWeight: '700' }}>{submitError}</motion.p>
                )}
              </motion.form>
            )}

            {showStartButton && (
              <motion.div key="start-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, delay: 0.1 }}>
                {/* User info bar */}
                <div style={{
                  background: '#2a2e3a',
                  padding: '12px 16px',
                  borderLeft: '3px solid #ecab37',
                  marginBottom: '16px',
                }}>
                  <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60619c', margin: '0 0 4px 0' }}>PLAYING AS</p>
                  <p style={{ fontFamily: 'Arial Black, Arial', fontSize: '18px', fontWeight: '900', color: '#e48600', margin: 0 }}>{displayName || username}</p>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/name-input')}
                  className="ds-btn-submit"
                  style={{ width: '100%', padding: '16px 24px', marginBottom: '8px' }}
                >
                  START NEW GAME
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/join')}
                  className="ds-btn-primary"
                  style={{ width: '100%', padding: '16px 24px', marginBottom: '8px' }}
                >
                  JOIN WITH CODE
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/name-input?game=raja-rani')}
                  className="ds-btn-secondary"
                  style={{ width: '100%', background: '#21242e', color: '#ecab37', borderBottomColor: '#e48600' }}
                >
                  👑 RAJA RANI
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/history')}
                  className="ds-btn-secondary"
                  style={{ width: '100%' }}
                >
                  VIEW HISTORY
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
