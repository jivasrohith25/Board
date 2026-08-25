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
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { x: 0.5, y: 0.4 },
    colors: ['#f19b4a', '#ed8027', '#e06416', '#ef4444', '#34d399', '#60a5fa', '#fbbf24', '#a78bfa'],
  })
  setTimeout(() => {
    confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } })
    confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } })
  }, 250)
  setTimeout(() => {
    confetti({ particleCount: 60, angle: 90, spread: 120, origin: { x: 0.5, y: 0.3 }, startVelocity: 45 })
  }, 600)
}

// Bar colors for each player
const BAR_COLORS = [
  'bg-primary-500', 'bg-orange-400', 'bg-emerald-400', 'bg-blue-400',
  'bg-purple-400', 'bg-pink-400', 'bg-yellow-400', 'bg-cyan-400',
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
  const [playerAvatars, setPlayerAvatars] = useState({})

  // Get archivedGameId from navigation state or URL
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
        confetti({ particleCount: 40, angle: 45, spread: 40, origin: { x: 0.1, y: 0.5 } })
        confetti({ particleCount: 40, angle: 135, spread: 40, origin: { x: 0.9, y: 0.5 } })
      }, 1500)
      const t2 = setTimeout(() => {
        confetti({ particleCount: 30, spread: 60, origin: { x: 0.3, y: 0.7 } })
        confetti({ particleCount: 30, spread: 60, origin: { x: 0.7, y: 0.7 } })
      }, 3000)

      // Fire-and-forget coach finale
      const winner = sortedPlayers[0]?.name || ''
      if (winner) {
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
            })
            .catch(() => {})
        }).catch(() => {})
      }

      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [loading, game])

  // Load avatars for all players by looking up usernames collection
  const loadAvatars = async (playerNames) => {
    try {
      const avatarMap = {}
      // Query usernames collection to get uid, then look up avatar from users collection
      const usernameQueries = playerNames.map(name =>
        getDoc(doc(db, 'usernames', name.toLowerCase()))
      )
      const usernameSnaps = await Promise.allSettled(usernameQueries)

      const userDocs = usernameSnaps
        .filter(s => s.status === 'fulfilled' && s.value.exists())
        .map(s => getDoc(doc(db, 'users', s.value.data().uid)))

      const userSnaps = await Promise.allSettled(userDocs)

      // We also need to map back from uid to username
      const uidToUsername = {}
      usernameSnaps.forEach(s => {
        if (s.status === 'fulfilled' && s.value.exists()) {
          const data = s.value.data()
          uidToUsername[data.uid] = data.id || playerNames.find(
            n => n.toLowerCase() === (s.value.id || '')
          )
        }
      })

      // Rebuild: query all usernames at once
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

  // Analytics
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

  const podiumHeights = { 1: 'h-36', 2: 'h-24', 3: 'h-16' }
  const podiumColors = { 1: 'bg-primary-500', 2: 'bg-primary-300', 3: 'bg-primary-200' }
  const podiumDelay = { 1: 0.4, 2: 0.2, 3: 0.0 }
  const podiumBounce = { 1: { type: 'spring', stiffness: 200, damping: 12 }, 2: { type: 'spring', stiffness: 300, damping: 20 }, 3: { type: 'spring', stiffness: 400, damping: 25 } }

  return (
    <div className="min-h-screen bg-warm-50 relative overflow-hidden">
      <FireworksBackground />

      <div className="relative z-10 px-4 py-8 max-w-lg mx-auto">
        {/* Mr. Slow Coach */}
        {coachComment && (
          <motion.div
            className="flex justify-center mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <GameCoach comment={coachComment} emotion={coachEmotion} fadeAfterMs={10000} />
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-3xl font-extrabold text-warm-900 mb-1">🏆 Game Over!</h1>
          <p className="text-warm-500">Here are the final standings</p>
        </motion.div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-3 mb-8 px-4">
          {podiumOrder.map(player => {
            const isTied = podiumOrder.some(
              p => p.rank !== player.rank && p.score === player.score
            )
            return (
              <motion.div
                key={player.name}
                className="flex flex-col items-center flex-1 max-w-[120px]"
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: podiumDelay[player.rank], ...podiumBounce[player.rank] }}
              >
                <div className="mb-2 text-center">
                  {player.rank === 1 && (
                    <motion.div
                      className="text-4xl mb-1"
                      animate={{ y: [0, -5, 0], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      👑
                    </motion.div>
                  )}
                  {player.rank === 2 && <div className="text-xl mb-1">🥈</div>}
                  {player.rank === 3 && <div className="text-xl mb-1">🥉</div>}

                  <PlayerAvatar
                    name={player.name}
                    avatar={player.avatar}
                    size={player.rank === 1 ? 'lg' : 'md'}
                  />

                  <p className="font-bold text-warm-900 text-sm truncate max-w-[100px] mt-1">
                    {player.name}
                  </p>
                  {isTied && (
                    <span className="inline-block text-[10px] font-bold text-primary-500 bg-primary-100 px-1.5 py-0.5 rounded-full mb-1">
                      TIED
                    </span>
                  )}
                  <p className="font-mono font-extrabold text-lg text-primary-600">
                    {player.score}
                  </p>
                </div>
                <motion.div
                  className={`w-full ${podiumHeights[player.rank]} ${podiumColors[player.rank]} rounded-t-xl ${
                    player.rank === 1 ? 'shadow-lg shadow-primary-300/40' : ''
                  }`}
                  initial={{ height: 0 }}
                  animate={{
                    height: 'auto',
                    boxShadow: player.rank === 1
                      ? ['0 0 0px 0px rgba(237,128,39,0)', '0 0 20px 4px rgba(237,128,39,0.3)', '0 0 0px 0px rgba(237,128,39,0)']
                      : undefined,
                  }}
                  transition={{
                    height: { delay: podiumDelay[player.rank] + 0.1, duration: 0.5, ease: 'easeOut' },
                    boxShadow: player.rank === 1
                      ? { delay: 1, duration: 2, repeat: Infinity, ease: 'easeInOut' }
                      : undefined,
                  }}
                />
              </motion.div>
            )
          })}
        </div>

        {/* Remaining Players */}
        {rest.length > 0 && (
          <motion.div
            className="card p-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-sm font-bold text-warm-500 uppercase tracking-wider mb-3">
              Other Players
            </h3>
            <div className="space-y-2">
              {rest.map((player, i) => {
                const isTied = i > 0 && player.score === rest[i - 1].score
                return (
                  <div key={player.name} className="flex items-center gap-3 py-2">
                    <span className="w-8 text-center text-warm-400 font-bold text-sm">
                      #{i + 4}
                    </span>
                    <PlayerAvatar name={player.name} avatar={player.avatar} size="sm" />
                    <span className="flex-1 font-medium text-warm-900">
                      {player.name}
                      {isTied && (
                        <span className="ml-1.5 text-[10px] font-bold text-primary-500 bg-primary-100 px-1.5 py-0.5 rounded-full">
                          TIE
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-bold text-warm-700">{player.score}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Score Bar Chart with Avatars */}
        <motion.div
          className="card p-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <h3 className="text-sm font-bold text-warm-500 uppercase tracking-wider mb-4">
            📊 Score Overview
          </h3>
          <div className="space-y-3">
            {sortedPlayers.map((player, i) => {
              const pct = maxScore > 0 ? (player.score / maxScore) * 100 : 0
              return (
                <motion.div
                  key={player.name}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                >
                  <PlayerAvatar name={player.name} avatar={player.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-warm-800 truncate">{player.name}</span>
                      <span className="text-xs font-mono font-bold text-primary-600 ml-2">{player.score}</span>
                    </div>
                    <div className="w-full h-4 bg-warm-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, 2)}%` }}
                        transition={{ delay: 0.8 + i * 0.1, duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Game Analytics */}
        {analytics && (
          <motion.div
            className="card p-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <h3 className="text-sm font-bold text-warm-500 uppercase tracking-wider mb-4">
              📊 Game Analytics
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-warm-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-primary-600 font-mono">{analytics.numRounds}</p>
                <p className="text-[11px] text-warm-500 font-medium">Rounds Played</p>
              </div>
              <div className="bg-warm-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-primary-600 font-mono">{analytics.totalPoints}</p>
                <p className="text-[11px] text-warm-500 font-medium">Total Points Scored</p>
              </div>
              <div className="bg-warm-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-primary-600 font-mono">{analytics.avgScore}</p>
                <p className="text-[11px] text-warm-500 font-medium">Avg Score / Player</p>
              </div>
              <div className="bg-warm-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-primary-600 font-mono">{analytics.margin}</p>
                <p className="text-[11px] text-warm-500 font-medium">Winning Margin</p>
              </div>
            </div>

            {/* Highlights */}
            <div className="space-y-2.5">
              {analytics.highestRoundScore > 0 && (
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="text-lg">🔥</span>
                  <span className="text-warm-700">
                    <span className="font-bold text-warm-900">{analytics.highestRoundPlayer}</span> scored{' '}
                    <span className="font-mono font-bold text-primary-600">{analytics.highestRoundScore}</span> in round {analytics.highestRoundNum}
                  </span>
                </div>
              )}
              {analytics.biggestLead > 0 && (
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="text-lg">📈</span>
                  <span className="text-warm-700">
                    Biggest lead: <span className="font-mono font-bold text-primary-600">{analytics.biggestLead} pts</span>
                    <span className="text-warm-400 ml-1">({analytics.leadLabel})</span>
                  </span>
                </div>
              )}
              {analytics.maxComeback > 0 && analytics.comebackPlayer && (
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="text-lg">💪</span>
                  <span className="text-warm-700">
                    <span className="font-bold text-warm-900">{analytics.comebackPlayer}</span> overcame a{' '}
                    <span className="font-mono font-bold text-primary-600">{analytics.maxComeback} pt deficit</span> to win
                  </span>
                </div>
              )}
              {analytics.playerConsistency.length > 0 && (
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="text-lg">🎯</span>
                  <span className="text-warm-700">
                    Most consistent: <span className="font-bold text-warm-900">{analytics.playerConsistency[0].name}</span>
                    <span className="text-warm-400 ml-1">(avg {analytics.playerConsistency[0].avg}, σ {analytics.playerConsistency[0].stdDev})</span>
                  </span>
                </div>
              )}
            </div>

            {/* Player Averages with avatars */}
            {analytics.playerConsistency.length > 0 && (
              <div className="mt-4 pt-3 border-t border-warm-100">
                <p className="text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">Player Averages</p>
                <div className="space-y-2">
                  {analytics.playerConsistency.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2.5">
                      <span className="w-5 text-center text-warm-400 font-bold text-xs">#{i + 1}</span>
                      <PlayerAvatar name={p.name} avatar={p.avatar} size="xs" />
                      <span className="flex-1 font-medium text-warm-800 text-xs">{p.name}</span>
                      <span className="font-mono text-warm-600 text-xs">avg {p.avg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <div className="flex items-center justify-center gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowHomeConfirm(true)}
              className="btn-ghost border border-warm-200 px-6"
            >
              🏠 Home
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowRematchConfirm(true)}
              disabled={rematching}
              className="btn-primary px-6"
            >
              {rematching ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Starting…
                </span>
              ) : '🔄 Rematch'}
            </motion.button>

            {archivedGameId && !archiving && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowHistoryConfirm(true)}
                className="btn-ghost border border-warm-200 px-4"
              >
                📜 History
              </motion.button>
            )}
            {archiving && (
              <div className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-warm-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Confirm: Back to Home */}
      <ConfirmModal
        isOpen={showHomeConfirm}
        onClose={() => setShowHomeConfirm(false)}
        onConfirm={() => { setShowHomeConfirm(false); navigate('/name-input') }}
        title="Back to Home"
        message="Leave the podium and go back to the main menu?"
        confirmText="Yes, go home"
        cancelText="Stay here"
      />

      {/* Confirm: Game History */}
      <ConfirmModal
        isOpen={showHistoryConfirm}
        onClose={() => setShowHistoryConfirm(false)}
        onConfirm={() => { setShowHistoryConfirm(false); navigate('/history') }}
        title="View Game History"
        message="Leave the podium to view your game history?"
        confirmText="View History"
        cancelText="Stay here"
      />

      {/* Confirm: Rematch */}
      <ConfirmModal
        isOpen={showRematchConfirm}
        onClose={() => setShowRematchConfirm(false)}
        onConfirm={handleRematch}
        title="Rematch?"
        message={`Start a new game with the same ${game?.players?.length || 0} players? Scores will be reset.`}
        confirmText="Let's go!"
        cancelText="Cancel"
      />
    </div>
  )
}
