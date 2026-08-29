import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  collection, doc, setDoc, updateDoc, getDoc, query, where, getDocs,
  arrayUnion, serverTimestamp
} from 'firebase/firestore'
import { v4 as uuidv4 } from 'uuid'
import { db, useAuth } from '../contexts/AuthContext'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateJoinCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

const FONT = "'Source Code Pro', monospace"

const labelStyle = {
  fontFamily: FONT,
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#ee1f66',
  margin: '0 0 15px 0',
}

const cardStyle = {
  background: '#29292a',
  border: '1px solid #ffffff',
  borderRadius: '15px',
  padding: '30px',
}

const smallCardStyle = {
  ...cardStyle,
  padding: '15px',
}

const inputStyle = {
  background: '#000000',
  border: '1px solid #ffffff',
  borderRadius: '10px',
  padding: '10px 15px',
  color: '#ffffff',
  fontFamily: FONT,
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  outline: 'none',
}

const btnPrimary = {
  background: '#ee1f66',
  color: '#ffffff',
  border: 'none',
  borderRadius: '10px',
  padding: '10px 15px',
  fontFamily: FONT,
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  cursor: 'pointer',
}

const btnGhost = {
  ...btnPrimary,
  background: 'transparent',
  border: '1px solid #ffffff',
}

const stepperBtn = (accent) => ({
  width: '40px',
  height: '40px',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  fontFamily: FONT,
  background: accent ? '#ee1f66' : 'transparent',
  border: accent ? 'none' : '1px solid #ffffff',
  borderRadius: '10px',
  color: '#ffffff',
  cursor: 'pointer',
})

