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
      style={{ minHeight: 'calc(100vh - 76px)', background: '#000000', padding: '16px' }}
    >
      <div style={{ maxWidth: '830px', margin: '0 auto' }}>
        {/* Section Label */}
        <div className="kippo-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <span style={{ fontSize: '14px' }}>📜</span>
          GAME HISTORY
          <span className="history-subtitle" style={{ marginLeft: 'auto', fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 400, letterSpacing: 0, textTransform: 'none', opacity: 0.5 }}>
            Past wins, close calls, and receipts.
          </span>
        </div>

        {games.length === 0 ? (
          <div className="kippo-card" style={{ textAlign: 'center', padding: '50px 30px' }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>📜</div>
            <h3 style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>NO GAMES YET</h3>
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px', lineHeight: '1.88' }}>Start a game and your finished sessions will live here.</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/name-input')} className="kippo-btn-primary">
              START A GAME
            </motion.button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                    background: '#29292a',
                    border: '1px solid #ffffff',
                    borderRadius: '15px',
                    padding: '15px',
                    cursor: 'pointer',
                    fontFamily: "'Source Code Pro', monospace",
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', margin: '0 0 4px 0' }}>
                        {game.played_at ? new Date(game.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'UNKNOWN DATE'}
                      </p>
                      <h2 style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                        {game.winner || 'Unknown'} won
                      </h2>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        background: '#ee1f66',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        borderRadius: '10px',
                      }}>
                        {topScore} PTS
                      </span>
                      {scores.length > 1 && (
                        <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0', fontWeight: 700 }}>+{margin} margin</p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                    {(game.players || []).map(p => (
                      <span key={p} style={{
                        fontFamily: "'Source Code Pro', monospace",
                        fontSize: '9px', fontWeight: 700,
                        background: '#000000',
                        color: '#ffffff',
                        padding: '3px 8px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '10px',
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                      }}>
                        {p}
                      </span>
                    ))}
                  </div>

                  {scores.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {scores.slice(0, 4).map(([name, score], index) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
                          <span style={{ width: '24px', fontFamily: "'Source Code Pro', monospace", fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>#{index + 1}</span>
                          <span style={{ flex: 1, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          <span style={{ fontFamily: "'Source Code Pro', monospace", fontWeight: 700, color: '#ee1f66', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
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

      <style>{`
        @media (max-width: 400px) {
          .history-subtitle { display: none !important; }
        }
      `}</style>
    </motion.div>
  )
}
