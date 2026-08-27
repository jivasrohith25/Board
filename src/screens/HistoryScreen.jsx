import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { LoadingSkeleton } from '../components/LoadingSkeleton'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function HistoryScreen() {
  const { user, username } = useAuth()
  const navigate = useNavigate()
  const { showError } = useToast()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadHistory() }, [username])

  const loadHistory = async () => {
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE}/history/${username}`, { headers: { Authorization: `Bearer ${token}` } })
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
      style={{ minHeight: 'calc(100vh - 48px)', background: '#7a8aba', padding: '16px' }}
    >
      <div style={{ maxWidth: '830px', margin: '0 auto' }}>
        {/* Section Label Bar */}
        <div className="section-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px' }}>📜</span>
          GAME HISTORY
          <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '400', letterSpacing: '0', textTransform: 'none' }}>
            Past wins, close calls, and receipts.
          </span>
        </div>

        {games.length === 0 ? (
          <div className="ds-form-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
            <h3 style={{ fontFamily: 'Arial Black, Arial', fontSize: '18px', fontWeight: '900', color: '#21242e', marginBottom: '8px' }}>NO GAMES YET</h3>
            <p style={{ fontSize: '12px', color: '#3d4f97', marginBottom: '24px' }}>Start a game and your finished sessions will live here.</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/name-input')} className="ds-btn-submit">
              START A GAME
            </motion.button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {games.map((game, i) => {
              const scores = Object.entries(game.final_scores || {}).sort(([, a], [, b]) => b - a)
              const topScore = scores[0]?.[1] || 0
              const secondScore = scores[1]?.[1] || 0
              const margin = topScore - secondScore

              return (
                <motion.button
                  key={game.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.035, type: 'spring', stiffness: 360, damping: 28 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/history/${game.id}`)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: '#dedede',
                    border: 'none',
                    borderTop: '1px solid rgba(255,255,255,0.5)',
                    borderLeft: '1px solid rgba(255,255,255,0.3)',
                    borderBottom: '2px solid #3d4f97',
                    borderRight: '1px solid #3d4f97',
                    borderRadius: '4px',
                    padding: '16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <p style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60619c', margin: '0 0 4px 0' }}>
                        {game.played_at ? new Date(game.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'UNKNOWN DATE'}
                      </p>
                      <h2 style={{ fontFamily: 'Arial Black, Arial', fontSize: '16px', fontWeight: '900', color: '#21242e', margin: 0 }}>
                        {game.winner || 'Unknown'} won
                      </h2>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        background: '#f68d1f',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '3px 10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {topScore} PTS
                      </span>
                      {scores.length > 1 && (
                        <p style={{ fontSize: '10px', color: '#60619c', margin: '4px 0 0 0', fontWeight: '700' }}>+{margin} margin</p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                    {(game.players || []).map(p => (
                      <span key={p} style={{
                        fontSize: '9px', fontWeight: '700',
                        background: '#ffffff', color: '#3d4f97',
                        padding: '3px 8px',
                        border: '1px solid #5a5f8c',
                        textTransform: 'uppercase', letterSpacing: '0.3px',
                      }}>
                        {p}
                      </span>
                    ))}
                  </div>

                  {scores.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {scores.slice(0, 4).map(([name, score], index) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
                          <span style={{ width: '24px', fontFamily: 'Arial, monospace', fontWeight: '700', color: '#60619c' }}>#{index + 1}</span>
                          <span style={{ flex: 1, fontWeight: '700', color: '#3d4f97', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          <span style={{ fontFamily: 'Arial, monospace', fontWeight: '700', color: '#21242e', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
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