export function RajaRaniLobbyScreen() {
  const { user, username, displayName } = useAuth()
  const navigate = useNavigate()
  const displayNameOrFallback = username || displayName || 'Host'

  const [view, setView] = useState('menu')
  const [timeLimit, setTimeLimit] = useState(60)
  const [rounds, setRounds] = useState(10)
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const adjustTimeLimit = (delta) => setTimeLimit((p) => Math.max(15, Math.min(120, p + delta)))
  const adjustRounds = (delta) => setRounds((p) => Math.max(1, Math.min(30, p + delta)))
  const adjustMaxPlayers = (delta) => setMaxPlayers((p) => Math.max(3, Math.min(10, p + delta)))

  const handleCreate = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const code = generateJoinCode()
      const roomId = uuidv4()
      await setDoc(doc(db, 'rajaRaniRooms', roomId), {
        hostUid: user.uid,
        hostUsername: displayNameOrFallback,
        players: [{ uid: user.uid, displayName: displayNameOrFallback }],
        playerUids: [user.uid],
        status: 'lobby',
        policeTimeLimit: timeLimit,
        totalRounds: rounds,
        maxPlayers,
        currentRound: 1,
        joinCode: code,
        createdAt: serverTimestamp(),
        scores: { [user.uid]: 0 },
      })
      navigate(`/raja-rani/game/${roomId}`)
    } catch (err) {
      console.error('Failed to create room:', err)
      setError('FAILED TO CREATE ROOM. TRY AGAIN.')
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (loading) return
    const trimmed = joinCode.trim().toUpperCase()
    if (trimmed.length !== 6) {
      setError('CODE MUST BE 6 CHARACTERS')
      return
    }
    setLoading(true)
    setError('')
    try {
      const q = query(collection(db, 'rajaRaniRooms'), where('joinCode', '==', trimmed))
      const snap = await getDocs(q)
      if (snap.empty) {
        setError('ROOM NOT FOUND')
        setLoading(false)
        return
      }
      const roomDoc = snap.docs[0]
      const room = roomDoc.data()
      if (room.status === 'active' || room.status === 'finished') {
        setError('GAME ALREADY IN PROGRESS')
        setLoading(false)
        return
      }
      const alreadyIn = room.players?.some((p) => p.uid === user.uid)
      if (!alreadyIn && room.maxPlayers && room.players?.length >= room.maxPlayers) {
        setError('ROOM IS FULL')
        setLoading(false)
        return
      }
      if (!alreadyIn) {
        const existingScores = room.scores || {}
        const updatedPlayers = [...(room.players || []), { uid: user.uid, displayName: displayNameOrFallback }]
        const updatedUids = [...(room.playerUids || []), user.uid]
        await updateDoc(doc(db, 'rajaRaniRooms', roomDoc.id), {
          players: updatedPlayers,
          playerUids: updatedUids,
          scores: { ...existingScores, [user.uid]: 0 },
        })
      }
      navigate(`/raja-rani/game/${roomDoc.id}`)
    } catch (err) {
      console.error('Failed to join room:', err)
      setError('FAILED TO JOIN ROOM. TRY AGAIN.')
      setLoading(false)
    }
  }

  const handleJoinKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleJoin() }
  }

  const handleJoinCodeChange = (e) => {
    const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
    setJoinCode(val)
    setError('')
  }

  /* ---------- PAGE TRANSITION ---------- */
  const pageVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  }

  /* ---------- MENU VIEW ---------- */
  const renderMenu = () => (
    <motion.div key="menu" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '700px', margin: '0 auto' }}>

      <p style={{ fontFamily: FONT, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff', opacity: 0.6, margin: 0 }}>
        SELECT AN OPTION
      </p>

      <div className="lobby-menu-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '100%' }}>
        {/* CREATE ROOM */}
        <motion.div whileTap={{ scale: 0.95 }} style={{ ...cardStyle, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}
          onClick={() => setView('create')}>
          <span style={{ fontSize: '40px', lineHeight: 1 }}>👑</span>
          <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>CREATE ROOM</p>
          <p style={{ fontFamily: FONT, fontSize: '11px', color: '#ffffff', opacity: 0.7, margin: 0, lineHeight: 1.6 }}>Host a game and invite friends</p>
          <motion.button whileTap={{ scale: 0.95 }} style={{ ...btnPrimary, marginTop: '8px', width: '100%', padding: '12px 15px' }}>CREATE</motion.button>
        </motion.div>

        {/* JOIN ROOM */}
        <motion.div whileTap={{ scale: 0.95 }} style={{ ...cardStyle, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}
          onClick={() => setView('join')}>
          <span style={{ fontSize: '40px', lineHeight: 1 }}>🎯</span>
          <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>JOIN ROOM</p>
          <p style={{ fontFamily: FONT, fontSize: '11px', color: '#ffffff', opacity: 0.7, margin: 0, lineHeight: 1.6 }}>Enter a code to join a game</p>
          <motion.button whileTap={{ scale: 0.95 }} style={{ ...btnGhost, marginTop: '8px', width: '100%', padding: '12px 15px' }}>JOIN</motion.button>
        </motion.div>
      </div>
    </motion.div>
  )

  /* ---------- CREATE VIEW ---------- */
  const renderCreate = () => (
    <motion.div key="create" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '700px', margin: '0 auto' }}>

      {/* Room Settings */}
      <div style={cardStyle}>
        <p style={labelStyle}>ROOM SETTINGS</p>
        <div className="lobby-settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
          {/* Police Time Limit */}
          <div style={{ ...smallCardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <p style={{ fontFamily: FONT, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff', opacity: 0.7, margin: 0 }}>
              POLICE TIME
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustTimeLimit(-5)} disabled={timeLimit <= 15} style={stepperBtn(false)}>−</motion.button>
              <div style={{ textAlign: 'center', minWidth: '50px' }}>
                <span style={{ fontFamily: FONT, fontSize: '36px', fontWeight: 700, color: '#ee1f66', lineHeight: '1', fontVariantNumeric: 'tabular-nums' }}>{timeLimit}</span>
                <div style={{ fontFamily: FONT, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff', marginTop: '5px', opacity: 0.7 }}>SECONDS</div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustTimeLimit(5)} disabled={timeLimit >= 120} style={stepperBtn(true)}>+</motion.button>
            </div>
          </div>

          {/* Total Rounds */}
          <div style={{ ...smallCardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <p style={{ fontFamily: FONT, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff', opacity: 0.7, margin: 0 }}>
              TOTAL ROUNDS
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustRounds(-1)} disabled={rounds <= 1} style={stepperBtn(false)}>−</motion.button>
              <div style={{ textAlign: 'center', minWidth: '50px' }}>
                <span style={{ fontFamily: FONT, fontSize: '36px', fontWeight: 700, color: '#ee1f66', lineHeight: '1', fontVariantNumeric: 'tabular-nums' }}>{rounds}</span>
                <div style={{ fontFamily: FONT, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff', marginTop: '5px', opacity: 0.7 }}>ROUNDS</div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustRounds(1)} disabled={rounds >= 30} style={stepperBtn(true)}>+</motion.button>
            </div>
          </div>

          {/* Max Players */}
          <div style={{ ...smallCardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <p style={{ fontFamily: FONT, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff', opacity: 0.7, margin: 0 }}>
              MAX PLAYERS
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustMaxPlayers(-1)} disabled={maxPlayers <= 3} style={stepperBtn(false)}>−</motion.button>
              <div style={{ textAlign: 'center', minWidth: '50px' }}>
                <span style={{ fontFamily: FONT, fontSize: '36px', fontWeight: 700, color: '#ee1f66', lineHeight: '1', fontVariantNumeric: 'tabular-nums' }}>{maxPlayers}</span>
                <div style={{ fontFamily: FONT, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff', marginTop: '5px', opacity: 0.7 }}>PLAYERS</div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustMaxPlayers(1)} disabled={maxPlayers >= 10} style={stepperBtn(true)}>+</motion.button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ fontFamily: FONT, color: '#ee1f66', fontSize: '10px', fontWeight: 700, margin: 0 }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Create Button */}
      <motion.button whileTap={loading ? {} : { scale: 0.97 }} onClick={handleCreate} disabled={loading}
        style={{ ...btnPrimary, width: '100%', padding: '20px 24px', opacity: loading ? 0.5 : 1 }}>
        {loading ? 'CREATING...' : 'CREATE ROOM'}
      </motion.button>

      {/* Back */}
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setView('menu'); setError(''); }} style={{ ...btnGhost, width: '100%', padding: '12px 15px' }}>
        ← BACK
      </motion.button>
    </motion.div>
  )

  /* ---------- JOIN VIEW ---------- */
  const renderJoin = () => (
    <motion.div key="join" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px', margin: '0 auto' }}>

      <div style={cardStyle}>
        <p style={labelStyle}>ENTER ROOM CODE</p>
        <input
          type="text"
          value={joinCode}
          onChange={handleJoinCodeChange}
          onKeyDown={handleJoinKeyDown}
          placeholder="XXXXXX"
          maxLength={6}
          autoFocus
          style={{ ...inputStyle, width: '100%', textAlign: 'center', fontSize: '24px', letterSpacing: '0.3em', padding: '15px' }}
        />
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ fontFamily: FONT, color: '#ee1f66', fontSize: '10px', fontWeight: 700, margin: '10px 0 0 0' }}>
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Join Button */}
      <motion.button whileTap={loading || joinCode.length < 6 ? {} : { scale: 0.97 }} onClick={handleJoin} disabled={loading || joinCode.length < 6}
        style={{ ...btnPrimary, width: '100%', padding: '20px 24px', opacity: loading || joinCode.length < 6 ? 0.5 : 1 }}>
        {loading ? 'JOINING...' : 'JOIN ROOM'}
      </motion.button>

      {/* Back */}
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setView('menu'); setJoinCode(''); setError(''); }} style={{ ...btnGhost, width: '100%', padding: '12px 15px' }}>
        ← BACK
      </motion.button>
    </motion.div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        minHeight: '100vh',
        background: '#000000',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', width: '100%', maxWidth: '700px', margin: '0 auto 20px auto' }}>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/')} style={{ ...btnGhost, padding: '8px 12px', fontSize: '10px' }}>
          ← HOME
        </motion.button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: view === 'menu' ? 'center' : 'flex-start', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {view === 'menu' && renderMenu()}
          {view === 'create' && renderCreate()}
          {view === 'join' && renderJoin()}
        </AnimatePresence>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .lobby-menu-grid { grid-template-columns: 1fr !important; }
          .lobby-settings-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 601px) and (max-width: 900px) {
          .lobby-settings-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 400px) {
          .lobby-settings-grid { gap: 10px !important; }
          .lobby-settings-grid > div { padding: 12px !important; }
          .lobby-settings-grid span[style*="font-size: 36px"] { font-size: 28px !important; }
        }
      `}</style>
    </motion.div>
  )
}
