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
    <div className="min-h-screen bg-warm-50 px-4 py-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/name-input')} className="btn-ghost text-sm p-2">
              ←
            </button>
            <h1 className="text-xl font-bold text-warm-900">Game History</h1>
          </div>
        </div>

        {games.length === 0 ? (
          <EmptyState
            icon="📜"
            title="No games yet"
            description="Start a game and it'll show up here!"
            action={
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/name-input')}
                className="btn-primary"
              >
                Start a Game
              </motion.button>
            }
          />
        ) : (
          <div className="space-y-3">
            {games.map((game, i) => (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/history/${game.id}`)}
                className="card card-hover p-4 w-full text-left"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs text-warm-400">
                    {game.played_at ? new Date(game.played_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                    }) : 'Unknown date'}
                  </span>
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                    🏆 {game.winner}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(game.players || []).map(p => (
                    <span key={p} className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">
                      {p}
                    </span>
                  ))}
                </div>
                {game.final_scores && (
                  <div className="mt-2 text-xs text-warm-500">
                    Scores: {Object.entries(game.final_scores)
                      .sort(([,a],[,b]) => b - a)
                      .map(([name, score]) => `${name}: ${score}`)
                      .join(' · ')}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}