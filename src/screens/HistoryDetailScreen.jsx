import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { LoadingSkeleton } from '../components/LoadingSkeleton'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function HistoryDetailScreen() {
  const { gameId } = useParams()
  const { user, username } = useAuth()
  const navigate = useNavigate()
  const { showError } = useToast()
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGameDetail()
  }, [gameId])

  const loadGameDetail = async () => {
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE}/history/${username}/${gameId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 404) {
        navigate('/history')
        return
      }
      if (!res.ok) throw new Error('Failed to load game')
      const data = await res.json()
      setGame(data)
    } catch (err) {
      console.error('Game detail error:', err)
      showError('Failed to load game details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSkeleton />
  if (!game) return null

  const rounds = game.rounds || []
  const players = game.players || []
  const finalScores = game.final_scores || {}

  // Sort players by final score descending
  const sortedPlayers = [...players].sort((a, b) => (finalScores[b] || 0) - (finalScores[a] || 0))

  return (
    <div className="min-h-screen bg-warm-50 px-4 py-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/history', { replace: true })} className="btn-ghost text-sm p-2">
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-warm-900">Game Detail</h1>
            <p className="text-warm-500 text-xs">
              {game.played_at ? new Date(game.played_at).toLocaleDateString('en-US', {
                weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
              }) : ''}
            </p>
          </div>
        </div>

        {/* Winner Card */}
        {game.winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-4 mb-4 bg-primary-50 border-primary-200"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">👑</span>
              <div>
                <p className="text-xs text-primary-600 font-medium uppercase tracking-wider">Winner</p>
                <p className="text-lg font-bold text-primary-800">{game.winner}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-extrabold font-mono text-primary-700">
                  {finalScores[game.winner] || 0}
                </p>
                <p className="text-xs text-primary-500">points</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Final Standings */}
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-bold text-warm-500 uppercase tracking-wider mb-3">
            Final Standings
          </h3>
          <div className="space-y-2">
            {sortedPlayers.map((name, i) => (
              <div key={name} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                i === 0 ? 'bg-primary-50' : ''
              }`}>
                <span className={`w-7 text-center font-bold text-sm ${
                  i === 0 ? 'text-primary-600' : 'text-warm-400'
                }`}>
                  #{i + 1}
                </span>
                <span className="flex-1 font-medium text-warm-900">{name}</span>
                <span className={`font-mono font-bold ${
                  i === 0 ? 'text-primary-600' : 'text-warm-700'
                }`}>
                  {finalScores[name] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Round-by-Round Breakdown */}
        {rounds.length > 0 && (
          <div className="card p-4 overflow-x-auto">
            <h3 className="text-sm font-bold text-warm-500 uppercase tracking-wider mb-3">
              Round-by-Round
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-200">
                  <th className="text-left py-2 px-2 text-warm-500 font-medium">#</th>
                  {sortedPlayers.map(name => (
                    <th key={name} className="text-right py-2 px-2 text-warm-500 font-medium">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rounds.map((round, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-warm-100"
                  >
                    <td className="py-2 px-2 text-warm-400 font-mono text-xs">
                      {round.round_number || i + 1}
                    </td>
                    {sortedPlayers.map(name => (
                      <td key={name} className="py-2 px-2 text-right font-mono text-warm-700">
                        {round.scores?.[name] ?? 0}
                      </td>
                    ))}
                  </motion.tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-warm-300 font-bold">
                  <td className="py-2 px-2 text-warm-600">Σ</td>
                  {sortedPlayers.map(name => (
                    <td key={name} className={`py-2 px-2 text-right font-mono ${
                      name === game.winner ? 'text-primary-600' : 'text-warm-900'
                    }`}>
                      {finalScores[name] || 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Back Button */}
        <div className="flex justify-center mt-8">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/history')}
            className="btn-ghost border border-warm-200 px-8"
          >
            ← Back to History
          </motion.button>
        </div>
      </div>
    </div>
  )
}