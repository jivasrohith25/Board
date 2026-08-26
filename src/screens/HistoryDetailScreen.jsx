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
  const winnerScore = game.winner ? finalScores[game.winner] || 0 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      className="min-h-screen bg-bg-primary px-4 py-8"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8 pr-20">
          <button
            onClick={() => navigate('/history', { replace: true })}
            className="w-11 h-11 rounded-xl bg-bg-elevated border border-ui-border text-text-secondary hover:text-text-primary hover:border-accent-primary transition-all shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-primary"
            aria-label="Back to history"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="font-display text-display-md text-text-primary">Game Detail</h1>
            <p className="text-text-secondary text-sm font-medium">
              {game.played_at ? new Date(game.played_at).toLocaleDateString('en-US', {
                weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
              }) : ''}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[0.82fr_1.18fr] gap-6 items-start">
          <div className="space-y-5">
            {game.winner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative p-6 rounded-3xl bg-accent-primary text-white overflow-hidden shadow-elevated"
              >
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
                <div className="relative z-10">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/80 mb-3">Winner</p>
                  <p className="font-display font-black text-4xl leading-none mb-4">{game.winner}</p>
                  <div className="flex items-end justify-between">
                    <p className="text-white/80 text-sm font-medium">Archived champion</p>
                    <div className="text-right">
                      <p className="font-mono font-extrabold text-4xl tabular-nums">{winnerScore}</p>
                      <p className="text-xs text-white/80 font-bold uppercase tracking-wider">points</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="card p-5">
              <h3 className="section-label mb-4">Final Standings</h3>
              <div className="space-y-2">
                {sortedPlayers.map((name, i) => (
                  <div key={name} className={`flex items-center gap-3 py-3 px-3 rounded-xl border transition-colors ${
                    i === 0 ? 'bg-accent-primary/10 border-accent-primary/20' : 'bg-bg-primary border-ui-border'
                  }`}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs font-mono ${
                      i === 0 ? 'bg-accent-primary text-white' : 'bg-bg-secondary text-text-muted border border-ui-border'
                    }`}>
                      #{i + 1}
                    </span>
                    <span className={`flex-1 font-bold text-sm ${i === 0 ? 'text-text-primary' : 'text-text-secondary'}`}>{name}</span>
                    <span className={`font-mono font-bold text-base tabular-nums ${
                      i === 0 ? 'text-accent-primary' : 'text-text-primary'
                    }`}>
                      {finalScores[name] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {rounds.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-ui-border bg-bg-secondary">
                <h3 className="section-label">Round-by-Round</h3>
                <p className="text-xs text-text-muted mt-1 font-medium">Every score, preserved exactly as played.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="bg-bg-primary border-b border-ui-border">
                      <th className="text-left py-3 px-4 text-text-muted font-bold text-[11px] uppercase tracking-wider">Round</th>
                      {sortedPlayers.map(name => (
                        <th key={name} className="text-right py-3 px-4 text-text-muted font-bold text-[11px] uppercase tracking-wider">
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
                        className="border-b border-ui-border odd:bg-bg-elevated even:bg-bg-secondary/40 hover:bg-accent-primary/5 transition-colors"
                      >
                        <td className="py-3 px-4 text-text-secondary font-mono text-xs font-bold">
                          {round.round_number || i + 1}
                        </td>
                        {sortedPlayers.map(name => (
                          <td key={name} className="py-3 px-4 text-right font-mono text-text-primary text-xs tabular-nums font-medium">
                            {round.scores?.[name] ?? 0}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                    <tr className="border-t-2 border-accent-primary/30 bg-accent-primary/10 font-bold">
                      <td className="py-3 px-4 text-accent-primary text-xs font-bold uppercase tracking-wider">Total</td>
                      {sortedPlayers.map(name => (
                        <td key={name} className={`py-3 px-4 text-right font-mono text-xs tabular-nums ${
                          name === game.winner ? 'text-accent-primary font-extrabold' : 'text-text-primary'
                        }`}>
                          {finalScores[name] || 0}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center mt-8">
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -2 }}
            onClick={() => navigate('/history')}
            className="btn-secondary px-6 text-sm"
          >
            Back to History
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
