import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../contexts/AuthContext'
import { useState } from 'react'
import { FireworksBackground } from '../components/FireworksBackground'
import { LoadingSkeleton } from '../components/LoadingSkeleton'

export function ResultsScreen() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState(null)
  const [totalScores, setTotalScores] = useState({})
  const [loading, setLoading] = useState(true)

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
        navigate('/name-input')
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
      setLoading(false)
    } catch (err) {
      console.error('Failed to load results:', err)
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
  const podiumDelay = { 1: 0.3, 2: 0.1, 3: 0.5 }

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
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: podiumDelay[player.rank], type: 'spring', stiffness: 200 }}
            >
              {/* Player info */}
              <div className="mb-2 text-center">
                {player.rank === 1 && (
                  <motion.div
                    className="text-3xl mb-1"
                    animate={{ y: [0, -5, 0], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    👑
                  </motion.div>
                )}
                {player.rank === 2 && <div className="text-xl mb-1">🥈</div>}
                {player.rank === 3 && <div className="text-xl mb-1">🥉</div>}
                <p className="font-bold text-warm-900 text-sm truncate max-w-[100px]">
                  {player.name}
                </p>
                <p className="font-mono font-extrabold text-lg text-primary-600">
                  {player.score}
                </p>
              </div>
              {/* Podium block */}
              <motion.div
                className={`w-full ${podiumHeights[player.rank]} ${podiumColors[player.rank]} rounded-t-xl`}
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                transition={{ delay: podiumDelay[player.rank] + 0.2, duration: 0.5, ease: 'easeOut' }}
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
                  <span className="flex-1 font-medium text-warm-900">{player.name}</span>
                  <span className="font-mono font-bold text-warm-700">{player.score}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* End Button */}
        <div className="flex justify-center">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/name-input')}
            className="btn-ghost border border-warm-200 px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            🏠 Back to Home
          </motion.button>
        </div>
      </div>
    </div>
  )
}