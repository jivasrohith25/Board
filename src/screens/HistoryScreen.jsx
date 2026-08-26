import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { EmptyState } from '../components/EmptyState'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function HistoryScreen() {
  const { user, username } = useAuth()
  const navigate = useNavigate()
  const { showError } = useToast()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [username])

  const loadHistory = async () => {
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE}/history/${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load history')
      const data = await res.json()
      setGames(data.games || [])
    } catch (err) {
      console.error('History load error:', err)
      showError('Failed to load game history')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSkeleton />

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      className="min-h-screen bg-bg-primary px-4 py-8"
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8 pr-20">
          <button
            onClick={() => navigate('/name-input')}
            className="w-11 h-11 rounded-xl bg-bg-elevated border border-ui-border text-text-secondary hover:text-text-primary hover:border-accent-primary transition-all shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-primary"
            aria-label="Back to new game"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="font-display text-display-md text-text-primary">Game History</h1>
            <p className="text-text-secondary text-sm font-medium">Past wins, close calls, and receipts.</p>
          </div>
        </div>

        {games.length === 0 ? (
          <EmptyState
            icon="📜"
            title="No games yet"
            description="Start a game and your finished sessions will live here."
            action={
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate('/name-input')}
                className="btn-primary"
              >
                Start a Game
              </motion.button>
            }
          />
        ) : (
          <div className="space-y-4">
            {games.map((game, i) => {
              const scores = Object.entries(game.final_scores || {}).sort(([, a], [, b]) => b - a)
              const topScore = scores[0]?.[1] || 0
              const secondScore = scores[1]?.[1] || 0
              const margin = topScore - secondScore

              return (
                <motion.button
                  key={game.id}
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.035, type: 'spring', stiffness: 360, damping: 28 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/history/${game.id}`)}
                  className="group relative w-full text-left overflow-hidden rounded-3xl bg-bg-elevated border border-ui-border p-5 shadow-card hover:shadow-elevated hover:border-accent-primary/35 transition-all focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-primary"
                >
                  <div className="absolute inset-y-0 right-0 w-28 bg-accent-primary/5 group-hover:bg-accent-primary/10 transition-colors pointer-events-none" />
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div>
                      <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-1">
                        {game.played_at ? new Date(game.played_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                        }) : 'Unknown date'}
                      </p>
                      <h2 className="font-display text-2xl font-black text-text-primary tracking-tight">
                        {game.winner || 'Unknown'} won
                      </h2>
                    </div>
                    <div className="flex sm:flex-col items-start sm:items-end gap-2">
                      <span className="inline-flex items-center rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20 px-3 py-1 text-xs font-bold">
                        {topScore} pts
                      </span>
                      {scores.length > 1 && (
                        <span className="text-xs text-text-muted font-medium">
                          +{margin} margin
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-wrap gap-2 mb-4">
                    {(game.players || []).map(p => (
                      <span key={p} className="text-xs bg-bg-secondary text-text-secondary px-3 py-1 rounded-lg font-bold border border-ui-border">
                        {p}
                      </span>
                    ))}
                  </div>

                  {scores.length > 0 && (
                    <div className="relative z-10 grid gap-2">
                      {scores.slice(0, 4).map(([name, score], index) => (
                        <div key={name} className="flex items-center gap-3 text-xs">
                          <span className="w-6 font-mono font-bold text-text-muted">#{index + 1}</span>
                          <span className="flex-1 font-medium text-text-secondary truncate">{name}</span>
                          <span className="font-mono font-bold text-text-primary tabular-nums">{score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
