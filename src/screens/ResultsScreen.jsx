import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { v4 as uuidv4 } from 'uuid'
import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../contexts/AuthContext'
import { useAuth } from '../contexts/AuthContext'
import { FireworksBackground } from '../components/FireworksBackground'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ConfirmModal } from '../components/Modal'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { GameCoach } from '../components/GameCoach'

const API_BASE = import.meta.env.VITE_API_URL || ''

function burstConfetti() {
  const styles = getComputedStyle(document.documentElement)
  const accent = styles.getPropertyValue('--accent-primary').trim()
  const accentSecondary = styles.getPropertyValue('--accent-secondary').trim()
  const warning = styles.getPropertyValue('--warning').trim()
  const success = styles.getPropertyValue('--success').trim()
  const colors = [accent, accentSecondary, warning, success].filter(Boolean)

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.5, y: 0.32 },
    startVelocity: 42,
    colors,
  })
  setTimeout(() => {
    confetti({ particleCount: 55, angle: 58, spread: 55, origin: { x: 0.08, y: 0.56 }, colors })
  }, 280)
  setTimeout(() => {
    confetti({ particleCount: 55, angle: 122, spread: 55, origin: { x: 0.92, y: 0.56 }, colors })
  }, 520)
  setTimeout(() => {
    confetti({ particleCount: 45, spread: 110, origin: { x: 0.5, y: 0.46 }, startVelocity: 34, colors })
  }, 920)
}

const BAR_STYLES = [
  'bg-accent-primary',
  'bg-accent-secondary',
  'bg-status-success',
  'bg-status-warning',
]

