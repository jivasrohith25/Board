import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Modal, ConfirmModal } from '../components/Modal'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { GameCoach } from '../components/GameCoach'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { TiltCard } from '../components/TiltCard'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Resolve player names from potentially mixed format (old: string[], new: [{uid, display_name}])
function getPlayerNames(players) {
  if (!players || players.length === 0) return []
  if (typeof players[0] === 'string') return players
  return players.map(p => p.display_name)
}

// Find current user's display name by matching uid
function findMyPlayerName(players, playerUids, myUid) {
  if (!players || !myUid) return null
  // New format: [{uid, display_name}]
  if (players.length > 0 && typeof players[0] === 'object') {
    const match = players.find(p => p.uid === myUid)
    return match?.display_name || null
  }
  // Old format: string[] — can't match by uid, fall back to first player if host
  if (playerUids && playerUids[0] === myUid) return players[0]
  return null
}

// Is the user the host?
function isHostPlayer(game, myUid) {
  return game?.createdBy === myUid
}

export function PointEntryScreen() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { user, username, displayName } = useAuth()
  const { showError, showSuccess, showInfo } = useToast()

  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scores, setScores] = useState({})
  const [totalScores, setTotalScores] = useState({})
  const [roundHistory, setRoundHistory] = useState([])
  const [currentRound, setCurrentRound] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [showZeroConfirm, setShowZeroConfirm] = useState(false)
  const [zeroPlayers, setZeroPlayers] = useState([])
  const [showEndModal, setShowEndModal] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showRematchConfirm, setShowRematchConfirm] = useState(false)
  const [undoAvailable, setUndoAvailable] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archivedGameId, setArchivedGameId] = useState(null)
  const undoTimerRef = useRef(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const pendingQueue = useRef([])
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [coachComment, setCoachComment] = useState('')
  const [coachEmotion, setCoachEmotion] = useState('default')
  const [coachTyping, setCoachTyping] = useState(false)
  const [pendingScores, setPendingScores] = useState({})
  const [unrecognizedNames, setUnrecognizedNames] = useState([])
  const [popupVisible, setPopupVisible] = useState(false)

  // Derived state: player names and current user's identity
  const playerNames = useMemo(() => getPlayerNames(game?.players), [game?.players])
  const myPlayerName = useMemo(
    () => findMyPlayerName(game?.players, game?.playerUids, user?.uid),
    [game?.players, game?.playerUids, user?.uid]
  )
  const isGameHost = useMemo(() => isHostPlayer(game, user?.uid), [game, user?.uid])
  const isLobby = game && !game.startedAt && game.status === 'lobby'

  const handleVoiceTranscript = useCallback(async (rawText) => {
    setIsVoiceActive(false)
    if (!rawText || !user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE}/parse-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: rawText, game_id: gameId }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `Server error ${res.status}`) }
      const data = await res.json()
      let hasPopup = false
      if (data.matched && data.matched.length > 0) {
        const newPending = {}
        data.matched.forEach(m => { newPending[m.player] = m.score })
        setPendingScores(prev => ({ ...prev, ...newPending }))
        hasPopup = true
      } else {
        showError('No player names recognized in speech')
      }
      if (data.unrecognized_names && data.unrecognized_names.length > 0) {
        setUnrecognizedNames(data.unrecognized_names)
        hasPopup = true
      } else {
        setUnrecognizedNames([])
      }
      if (hasPopup) setPopupVisible(true)
      if (data.errors && data.errors.length > 0) data.errors.forEach(e => showError(e))
    } catch (err) {
      showError(`Voice parse failed: ${err.message}`)
    }
  }, [user, gameId, showError])

  const handleVoiceError = useCallback((err) => {
    setIsVoiceActive(false)
    if (err !== 'no-speech') showError(`Voice error: ${err}`)
  }, [showError])

  const { isListening, isSupported, transcript, startListening, stopListening } = useVoiceInput({ onResult: handleVoiceTranscript, onError: handleVoiceError })

  const toggleGlobalVoice = () => {
    if (isListening) { stopListening(); setIsVoiceActive(false) }
    else { setIsVoiceActive(true); startListening() }
  }

  const acceptPendingScore = (player) => {
    const val = pendingScores[player]
    if (val !== undefined) {
      handleScoreChange(player, val.toString())
      setPendingScores(prev => {
        const next = { ...prev }; delete next[player]
        if (Object.keys(next).length === 0) setPopupVisible(false)
        return next
      })
    }
  }

  const acceptAllPending = () => {
    // Only accept pending scores that match the current user's player name
    if (myPlayerName && pendingScores[myPlayerName] !== undefined) {
      handleScoreChange(myPlayerName, pendingScores[myPlayerName].toString())
    }
    setPendingScores({}); setPopupVisible(false)
  }

  const dismissPending = () => { setPendingScores({}); setUnrecognizedNames([]); setPopupVisible(false) }

  useEffect(() => {
    const on = () => setIsOnline(true); const off = () => setIsOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (roundHistory.length > 0 || Object.values(scores).some(v => v !== '' && v !== undefined)) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [roundHistory, scores])

  useEffect(() => {
    if (isOnline && pendingQueue.current.length > 0) {
      const queue = [...pendingQueue.current]; pendingQueue.current = []
      queue.forEach(fn => fn())
    }
  }, [isOnline])

  // Main game + rounds listeners
  useEffect(() => {
    const gameRef = doc(db, 'games', gameId)
    const roundsRef = collection(db, 'games', gameId, 'rounds')

    const unsubGame = onSnapshot(gameRef, (snap) => {
      if (!snap.exists()) { navigate('/name-input'); return }
      const gameData = snap.data()
      setGame(gameData)

      // Initialize score inputs for current user only
      const names = getPlayerNames(gameData.players)
      const myName = findMyPlayerName(gameData.players, gameData.playerUids, user?.uid)
      if (myName) {
        setScores(prev => {
          // Only reset if we don't already have a value for this player
          if (prev[myName] !== undefined && prev[myName] !== '') return prev
          return { ...prev, [myName]: '' }
        })
      }
      setLoading(false)
    }, (err) => {
      console.error('Game listener error:', err)
      showError('Failed to load game')
      setLoading(false)
    })

    const unsubRounds = onSnapshot(query(roundsRef, orderBy('submittedAt')), (snap) => {
      const rounds = []
      snap.forEach(d => rounds.push({ id: d.id, ...d.data() }))
      const names = game ? getPlayerNames(game.players) : []
      const initTotals = {}
      names.forEach(p => { initTotals[p] = 0 })
      rounds.forEach(r => { Object.entries(r.scores).forEach(([player, score]) => { initTotals[player] = (initTotals[player] || 0) + score }) })
      setRoundHistory(rounds); setTotalScores(initTotals); setCurrentRound(rounds.length + 1)
    }, (err) => {
      console.error('Rounds listener error:', err)
    })

    return () => { unsubGame(); unsubRounds() }
  }, [gameId])

  const handleScoreChange = (player, value) => {
    if (value === '' || value === '-') { setScores(prev => ({ ...prev, [player]: value })); return }
    const num = parseInt(value)
    if (!isNaN(num)) setScores(prev => ({ ...prev, [player]: num }))
  }

  const submitRound = async (forceZeros = false) => {
    if (submitting || !myPlayerName) return

    const myScore = scores[myPlayerName]
    if (!forceZeros && (myScore === '' || myScore === undefined)) {
      setZeroPlayers([myPlayerName])
      setShowZeroConfirm(true)
      return
    }
    setShowZeroConfirm(false); setSubmitting(true)

    // Build round scores: only the current user's score
    const roundScores = {}
    playerNames.forEach(p => { roundScores[p] = 0 }) // Default all to 0
    roundScores[myPlayerName] = (myScore === '' || myScore === undefined) ? 0 : parseInt(myScore) || 0

    const newTotals = { ...totalScores }
    Object.entries(roundScores).forEach(([p, s]) => { newTotals[p] = (newTotals[p] || 0) + s })
    setTotalScores(newTotals)
    const roundNum = currentRound.toString()
    const newRound = { scores: roundScores, submittedAt: new Date().toISOString() }
    setRoundHistory(prev => [...prev, { id: roundNum, ...newRound }])
    setCurrentRound(prev => prev + 1)
    setScores(prev => ({ ...prev, [myPlayerName]: '' }))

    const writeRound = async () => {
      try { await setDoc(doc(db, 'games', gameId, 'rounds', roundNum), { ...newRound, submittedAt: serverTimestamp() }) }
      catch (err) { console.error('Failed to write round:', err); showError('Failed to save round. Retrying…', { label: 'Retry', action: writeRound }); pendingQueue.current.push(writeRound) }
    }

    const token = await user.getIdToken()
    const newTotalsForCoach = { ...newTotals }
    setCoachTyping(true)
    const coachPromise = fetch(`${API_BASE}/coach-comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ game_id: gameId, round_number: parseInt(roundNum), scores: roundScores, totals: newTotalsForCoach }),
      signal: AbortSignal.timeout(10000),
    }).then(r => { if (!r.ok) throw new Error(`Coach API ${r.status}`); return r.json() })
      .then(data => { if (data.comment) { setCoachComment(data.comment); setCoachEmotion(data.emotion || 'default') }; setCoachTyping(false) })
      .catch(err => { console.warn('Coach comment failed:', err?.message || err); setCoachTyping(false) })

    await writeRound(); setSubmitting(false)
    coachPromise.catch(() => {})
    setUndoAvailable(true)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setUndoAvailable(false), 10000)
    if (game.roundLength && parseInt(roundNum) >= game.roundLength) {
      const savedId = await archiveGame()
      if (savedId) navigate(`/results/${savedId || gameId}`)
    }
  }

  const undoLastRound = async () => {
    if (!undoAvailable || roundHistory.length === 0) return
    const lastRound = roundHistory[roundHistory.length - 1]
    const newTotals = { ...totalScores }
    Object.entries(lastRound.scores).forEach(([p, s]) => { newTotals[p] = (newTotals[p] || 0) - s })
    setTotalScores(newTotals); setRoundHistory(prev => prev.slice(0, -1)); setCurrentRound(prev => prev - 1); setUndoAvailable(false)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    try { await deleteDoc(doc(db, 'games', gameId, 'rounds', lastRound.id)); showInfo('Round undone') }
    catch (err) { console.error('Failed to undo round:', err); showError('Failed to undo round') }
  }

  const archiveGame = async () => {
    setArchiving(true)
    try {
      const token = await user.getIdToken()
      const response = await fetch(`${API_BASE}/games/${gameId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ players: playerNames, rounds: roundHistory.map((r, i) => ({ round_number: i + 1, scores: r.scores })), final_scores: totalScores, winner: getSortedPlayers()[0]?.name || '' }),
      })
      if (!response.ok) { const errBody = await response.json().catch(() => ({})); throw new Error(errBody.detail || errBody.error || `Server error ${response.status}`) }
      const data = await response.json(); setArchivedGameId(data.id || gameId); return data.id || gameId
    } catch (err) { console.error('Archive failed:', err); showError(`Archive failed: ${err.message}`); return null }
    finally { setArchiving(false) }
  }

  const handleEndGame = async (action) => {
    setShowEndModal(false)
    if (action === 'rematch') {
      const savedId = await archiveGame()
      const resetTotals = {}, resetScores = {}
      playerNames.forEach(p => { resetTotals[p] = 0; resetScores[p] = '' })
      const roundsSnap = await getDocs(collection(db, 'games', gameId, 'rounds'))
      const deletePromises = []
      roundsSnap.forEach(d => deletePromises.push(deleteDoc(doc(db, 'games', gameId, 'rounds', d.id))))
      await Promise.all(deletePromises)
      const newJoinCode = generateJoinCode()
      // Build players for rematch
      const playersArray = playerNames.map(name => {
        const existing = (game.players || []).find(p => (typeof p === 'object' ? p.display_name : p) === name)
        return typeof existing === 'object' ? existing : { uid: null, display_name: name }
      })
      const playerUidsList = playersArray.filter(p => p.uid).map(p => p.uid)
      await updateDoc(doc(db, 'games', gameId), {
        currentRound: 1, joinCode: newJoinCode,
        players: playersArray, playerUids: playerUidsList,
        startedAt: null, status: 'lobby',
      })
      setTotalScores(resetTotals); setScores(resetScores); setRoundHistory([]); setCurrentRound(1); setUndoAvailable(false); setArchivedGameId(null)
      showSuccess('Rematch! Scores reset.')
    } else {
      const savedId = await archiveGame()
      if (savedId) navigate(`/results/${savedId || gameId}`)
    }
  }

  const generateJoinCode = () => {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
    return code
  }

  const handleRematchNew = async () => {
    setShowRematchConfirm(false)
    if (!game || rematching) return
    setRematching(true)
    try {
      const newGameId = uuidv4()
      const joinCode = generateJoinCode()
      const playersArray = playerNames.map(name => {
        const existing = (game.players || []).find(p => (typeof p === 'object' ? p.display_name : p) === name)
        return typeof existing === 'object' ? existing : { uid: null, display_name: name }
      })
      const playerUidsList = playersArray.filter(p => p.uid).map(p => p.uid)
      await setDoc(doc(db, 'games', newGameId), {
        createdBy: user.uid, username,
        players: playersArray, playerUids: playerUidsList,
        roundLength: game.roundLength || 5, joinCode,
        currentRound: 1, status: 'lobby', createdAt: serverTimestamp(),
      })
      navigate(`/point-entry/${newGameId}`)
    } catch (err) { console.error('Rematch failed:', err) }
    finally { setRematching(false) }
  }
  const [rematching, setRematching] = useState(false)

  const getSortedPlayers = useCallback(() => {
    if (!game) return []
    return playerNames.map(name => ({ name, score: totalScores[name] || 0 })).sort((a, b) => b.score - a.score)
  }, [playerNames, totalScores])

  if (loading) return <LoadingSkeleton />
  const sorted = getSortedPlayers()

  // LOBBY VIEW — game not yet started
  if (isLobby) {
    const lobbyPlayers = game.players || []
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ minHeight: 'calc(100vh - 48px)', background: '#7a8aba', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      >
        <div style={{ maxWidth: '480px', width: '100%' }}>
          <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="section-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>⏳</span>
              WAITING FOR HOST
            </div>
            <div style={{ padding: '24px' }}>
              {/* Join Code */}
              {game.joinCode && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <p style={{ fontSize: '10px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' }}>GAME CODE</p>
                  <span style={{
                    fontFamily: 'Arial, monospace', fontSize: '24px', fontWeight: '900',
                    color: '#ecab37', letterSpacing: '6px', background: '#21242e',
                    padding: '8px 16px', display: 'inline-block',
                  }}>{game.joinCode}</span>
                </div>
              )}

              {/* Players connected */}
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', textAlign: 'center', margin: '0 0 12px 0' }}>
                {lobbyPlayers.length} PLAYER{lobbyPlayers.length !== 1 ? 'S' : ''} CONNECTED
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {lobbyPlayers.map((p) => {
                  const name = typeof p === 'object' ? p.display_name : p
                  const uid = typeof p === 'object' ? p.uid : null
                  const isMe = uid === user.uid
                  return (
                    <div key={name} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', background: isMe ? 'rgba(236, 171, 55, 0.12)' : '#ffffff',
                      borderLeft: isMe ? '3px solid #ecab37' : '3px solid transparent',
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#21242e', flex: 1 }}>{name}</span>
                      {isMe && <span style={{ fontSize: '9px', fontWeight: '700', color: '#ecab37' }}>(YOU)</span>}
                      <span style={{ width: '8px', height: '8px', borderRadius: '9999px', background: '#15803d' }} />
                    </div>
                  )
                })}
              </div>

              {isGameHost ? (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    await updateDoc(doc(db, 'games', gameId), { startedAt: serverTimestamp(), status: 'active' })
                  }}
                  className="ds-btn-submit"
                  style={{ width: '100%', padding: '16px' }}
                >
                  🎮 START GAME
                </motion.button>
              ) : (
                <motion.p
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ fontSize: '12px', fontWeight: '700', color: '#ecab37', textAlign: 'center', margin: 0 }}
                >
                  ⏳ Waiting for host to start...
                </motion.p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ACTIVE GAME VIEW
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ minHeight: 'calc(100vh - 48px)', background: '#7a8aba', backgroundImage: 'url(/bg/pointinput.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', display: 'flex', flexDirection: 'row', position: 'relative', overflowX: 'hidden' }}
      className="point-entry-layout"
    >
      {/* Scrim for readability */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(122,138,186,0.82) 0%, rgba(33,36,46,0.7) 100%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* === SIDEBAR LEADERBOARD === */}
      <div className="ds-nav-bar pe-sidebar" style={{
        width: '280px', minHeight: 'calc(100vh - 48px)',
        display: 'flex', flexDirection: 'column',
        padding: '16px', flexShrink: 0,
        borderRight: '3px solid rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ecab37' }}>LEADERBOARD</span>
          {game?.roundLength && (
            <span style={{
              fontSize: '9px', fontWeight: '700', color: '#f68d1f',
              background: 'rgba(246, 141, 31, 0.2)', padding: '2px 8px',
              letterSpacing: '0.5px',
            }}>
              R{currentRound - 1}/{game.roundLength}
            </span>
          )}
        </div>

        {/* Join Code + Copy */}
        {game?.joinCode && (
          <div style={{ background: 'rgba(236, 171, 55, 0.15)', border: '1px solid rgba(236, 171, 55, 0.3)', padding: '8px', marginBottom: '12px', textAlign: 'center' }}>
            <p style={{ fontSize: '8px', fontWeight: '700', color: '#ecab37', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px 0' }}>JOIN CODE</p>
            <p style={{ fontFamily: 'Arial, monospace', fontSize: '20px', fontWeight: '900', color: '#ffffff', letterSpacing: '6px', margin: '0 0 6px 0' }}>{game.joinCode}</p>
            <CopyButton code={game.joinCode} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <AnimatePresence mode="popLayout">
            {sorted.map((player, i) => {
              const isTied = i > 0 && player.score === sorted[i - 1].score
              const isLeader = i === 0 && !isTied
              const isMe = player.name === myPlayerName
              return (
                <TiltCard key={player.name} style={{ display: 'block' }}>
                <motion.div
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px',
                    background: isLeader ? 'rgba(236, 171, 55, 0.15)' : isMe ? 'rgba(61, 79, 151, 0.12)' : 'rgba(255,255,255,0.05)',
                    borderLeft: isLeader ? '3px solid #ecab37' : isMe ? '3px solid #3d4f97' : '3px solid transparent',
                  }}
                >
                  <span style={{
                    width: '24px', height: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isLeader ? '#ecab37' : 'rgba(255,255,255,0.1)',
                    color: isLeader ? '#21242e' : '#60619c',
                    fontSize: '9px', fontWeight: '700',
                    fontFamily: 'Arial, monospace',
                  }}>
                    {isLeader ? '👑' : `#${i + 1}`}
                  </span>
                  <span style={{ flex: 1, fontSize: '11px', fontWeight: '700', color: isLeader ? '#ffffff' : '#9fbee7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.name}
                    {isMe && <span style={{ fontSize: '8px', color: '#3d4f97', marginLeft: '4px', fontWeight: '700' }}>YOU</span>}
                    {isTied && <span style={{ fontSize: '8px', color: '#ecab37', marginLeft: '4px' }}>TIE</span>}
                  </span>
                  <span style={{ fontFamily: 'Arial, monospace', fontWeight: '900', fontSize: isLeader ? '14px' : '12px', color: isLeader ? '#ecab37' : '#9fbee7', fontVariantNumeric: 'tabular-nums' }}>
                    {player.score}
                  </span>
                </motion.div>
                </TiltCard>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* === MAIN CONTENT === */}
      <div className="pe-main" style={{ flex: 1, padding: '16px', overflowY: 'auto', position: 'relative' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          {/* Round Header */}
          <div className="section-label-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>📝</span>
              ROUND <motion.span key={currentRound} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ fontFamily: 'Arial Black, Arial', fontSize: '14px' }}>{currentRound}</motion.span>
            </span>
            {!isOnline && (
              <span style={{ fontSize: '9px', fontWeight: '700', color: '#ecab37', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(236, 171, 55, 0.2)', padding: '2px 8px' }}>OFFLINE</span>
            )}
          </div>

          {/* Voice Input */}
          {isSupported && (
            <div className="ds-form-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '12px 16px' }}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleGlobalVoice}
                style={{
                  width: '44px', height: '44px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isListening ? '#e6001f' : '#ffffff',
                  color: isListening ? '#ffffff' : '#60619c',
                  border: isListening ? '3px solid rgba(230, 0, 18, 0.3)' : '2px solid #5a5f8c',
                  borderRadius: '0',
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                {isListening ? (
                  <svg style={{ width: '20px', height: '20px', animation: 'pulse 1s ease-in-out infinite' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                ) : (
                  <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                  </svg>
                )}
              </motion.button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '11px', fontWeight: '700', margin: 0, color: isListening ? '#e60012' : '#3d4f97' }}>
                  {isListening ? 'LISTENING... SPEAK YOUR SCORE' : `TAP MIC, SAY YOUR SCORE (e.g. "${myPlayerName || 'Your Name'} 25")`}
                </p>
                <AnimatePresence>
                  {isListening && transcript && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ fontSize: '10px', color: '#60619c', marginTop: '2px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{transcript}"
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Pending Voice Scores — only show for current user */}
          <AnimatePresence>
            {myPlayerName && pendingScores[myPlayerName] !== undefined && (
              <motion.div initial={{ opacity: 0, height: 0, y: -10 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, scale: 0.95 }} style={{ marginBottom: '12px', overflow: 'hidden' }}>
                <div className="ds-form-panel" style={{ padding: '12px 16px', borderTop: '3px solid #f68d1f' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f68d1f' }}>VOICE MATCHED — REVIEW</span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={acceptAllPending} style={{ fontSize: '10px', fontWeight: '700', color: '#f68d1f', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>ACCEPT</button>
                      <button onClick={dismissPending} style={{ fontSize: '10px', fontWeight: '700', color: '#60619c', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>DISMISS</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <motion.button initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileTap={{ scale: 0.95 }} onClick={() => acceptPendingScore(myPlayerName)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 12px',
                        background: '#ffffff', border: '1px solid rgba(246, 141, 31, 0.3)',
                        cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#21242e',
                      }}>
                      <span>{myPlayerName}</span>
                      <span style={{ fontFamily: 'Arial, monospace', fontWeight: '900', color: '#f68d1f' }}>{pendingScores[myPlayerName]}</span>
                      <span style={{ fontSize: '14px', color: '#f68d1f' }}>✓</span>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unrecognized Names */}
          <AnimatePresence>
            {unrecognizedNames.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: '12px' }}>
                <div className="ds-form-panel" style={{ padding: '12px 16px', borderTop: '3px solid #ecab37', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ecab37', margin: '0 0 4px 0' }}>UNRECOGNIZED NAMES</p>
                    <p style={{ fontSize: '11px', color: '#3d4f97', margin: 0 }}>
                      Heard but couldn't match: <span style={{ fontWeight: '700', color: '#21242e' }}>{unrecognizedNames.join(', ')}</span>
                    </p>
                  </div>
                  <button onClick={() => setUnrecognizedNames([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60619c', padding: '4px', fontSize: '14px' }}>×</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Score Inputs + Coach — own score only */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
              {playerNames.map((player) => {
                const isMe = player === myPlayerName
                return (
                  <div key={player} className="ds-form-panel" style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', overflow: 'hidden',
                    borderLeft: isMe ? '3px solid #ecab37' : '3px solid transparent',
                    background: isMe ? 'rgba(236, 171, 55, 0.06)' : undefined,
                  }}>
                    <label style={{ flex: 1, fontWeight: '700', fontSize: '12px', color: isMe ? '#21242e' : '#60619c', paddingLeft: '4px', margin: 0 }}>
                      {player}
                      {isMe && <span style={{ fontSize: '9px', color: '#ecab37', marginLeft: '6px' }}>(YOU)</span>}
                    </label>
                    {isMe ? (
                      <input
                        type="number"
                        value={scores[player] ?? ''}
                        onChange={(e) => handleScoreChange(player, e.target.value)}
                        placeholder="0"
                        style={{
                          width: '100px', textAlign: 'center',
                          fontFamily: 'Arial, monospace', fontSize: '16px', fontWeight: '900',
                          background: '#ffffff', color: '#21242e',
                          border: '2px solid #ecab37', borderRadius: '2px',
                          padding: '8px', outline: 'none',
                        }}
                        autoFocus
                      />
                    ) : (
                      <span style={{
                        width: '100px', textAlign: 'center',
                        fontFamily: 'Arial, monospace', fontSize: '14px', fontWeight: '700',
                        color: '#60619c', padding: '8px',
                        background: '#f5f5f5', border: '1px solid #dedede', borderRadius: '2px',
                      }}>
                        {totalScores[player] || 0}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Coach */}
            <div style={{ width: '200px', flexShrink: 0 }}>
              <GameCoach comment={coachComment} emotion={coachEmotion} fadeAfterMs={5000} permanent isTyping={coachTyping} />
            </div>
          </div>

          {/* Action Area */}
          <div className="ds-form-panel" style={{ padding: '16px' }}>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => submitRound()}
              disabled={submitting || !myPlayerName}
              className="ds-btn-submit"
              style={{ width: '100%', marginBottom: '8px', padding: '16px 24px' }}
            >
              {submitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  SAVING ROUND...
                </span>
              ) : 'SUBMIT MY SCORE'}
            </motion.button>

            <AnimatePresence>
              {undoAvailable && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginBottom: '8px' }}>
                  <button onClick={undoLastRound} className="ds-btn-secondary" style={{ width: '100%', fontSize: '10px' }}>
                    ↩ UNDO ROUND {currentRound - 1}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ textAlign: 'center', paddingTop: '8px' }}>
              <button onClick={() => setShowEndConfirm(true)} style={{ background: 'none', border: 'none', color: '#e60012', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px', textDecoration: 'underline', textDecorationColor: 'rgba(230, 0, 18, 0.3)', textUnderlineOffset: '4px' }}>
                END GAME EARLY
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === MODALS === */}
      <Modal isOpen={showZeroConfirm} onClose={() => setShowZeroConfirm(false)} title="Empty Score">
        <p style={{ fontSize: '12px', color: '#3d4f97', marginBottom: '12px' }}>
          Your score will be recorded as <span style={{ fontWeight: '700', color: '#21242e', background: '#dedede', padding: '1px 6px' }}>0 points</span> this round.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowZeroConfirm(false)} className="ds-btn-secondary" style={{ flex: 1 }}>GO BACK</button>
          <button onClick={() => submitRound(true)} className="ds-btn-submit" style={{ flex: 1, background: '#e60012', borderBottomColor: 'rgba(0,0,0,0.3)' }}>CONFIRM ZERO</button>
        </div>
      </Modal>

      <ConfirmModal isOpen={showEndConfirm} onClose={() => setShowEndConfirm(false)} onConfirm={() => { setShowEndConfirm(false); setShowEndModal(true) }} title="End Game?" message="Are you sure you want to end this game early?" confirmText="END GAME" cancelText="KEEP PLAYING" />

      <Modal isOpen={showEndModal} onClose={() => setShowEndModal(false)} title="Game Over">
        {archiving ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <svg style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite', margin: '0 auto 12px', color: '#f68d1f' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#3d4f97', margin: 0 }}>TALLYING FINAL SCORES...</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '11px', color: '#3d4f97', marginBottom: '16px', textAlign: 'center' }}>WHAT'S NEXT?</p>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => handleEndGame('rematch')} className="ds-btn-submit" style={{ width: '100%', marginBottom: '8px', padding: '16px 24px' }}>
              🔄 REMATCH — KEEP ROSTER, RESET SCORES
            </motion.button>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => handleEndGame('end')} className="ds-btn-secondary" style={{ width: '100%' }}>
              🏁 VIEW PODIUM & FINAL RESULTS
            </motion.button>
          </>
        )}
      </Modal>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @media (max-width: 768px) {
          .point-entry-layout { flex-direction: column !important; }
          .pe-sidebar { width: 100% !important; min-height: auto !important; border-right: none !important; border-bottom: 3px solid rgba(0,0,0,0.3) !important; max-height: 200px; overflow-y: auto; }
          .pe-main { padding: 12px !important; }
        }
      `}</style>
    </motion.div>
  )
}

// Small copy button component
function CopyButton({ code }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <button onClick={handleCopy} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '9px', fontWeight: '700', color: copied ? '#15803d' : '#ecab37',
      textTransform: 'uppercase', letterSpacing: '0.5px', padding: '2px 4px',
    }}>
      {copied ? '✓ COPIED' : '📋 COPY'}
    </button>
  )
}
