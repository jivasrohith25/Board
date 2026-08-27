import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export function JoinGameScreen() {
  const { user, displayName, username } = useAuth()
  const navigate = useNavigate()
  const { showError, showSuccess } = useToast()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed || trimmed.length !== 6) { setError('Enter a 6-character code'); return }
    setJoining(true); setError('')

    try {
      const gamesRef = collection(db, 'games')
      const q = query(gamesRef, where('joinCode', '==', trimmed))
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        setError('No game found with that code. Check the code and try again.')
        setJoining(false)
        return
      }

      const gameDoc = snapshot.docs[0]
      const gameData = gameDoc.data()

      // Check if game has already started
      if (gameData.startedAt || gameData.status === 'active') {
        setError('This game has already started. Ask the host for a new code.')
        setJoining(false)
        return
      }

      // Check if already joined
      const alreadyJoined = (gameData.playerUids || []).includes(user.uid)
      if (!alreadyJoined) {
        const myName = displayName || username
        await updateDoc(doc(db, 'games', gameDoc.id), {
          playerUids: arrayUnion(user.uid),
          players: arrayUnion({ uid: user.uid, display_name: myName }),
        })
      }

      showSuccess(`Joined game!`)
      navigate(`/point-entry/${gameDoc.id}`)
    } catch (err) {
      console.error('Join failed:', err)
      setError('Failed to join game. Try again.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      style={{ minHeight: 'calc(100vh - 48px)', background: '#7a8aba', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="section-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>🎮</span>
            JOIN GAME
          </div>
          <div style={{ padding: '24px' }}>
            <p style={{ fontSize: '12px', color: '#3d4f97', marginBottom: '16px', textAlign: 'center' }}>
              Enter the 6-character game code shared by the host.
            </p>

            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin() }}
              placeholder="ABCDEF"
              className="ds-input"
              style={{ width: '100%', textAlign: 'center', fontSize: '24px', fontWeight: '900', fontFamily: 'Arial, monospace', letterSpacing: '8px', padding: '16px', textTransform: 'uppercase' }}
              maxLength={6}
              autoFocus
            />

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: '12px', padding: '10px 12px',
                    background: 'rgba(230, 0, 18, 0.08)',
                    borderLeft: '3px solid #e60012',
                  }}>
                    <p style={{ color: '#e60012', fontSize: '11px', fontWeight: '700', margin: 0 }}>
                      {error}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleJoin}
              disabled={joining || code.length < 6}
              className="ds-btn-submit"
              style={{ width: '100%', marginTop: '16px', padding: '16px', opacity: joining || code.length < 6 ? 0.5 : 1 }}
            >
              {joining ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  JOINING...
                </span>
              ) : '🎮 JOIN GAME'}
            </motion.button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button onClick={() => navigate('/name-input')} style={{ background: 'none', border: 'none', color: '#3d4f97', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase' }}>
                ← CREATE A NEW GAME INSTEAD
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  )
}
