import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Modal } from '../components/Modal'
import { LoadingSkeleton } from '../components/LoadingSkeleton'

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
  const undoTimerRef = useRef(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const pendingQueue = useRef([])

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

    // Undo window
    setUndoAvailable(true)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setUndoAvailable(false), 10000)
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
      const response = await fetch(`${API_BASE}/archive-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gameId,
          username,
          players: game.players,
          rounds: roundHistory.map(r => r.scores),
          finalScores: totalScores,
          winner: getSortedPlayers()[0]?.name || '',
        }),
      })
      if (!response.ok) throw new Error('Archive failed')
      return true
    } catch (err) {
      console.error('Archive failed:', err)
      showError('Failed to archive game')
      return false
    } finally {
      setArchiving(false)
    }
  }

  const handleEndGame = async (action) => {
    setShowEndModal(false)

    if (action === 'rematch') {
      await archiveGame()
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
      showSuccess('Rematch! Scores reset.')
    } else {
      const archived = await archiveGame()
      if (archived) {
        navigate(`/results/${gameId}`)
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
            {sorted.map((player, i) => (
              <motion.div
                key={player.name}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl min-w-[140px] lg:min-w-0 ${
                  i === 0 ? 'bg-primary-50 border border-primary-200' : 'bg-warm-50'
                }`}
              >
                <span className={`text-sm font-bold w-6 text-center ${
                  i === 0 ? 'text-primary-600' : 'text-warm-400'
                }`}>
                  {i === 0 ? '👑' : `#${i + 1}`}
                </span>
                <span className="flex-1 font-medium text-warm-900 text-sm truncate">
                  {player.name}
                </span>
                <span className={`font-bold font-mono text-lg ${
                  i === 0 ? 'text-primary-600' : 'text-warm-700'
                }`}>
                  {player.score}
                </span>
              </motion.div>
            ))}
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
            {!isOnline && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                Offline
              </span>
            )}
          </div>

          {/* Score Inputs */}
          <div className="space-y-3 mb-6">
            {game.players.map(player => (
              <div key={player} className="card p-4">
                <div className="flex items-center gap-4">
                  <label className="flex-1 font-medium text-warm-900">{player}</label>
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