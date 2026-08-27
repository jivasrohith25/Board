import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  increment,
  arrayUnion,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'

const FONT = "'Source Code Pro', monospace"

const ACCENT = '#ee1f66'
const CARD_BG = '#29292a'
const CARD_BORDER = '1px solid #ffffff'
const CARD_RADIUS = '15px'
const CARD_STYLE = { background: CARD_BG, border: CARD_BORDER, borderRadius: CARD_RADIUS }

const LABEL_STYLE = {
  fontFamily: FONT,
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  color: ACCENT,
  textTransform: 'uppercase',
  padding: '12px 30px 0',
}

const INPUT_STYLE = {
  background: '#000000',
  border: '1px solid #ffffff',
  borderRadius: '10px',
  color: '#ffffff',
  fontFamily: FONT,
  padding: '12px 16px',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
}

const PRIMARY_BTN = {
  background: ACCENT,
  color: '#ffffff',
  border: 'none',
  borderRadius: CARD_RADIUS,
  padding: '16px 24px',
  fontFamily: FONT,
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  cursor: 'pointer',
  width: '100%',
}

const GHOST_BTN = {
  background: 'transparent',
  color: '#ffffff',
  border: '1px solid #ffffff',
  borderRadius: CARD_RADIUS,
  padding: '14px 24px',
  fontFamily: FONT,
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  cursor: 'pointer',
}

const ROLE_META = {
  police:   { icon: '\u{1F6A9}', label: 'POLICE',   color: '#33beff' },
  thief:    { icon: '\u{1F5E1}️', label: 'THIEF',     color: ACCENT },
  civilian: { icon: '\u{1F464}', label: 'CIVILIAN', color: '#ffffff' },
}

