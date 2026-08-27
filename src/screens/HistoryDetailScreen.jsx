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
      style={{ minHeight: 'calc(100vh - 48px)', background: '#7a8aba', padding: '16px' }}
    >
      <div style={{ maxWidth: '830px', margin: '0 auto' }}>
        {/* Back + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <button onClick={() => navigate('/history', { replace: true })} className="ds-btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }}>
            ← BACK
          </button>
        </div>

        {/* Winner banner */}
        {game.winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: '#f68d1f',
              borderTop: '1px solid rgba(255,255,255,0.35)',
              borderBottom: '3px solid rgba(0,0,0,0.25)',
              borderRadius: '0',
              padding: '24px',
              color: '#ffffff',
              marginBottom: '12px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', right: '-40px', top: '-40px', width: '160px', height: '160px', borderRadius: '9999px', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
            <p style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.25em', opacity: 0.8, margin: '0 0 8px 0' }}>WINNER</p>
            <p style={{ fontFamily: 'Arial Black, Arial', fontSize: '28px', fontWeight: '900', lineHeight: '1', margin: '0 0 16px 0' }}>{game.winner}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Archived champion</p>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: 'Arial Black, Arial', fontSize: '32px', fontWeight: '900', lineHeight: '1', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{winnerScore}</p>
                <p style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, margin: '4px 0 0 0' }}>POINTS</p>
              </div>
            </div>
          </motion.div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', alignItems: 'start' }}>
          {/* Left: Final Standings */}
          <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="section-label-bar">≡ FINAL STANDINGS</div>
            <div style={{ padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {sortedPlayers.map((name, i) => (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px',
                    background: i === 0 ? 'rgba(246, 141, 31, 0.1)' : i % 2 === 0 ? '#ffffff' : 'transparent',
                    borderBottom: '1px solid rgba(90, 95, 140, 0.15)',
                  }}>
                    <span style={{
                      width: '24px', height: '24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: i === 0 ? '#f68d1f' : '#dedede',
                      color: i === 0 ? '#ffffff' : '#60619c',
                      fontSize: '9px', fontWeight: '700',
                      fontFamily: 'Arial, monospace',
                    }}>#{i + 1}</span>
                    <span style={{ flex: 1, fontWeight: '700', fontSize: '12px', color: i === 0 ? '#21242e' : '#3d4f97' }}>{name}</span>
                    <span style={{ fontFamily: 'Arial, monospace', fontWeight: '700', fontSize: '12px', color: i === 0 ? '#f68d1f' : '#21242e', fontVariantNumeric: 'tabular-nums' }}>
                      {finalScores[name] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Round-by-Round Table */}
          {rounds.length > 0 && (
            <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="section-label-bar">
                ≡ ROUND-BY-ROUND
                <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: '400', letterSpacing: '0', textTransform: 'none', opacity: 0.7 }}>Every score, preserved.</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '400px', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#dedede', borderBottom: '2px solid #3d4f97' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60619c' }}>ROUND</th>
                      {sortedPlayers.map(name => (
                        <th key={name} style={{ textAlign: 'right', padding: '8px 12px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60619c' }}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map((round, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(90, 95, 140, 0.15)', background: i % 2 === 0 ? '#ffffff' : 'rgba(222, 222, 222, 0.4)' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'Arial, monospace', fontSize: '10px', fontWeight: '700', color: '#60619c' }}>{round.round_number || i + 1}</td>
                        {sortedPlayers.map(name => (
                          <td key={name} style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Arial, monospace', fontSize: '11px', color: '#21242e', fontVariantNumeric: 'tabular-nums' }}>
                            {round.scores?.[name] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid rgba(246, 141, 31, 0.3)', background: 'rgba(246, 141, 31, 0.08)' }}>
                      <td style={{ padding: '8px 12px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f68d1f' }}>TOTAL</td>
                      {sortedPlayers.map(name => (
                        <td key={name} style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Arial, monospace', fontSize: '11px', fontWeight: name === game.winner ? '900' : '700', color: name === game.winner ? '#f68d1f' : '#21242e', fontVariantNumeric: 'tabular-nums' }}>
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

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/history')} className="ds-btn-secondary" style={{ padding: '10px 24px' }}>
            ← BACK TO HISTORY
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
