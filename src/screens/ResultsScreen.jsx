import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../contexts/AuthContext'
import { useAuth } from '../contexts/AuthContext'
import { FireworksBackground } from '../components/FireworksBackground'
import { LoadingSkeleton } from '../components/LoadingSkeleton'

const API_BASE = import.meta.env.VITE_API_URL || ''

function PlayerAvatar({ name, size = 'md' }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }
  return (
    <div className={`${sizes[size]} rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center`}>
      {initials}
    </div>
  )
}

export function ResultsScreen() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, username } = useAuth()
  const [game, setGame] = useState(null)
  const [totalScores, setTotalScores] = useState({})
  const [loading, setLoading] = useState(true)
  const [archivedGameId, setArchivedGameId] = useState(null)
  const [archiving, setArchiving] = useState(true)

  // Get archivedGameId from navigation state or URL
  useEffect(() => {
    if (location.state?.archivedGameId) {
      setArchivedGameId(location.state.archivedGameId)
      setArchiving(false)
    }
  }, [location.state])

  useEffect(() => {
    loadGame()
  }, [gameId])

  useEffect(() => {
    if (!loading && game) {
      // Confetti burst
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#f19b4a', '#ed8027', '#e06416', '#ef4444', '#34d399', '#60a5fa'],
      })
      // Follow-up bursts
      setTimeout(() => {
        confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } })
        confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } })
      }, 300)
    }
  }, [loading, game])

  const loadGame = async () => {
    try {
      const gameDoc = await getDoc(doc(db, 'games', gameId))
      if (!gameDoc.exists()) {
        // Game might have been archived, try to use archivedGameId from state
        if (location.state?.archivedGameId) {
          setArchivedGameId(location.state.archivedGameId)
          setArchiving(false)
        } else {
          // Try loading from history API
          try {
            const token = await user.getIdToken()
            const res = await fetch(`${API_BASE}/history/${username}/${gameId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
              const data = await res.json()
              setGame({ players: data.players })
              const totals = {}
              data.players.forEach(p => totals[p] = 0)
              if (data.rounds) {
                data.rounds.forEach(r => {
                  Object.entries(r.scores || {}).forEach(([p, s]) => {
                    totals[p] = (totals[p] || 0) + s
                  })
                })
              }
              if (data.final_scores) {
                Object.assign(totals, data.final_scores)
              }
              setTotalScores(totals)
              setArchivedGameId(gameId)
              setArchiving(false)
              setLoading(false)
              return
            }
          } catch {}
          navigate('/name-input')
        }
        setLoading(false)
        return
      }
      const gameData = gameDoc.data()
      setGame(gameData)

      const roundsSnap = await getDocs(collection(db, 'games', gameId, 'rounds'))
      const totals = {}
      gameData.players.forEach(p => totals[p] = 0)
      roundsSnap.forEach(d => {
        const r = d.data()
        Object.entries(r.scores).forEach(([p, s]) => {
          totals[p] = (totals[p] || 0) + s
        })
      })

      setTotalScores(totals)
      setArchivedGameId(gameId)
      setArchiving(false)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load results:', err)
      setArchiving(false)
      setLoading(false)
    }
  }

  const sortedPlayers = useMemo(() => {
    if (!game) return []
    return game.players
      .map(name => ({ name, score: totalScores[name] || 0 }))
      .sort((a, b) => b.score - a.score)
  }, [game, totalScores])

  if (loading) return <LoadingSkeleton />

  const top3 = sortedPlayers.slice(0, 3)
  const rest = sortedPlayers.slice(3)

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = []
  if (top3[1]) podiumOrder.push({ ...top3[1], rank: 2 })
  if (top3[0]) podiumOrder.push({ ...top3[0], rank: 1 })
  if (top3[2]) podiumOrder.push({ ...top3[2], rank: 3 })

  const podiumHeights = { 1: 'h-36', 2: 'h-24', 3: 'h-16' }
  const podiumColors = { 1: 'bg-primary-500', 2: 'bg-primary-300', 3: 'bg-primary-200' }
  // Stagger: 3rd first, then 2nd, then 1st with bounce
  const podiumDelay = { 1: 0.4, 2: 0.2, 3: 0.0 }
  const podiumBounce = { 1: { type: 'spring', stiffness: 200, damping: 12 }, 2: { type: 'spring', stiffness: 300, damping: 20 }, 3: { type: 'spring', stiffness: 400, damping: 25 } }

  return (
    <div className="min-h-screen bg-warm-50 relative overflow-hidden">
      <FireworksBackground />

      <div className="relative z-10 px-4 py-8 max-w-lg mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-3xl font-extrabold text-warm-900 mb-1">🏆 Game Over!</h1>
          <p className="text-warm-500">Here are the final standings</p>
        </motion.div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-3 mb-8 px-4">
          {podiumOrder.map(player => (
            <motion.div
              key={player.name}
              className="flex flex-col items-center flex-1 max-w-[120px]"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: podiumDelay[player.rank], ...podiumBounce[player.rank] }}
            >
              {/* Player info */}
              <div className="mb-2 text-center">
                {player.rank === 1 && (
                  <motion.div
                    className="text-4xl mb-1"
                    animate={{ y: [0, -5, 0], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    👑
                  </motion.div>
                )}
                {player.rank === 2 && <div className="text-xl mb-1">🥈</div>}
                {player.rank === 3 && <div className="text-xl mb-1">🥉</div>}

                <PlayerAvatar name={player.name} size={player.rank === 1 ? 'lg' : 'md'} />

                <p className="font-bold text-warm-900 text-sm truncate max-w-[100px] mt-1">
                  {player.name}
                </p>
                <p className="font-mono font-extrabold text-lg text-primary-600">
                  {player.score}
                </p>
              </div>
              {/* Podium block */}
              <motion.div
                className={`w-full ${podiumHeights[player.rank]} ${podiumColors[player.rank]} rounded-t-xl ${
                  player.rank === 1 ? 'shadow-lg shadow-primary-300/40' : ''
                }`}
                initial={{ height: 0 }}
                animate={{
                  height: 'auto',
                  boxShadow: player.rank === 1
                    ? ['0 0 0px 0px rgba(237,128,39,0)', '0 0 20px 4px rgba(237,128,39,0.3)', '0 0 0px 0px rgba(237,128,39,0)']
                    : undefined,
                }}
                transition={{
                  height: { delay: podiumDelay[player.rank] + 0.1, duration: 0.5, ease: 'easeOut' },
                  boxShadow: player.rank === 1
                    ? { delay: 1, duration: 2, repeat: Infinity, ease: 'easeInOut' }
                    : undefined,
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Remaining Players */}
        {rest.length > 0 && (
          <motion.div
            className="card p-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-sm font-bold text-warm-500 uppercase tracking-wider mb-3">
              Other Players
            </h3>
            <div className="space-y-2">
              {rest.map((player, i) => (
                <div key={player.name} className="flex items-center gap-3 py-2">
                  <span className="w-8 text-center text-warm-400 font-bold text-sm">
                    #{i + 4}
                  </span>
                  <PlayerAvatar name={player.name} size="sm" />
                  <span className="flex-1 font-medium text-warm-900">{player.name}</span>
                  <span className="font-mono font-bold text-warm-700">{player.score}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          className="flex items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/name-input')}
            className="btn-ghost border border-warm-200 px-8"
          >
            🏠 Back to Home
          </motion.button>

          {/* Clock-rewind icon to history detail */}
          {archivedGameId && !archiving && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/history/${archivedGameId}`)}
              className="w-10 h-10 rounded-full bg-warm-100 hover:bg-warm-200 flex items-center justify-center transition-colors"
              title="View game in history"
            >
              <svg className="w-5 h-5 text-warm-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </motion.button>
          )}
          {archiving && (
            <div className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-warm-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}