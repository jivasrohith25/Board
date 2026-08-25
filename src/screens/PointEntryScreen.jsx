import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Modal } from '../components/Modal'
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

      // Pre-fill matched scores in PENDING state
      let hasPopup = false
      if (data.matched && data.matched.length > 0) {
        const newPending = {}
        data.matched.forEach(m => {
          newPending[m.player] = m.score
        })
        setPendingScores(prev => ({ ...prev, ...newPending }))
        hasPopup = true
        showInfo(`Voice matched ${data.matched.length} player(s) — review below`)
      } else {
        showError('No player names recognized in speech')
      }

      // Show unrecognized names warning
      if (data.unrecognized_names && data.unrecognized_names.length > 0) {
        setUnrecognizedNames(data.unrecognized_names)
        hasPopup = true
      } else {
        setUnrecognizedNames([])
      }

      // Trigger auto-fade timer
      if (hasPopup) setPopupVisible(true)

      // Show errors
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

  // Accept a pending voice score into the real scores
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

  // Accept all pending scores
  const acceptAllPending = () => {
    Object.entries(pendingScores).forEach(([player, score]) => {
      handleScoreChange(player, score.toString())
    })
    setPendingScores({})
    setPopupVisible(false)
  }

  // Dismiss pending scores
  const dismissPending = () => {
    setPendingScores({})
    setUnrecognizedNames([])
    setPopupVisible(false)
  }

  // Auto-fade voice popups after 3 seconds
  useEffect(() => {
    if (!popupVisible) return
    const timer = setTimeout(() => {
      setPendingScores({})
      setUnrecognizedNames([])
      setPopupVisible(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [popupVisible])

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

  // Warn before unload if game has data
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

    // Optimistic update
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

    await writeRound()
    setSubmitting(false)

    // Fire-and-forget coach comment (non-blocking)
    const newTotalsForCoach = { ...newTotals }
    fetch(`${API_BASE}/coach-comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`,
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
          // Determine emotion
          if (data.favorite_player && roundScores[data.favorite_player] !== undefined) {
            const favScore = roundScores[data.favorite_player]
            const maxRoundScore = Math.max(...Object.values(roundScores))
            setCoachEmotion(favScore === maxRoundScore ? 'happy' : 'default')
          } else {
            setCoachEmotion('laugh')
          }
        }
      })
      .catch(() => {}) // silently drop errors

    // Undo window
    setUndoAvailable(true)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setUndoAvailable(false), 10000)

    // Auto-transition to results if round limit reached
    // roundNum is the round we just submitted (1-indexed string)
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
      // Reset scores
      const resetTotals = {}
      const resetScores = {}
      game.players.forEach(p => {
        resetTotals[p] = 0
        resetScores[p] = ''
      })

      // Delete all rounds
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
    <div className="min-h-screen bg-warm-50 flex flex-col lg:flex-row">
      {/* Sidebar Leaderboard */}
      <div className="lg:w-72 lg:min-h-screen bg-white border-b lg:border-b-0 lg:border-r border-warm-100 p-4">
        <h2 className="text-sm font-bold text-warm-500 uppercase tracking-wider mb-3">
          Leaderboard
        </h2>
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
          <AnimatePresence mode="popLayout">
            {sorted.map((player, i) => {
              const isTied = i > 0 && player.score === sorted[i - 1].score
              return (
                <motion.div
                  key={player.name}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl min-w-[140px] lg:min-w-0 ${
                    i === 0 && !isTied ? 'bg-primary-50 border border-primary-200' : 'bg-warm-50'
                  } ${isTied ? 'border border-dashed border-primary-300 bg-primary-50/50' : ''}`}
                >
                  <span className={`text-sm font-bold w-6 text-center ${
                    i === 0 && !isTied ? 'text-primary-600' : 'text-warm-400'
                  }`}>
                    {i === 0 && !isTied ? '👑' : `#${i + 1}`}
                  </span>
                  <span className="flex-1 font-medium text-warm-900 text-sm truncate">
                    {player.name}
                    {isTied && (
                      <span className="ml-1.5 text-[10px] font-bold text-primary-500 bg-primary-100 px-1.5 py-0.5 rounded-full align-middle">
                        TIE
                      </span>
                    )}
                  </span>
                  <span className={`font-bold font-mono text-lg ${
                    i === 0 && !isTied ? 'text-primary-600' : 'text-warm-700'
                  }`}>
                    {player.score}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-8">
        <div className="max-w-lg mx-auto">
          {/* Round Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-warm-900">Round {currentRound}</h1>
              <p className="text-warm-500 text-sm">Enter scores for each player</p>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                  Offline
                </span>
              )}
            </div>
          </div>

          {/* Voice Input Bar */}
          {isSupported && (
            <div className="flex items-center gap-3 mb-4">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleGlobalVoice}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isListening
                    ? 'bg-danger-500 text-white shadow-lg shadow-danger-500/30'
                    : 'bg-warm-100 text-warm-500 hover:bg-warm-200 hover:text-warm-700'
                }`}
                title={isListening ? 'Stop listening' : 'Speak all scores'}
              >
                {isListening ? (
                  <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                  </svg>
                )}
              </motion.button>
              <div className="flex-1">
                <p className="text-sm text-warm-500">
                  {isListening ? (
                    <span className="text-danger-600 font-medium">Listening… speak player names and scores</span>
                  ) : (
                    'Tap mic, then say names + scores (e.g. "Alice 25, Bob 30")'
                  )}
                </p>
                {isListening && transcript && (
                  <p className="text-xs text-warm-400 italic mt-0.5">"{transcript}"</p>
                )}
              </div>
            </div>
          )}

          {/* Pending Voice Scores */}
          <AnimatePresence>
            {Object.keys(pendingScores).length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="card p-3 border-primary-200 bg-primary-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">
                      Voice Matched — Review
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={acceptAllPending}
                        className="text-xs font-medium text-primary-600 hover:text-primary-800 underline"
                      >
                        Accept All
                      </button>
                      <button
                        onClick={dismissPending}
                        className="text-xs font-medium text-warm-400 hover:text-warm-600 underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(pendingScores).map(([player, score]) => (
                      <motion.button
                        key={player}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => acceptPendingScore(player)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 border border-primary-300 text-primary-800 text-sm font-medium hover:bg-primary-200 transition-colors"
                        title={`Click to accept ${score} for ${player}`}
                      >
                        <span>{player}</span>
                        <span className="font-mono font-bold">{score}</span>
                        <svg className="w-3 h-3 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.button>
                    ))}
                  </div>
                  <p className="text-xs text-primary-600 mt-2">
                    Click a chip to accept, or "Accept All"
                  </p>
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
                className="mb-4"
              >
                <div className="card p-3 border-yellow-200 bg-yellow-50">
                  <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">
                    ⚠ Unrecognized Names
                  </p>
                  <p className="text-sm text-yellow-800">
                    Heard these names but couldn't match them to players:{' '}
                    <span className="font-semibold">
                      {unrecognizedNames.join(', ')}
                    </span>
                  </p>
                  <button
                    onClick={() => setUnrecognizedNames([])}
                    className="text-xs text-yellow-600 hover:text-yellow-800 underline mt-1"
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Score Inputs */}
          <div className="space-y-3 mb-2">
            {game.players.map(player => (
              <div key={player} className="card p-4">
                <div className="flex items-center gap-3">
                  <label className="flex-1 font-medium text-warm-900">{player}</label>
                  {pendingScores[player] !== undefined && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                      PENDING
                    </span>
                  )}
                  <input
                    type="number"
                    value={scores[player] ?? ''}
                    onChange={(e) => handleScoreChange(player, e.target.value)}
                    placeholder="0"
                    className="input-field w-24 text-center text-lg font-mono font-bold"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Submit Round */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => submitRound()}
            disabled={submitting}
            className="btn-primary w-full mb-3"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Submitting…
              </span>
            ) : 'Submit Round'}
          </motion.button>

          {/* Undo */}
          <AnimatePresence>
            {undoAvailable && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-center mb-4"
              >
                <button
                  onClick={undoLastRound}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium underline transition-colors"
                >
                  Undo last round
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* End Game Button */}
          <div className="flex justify-center mt-8">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowEndModal(true)}
              className="btn-ghost text-danger-600 hover:bg-danger-50 border border-danger-200 px-6"
            >
              End Game
            </motion.button>
          </div>
        </div>
      </div>

      {/* Zero Confirmation Modal */}
      <Modal
        isOpen={showZeroConfirm}
        onClose={() => setShowZeroConfirm(false)}
        title="Empty Scores"
      >
        <p className="text-warm-600 text-sm mb-2">
          These players will be scored <span className="font-bold">0</span> for this round:
        </p>
        <ul className="mb-4 space-y-1">
          {zeroPlayers.map(p => (
            <li key={p} className="text-warm-800 font-medium text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger-400" />
              {p}
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button onClick={() => setShowZeroConfirm(false)} className="btn-secondary flex-1">
            Go Back
          </button>
          <button onClick={() => submitRound(true)} className="btn-primary flex-1">
            Confirm
          </button>
        </div>
      </Modal>

      {/* Coach */}
      <div className="fixed bottom-4 left-4 z-30">
        <GameCoach comment={coachComment} emotion={coachEmotion} fadeAfterMs={5000} />
      </div>

      {/* End Game Modal */}
      <Modal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title="End Game"
      >
        {archiving ? (
          <div className="text-center py-4">
            <svg className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <p className="text-warm-600 text-sm">Saving your game…</p>
          </div>
        ) : (
          <>
            <p className="text-warm-600 text-sm mb-4">What would you like to do?</p>
            <div className="space-y-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleEndGame('rematch')}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                🔄 Rematch
                <span className="text-xs opacity-75">(same players, reset scores)</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleEndGame('end')}
                className="btn-ghost w-full border border-warm-200 text-danger-600"
              >
                🏁 End &amp; See Results
              </motion.button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}