import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { db, useAuth } from '../contexts/AuthContext'
import { collection, doc, onSnapshot, deleteDoc } from 'firebase/firestore'
import confetti from 'canvas-confetti'

const FONT = "'Source Code Pro', monospace"

export function RajaRaniPodiumScreen() {
  const { roomId } = useParams()
  const { user, username, displayName } = useAuth()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [roundsOpen, setRoundsOpen] = useState(false)

  useEffect(() => {
    if (!roomId) return
    setLoading(true)

    const unsub = onSnapshot(doc(db, 'rajaRaniRooms', roomId), (snap) => {
      if (!snap.exists()) {
        navigate('/')
        return
      }
      setRoom(snap.data())
      setLoading(false)
    }, (err) => {
      console.error('Room listen error:', err)
      navigate('/')
    })

    const roundsRef = collection(db, 'rajaRaniRooms', roomId, 'rounds')
    const unsubRounds = onSnapshot(roundsRef, (snapshot) => {
      const roundsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      roundsData.sort((a, b) => Number(a.id) - Number(b.id))
      setRounds(roundsData)
    }, (err) => {
      console.error('Rounds listen error:', err)
    })

    return () => { unsub(); unsubRounds() }
  }, [roomId, navigate])

  // Confetti + victory music on mount
  const audioRef = useRef(null)
  const [audioBlocked, setAudioBlocked] = useState(false)

  useEffect(() => {
    if (!room) return

    // Victory music — try autoplay, fall back to user-tap prompt
    const audio = new Audio('/victory_music.mpeg')
    audio.loop = false
    audio.volume = 0.6
    audioRef.current = audio
    audio.play().catch(() => {
      // Autoplay blocked (mobile browser) — show tap-to-play prompt
      setAudioBlocked(true)
    })

    // Confetti
    const duration = 3000
    const end = Date.now() + duration
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ee1f66', '#ff33e0', '#ffc400', '#ffffff'] })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ee1f66', '#ff33e0', '#ffc400', '#ffffff'] })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()

    return () => { audio.pause(); audio.currentTime = 0 }
  }, [room])

  const playVictorySound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {})
      setAudioBlocked(false)
    }
  }

  if (loading || !room) {
    return (
      <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FONT, fontSize: '14px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Loading results...
        </div>
      </div>
    )
  }

  const players = room.players || []
  const scores = room.scores || {}
  const sortedPlayers = [...players]
    .sort((a, b) => {
      const scoreA = scores[a.uid] || 0
      const scoreB = scores[b.uid] || 0
      if (scoreB !== scoreA) return scoreB - scoreA
      // Tiebreaker: most correct police identifications
      const catchesA = rounds.filter(r => r.roles?.[a.uid] === 'police' && r.policeSelectionCorrect).length
      const catchesB = rounds.filter(r => r.roles?.[b.uid] === 'police' && r.policeSelectionCorrect).length
      return catchesB - catchesA
    })

  const winner = sortedPlayers[0]
  const winnerScore = winner ? (scores[winner.uid] || 0) : 0
  const podiumPlayers = sortedPlayers.slice(0, 3)

  // Compute stats per player
  const playerStats = {}
  players.forEach(p => {
    playerStats[p.uid] = { policeCatches: 0, thiefEscapes: 0 }
  })
  rounds.forEach(r => {
    if (!r.roles) return
    Object.entries(r.roles).forEach(([uid, role]) => {
      if (!playerStats[uid]) playerStats[uid] = { policeCatches: 0, thiefEscapes: 0 }
      if (role === 'police' && r.policeSelectionCorrect) {
        playerStats[uid].policeCatches++
      }
      if (role === 'thief' && !r.policeSelectionCorrect) {
        playerStats[uid].thiefEscapes++
      }
    })
  })

  // Responsive podium bar heights based on viewport
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 480
  const podiumHeights = isMobile
    ? { first: 120, second: 85, third: 70 }
    : { first: 200, second: 150, third: 120 }

  // Podium bar configs: [2nd, 1st, 3rd] left-to-right
  const podiumBars = [
    podiumPlayers[1] && { player: podiumPlayers[1], rank: 2, height: podiumHeights.second, bg: '#888888', label: '#2' },
    podiumPlayers[0] && { player: podiumPlayers[0], rank: 1, height: podiumHeights.first, bg: '#ee1f66', label: '#1' },
    podiumPlayers[2] && { player: podiumPlayers[2], rank: 3, height: podiumHeights.third, bg: '#cd7f32', label: '#3' },
  ].filter(Boolean)

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      style={{ minHeight: '100vh', background: '#000000', padding: '16px' }}
    >
      <div style={{ maxWidth: '830px', margin: '0 auto' }}>

        {/* Winner Banner */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="rr-winner-banner"
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
            <div style={{
              position: 'absolute', right: '-40px', top: '-40px',
              width: '160px', height: '160px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              pointerEvents: 'none',
            }} />
            <p style={{
              fontFamily: FONT,
              fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              opacity: 0.8, margin: '0 0 8px 0',
            }}>
              👑 WINNER
            </p>
            <p className="rr-winner-name" style={{
              fontFamily: FONT,
              fontSize: '28px', fontWeight: 700,
              lineHeight: '1.19', margin: '0 0 15px 0',
              letterSpacing: '0.1em',
            }}>
              {winner.displayName || winner.name || 'Unknown'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <p style={{ fontFamily: FONT, fontSize: '12px', opacity: 0.7, margin: 0 }}>Raja Rani Champion</p>
              <div style={{ textAlign: 'right' }}>
                <p className="rr-winner-score" style={{
                  fontFamily: FONT,
                  fontSize: '32px', fontWeight: 700,
                  lineHeight: '1', margin: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {winnerScore}
                </p>
                <p style={{
                  fontFamily: FONT,
                  fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  opacity: 0.7, margin: '4px 0 0 0',
                }}>
                  POINTS
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tap to play victory sound — shown when autoplay blocked on mobile */}
        {audioBlocked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', justifyContent: 'center', marginBottom: '12px',
            }}
          >
            <button
              onClick={playVictorySound}
              style={{
                fontFamily: FONT, fontSize: '11px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '10px 20px', background: '#29292a',
                color: '#ffffff', border: '1px solid #ee1f66',
                borderRadius: '10px', cursor: 'pointer',
              }}
            >
              🔊 TAP FOR VICTORY SOUND
            </button>
          </motion.div>
        )}

        {/* Podium */}
        {podiumBars.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rr-podium-card"
            style={{
              background: '#29292a',
              border: '1px solid #ffffff',
              borderRadius: '15px',
              padding: '30px',
              marginBottom: '15px',
            }}
          >
            <p style={{
              fontFamily: FONT,
              fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: '#ee1f66', margin: '0 0 20px 0',
            }}>
              PODIUM
            </p>
            <div className="rr-podium-container" style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: '12px',
              height: '260px',
              padding: '0 10px',
            }}>
              {podiumBars.map((bar, i) => (
                <motion.div
                  key={bar.player.uid}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: bar.height, opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.2, duration: 0.6, ease: 'easeOut' }}
                  className={bar.rank === 1 ? 'rr-podium-bar-first' : 'rr-podium-bar'}
                  style={{
                    width: bar.rank === 1 ? '140px' : '110px',
                    background: bar.bg,
                    borderRadius: '15px 15px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    position: 'relative',
                    padding: '15px 10px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Rank badge */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    width: '24px',
                    height: '24px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONT,
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>
                    {bar.label}
                  </div>

                  {bar.rank === 1 && (
                    <span style={{ fontSize: '28px', lineHeight: 1, marginBottom: '-4px' }}>👑</span>
                  )}
                  <p style={{
                    fontFamily: FONT,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ffffff',
                    textAlign: 'center',
                    margin: 0,
                    letterSpacing: '0.05em',
                    lineHeight: 1.2,
                    wordBreak: 'break-word',
                  }}>
                    {bar.player.displayName || bar.player.name || 'Unknown'}
                  </p>
                  <p style={{
                    fontFamily: FONT,
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#ffffff',
                    margin: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {scores[bar.player.uid] || 0}
                  </p>
                  <p style={{
                    fontFamily: FONT,
                    fontSize: '8px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'rgba(255,255,255,0.6)',
                    margin: 0,
                  }}>
                    POINTS
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* All Players Scoreboard */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rr-standings-card"
          style={{
            background: '#29292a',
            border: '1px solid #ffffff',
            borderRadius: '15px',
            padding: '30px',
            marginBottom: '15px',
          }}
        >
          <p style={{
            fontFamily: FONT,
            fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: '#ee1f66', margin: '0 0 15px 0',
          }}>
            FINAL STANDINGS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sortedPlayers.map((player, i) => {
              const stats = playerStats[player.uid] || { policeCatches: 0, thiefEscapes: 0 }
              const isWinner = i === 0
              return (
                <motion.div
                  key={player.uid}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 15px',
                    background: isWinner ? 'rgba(238, 31, 102, 0.1)' : 'transparent',
                    borderRadius: '10px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{
                    width: '24px', height: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isWinner ? '#ee1f66' : '#29292a',
                    color: isWinner ? '#ffffff' : 'rgba(255,255,255,0.4)',
                    fontSize: '9px', fontWeight: 700,
                    fontFamily: FONT,
                    borderRadius: '10px',
                    flexShrink: 0,
                  }}>
                    #{i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontFamily: FONT,
                      fontWeight: 700, fontSize: '12px',
                      color: isWinner ? '#ffffff' : 'rgba(255,255,255,0.6)',
                      margin: 0,
                    }}>
                      {player.displayName || player.name || 'Unknown'}
                    </p>
                    <p style={{
                      fontFamily: FONT,
                      fontSize: '9px',
                      color: 'rgba(255,255,255,0.3)',
                      margin: '2px 0 0 0',
                    }}>
                      👮 {stats.policeCatches} catches · 🏃 {stats.thiefEscapes} escapes
                    </p>
                  </div>
                  <span style={{
                    fontFamily: FONT,
                    fontWeight: 700, fontSize: '14px',
                    color: isWinner ? '#ee1f66' : '#ffffff',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {scores[player.uid] || 0}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Round-by-Round Summary */}
        {rounds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            style={{
              background: '#29292a',
              border: '1px solid #ffffff',
              borderRadius: '15px',
              marginBottom: '15px',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setRoundsOpen(prev => !prev)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '15px 30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              <span style={{
                fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: '#ee1f66',
              }}>
                ROUND-BY-ROUND ({rounds.length})
              </span>
              <span style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.4)',
                transform: roundsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}>
                ▼
              </span>
            </button>
            {roundsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ duration: 0.3 }}
                style={{ padding: '0 30px 15px 30px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rounds.map((round, idx) => {
                    const roles = round.roles || {}
                    const policeId = Object.entries(roles).find(([, r]) => r === 'police')?.[0]
                    const thiefId = Object.entries(roles).find(([, r]) => r === 'thief')?.[0]
                    const policeName = players.find(p => p.uid === policeId)?.displayName || 'Unknown'
                    const thiefName = players.find(p => p.uid === thiefId)?.displayName || 'Unknown'
                    const caught = round.policeSelectionCorrect
                    const roundScores = round.roundScores || {}

                    return (
                      <div key={round.id} style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                        padding: '12px 15px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{
                            fontFamily: FONT,
                            fontSize: '10px', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                            color: 'rgba(255,255,255,0.4)',
                          }}>
                            ROUND {Number(round.id)}
                          </span>
                          <span style={{
                            fontFamily: FONT,
                            fontSize: '11px', fontWeight: 700,
                            color: caught ? '#00ff88' : '#ee1f66',
                          }}>
                            {caught ? '✓ CAUGHT' : '✗ ESCAPED'}
                          </span>
                        </div>
                        <p style={{
                          fontFamily: FONT,
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.5)',
                          margin: '0 0 6px 0',
                        }}>
                          👮 {policeName} → 🏃 {thiefName}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {players.map(p => (
                            <span key={p.uid} style={{
                              fontFamily: FONT,
                              fontSize: '10px',
                              color: 'rgba(255,255,255,0.4)',
                            }}>
                              {p.displayName || p.name}: <span style={{ color: '#ffffff', fontWeight: 700 }}>{roundScores[p.uid] ?? 0}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/raja-rani/lobby')}
            style={{
              fontFamily: FONT,
              fontSize: '12px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '12px 24px',
              background: '#ee1f66',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            PLAY AGAIN
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/')}
            style={{
              fontFamily: FONT,
              fontSize: '12px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '12px 24px',
              background: 'transparent',
              color: 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            BACK TO HOME
          </motion.button>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .rr-winner-banner { padding: 20px 16px !important; }
          .rr-podium-card { padding: 16px 10px !important; }
          .rr-podium-bar { width: 72px !important; min-width: 72px !important; padding: 8px 4px !important; gap: 3px !important; }
          .rr-podium-bar-first { width: 90px !important; min-width: 90px !important; padding: 8px 4px !important; gap: 3px !important; }
          .rr-podium-container { gap: 6px !important; padding: 0 2px !important; height: 160px !important; }
          .rr-podium-container p[style*="font-size: 20px"] { font-size: 14px !important; }
          .rr-podium-container p[style*="font-size: 13px"] { font-size: 10px !important; }
          .rr-winner-name { font-size: 20px !important; }
          .rr-winner-score { font-size: 22px !important; }
          .rr-standings-card { padding: 16px !important; }
        }
      `}</style>
    </motion.div>
  )
}