function fisherYates(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Scoring:
 *   Raja  = 1000
 *   Rani  = 800
 *   Police = -100 if catches thief, 0 if not
 *   Thief = 0 if caught, random 200-799 if escaped
 *   Civilian = random 100-799 unique per civilian (at least 1pt apart)
 */
function computeRoundScores(roles, policeSelectionCorrect) {
  const scores = {}
  const civilians = []

  Object.entries(roles).forEach(([uid, role]) => {
    if (role === 'raja') scores[uid] = 1000
    else if (role === 'rani') scores[uid] = 800
    else if (role === 'police') scores[uid] = policeSelectionCorrect ? -100 : 0
    else if (role === 'thief') scores[uid] = 0 // caught case; set below if escaped
    else civilians.push(uid)
  })

  // Thief escaped — random 200-799
  const thiefUid = Object.entries(roles).find(([, r]) => r === 'thief')?.[0]
  if (thiefUid && !policeSelectionCorrect) {
    scores[thiefUid] = 200 + Math.floor(Math.random() * 600)
  }

  // Civilians — unique random 100-799, at least 1pt apart
  if (civilians.length > 0) {
    const pool = new Set()
    while (pool.size < civilians.length) {
      pool.add(100 + Math.floor(Math.random() * 700))
    }
    const sorted = [...pool].sort((a, b) => a - b)
    civilians.forEach((uid, i) => { scores[uid] = sorted[i] })
  }

  return scores
}

/* ─── Card Reveal ─── */
function GameCard({ role, revealed, onTap }) {
  const meta = ROLE_META[role] || ROLE_META.civilian
  return (
    <div
      className="rr-game-card"
      style={{ perspective: '800px', width: '200px', height: '280px', cursor: revealed ? 'default' : 'pointer' }}
      onClick={!revealed ? onTap : undefined}
    >
      <motion.div
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Face down */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span className="card-q" style={{ fontFamily: FONT, fontSize: '72px', fontWeight: 900, color: ACCENT }}>?</span>
        </div>
        {/* Face up */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: '15px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          <span className="card-icon" style={{ fontSize: '56px' }}>{meta.icon}</span>
          <span className="card-label" style={{ fontFamily: FONT, fontSize: '18px', fontWeight: 900, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {meta.label}
          </span>
        </div>
      </motion.div>
    </div>
  )
}

/* ─── Timer Bar ─── */
function TimerBar({ remaining, total }) {
  const pct = total > 0 ? Math.max(0, (remaining / total) * 100) : 0
  const urgent = remaining < 10
  const color = remaining <= 10 ? ACCENT : remaining <= 30 ? '#ff6b9d' : '#ffffff'
  const mins = String(Math.floor(remaining / 60)).padStart(2, '0')
  const secs = String(remaining % 60).padStart(2, '0')

  return (
    <div style={{ width: '100%', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
        <span style={{ fontFamily: FONT, fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Time remaining
        </span>
        <motion.span
          animate={urgent ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
          transition={urgent ? { repeat: Infinity, duration: 0.8 } : {}}
          style={{ fontFamily: FONT, fontSize: '20px', fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}
        >
          {mins}:{secs}
        </motion.span>
      </div>
      <div style={{ width: '100%', height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'linear' }}
          style={{ height: '100%', background: color, borderRadius: '3px' }}
        />
      </div>
    </div>
  )
}

/* ─── Main Component ─── */
export function RajaRaniGameScreen() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, username, displayName } = useAuth()

  /* state */
  const [room, setRoom] = useState(null)
  const [currentRoundData, setCurrentRoundData] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | reveal | waiting | selecting | result | intermission
  const [hasRevealed, setHasRevealed] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [localRoundScores, setLocalRoundScores] = useState({})
  const [cumulativeScores, setCumulativeScores] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [roundResults, setRoundResults] = useState(null)

  const timerRef = useRef(null)
  const timerStartRef = useRef(null)
  const unsubRoomRef = useRef(null)
  const unsubRoundRef = useRef(null)
  const hasStartedRound = useRef(false)

  const myUid = user?.uid
  const isHost = room?.hostUid === myUid
  const players = room?.players || []
  const myRole = currentRoundData?.roles?.[myUid]
  const roundStatus = currentRoundData?.status
  const totalRounds = room?.totalRounds || 5
  const currentRoundNum = room?.currentRound || 1
  const policeTimeLimit = Math.min(120, Math.max(15, room?.policeTimeLimit || 60))

  /* ─── Subscribe to room ─── */
  useEffect(() => {
    if (!roomId) return

    const roomRef = doc(db, 'rajaRaniRooms', roomId)
    unsubRoomRef.current = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) {
        setError('Room not found.')
        return
      }
      const data = snap.data()
      setRoom(data)
      setCumulativeScores(data.scores || {})

      if (data.status === 'finished') {
        navigate(`/raja-rani/podium/${roomId}`)
        return
      }
    }, (err) => {
      console.error('Room listener error:', err)
      setError('Connection error. Retrying...')
    })

    return () => { unsubRoomRef.current?.() }
  }, [roomId, navigate])

  /* ─── Subscribe to current round ─── */
  useEffect(() => {
    if (!room || room.status !== 'active') return
    const roundNum = room.currentRound || 1

    const roundRef = doc(db, 'rajaRaniRooms', roomId, 'rounds', String(roundNum))
    unsubRoundRef.current = onSnapshot(roundRef, (snap) => {
      if (!snap.exists()) {
        setCurrentRoundData(null)
        return
      }
      const data = snap.data()
      setCurrentRoundData(data)

      /* Sync phase from Firestore */
      if (data.status === 'completed') {
        setPhase('result')
        setRoundResults(data)
        setLocalRoundScores(data.roundScores || {})
      } else if (data.status === 'active') {
        if (!hasRevealed) {
          setPhase('reveal')
        }
      }
    }, (err) => {
      console.error('Round listener error:', err)
    })

    return () => { unsubRoundRef.current?.() }
  }, [room?.currentRound, room?.status, roomId])

  /* ─── Reset local state on new round ─── */
  useEffect(() => {
    if (room?.status !== 'active') return
    const roundNum = room.currentRound || 1
    if (currentRoundData && currentRoundData.roundNumber === roundNum && currentRoundData.status === 'active') {
      if (!hasRevealed) {
        setPhase('reveal')
      }
    }
  }, [room?.currentRound, currentRoundData?.roundNumber])

  useEffect(() => {
    setHasRevealed(false)
    setSelectedTarget(null)
    setSubmitting(false)
    setError('')
    setRoundResults(null)
    setLocalRoundScores({})
    hasStartedRound.current = false
  }, [room?.currentRound])

  /* ─── Timer countdown ─── */
  useEffect(() => {
    if (!currentRoundData?.policeTurnStartedAt || currentRoundData.status === 'completed') {
      clearInterval(timerRef.current)
      return
    }

    const startMs = currentRoundData.policeTurnStartedAt.toMillis
      ? currentRoundData.policeTurnStartedAt.toMillis()
      : new Date(currentRoundData.policeTurnStartedAt).getTime()

    timerStartRef.current = startMs

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000)
      const rem = Math.max(0, policeTimeLimit - elapsed)
      setTimeRemaining(rem)
      if (rem <= 0) {
        clearInterval(timerRef.current)
        handleTimerExpired()
      }
    }

    tick()
    timerRef.current = setInterval(tick, 250)

    return () => clearInterval(timerRef.current)
  }, [currentRoundData?.policeTurnStartedAt, currentRoundData?.status, policeTimeLimit])

  /* ─── Start Round (host only) ─── */
  const startRound = useCallback(async () => {
    if (!isHost || hasStartedRound.current) return
    if (players.length < 3) {
      setError('Need at least 3 players to start.')
      return
    }

    hasStartedRound.current = true
    const nextRound = (room.currentRound || 0) + 1
    const uids = fisherYates(players.map((p) => p.uid))

    const roles = {}
    roles[uids[0]] = 'police'
    roles[uids[1]] = 'thief'
    for (let i = 2; i < uids.length; i++) {
      roles[uids[i]] = 'civilian'
    }

    const roundData = {
      roundNumber: nextRound,
      roles,
      policeSelection: null,
      policeSelectionCorrect: null,
      roundScores: {},
      policeTurnStartedAt: null,
      status: 'active',
    }

    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'rajaRaniRooms', roomId, 'rounds', String(nextRound)), roundData)
      batch.update(doc(db, 'rajaRaniRooms', roomId), {
        currentRound: nextRound,
        status: 'active',
      })
      await batch.commit()
      setPhase('reveal')
      setHasRevealed(false)
    } catch (err) {
      console.error('Failed to start round:', err)
      setError('Failed to start round. Try again.')
      hasStartedRound.current = false
    }
  }, [isHost, players, room, roomId])

  /* ─── Auto-start round 1 ─── */
  useEffect(() => {
    if (isHost && room && room.status === 'active' && !room.currentRound && !hasStartedRound.current && players.length >= 3) {
      startRound()
    }
  }, [isHost, room, players])

  /* ─── Card Reveal ─── */
  const handleReveal = useCallback(() => {
    if (hasRevealed) return
    setHasRevealed(true)

    if (myRole === 'police') {
      setPhase('selecting')
      // Write policeTurnStartedAt
      if (isHost || myUid) {
        updateDoc(doc(db, 'rajaRaniRooms', roomId, 'rounds', String(currentRoundNum)), {
          policeTurnStartedAt: serverTimestamp(),
        }).catch((err) => console.error('Failed to start police timer:', err))
      }
    } else {
      setPhase('waiting')
    }
  }, [hasRevealed, myRole, roomId, currentRoundNum, isHost, myUid])

  /* ─── Police selection ─── */
  const handleAccuse = useCallback(async () => {
    if (!selectedTarget || submitting || !currentRoundData?.roles) return
    setSubmitting(true)

    const roles = currentRoundData.roles
    const correct = roles[selectedTarget] === 'thief'
    const roundScores = computeRoundScores(roles, correct)

    try {
      const batch = writeBatch(db)
      const roundRef = doc(db, 'rajaRaniRooms', roomId, 'rounds', String(currentRoundNum))
      batch.update(roundRef, {
        policeSelection: selectedTarget,
        policeSelectionCorrect: correct,
        roundScores,
        status: 'completed',
      })

      players.forEach((p) => {
        const pts = roundScores[p.uid] || 0
        batch.update(doc(db, 'rajaRaniRooms', roomId), {
          [`scores.${p.uid}`]: increment(pts),
        })
      })

      await batch.commit()
      clearInterval(timerRef.current)
    } catch (err) {
      console.error('Failed to submit accusation:', err)
      setError('Failed to submit. Try again.')
      setSubmitting(false)
    }
  }, [selectedTarget, submitting, currentRoundData, myUid, roomId, currentRoundNum, players])

  /* ─── Timer expired ─── */
  const handleTimerExpired = useCallback(async () => {
    if (!currentRoundData?.roles || submitting) return
    setSubmitting(true)

    const roles = currentRoundData.roles
    const roundScores = computeRoundScores(roles, false)

    try {
      const batch = writeBatch(db)
      const roundRef = doc(db, 'rajaRaniRooms', roomId, 'rounds', String(currentRoundNum))
      batch.update(roundRef, {
        policeSelection: null,
        policeSelectionCorrect: false,
        roundScores,
        status: 'completed',
      })

      players.forEach((p) => {
        const pts = roundScores[p.uid] || 0
        batch.update(doc(db, 'rajaRaniRooms', roomId), {
          [`scores.${p.uid}`]: increment(pts),
        })
      })

      await batch.commit()
    } catch (err) {
      console.error('Failed to handle timer expiry:', err)
      setError('Failed to record result.')
      setSubmitting(false)
    }
  }, [currentRoundData, submitting, myUid, roomId, currentRoundNum, players])

  /* ─── Next Round / End Game ─── */
  const handleNextRound = useCallback(async () => {
    if (!isHost) return
    const nextRound = currentRoundNum + 1
    if (nextRound > totalRounds) {
      await handleEndGame()
      return
    }
    hasStartedRound.current = false
    setHasRevealed(false)
    setSelectedTarget(null)
    setPhase('reveal')
    setRoundResults(null)
    setLocalRoundScores({})
    setSubmitting(false)

    const uids = fisherYates(players.map((p) => p.uid))
    const roles = {}
    roles[uids[0]] = 'police'
    roles[uids[1]] = 'thief'
    for (let i = 2; i < uids.length; i++) {
      roles[uids[i]] = 'civilian'
    }

    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'rajaRaniRooms', roomId, 'rounds', String(nextRound)), {
        roundNumber: nextRound,
        roles,
        policeSelection: null,
        policeSelectionCorrect: null,
        roundScores: {},
        policeTurnStartedAt: null,
        status: 'active',
      })
      batch.update(doc(db, 'rajaRaniRooms', roomId), { currentRound: nextRound })
      await batch.commit()
    } catch (err) {
      console.error('Failed to start next round:', err)
      setError('Failed to advance round.')
    }
  }, [isHost, currentRoundNum, totalRounds, players, roomId])

  const handleEndGame = useCallback(async () => {
    if (!isHost) return
    try {
      await updateDoc(doc(db, 'rajaRaniRooms', roomId), { status: 'finished' })
      navigate(`/raja-rani/podium/${roomId}`)
    } catch (err) {
      console.error('Failed to end game:', err)
      setError('Failed to end game.')
    }
  }, [isHost, roomId, navigate])

  /* ─── Derived data for result display ─── */
  const roleEntries = useMemo(() => {
    if (!currentRoundData?.roles) return []
    return players.map((p) => ({
      uid: p.uid,
      name: p.displayName,
      role: currentRoundData.roles[p.uid] || 'civilian',
    }))
  }, [currentRoundData?.roles, players])

  const sortedCumulative = useMemo(() => {
    return [...players]
      .map((p) => ({ uid: p.uid, name: p.displayName, score: cumulativeScores[p.uid] || 0 }))
      .sort((a, b) => b.score - a.score)
  }, [players, cumulativeScores])

  const policePlayer = roleEntries.find((e) => e.role === 'police')
  const thiefPlayer = roleEntries.find((e) => e.role === 'thief')
  const wasCorrect = roundResults?.policeSelectionCorrect
  const selectionName = roundResults?.policeSelection
    ? players.find((p) => p.uid === roundResults.policeSelection)?.displayName
    : null

  /* ─── Error Banner ─── */
  const ErrorBanner = () => (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{ background: 'rgba(238,31,102,0.15)', border: `1px solid ${ACCENT}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ fontFamily: FONT, fontSize: '12px', fontWeight: 700, color: ACCENT, margin: 0 }}>{error}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  /* ─── Loading state ─── */
  if (!room) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}
      >
        <div style={{ textAlign: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            style={{ width: '40px', height: '40px', border: `3px solid rgba(255,255,255,0.1)`, borderTopColor: ACCENT, borderRadius: '50%', margin: '0 auto 16px' }}
          />
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Loading room...
          </p>
        </div>
      </motion.div>
    )
  }

  /* ─── Not enough players ─── */
  if (players.length < 3 && room.status === 'lobby') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}
      >
        <div style={{ maxWidth: '400px', width: '100%', padding: '0 16px' }}>
          <div style={{ ...CARD_STYLE, padding: '30px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', margin: '0 0 8px' }}>WAITING FOR PLAYERS</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '0 0 20px' }}>
              Need at least 3 players. Currently {players.length}/3.
            </p>
            <p style={{ fontSize: '11px', color: ACCENT, fontWeight: 700, margin: 0, letterSpacing: '0.1em' }}>
              Share room code: {room.joinCode}
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  /* ─── Lobby (host start button) ─── */
  if (room.status === 'lobby') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}
      >
        <div style={{ maxWidth: '400px', width: '100%', padding: '0 16px' }}>
          <div style={{ ...CARD_STYLE, padding: '30px' }}>
            <ErrorBanner />
            <div style={LABEL_STYLE}>PLAYERS ({players.length})</div>
            <div style={{ padding: '12px 30px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {players.map((p) => (
                  <div
                    key={p.uid}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: p.uid === myUid ? 'rgba(238,31,102,0.1)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}
                  >
                    <span style={{ fontFamily: FONT, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{p.displayName}</span>
                    {p.uid === myUid && (
                      <span style={{ fontFamily: FONT, fontSize: '8px', fontWeight: 700, color: ACCENT, background: 'rgba(238,31,102,0.2)', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>YOU</span>
                    )}
                    {p.uid === room.hostUid && (
                      <span style={{ fontFamily: FONT, fontSize: '8px', fontWeight: 700, color: '#33beff', background: 'rgba(51,190,255,0.15)', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>HOST</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {isHost && (
              <div style={{ padding: '0 30px 30px' }}>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={startRound}
                  disabled={players.length < 3}
                  style={{ ...PRIMARY_BTN, opacity: players.length < 3 ? 0.5 : 1 }}
                >
                  START GAME ({players.length} PLAYERS)
                </motion.button>
              </div>
            )}
            {!isHost && (
              <div style={{ padding: '0 30px 30px' }}>
                <p style={{ fontFamily: FONT, fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: 0 }}>
                  Waiting for host to start...
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  /* ─── Phase: Reveal ─── */
  const renderReveal = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ ...LABEL_STYLE, padding: 0 }}>ROUND {currentRoundNum}</div>
        <p style={{ fontFamily: FONT, fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '8px 0 0' }}>
          Player {currentRoundNum} of {totalRounds}
        </p>
      </div>

      <GameCard role={myRole || 'civilian'} revealed={hasRevealed} onTap={handleReveal} />

      <AnimatePresence>
        {!hasRevealed && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{ fontFamily: FONT, fontSize: '12px', fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '24px' }}
          >
            TAP TO REVEAL
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )

  /* ─── Phase: Waiting ─── */
  const renderWaiting = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ ...LABEL_STYLE, padding: 0, marginBottom: '16px' }}>YOUR ROLE</div>
      <div style={{ marginBottom: '24px' }}>
        <span style={{ fontSize: '40px' }}>{ROLE_META[myRole || 'civilian'].icon}</span>
      </div>
      <p style={{ fontFamily: FONT, fontSize: '16px', fontWeight: 900, color: ROLE_META[myRole || 'civilian'].color, textTransform: 'uppercase', margin: '0 0 8px' }}>
        You are {ROLE_META[myRole || 'civilian'].label}
      </p>
      <motion.p
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 2.5 }}
        style={{ fontFamily: FONT, fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '24px' }}
      >
        Waiting for police to act...
      </motion.p>
      {/* Timer visible to ALL players */}
      <div style={{ width: '100%', maxWidth: '400px', marginTop: '32px' }}>
        <TimerBar remaining={timeRemaining} total={policeTimeLimit} />
      </div>
    </div>
  )

  /* ─── Phase: Selecting (police) ─── */
  const renderSelecting = () => (
    <div style={{ minHeight: '100vh', padding: '32px 16px', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ ...LABEL_STYLE, padding: 0, marginBottom: '24px', textAlign: 'center', fontSize: '14px' }}>
        IDENTIFY THE THIEF
      </div>

      <TimerBar remaining={timeRemaining} total={policeTimeLimit} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {players.map((p) => {
          const isMe = p.uid === myUid
          const isSelected = selectedTarget === p.uid
          return (
            <motion.div
              key={p.uid}
              whileTap={!isMe ? { scale: 0.98 } : {}}
              onClick={!isMe && !submitting ? () => setSelectedTarget(p.uid) : undefined}
              style={{
                ...CARD_STYLE,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: isMe ? 'default' : 'pointer',
                opacity: isMe ? 0.4 : 1,
                borderColor: isSelected ? ACCENT : 'rgba(255,255,255,0.12)',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                {p.displayName}
              </span>
              {isMe && (
                <span style={{ fontFamily: FONT, fontSize: '9px', fontWeight: 700, color: '#33beff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  YOU — POLICE
                </span>
              )}
              {isSelected && (
                <span style={{ fontFamily: FONT, fontSize: '9px', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' }}>
                  SELECTED
                </span>
              )}
            </motion.div>
          )
        })}
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleAccuse}
        disabled={!selectedTarget || submitting}
        style={{
          ...PRIMARY_BTN,
          opacity: !selectedTarget || submitting ? 0.4 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {submitting ? (
          <>
            <svg style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ opacity: 0.75 }} />
            </svg>
            ACCUSING...
          </>
        ) : (
          'ACCUSE'
        )}
      </motion.button>
    </div>
  )

  /* ─── Phase: Result ─── */
  const renderResult = () => {
    const rr = roundResults || currentRoundData
    if (!rr) return null

    return (
      <div style={{ minHeight: '100vh', padding: '32px 16px', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ ...LABEL_STYLE, padding: 0, marginBottom: '20px', textAlign: 'center', fontSize: '14px' }}>
          ROUND {currentRoundNum} RESULT
        </div>

        {/* Result banner */}
        {rr.policeSelectionCorrect !== null && rr.policeSelectionCorrect !== undefined && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: rr.policeSelectionCorrect ? 'rgba(34,197,94,0.15)' : `rgba(238,31,102,0.15)`,
              border: `1px solid ${rr.policeSelectionCorrect ? '#22c55e' : ACCENT}`,
              borderRadius: '15px',
              padding: '20px',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontFamily: FONT, fontSize: '22px', fontWeight: 900, color: rr.policeSelectionCorrect ? '#22c55e' : ACCENT, margin: '0 0 4px' }}>
              {rr.policeSelectionCorrect ? '✓ CORRECT' : '✗ WRONG'}
            </p>
            {selectionName && (
              <p style={{ fontFamily: FONT, fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                {policePlayer?.name} accused {selectionName}
              </p>
            )}
            {!rr.policeSelection && rr.policeSelection !== 0 && (
              <p style={{ fontFamily: FONT, fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                Police ran out of time
              </p>
            )}
          </motion.div>
        )}

        {/* Role Reveal */}
        <div style={{ ...CARD_STYLE, padding: '20px', marginBottom: '20px' }}>
          <div style={{ ...LABEL_STYLE, padding: '0 0 16px', fontSize: '10px' }}>ROLES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {roleEntries.map((entry) => {
              const meta = ROLE_META[entry.role]
              return (
                <div
                  key={entry.uid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: entry.uid === myUid ? 'rgba(238,31,102,0.1)' : 'rgba(255,255,255,0.04)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span style={{ fontFamily: FONT, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {entry.name}
                    {entry.uid === myUid && <span style={{ fontSize: '8px', color: ACCENT, marginLeft: '6px' }}>(YOU)</span>}
                  </span>
                  <span style={{
                    fontFamily: FONT,
                    fontSize: '9px',
                    fontWeight: 700,
                    color: meta.color,
                    background: `${meta.color}22`,
                    padding: '3px 10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderRadius: '6px',
                  }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Round Scores */}
        <div style={{ ...CARD_STYLE, padding: '20px', marginBottom: '20px' }}>
          <div style={{ ...LABEL_STYLE, padding: '0 0 16px', fontSize: '10px' }}>ROUND SCORES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {roleEntries.map((entry) => {
              const pts = rr.roundScores?.[entry.uid] ?? 0
              return (
                <div key={entry.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontFamily: FONT, fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>{entry.name}</span>
                  <span style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 900, color: pts < 0 ? '#ff4444' : ACCENT, fontVariantNumeric: 'tabular-nums' }}>
                    {pts > 0 ? '+' : ''}{pts}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Cumulative Scores */}
        <div style={{ ...CARD_STYLE, padding: '20px', marginBottom: '20px' }}>
          <div style={{ ...LABEL_STYLE, padding: '0 0 16px', fontSize: '10px' }}>TOTAL STANDINGS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedCumulative.map((entry, i) => (
              <div key={entry.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < sortedCumulative.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                  {entry.name}
                  {entry.uid === myUid && <span style={{ fontSize: '8px', color: ACCENT, marginLeft: '6px' }}>(YOU)</span>}
                </span>
                <span style={{ fontFamily: FONT, fontSize: '16px', fontWeight: 900, color: i === 0 ? ACCENT : '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                  {entry.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Host Controls */}
        {isHost && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentRoundNum < totalRounds && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleNextRound}
                style={PRIMARY_BTN}
              >
                NEXT ROUND ({currentRoundNum + 1}/{totalRounds})
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleEndGame}
              style={GHOST_BTN}
            >
              END GAME
            </motion.button>
          </div>
        )}
        {!isHost && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              style={{ fontFamily: FONT, fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              Waiting for host to continue...
            </motion.p>
          </div>
        )}
      </div>
    )
  }

  /* ─── Phase: Intermission ─── */
  const renderIntermission = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ ...CARD_STYLE, padding: '30px', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 900, color: '#ffffff', margin: '0 0 8px' }}>
          INTERMISSION
        </p>
        <p style={{ fontFamily: FONT, fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 24px' }}>
          Round {currentRoundNum} of {totalRounds} complete
        </p>
        {isHost ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentRoundNum < totalRounds && (
              <motion.button whileTap={{ scale: 0.98 }} onClick={handleNextRound} style={PRIMARY_BTN}>
                NEXT ROUND
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleEndGame} style={GHOST_BTN}>
              END GAME
            </motion.button>
          </div>
        ) : (
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            style={{ fontFamily: FONT, fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
          >
            Waiting for host...
          </motion.p>
        )}
      </div>
    </div>
  )

  /* ─── Render Phase ─── */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ minHeight: '100vh', background: '#000000', fontFamily: FONT }}
    >
      <AnimatePresence mode="wait">
        {phase === 'reveal' && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderReveal()}
          </motion.div>
        )}
        {phase === 'waiting' && (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderWaiting()}
          </motion.div>
        )}
        {phase === 'selecting' && (
          <motion.div key="selecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderSelecting()}
          </motion.div>
        )}
        {phase === 'result' && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderResult()}
          </motion.div>
        )}
        {phase === 'intermission' && (
          <motion.div key="intermission" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderIntermission()}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .rr-game-card { width: 160px !important; height: 224px !important; }
          .rr-game-card .card-q { font-size: 56px !important; }
          .rr-game-card .card-icon { font-size: 44px !important; }
          .rr-game-card .card-label { font-size: 14px !important; }
          .rr-result-banner { font-size: 18px !important; }
          .rr-label { font-size: 12px !important; padding: 0 !important; }
          .rr-player-row { padding: 12px 14px !important; }
        }
      `}</style>
    </motion.div>
  )
}
