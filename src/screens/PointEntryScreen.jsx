import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Modal, ConfirmModal } from '../components/Modal'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { GameCoach } from '../components/GameCoach'
import { useVoiceInput } from '../hooks/useVoiceInput'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function PointEntryScreen() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { user, username } = useAuth()
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

  const handleVoiceTranscript = useCallback(async (rawText) => {
    setIsVoiceActive(false)
    if (!rawText || !user) return

    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE}/parse-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: rawText, game_id: gameId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()

      let hasPopup = false
      if (data.matched && data.matched.length > 0) {
        const newPending = {}
        data.matched.forEach(m => {
          newPending[m.player] = m.score
        })
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

      if (data.errors && data.errors.length > 0) {
        data.errors.forEach(e => showError(e))
      }
    } catch (err) {
      showError(`Voice parse failed: ${err.message}`)
    }
  }, [user, gameId, showInfo, showError])

  const handleVoiceError = useCallback((err) => {
    setIsVoiceActive(false)
    if (err !== 'no-speech') {
      showError(`Voice error: ${err}`)
    }
  }, [showError])

  const { isListening, isSupported, transcript, startListening, stopListening } = useVoiceInput({
    onResult: handleVoiceTranscript,
    onError: handleVoiceError,
  })

  const toggleGlobalVoice = () => {
    if (isListening) {
      stopListening()
      setIsVoiceActive(false)
    } else {
      setIsVoiceActive(true)
      startListening()
    }
  }

  const acceptPendingScore = (player) => {
    const val = pendingScores[player]
    if (val !== undefined) {
      handleScoreChange(player, val.toString())
      setPendingScores(prev => {
        const next = { ...prev }
        delete next[player]
        if (Object.keys(next).length === 0) setPopupVisible(false)
        return next
      })
    }
  }

  const acceptAllPending = () => {
    Object.entries(pendingScores).forEach(([player, score]) => {
      handleScoreChange(player, score.toString())
    })
    setPendingScores({})
    setPopupVisible(false)
  }

  const dismissPending = () => {
    setPendingScores({})
    setUnrecognizedNames([])
    setPopupVisible(false)
  }

  // Voice popup stays until user dismisses (no auto-fade)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (roundHistory.length > 0 || Object.values(scores).some(v => v !== '' && v !== undefined)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [roundHistory, scores])

  useEffect(() => {
    if (isOnline && pendingQueue.current.length > 0) {
      const queue = [...pendingQueue.current]
      pendingQueue.current = []
      queue.forEach(fn => fn())
    }
  }, [isOnline])

  useEffect(() => {
    loadGame()
  }, [gameId])

  const loadGame = async () => {
    try {
      const gameDoc = await getDoc(doc(db, 'games', gameId))
      if (!gameDoc.exists()) {
        navigate('/name-input')
        return
      }
      const gameData = gameDoc.data()
      setGame(gameData)

      const initScores = {}
      const initTotals = {}
      gameData.players.forEach(p => {
        initScores[p] = ''
        initTotals[p] = 0
      })

      const roundsSnap = await getDocs(collection(db, 'games', gameId, 'rounds'))
      const rounds = []
      roundsSnap.forEach(d => {
        rounds.push({ id: d.id, ...d.data() })
      })
      rounds.sort((a, b) => parseInt(a.id) - parseInt(b.id))

      rounds.forEach(r => {
        Object.entries(r.scores).forEach(([player, score]) => {
          initTotals[player] = (initTotals[player] || 0) + score
        })
      })

      setRoundHistory(rounds)
      setTotalScores(initTotals)
      setScores(initScores)
      setCurrentRound(rounds.length + 1)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load game:', err)
      showError('Failed to load game')
      setLoading(false)
    }
  }

  const handleScoreChange = (player, value) => {
    if (value === '' || value === '-') {
      setScores(prev => ({ ...prev, [player]: value }))
      return
    }
    const num = parseInt(value)
    if (!isNaN(num)) {
      setScores(prev => ({ ...prev, [player]: num }))
    }
  }

  const submitRound = async (forceZeros = false) => {
    if (submitting) return

    const emptyPlayers = game.players.filter(p => scores[p] === '' || scores[p] === undefined)

    if (!forceZeros && emptyPlayers.length > 0) {
      setZeroPlayers(emptyPlayers)
      setShowZeroConfirm(true)
      return
    }

    setShowZeroConfirm(false)
    setSubmitting(true)

    const roundScores = {}
    game.players.forEach(p => {
      const val = scores[p]
      roundScores[p] = (val === '' || val === undefined) ? 0 : parseInt(val) || 0
    })

    const newTotals = { ...totalScores }
    Object.entries(roundScores).forEach(([p, s]) => {
      newTotals[p] = (newTotals[p] || 0) + s
    })
    setTotalScores(newTotals)

    const roundNum = currentRound.toString()
    const newRound = { scores: roundScores, submittedAt: new Date().toISOString() }
    setRoundHistory(prev => [...prev, { id: roundNum, ...newRound }])
    setCurrentRound(prev => prev + 1)

    const resetScores = {}
    game.players.forEach(p => resetScores[p] = '')
    setScores(resetScores)

    const writeRound = async () => {
      try {
        await setDoc(doc(db, 'games', gameId, 'rounds', roundNum), {
          ...newRound,
          submittedAt: serverTimestamp()
        })
      } catch (err) {
        console.error('Failed to write round:', err)
        showError('Failed to save round. Retrying…', {
          label: 'Retry',
          action: writeRound
        })
        pendingQueue.current.push(writeRound)
      }
    }

    const token = await user.getIdToken()

    // Fire coach-comment in PARALLEL with round write (not after awaiting it)
    const newTotalsForCoach = { ...newTotals }
    setCoachTyping(true)
    const coachPromise = fetch(`${API_BASE}/coach-comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        game_id: gameId,
        round_number: parseInt(roundNum),
        scores: roundScores,
        totals: newTotalsForCoach,
      }),
      signal: AbortSignal.timeout(4000),
    })
      .then(r => r.json())
      .then(data => {
        if (data.comment) {
          setCoachComment(data.comment)
          setCoachEmotion(data.emotion || 'default')
        }
        setCoachTyping(false)
      })
      .catch(() => {
        setCoachTyping(false)
      })

    await writeRound()
    setSubmitting(false)

    // Ensure typing indicator is off if coach finishes after round write
    coachPromise.catch(() => {})

    setUndoAvailable(true)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setUndoAvailable(false), 10000)

    if (game.roundLength && parseInt(roundNum) >= game.roundLength) {
      const savedId = await archiveGame()
      if (savedId) {
        navigate(`/results/${savedId || gameId}`)
      }
    }
  }

  const undoLastRound = async () => {
    if (!undoAvailable || roundHistory.length === 0) return

    const lastRound = roundHistory[roundHistory.length - 1]
    const newTotals = { ...totalScores }
    Object.entries(lastRound.scores).forEach(([p, s]) => {
      newTotals[p] = (newTotals[p] || 0) - s
    })

    setTotalScores(newTotals)
    setRoundHistory(prev => prev.slice(0, -1))
    setCurrentRound(prev => prev - 1)
    setUndoAvailable(false)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

    try {
      await deleteDoc(doc(db, 'games', gameId, 'rounds', lastRound.id))
      showInfo('Round undone')
    } catch (err) {
      console.error('Failed to undo round:', err)
      showError('Failed to undo round')
    }
  }

  const archiveGame = async () => {
    setArchiving(true)
    try {
      const token = await user.getIdToken()
      const response = await fetch(`${API_BASE}/games/${gameId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          players: game.players,
          rounds: roundHistory.map((r, i) => ({
            round_number: i + 1,
            scores: r.scores,
          })),
          final_scores: totalScores,
          winner: getSortedPlayers()[0]?.name || '',
        }),
      })
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        const msg = errBody.detail || errBody.error || `Server error ${response.status}`
        throw new Error(msg)
      }
      const data = await response.json()
      setArchivedGameId(data.id || gameId)
      return data.id || gameId
    } catch (err) {
      console.error('Archive failed:', err)
      showError(`Archive failed: ${err.message}`)
      return null
    } finally {
      setArchiving(false)
    }
  }

  const handleEndGame = async (action) => {
    setShowEndModal(false)

    if (action === 'rematch') {
      const savedId = await archiveGame()
      const resetTotals = {}
      const resetScores = {}
      game.players.forEach(p => {
        resetTotals[p] = 0
        resetScores[p] = ''
      })

      const roundsSnap = await getDocs(collection(db, 'games', gameId, 'rounds'))
      const deletePromises = []
      roundsSnap.forEach(d => {
        deletePromises.push(deleteDoc(doc(db, 'games', gameId, 'rounds', d.id)))
      })
      await Promise.all(deletePromises)

      await updateDoc(doc(db, 'games', gameId), { currentRound: 1 })

      setTotalScores(resetTotals)
      setScores(resetScores)
      setRoundHistory([])
      setCurrentRound(1)
      setUndoAvailable(false)
      setArchivedGameId(null)
      showSuccess('Rematch! Scores reset.')
    } else {
      const savedId = await archiveGame()
      if (savedId) {
        navigate(`/results/${savedId || gameId}`)
      }
    }
  }

  const getSortedPlayers = useCallback(() => {
    if (!game) return []
    return game.players
      .map(name => ({ name, score: totalScores[name] || 0 }))
      .sort((a, b) => b.score - a.score)
  }, [game, totalScores])

  if (loading) return <LoadingSkeleton />

  const sorted = getSortedPlayers()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-bg-primary flex flex-col lg:flex-row relative"
    >
      {/* Sidebar Leaderboard */}
      <div className="lg:w-80 lg:min-h-screen bg-bg-elevated border-b lg:border-b-0 lg:border-r border-ui-border p-5 lg:p-6 shadow-sm z-10 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-label">Leaderboard</h2>
          {game?.roundLength && (
            <span className="text-xs font-mono font-bold text-accent-primary bg-accent-primary/10 px-2.5 py-1 rounded-full border border-accent-primary/20 shadow-sm">
              R{currentRound - 1}/{game.roundLength}
            </span>
          )}
        </div>
        <div className="flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 hide-scrollbar flex-1">
          <AnimatePresence mode="popLayout">
            {sorted.map((player, i) => {
              const isTied = i > 0 && player.score === sorted[i - 1].score
              const isLeader = i === 0 && !isTied
              return (
                <motion.div
                  key={player.name}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl min-w-[160px] lg:min-w-0 transition-all shadow-sm ${
                    isLeader
                      ? 'bg-accent-primary/10 border border-accent-primary/30 ring-1 ring-accent-primary/10'
                      : isTied
                        ? 'bg-bg-primary border border-dashed border-ui-border opacity-90'
                        : 'bg-bg-primary border border-transparent hover:border-ui-border'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ${
                    isLeader ? 'bg-accent-primary text-white' : 'bg-bg-secondary text-text-muted border border-ui-border'
                  }`}>
                    {isLeader ? '👑' : `#${i + 1}`}
                  </span>
                  <span className={`flex-1 font-medium text-base truncate ${
                    isLeader ? 'text-text-primary font-bold' : 'text-text-secondary'
                  }`}>
                    {player.name}
                    {isTied && (
                      <span className="ml-2 text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded-md align-middle uppercase tracking-wide border border-accent-primary/20">
                        Tie
                      </span>
                    )}
                  </span>
                  <span className={`font-mono font-bold tabular-nums ${
                    isLeader ? 'text-accent-primary text-xl' : 'text-text-secondary text-lg'
                  }`}>
                    {player.score}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 lg:p-8 relative overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {/* Round Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <motion.h1
                key={currentRound}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-display-md text-text-primary"
              >
                Round {currentRound}
              </motion.h1>
              <p className="text-text-secondary text-sm font-medium">Record scores for this round</p>
            </div>
            <div className="flex items-center gap-3">
              {!isOnline && (
                <span className="px-3 py-1 bg-status-warning/10 text-status-warning text-xs rounded-full font-bold border border-status-warning/20 shadow-sm">
                  Offline
                </span>
              )}
            </div>
          </div>

          {/* Voice Input Bar */}
          {isSupported && (
            <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl bg-bg-elevated border border-ui-border shadow-sm">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleGlobalVoice}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 shadow-md ${
                  isListening
                    ? 'bg-status-error text-white shadow-status-error/30 ring-4 ring-status-error/20'
                    : 'bg-bg-primary text-text-muted hover:text-accent-primary border-2 border-ui-border hover:border-accent-primary'
                }`}
                title={isListening ? 'Stop listening' : 'Speak all scores'}
              >
                {isListening ? (
                  <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                  </svg>
                )}
              </motion.button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {isListening ? (
                    <span className="text-status-error font-bold">Listening... Speak player names and scores</span>
                  ) : (
                    <span className="text-text-secondary">Tap mic, say names + scores (e.g. "Alice 25, Bob 30")</span>
                  )}
                </p>
                <AnimatePresence>
                  {isListening && transcript && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-xs text-text-muted italic mt-1 truncate"
                    >
                      "{transcript}"
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Pending Voice Scores */}
          <AnimatePresence>
            {Object.keys(pendingScores).length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                className="mb-6 overflow-hidden"
              >
                <div className="p-4 rounded-2xl border-2 border-accent-primary/40 bg-accent-primary/5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="section-label text-accent-primary">Voice Matched — Review</span>
                    <div className="flex gap-3">
                      <button
                        onClick={acceptAllPending}
                        className="text-xs font-bold text-accent-primary hover:text-accent-secondary transition-colors"
                      >
                        Accept All
                      </button>
                      <button
                        onClick={dismissPending}
                        className="text-xs font-semibold text-text-muted hover:text-text-primary transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {Object.entries(pendingScores).map(([player, score]) => (
                      <motion.button
                        key={player}
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => acceptPendingScore(player)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-elevated border border-accent-primary/30 text-text-primary text-sm font-medium hover:border-accent-primary shadow-sm transition-colors group"
                        title={`Click to accept ${score} for ${player}`}
                      >
                        <span>{player}</span>
                        <span className="font-mono font-bold text-accent-primary">{score}</span>
                        <span className="w-5 h-5 rounded-md bg-accent-primary/10 flex items-center justify-center group-hover:bg-accent-primary group-hover:text-white transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unrecognized Names Warning */}
          <AnimatePresence>
            {unrecognizedNames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <div className="p-4 rounded-2xl border border-status-warning/40 bg-status-warning/10 shadow-sm flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-status-warning mb-1">Unrecognized Names</p>
                    <p className="text-sm text-text-secondary">
                      Heard but couldn't match:{' '}
                      <span className="font-semibold text-text-primary">{unrecognizedNames.join(', ')}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setUnrecognizedNames([])}
                    className="p-1 text-text-muted hover:text-text-primary transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Score Inputs + Coach Layout */}
          <div className="space-y-4 mb-8 lg:flex lg:items-start lg:gap-8 lg:space-y-0">
            {/* Inputs Column */}
            <div className="lg:flex-1 min-w-0 flex flex-col gap-3">
              {game.players.map((player) => (
                <div key={player} className="card p-4 flex items-center gap-4 relative overflow-hidden group">
                  {/* Focus indicator bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-accent-primary opacity-0 group-focus-within:opacity-100 transition-opacity" />

                  <label className="flex-1 font-bold text-text-primary text-base pl-2">{player}</label>

                  {pendingScores[player] !== undefined && (
                    <span className="text-[10px] bg-accent-primary/10 text-accent-primary px-2 py-1 rounded-md font-bold uppercase tracking-wider border border-accent-primary/20">
                      Pending
                    </span>
                  )}

                  <div className="relative">
                    <input
                      type="number"
                      value={scores[player] ?? ''}
                      onChange={(e) => handleScoreChange(player, e.target.value)}
                      placeholder="0"
                      className="input-field w-28 text-center text-xl font-mono font-bold py-3 pr-4"
                    />
                    {scores[player] !== '' && scores[player] !== undefined && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-bold">
                        pts
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Coach Column */}
            <div className="lg:w-64 lg:flex-none lg:sticky lg:top-8 hidden lg:block">
              <GameCoach
                comment={coachComment}
                emotion={coachEmotion}
                fadeAfterMs={5000}
                permanent
                isTyping={coachTyping}
              />
            </div>
          </div>

          {/* Mobile coach */}
          <div className="lg:hidden mb-8">
            <GameCoach
              comment={coachComment}
              emotion={coachEmotion}
              fadeAfterMs={5000}
              permanent
              isTyping={coachTyping}
            />
          </div>

          {/* Action Area */}
          <div className="bg-bg-elevated p-6 rounded-3xl border border-ui-border shadow-elevated">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => submitRound()}
              disabled={submitting}
              className="btn-primary w-full mb-4 py-4 text-lg font-display shadow-md"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Saving Round...
                </span>
              ) : 'Submit Scores'}
            </motion.button>

            {/* Undo */}
            <AnimatePresence>
              {undoAvailable && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <button
                    onClick={undoLastRound}
                    className="w-full py-3 flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary font-medium transition-colors bg-bg-secondary rounded-xl border border-ui-border hover:border-text-muted mb-4"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Undo Round {currentRound - 1}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-center pt-2">
              <button
                onClick={() => setShowEndConfirm(true)}
                className="text-status-error hover:text-red-700 font-semibold text-sm underline underline-offset-4 decoration-status-error/30 hover:decoration-status-error transition-colors"
              >
                End Game Early
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals remain mostly the same structurally but will pick up global theme vars */}
      {/* Zero Confirmation Modal */}
      <Modal
        isOpen={showZeroConfirm}
        onClose={() => setShowZeroConfirm(false)}
        title="Empty Scores"
      >
        <p className="text-text-secondary text-sm mb-4 leading-relaxed">
          The following players will receive <span className="font-bold text-text-primary bg-bg-secondary px-1.5 py-0.5 rounded">0 points</span> for this round:
        </p>
        <ul className="mb-6 space-y-2 bg-bg-secondary p-4 rounded-xl border border-ui-border">
          {zeroPlayers.map(p => (
            <li key={p} className="text-text-primary font-bold text-base flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-status-error shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              {p}
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button onClick={() => setShowZeroConfirm(false)} className="btn-secondary flex-1 py-3.5">
            Go Back
          </button>
          <button onClick={() => submitRound(true)} className="btn-primary flex-1 py-3.5 bg-status-error hover:bg-status-error/90 focus:ring-status-error">
            Confirm Zeros
          </button>
        </div>
      </Modal>

      {/* Confirm: End Game */}
      <ConfirmModal
        isOpen={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        onConfirm={() => { setShowEndConfirm(false); setShowEndModal(true) }}
        title="End Game?"
        message="Are you sure you want to end this game early? You can choose to Rematch or see the Final Results next."
        confirmText="End Game"
        cancelText="Keep Playing"
      />

      {/* End Game Modal */}
      <Modal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title="Game Over"
      >
        {archiving ? (
          <div className="text-center py-8">
            <svg className="w-10 h-10 animate-spin mx-auto text-accent-primary mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <p className="text-text-secondary font-medium">Tallying final scores...</p>
          </div>
        ) : (
          <>
            <p className="text-text-secondary text-sm mb-6 text-center">What's next for this group?</p>
            <div className="space-y-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEndGame('rematch')}
                className="btn-primary w-full flex flex-col items-center justify-center gap-1 py-4 h-auto shadow-md"
              >
                <div className="flex items-center gap-2 text-lg">
                  <span className="text-xl">🔄</span> Rematch
                </div>
                <span className="text-xs font-normal opacity-80">Keep roster, reset scores to zero</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEndGame('end')}
                className="btn-secondary w-full py-4 text-text-primary border-2 border-ui-border hover:border-text-muted"
              >
                🏁 View Podium & Final Results
              </motion.button>
            </div>
          </>
        )}
      </Modal>
    </motion.div>
  )
}
