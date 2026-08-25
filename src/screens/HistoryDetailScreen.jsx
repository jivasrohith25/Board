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

  const sortedPlayers = [...players].sort((a, b) => (finalScores[b] || 0) - (finalScores[a] || 0))

  return (
    <div className="min-h-screen bg-warm-50 px-4 py-5">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/history', { replace: true })} className="btn-ghost text-sm p-2">
            ←
          </button>
          <div>
            <h1 className="font-display text-display-sm text-warm-900">Game Detail</h1>
            <p className="text-warm-400 text-xs font-medium">
              {game.played_at ? new Date(game.played_at).toLocaleDateString('en-US', {
                weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
              }) : ''}
            </p>
          </div>
        </div>

        {/* Winner Card */}
        {game.winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 mb-3 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200/60"
            style={{ boxShadow: '0 4px 12px rgba(237, 128, 39, 0.10)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center">
                <span className="text-2xl">👑</span>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-primary-500 font-semibold uppercase tracking-wider">Winner</p>
                <p className="font-display font-bold text-primary-800 text-lg leading-tight">{game.winner}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-extrabold text-2xl text-primary-600 tabular-nums">
                  {finalScores[game.winner] || 0}
                </p>
                <p className="text-[10px] text-primary-400 font-medium">points</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Final Standings */}
        <div className="card p-4 mb-3">
          <h3 className="section-label mb-2.5">Final Standings</h3>
          <div className="space-y-1">
            {sortedPlayers.map((name, i) => (
              <div key={name} className={`flex items-center gap-3 py-2 px-2 rounded-lg ${
                i === 0 ? 'bg-primary-50/60' : ''
              }`}>
                <span className={`w-7 text-center font-bold text-xs font-mono ${
                  i === 0 ? 'text-primary-600' : 'text-warm-300'
                }`}>
                  #{i + 1}
                </span>
                <span className={`flex-1 font-medium text-sm ${i === 0 ? 'text-warm-900' : 'text-warm-700'}`}>{name}</span>
                <span className={`font-mono font-bold text-sm tabular-nums ${
                  i === 0 ? 'text-primary-600' : 'text-warm-600'
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
            <h3 className="section-label mb-2.5">Round-by-Round</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100">
                  <th className="text-left py-2 px-2 text-warm-400 font-medium text-[11px]">#</th>
                  {sortedPlayers.map(name => (
                    <th key={name} className="text-right py-2 px-2 text-warm-400 font-medium text-[11px]">
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
                    transition={{ delay: i * 0.025 }}
                    className="border-b border-warm-50"
                  >
                    <td className="py-2 px-2 text-warm-300 font-mono text-xs">
                      {round.round_number || i + 1}
                    </td>
                    {sortedPlayers.map(name => (
                      <td key={name} className="py-2 px-2 text-right font-mono text-warm-600 text-xs tabular-nums">
                        {round.scores?.[name] ?? 0}
                      </td>
                    ))}
                  </motion.tr>
                ))}
                <tr className="border-t-2 border-warm-200 font-bold">
                  <td className="py-2 px-2 text-warm-500 text-xs">Σ</td>
                  {sortedPlayers.map(name => (
                    <td key={name} className={`py-2 px-2 text-right font-mono text-xs tabular-nums ${
                      name === game.winner ? 'text-primary-600' : 'text-warm-800'
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
        <div className="flex justify-center mt-6">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/history')}
            className="btn-ghost border border-warm-200/60 px-6 text-sm"
          >
            ← Back to History
          </motion.button>
        </div>
      </div>
    </div>
  )
}
