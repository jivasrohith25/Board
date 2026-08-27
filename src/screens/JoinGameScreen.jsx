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

      if (gameData.startedAt || gameData.status === 'active') {
        setError('This game has already started. Ask the host for a new code.')
        setJoining(false)
        return
      }

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
      style={{ minHeight: '100vh', background: '#000000', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <div className="kippo-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="kippo-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>🎮</span>
            JOIN GAME
          </div>
          <div style={{ padding: '30px' }}>
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '15px', textAlign: 'center', lineHeight: '1.88' }}>
              Enter the 6-character game code shared by the host.
            </p>

            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin() }}
              placeholder="ABCDEF"
              className="kippo-input"
              style={{ width: '100%', textAlign: 'center', fontSize: '24px', fontWeight: 700, letterSpacing: '8px', padding: '15px', textTransform: 'uppercase' }}
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
                  <p style={{ fontFamily: "'Source Code Pro', monospace", color: '#ee1f66', fontSize: '12px', marginTop: '10px', fontWeight: 700, textAlign: 'center' }}>
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleJoin}
              disabled={joining || code.length < 6}
              className="kippo-btn-primary"
              style={{ width: '100%', marginTop: '15px', padding: '15px', opacity: joining || code.length < 6 ? 0.5 : 1 }}
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

            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <button onClick={() => navigate('/name-input')} style={{ fontFamily: "'Source Code Pro', monospace", background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                ← CREATE A NEW GAME INSTEAD
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
