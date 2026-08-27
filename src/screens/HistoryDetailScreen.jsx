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

  useEffect(() => { loadGameDetail() }, [gameId])

  const loadGameDetail = async () => {
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE}/history/${username}/${gameId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 404) { navigate('/history'); return }
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
      style={{ minHeight: 'calc(100vh - 76px)', background: '#000000', padding: '16px' }}
    >
      <div style={{ maxWidth: '830px', margin: '0 auto' }}>
        {/* Back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
          <button onClick={() => navigate('/history', { replace: true })} className="kippo-btn-ghost" style={{ padding: '8px 12px', fontSize: '12px' }}>
            ← BACK
          </button>
        </div>

        {/* Winner Banner */}
        {game.winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: '#ee1f66',
              borderRadius: '15px',
              padding: '30px',
              color: '#ffffff',
              marginBottom: '15px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', right: '-40px', top: '-40px', width: '160px', height: '160px', borderRadius: '50px', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8, margin: '0 0 8px 0' }}>WINNER</p>
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '28px', fontWeight: 700, lineHeight: '1.19', margin: '0 0 15px 0', letterSpacing: '0.1em' }}>{game.winner}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', opacity: 0.7, margin: 0 }}>Archived champion</p>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '32px', fontWeight: 700, lineHeight: '1', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{winnerScore}</p>
                <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, margin: '4px 0 0 0' }}>POINTS</p>
              </div>
            </div>
          </motion.div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', alignItems: 'start' }}>
          {/* Final Standings */}
          <div className="kippo-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="kippo-label-bar">≡ FINAL STANDINGS</div>
            <div style={{ padding: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {sortedPlayers.map((name, i) => (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px',
                    background: i === 0 ? 'rgba(238, 31, 102, 0.1)' : 'transparent',
                    borderRadius: '10px',
                  }}>
                    <span style={{
                      width: '24px', height: '24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: i === 0 ? '#ee1f66' : '#29292a',
                      color: i === 0 ? '#ffffff' : 'rgba(255,255,255,0.4)',
                      fontSize: '9px', fontWeight: 700,
                      fontFamily: "'Source Code Pro', monospace",
                      borderRadius: '10px',
                    }}>#{i + 1}</span>
                    <span style={{ fontFamily: "'Source Code Pro', monospace", flex: 1, fontWeight: 700, fontSize: '12px', color: i === 0 ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>{name}</span>
                    <span style={{ fontFamily: "'Source Code Pro', monospace", fontWeight: 700, fontSize: '12px', color: i === 0 ? '#ee1f66' : '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                      {finalScores[name] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Round-by-Round Table */}
          {rounds.length > 0 && (
            <div className="kippo-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="kippo-label-bar">
                ≡ ROUND-BY-ROUND
                <span style={{ marginLeft: 'auto', fontFamily: "'Source Code Pro', monospace", fontSize: '9px', fontWeight: 400, letterSpacing: 0, textTransform: 'none', opacity: 0.5 }}>Every score, preserved.</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '400px', borderCollapse: 'collapse', fontSize: '11px', fontFamily: "'Source Code Pro', monospace" }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>ROUND</th>
                      {sortedPlayers.map(name => (
                        <th key={name} style={{ textAlign: 'right', padding: '8px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map((round, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '8px 12px', fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>{round.round_number || i + 1}</td>
                        {sortedPlayers.map(name => (
                          <td key={name} style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'Source Code Pro', monospace", fontSize: '11px', color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                            {round.scores?.[name] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1px solid rgba(238, 31, 102, 0.3)' }}>
                      <td style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ee1f66' }}>TOTAL</td>
                      {sortedPlayers.map(name => (
                        <td key={name} style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'Source Code Pro', monospace", fontSize: '11px', fontWeight: name === game.winner ? 700 : 400, color: name === game.winner ? '#ee1f66' : '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
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

        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/history')} className="kippo-btn-ghost" style={{ padding: '10px 24px' }}>
            ← BACK TO HISTORY
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