export function ResultsScreen() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, username } = useAuth()
  const [game, setGame] = useState(null)
  const [totalScores, setTotalScores] = useState({})
  const [loading, setLoading] = useState(true)
  const [archivedGameId, setArchivedGameId] = useState(null)
  const [archiving, setArchiving] = useState(true)
  const [roundData, setRoundData] = useState([])
  const [showHomeConfirm, setShowHomeConfirm] = useState(false)
  const [showHistoryConfirm, setShowHistoryConfirm] = useState(false)
  const [showRematchConfirm, setShowRematchConfirm] = useState(false)
  const [rematching, setRematching] = useState(false)
  const [coachComment, setCoachComment] = useState('')
  const [coachEmotion, setCoachEmotion] = useState('default')
  const [coachTyping, setCoachTyping] = useState(false)
  const [playerAvatars, setPlayerAvatars] = useState({})

  useEffect(() => {
    if (location.state?.archivedGameId) {
      setArchivedGameId(location.state.archivedGameId)
      setArchiving(false)
    }
  }, [location.state])

  useEffect(() => {
    loadGame()
  }, [gameId])

  useEffect(() => {
    if (!loading && game) {
      burstConfetti()
      const t1 = setTimeout(() => {
        const styles = getComputedStyle(document.documentElement)
        const colors = [
          styles.getPropertyValue('--accent-primary').trim(),
          styles.getPropertyValue('--accent-secondary').trim(),
          styles.getPropertyValue('--warning').trim(),
        ].filter(Boolean)
        confetti({ particleCount: 34, angle: 45, spread: 40, origin: { x: 0.1, y: 0.5 }, colors })
        confetti({ particleCount: 34, angle: 135, spread: 40, origin: { x: 0.9, y: 0.5 }, colors })
      }, 1600)
      const t2 = setTimeout(() => {
        const styles = getComputedStyle(document.documentElement)
        const colors = [
          styles.getPropertyValue('--accent-primary').trim(),
          styles.getPropertyValue('--success').trim(),
        ].filter(Boolean)
        confetti({ particleCount: 26, spread: 65, origin: { x: 0.32, y: 0.72 }, colors })
        confetti({ particleCount: 26, spread: 65, origin: { x: 0.68, y: 0.72 }, colors })
      }, 3100)

      const winner = sortedPlayers[0]?.name || ''
      if (winner) {
        setCoachTyping(true)
        user.getIdToken().then(token => {
          fetch(`${API_BASE}/coach-finale`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              game_id: gameId,
              winner,
              final_scores: totalScores,
            }),
            signal: AbortSignal.timeout(4000),
          })
            .then(r => r.json())
            .then(data => {
              if (data.comment) {
                setCoachComment(data.comment)
                setCoachEmotion(data.emotion || 'default')
              }
              setCoachTyping(false)
            })
            .catch(() => {
              setCoachTyping(false)
            })
        }).catch(() => {
          setCoachTyping(false)
        })
      }

      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [loading, game])

  const loadAvatars = async (playerNames) => {
    try {
      const avatarMap = {}
      const results = await Promise.allSettled(
        playerNames.map(async (name) => {
          const unameSnap = await getDoc(doc(db, 'usernames', name.toLowerCase()))
          if (!unameSnap.exists()) return { name, avatar: null }
          const uid = unameSnap.data().uid
          const userSnap = await getDoc(doc(db, 'users', uid))
          if (!userSnap.exists()) return { name, avatar: null }
          return { name, avatar: userSnap.data().avatar || null }
        })
      )
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) {
          avatarMap[r.value.name] = r.value.avatar
        }
      })
      setPlayerAvatars(avatarMap)
    } catch (err) {
      console.error('Failed to load avatars:', err)
    }
  }

  const handleRematch = async () => {
    setShowRematchConfirm(false)
    if (!game || !game.players || rematching) return
    setRematching(true)
    try {
      const newGameId = uuidv4()
      await setDoc(doc(db, 'games', newGameId), {
        createdBy: user.uid,
        username: username,
        players: game.players,
        roundLength: game.roundLength || 5,
        currentRound: 1,
        status: 'active',
        createdAt: serverTimestamp(),
      })
      navigate(`/point-entry/${newGameId}`)
    } catch (err) {
      console.error('Rematch failed:', err)
      setRematching(false)
    }
  }

  const loadGame = async () => {
    try {
      const gameDoc = await getDoc(doc(db, 'games', gameId))
      if (!gameDoc.exists()) {
        if (location.state?.archivedGameId) {
          setArchivedGameId(location.state.archivedGameId)
          setArchiving(false)
        } else {
          try {
            const token = await user.getIdToken()
            const res = await fetch(`${API_BASE}/history/${username}/${gameId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
              const data = await res.json()
              setGame({ players: data.players })
              const totals = {}
              data.players.forEach(p => totals[p] = 0)
              if (data.rounds) {
                data.rounds.forEach(r => {
                  Object.entries(r.scores || {}).forEach(([p, s]) => {
                    totals[p] = (totals[p] || 0) + s
                  })
                })
              }
              if (data.final_scores) {
                Object.assign(totals, data.final_scores)
              }
              setTotalScores(totals)
              setRoundData(data.rounds || [])
              setArchivedGameId(gameId)
              setArchiving(false)
              setLoading(false)
              if (data.players) loadAvatars(data.players)
              return
            }
          } catch {}
          navigate('/name-input')
        }
        setLoading(false)
        return
      }
      const gameData = gameDoc.data()
      setGame(gameData)

      const roundsSnap = await getDocs(collection(db, 'games', gameId, 'rounds'))
      const rounds = []
      const totals = {}
      gameData.players.forEach(p => totals[p] = 0)
      roundsSnap.forEach(d => {
        const r = d.data()
        rounds.push({ id: d.id, ...r })
        Object.entries(r.scores).forEach(([p, s]) => {
          totals[p] = (totals[p] || 0) + s
        })
      })
      rounds.sort((a, b) => parseInt(a.id) - parseInt(b.id))

      setRoundData(rounds)
      setTotalScores(totals)
      setArchivedGameId(gameId)
      setArchiving(false)
      setLoading(false)
      loadAvatars(gameData.players)
    } catch (err) {
      console.error('Failed to load results:', err)
      setArchiving(false)
      setLoading(false)
    }
  }

  const sortedPlayers = useMemo(() => {
    if (!game) return []
    return game.players
      .map(name => ({ name, score: totalScores[name] || 0, avatar: playerAvatars[name] || null }))
      .sort((a, b) => b.score - a.score)
  }, [game, totalScores, playerAvatars])

  const analytics = useMemo(() => {
    if (!game || sortedPlayers.length === 0) return null
    const numRounds = roundData.length
    const allScores = Object.values(totalScores)
    const totalPoints = allScores.reduce((a, b) => a + b, 0)
    const avgScore = numRounds > 0 ? (totalPoints / game.players.length).toFixed(1) : 0

    let biggestLead = 0
    let leadLabel = ''
    const runningTotals = {}
    game.players.forEach(p => runningTotals[p] = 0)
    roundData.forEach((round, idx) => {
      Object.entries(round.scores || {}).forEach(([p, s]) => {
        runningTotals[p] = (runningTotals[p] || 0) + s
      })
      const vals = Object.values(runningTotals)
      const max = Math.max(...vals)
      const min = Math.min(...vals)
      if (max - min > biggestLead) {
        biggestLead = max - min
        const leader = Object.keys(runningTotals).find(k => runningTotals[k] === max)
        leadLabel = `Round ${idx + 1}: ${leader} +${biggestLead}`
      }
    })

    const margin = sortedPlayers.length >= 2
      ? sortedPlayers[0].score - sortedPlayers[1].score
      : sortedPlayers[0]?.score || 0

    const playerConsistency = game.players.map(p => {
      const pScores = roundData.map(r => r.scores?.[p] || 0)
      const mean = pScores.length > 0 ? pScores.reduce((a, b) => a + b, 0) / pScores.length : 0
      const variance = pScores.length > 0 ? pScores.reduce((a, s) => a + (s - mean) ** 2, 0) / pScores.length : 0
      return { name: p, stdDev: Math.sqrt(variance).toFixed(1), avg: mean.toFixed(1), avatar: playerAvatars[p] || null }
    }).sort((a, b) => parseFloat(a.stdDev) - parseFloat(b.stdDev))

    let highestRoundScore = 0
    let highestRoundPlayer = ''
    let highestRoundNum = 0
    roundData.forEach((round, idx) => {
      Object.entries(round.scores || {}).forEach(([p, s]) => {
        if (s > highestRoundScore) {
          highestRoundScore = s
          highestRoundPlayer = p
          highestRoundNum = idx + 1
        }
      })
    })

    let maxComeback = 0
    let comebackPlayer = ''
    roundData.forEach((round, idx) => {
      Object.entries(round.scores || {}).forEach(([p, s]) => {
        const running = {}
        game.players.forEach(pl => running[pl] = 0)
        for (let r = 0; r <= idx; r++) {
          Object.entries(roundData[r].scores || {}).forEach(([pl, sc]) => {
            running[pl] = (running[pl] || 0) + sc
          })
        }
        const sorted = Object.entries(running).sort(([,a],[,b]) => b - a)
        const rank = sorted.findIndex(([n]) => n === p)
        if (rank === 0 && idx > 0) {
          const prevRunning = {}
          game.players.forEach(pl => prevRunning[pl] = 0)
          for (let r = 0; r < idx; r++) {
            Object.entries(roundData[r].scores || {}).forEach(([pl, sc]) => {
              prevRunning[pl] = (prevRunning[pl] || 0) + sc
            })
          }
          const prevSorted = Object.entries(prevRunning).sort(([,a],[,b]) => b - a)
          const prevRank = prevSorted.findIndex(([n]) => n === p)
          if (prevRank > 0) {
            const deficit = prevSorted[0][1] - prevSorted.find(([n]) => n === p)[1]
            if (deficit > maxComeback) {
              maxComeback = deficit
              comebackPlayer = p
            }
          }
        }
      })
    })

    return {
      numRounds, totalPoints, avgScore, biggestLead, leadLabel, margin,
      playerConsistency, highestRoundScore, highestRoundPlayer, highestRoundNum,
      maxComeback, comebackPlayer,
    }
  }, [game, sortedPlayers, roundData, totalScores, playerAvatars])

  if (loading) return <LoadingSkeleton />

  const top3 = sortedPlayers.slice(0, 3)
  const rest = sortedPlayers.slice(3)
  const maxScore = sortedPlayers.length > 0 ? sortedPlayers[0].score : 1

  const podiumOrder = []
  if (top3[1]) podiumOrder.push({ ...top3[1], rank: 2 })
  if (top3[0]) podiumOrder.push({ ...top3[0], rank: 1 })
  if (top3[2]) podiumOrder.push({ ...top3[2], rank: 3 })

  const podiumHeights = { 1: 'h-44', 2: 'h-32', 3: 'h-24' }
  const podiumDelay = { 1: 0.35, 2: 0.18, 3: 0.04 }
  const podiumLabel = { 1: '1st', 2: '2nd', 3: '3rd' }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-bg-primary relative overflow-hidden"
    >
      <FireworksBackground />
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,var(--accent-primary)_0%,transparent_62%)] opacity-10 pointer-events-none" />

      <div className="relative z-10 px-4 py-10 max-w-5xl mx-auto">
        {(coachComment || coachTyping) && (
          <motion.div
            className="flex justify-center mb-6"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
          >
            <GameCoach comment={coachComment} emotion={coachEmotion} fadeAfterMs={10000} permanent isTyping={coachTyping} />
          </motion.div>
        )}

        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <p className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs font-bold uppercase tracking-[0.2em] mb-4">
            Final Standings
          </p>
          <h1 className="font-display text-5xl sm:text-6xl font-black text-text-primary tracking-tight mb-3">
            {sortedPlayers[0]?.name || 'Winner'} owns table.
          </h1>
          <p className="text-text-secondary text-base sm:text-lg font-medium max-w-xl mx-auto">
            Scores locked, bragging rights archived, rematch pressure fully loaded.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
          <div>
            <div className="relative bg-bg-elevated border border-ui-border rounded-[2rem] p-6 sm:p-8 shadow-elevated overflow-hidden mb-8">
              <div className="absolute inset-x-8 bottom-8 h-16 bg-accent-primary/10 blur-3xl rounded-full pointer-events-none" />
              <div className="flex items-end justify-center gap-3 sm:gap-5 px-1 relative z-10">
                {podiumOrder.map(player => {
                  const isTied = podiumOrder.some(
                    p => p.rank !== player.rank && p.score === player.score
                  )
                  return (
                    <motion.div
                      key={player.name}
                      className="flex flex-col items-center flex-1 max-w-[160px]"
                      initial={{ opacity: 0, y: 80 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: podiumDelay[player.rank], type: 'spring', stiffness: 220, damping: 18 }}
                    >
                      <div className="mb-3 text-center w-full">
                        <div className={`mx-auto mb-3 ${player.rank === 1 ? 'scale-110' : ''}`}>
                          <PlayerAvatar
                            name={player.name}
                            avatar={player.avatar}
                            size={player.rank === 1 ? 'lg' : 'md'}
                          />
                        </div>
                        <p className="font-display font-black text-text-primary text-sm sm:text-base truncate mt-2">
                          {player.name}
                        </p>
                        {isTied && (
                          <span className="inline-block text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-full mb-1 border border-accent-primary/20 uppercase tracking-wider">
                            tied
                          </span>
                        )}
                        <p className="font-mono font-extrabold text-xl text-accent-primary tabular-nums">
                          {player.score}
                        </p>
                      </div>
                      <motion.div
                        className={`w-full ${podiumHeights[player.rank]} rounded-t-3xl relative overflow-hidden shadow-lg border border-white/10 ${
                          player.rank === 1
                            ? 'bg-gradient-to-t from-accent-secondary to-accent-primary'
                            : player.rank === 2
                              ? 'bg-gradient-to-t from-bg-secondary to-bg-elevated'
                              : 'bg-gradient-to-t from-bg-primary to-bg-secondary'
                        }`}
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        transition={{ delay: podiumDelay[player.rank] + 0.16, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.28),transparent_42%)]" />
                        <div className="absolute bottom-4 inset-x-0 text-center">
                          <span className={`font-display font-black ${player.rank === 1 ? 'text-white/90 text-4xl' : 'text-text-muted text-3xl'}`}>
                            {podiumLabel[player.rank]}
                          </span>
                        </div>
                      </motion.div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            <motion.div
              className="card p-5 mb-8"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.62 }}
            >
              <h3 className="section-label mb-4">Score Overview</h3>
              <div className="space-y-3.5">
                {sortedPlayers.map((player, i) => {
                  const pct = maxScore > 0 ? (player.score / maxScore) * 100 : 0
                  return (
                    <motion.div
                      key={player.name}
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + i * 0.06 }}
                    >
                      <PlayerAvatar name={player.name} avatar={player.avatar} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-bold text-text-primary truncate">{player.name}</span>
                          <span className="text-sm font-mono font-bold text-accent-primary ml-2 tabular-nums">{player.score}</span>
                        </div>
                        <div className="w-full h-3.5 bg-bg-secondary rounded-full overflow-hidden border border-ui-border">
                          <motion.div
                            className={`h-full rounded-full ${BAR_STYLES[i % BAR_STYLES.length]}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, 3)}%` }}
                            transition={{ delay: 0.8 + i * 0.08, duration: 0.55, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>

            {rest.length > 0 && (
              <motion.div
                className="card p-5 mb-8"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.58 }}
              >
                <h3 className="section-label mb-3">Also Played</h3>
                <div className="space-y-2">
                  {rest.map((player, i) => {
                    const isTied = i > 0 && player.score === rest[i - 1].score
                    return (
                      <div key={player.name} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-bg-secondary transition-colors">
                        <span className="w-8 text-center text-text-muted font-bold text-xs font-mono">
                          #{i + 4}
                        </span>
                        <PlayerAvatar name={player.name} avatar={player.avatar} size="sm" />
                        <span className="flex-1 font-bold text-text-secondary text-sm">
                          {player.name}
                          {isTied && (
                            <span className="ml-2 text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded-full">
                              tie
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-text-primary text-sm tabular-nums">{player.score}</span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-6">
            {analytics && (
              <motion.div
                className="card p-5"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.72 }}
              >
                <h3 className="section-label mb-4">Game Analytics</h3>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-bg-primary rounded-2xl p-4 border border-ui-border">
                    <p className="stat-value">{analytics.numRounds}</p>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1">Rounds</p>
                  </div>
                  <div className="bg-bg-primary rounded-2xl p-4 border border-ui-border">
                    <p className="stat-value">{analytics.totalPoints}</p>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1">Total Points</p>
                  </div>
                  <div className="bg-bg-primary rounded-2xl p-4 border border-ui-border">
                    <p className="stat-value">{analytics.avgScore}</p>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1">Avg / Player</p>
                  </div>
                  <div className="bg-bg-primary rounded-2xl p-4 border border-ui-border">
                    <p className="stat-value">{analytics.margin}</p>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1">Win Margin</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  {analytics.highestRoundScore > 0 && (
                    <p className="text-text-secondary leading-snug">
                      <span className="font-bold text-text-primary">{analytics.highestRoundPlayer}</span> scored{' '}
                      <span className="font-mono font-bold text-accent-primary">{analytics.highestRoundScore}</span> in round {analytics.highestRoundNum}.
                    </p>
                  )}
                  {analytics.biggestLead > 0 && (
                    <p className="text-text-secondary leading-snug">
                      Biggest lead: <span className="font-mono font-bold text-accent-primary">{analytics.biggestLead} pts</span>
                      <span className="text-text-muted ml-1">({analytics.leadLabel})</span>
                    </p>
                  )}
                  {analytics.maxComeback > 0 && analytics.comebackPlayer && (
                    <p className="text-text-secondary leading-snug">
                      <span className="font-bold text-text-primary">{analytics.comebackPlayer}</span> overcame a{' '}
                      <span className="font-mono font-bold text-accent-primary">{analytics.maxComeback} pt deficit</span> to win.
                    </p>
                  )}
                  {analytics.playerConsistency.length > 0 && (
                    <p className="text-text-secondary leading-snug">
                      Most consistent: <span className="font-bold text-text-primary">{analytics.playerConsistency[0].name}</span>
                      <span className="text-text-muted ml-1">(avg {analytics.playerConsistency[0].avg}, σ {analytics.playerConsistency[0].stdDev})</span>
                    </p>
                  )}
                </div>

                {analytics.playerConsistency.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-ui-border">
                    <p className="section-label mb-3">Player Averages</p>
                    <div className="space-y-2">
                      {analytics.playerConsistency.map((p, i) => (
                        <div key={p.name} className="flex items-center gap-2.5 py-1">
                          <span className="w-6 text-center text-text-muted font-bold text-[10px] font-mono">#{i + 1}</span>
                          <PlayerAvatar name={p.name} avatar={p.avatar} size="xs" />
                          <span className="flex-1 font-medium text-text-secondary text-xs">{p.name}</span>
                          <span className="font-mono text-text-primary text-[11px] tabular-nums">avg {p.avg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <motion.div
              className="card p-5"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.86 }}
            >
              <h3 className="font-display text-xl font-black text-text-primary mb-4">Next move?</h3>
              <div className="grid gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setShowRematchConfirm(true)}
                  disabled={rematching}
                  className="btn-primary w-full py-4"
                >
                  {rematching ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Starting...
                    </span>
                  ) : 'Rematch Same Crew'}
                </motion.button>

                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowHomeConfirm(true)}
                    className="btn-secondary text-sm"
                  >
                    Home
                  </motion.button>

                  {archivedGameId && !archiving && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowHistoryConfirm(true)}
                      className="btn-secondary text-sm"
                    >
                      History
                    </motion.button>
                  )}
                  {archiving && (
                    <div className="h-12 rounded-xl bg-bg-secondary flex items-center justify-center border border-ui-border">
                      <svg className="w-4 h-4 text-text-muted animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showHomeConfirm}
        onClose={() => setShowHomeConfirm(false)}
        onConfirm={() => { setShowHomeConfirm(false); navigate('/name-input') }}
        title="Back to Home"
        message="Leave the podium and go back to the main menu?"
        confirmText="Yes, go home"
        cancelText="Stay here"
      />

      <ConfirmModal
        isOpen={showHistoryConfirm}
        onClose={() => setShowHistoryConfirm(false)}
        onConfirm={() => { setShowHistoryConfirm(false); navigate('/history') }}
        title="View Game History"
        message="Leave the podium to view your game history?"
        confirmText="View History"
        cancelText="Stay here"
      />

      <ConfirmModal
        isOpen={showRematchConfirm}
        onClose={() => setShowRematchConfirm(false)}
        onConfirm={handleRematch}
        title="Rematch?"
        message={`Start a new game with the same ${game?.players?.length || 0} players? Scores will be reset.`}
        confirmText="Let's go!"
        cancelText="Cancel"
      />
    </motion.div>
  )
}
