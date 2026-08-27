import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { v4 as uuidv4 } from 'uuid'
import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'
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

  confetti({ particleCount: 80, spread: 70, origin: { x: 0.5, y: 0.32 }, startVelocity: 42, colors })
  setTimeout(() => { confetti({ particleCount: 55, angle: 58, spread: 55, origin: { x: 0.08, y: 0.56 }, colors }) }, 280)
  setTimeout(() => { confetti({ particleCount: 55, angle: 122, spread: 55, origin: { x: 0.92, y: 0.56 }, colors }) }, 520)
  setTimeout(() => { confetti({ particleCount: 45, spread: 110, origin: { x: 0.5, y: 0.46 }, startVelocity: 34, colors }) }, 920)
}

const BAR_STYLES = ['bg-accent-primary', 'bg-accent-secondary', 'bg-status-success', 'bg-status-warning']

// Resolve player names from potentially mixed format
function getPlayerNames(players) {
  if (!players || players.length === 0) return []
  if (typeof players[0] === 'string') return players
  return players.map(p => p.display_name)
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateJoinCode() {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

export function ResultsScreen() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, username, displayName } = useAuth()
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

  // Victory music (Part 4)
  const musicRef = useRef(null)
  const [musicMuted, setMusicMuted] = useState(false)
  const [musicPlaying, setMusicPlaying] = useState(false)

  useEffect(() => {
    const audio = new Audio('/victory_music.mpeg')
    audio.loop = false
    audio.volume = 0.6
    musicRef.current = audio

    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.then(() => setMusicPlaying(true)).catch(() => {})
    }

    return () => {
      audio.pause()
      audio.currentTime = 0
      musicRef.current = null
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (!musicRef.current) return
    musicRef.current.muted = !musicRef.current.muted
    setMusicMuted(musicRef.current.muted)
  }, [])

  useEffect(() => {
    if (location.state?.archivedGameId) { setArchivedGameId(location.state.archivedGameId); setArchiving(false) }
  }, [location.state])

  useEffect(() => { loadGame() }, [gameId])

  useEffect(() => {
    if (!loading && game) {
      burstConfetti()
      const t1 = setTimeout(() => {
        const styles = getComputedStyle(document.documentElement)
        const colors = [styles.getPropertyValue('--accent-primary').trim(), styles.getPropertyValue('--accent-secondary').trim(), styles.getPropertyValue('--warning').trim()].filter(Boolean)
        confetti({ particleCount: 34, angle: 45, spread: 40, origin: { x: 0.1, y: 0.5 }, colors })
        confetti({ particleCount: 34, angle: 135, spread: 40, origin: { x: 0.9, y: 0.5 }, colors })
      }, 1600)
      const t2 = setTimeout(() => {
        const styles = getComputedStyle(document.documentElement)
        const colors = [styles.getPropertyValue('--accent-primary').trim(), styles.getPropertyValue('--success').trim()].filter(Boolean)
        confetti({ particleCount: 26, spread: 65, origin: { x: 0.32, y: 0.72 }, colors })
        confetti({ particleCount: 26, spread: 65, origin: { x: 0.68, y: 0.72 }, colors })
      }, 3100)

      const winner = sortedPlayers[0]?.name || ''
      if (winner) {
        setCoachTyping(true)
        user.getIdToken().then(token => {
          fetch(`${API_BASE}/coach-finale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ game_id: gameId, winner, final_scores: totalScores }),
            signal: AbortSignal.timeout(10000),
          })
            .then(r => { if (!r.ok) throw new Error(`Coach finale API ${r.status}`); return r.json() })
            .then(data => { if (data.comment) { setCoachComment(data.comment); setCoachEmotion(data.emotion || 'default') }; setCoachTyping(false) })
            .catch(err => { console.warn('Coach finale failed:', err?.message || err); setCoachTyping(false) })
        }).catch(() => setCoachTyping(false))
      }
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [loading, game])

  const loadAvatars = async (playerNames) => {
    try {
      const avatarMap = {}
      const results = await Promise.allSettled(playerNames.map(async (name) => {
        const unameSnap = await getDoc(doc(db, 'usernames', name.toLowerCase()))
        if (!unameSnap.exists()) return { name, avatar: null }
        const uid = unameSnap.data().uid
        const userSnap = await getDoc(doc(db, 'users', uid))
        if (!userSnap.exists()) return { name, avatar: null }
        return { name, avatar: userSnap.data().avatar || null }
      }))
      results.forEach(r => { if (r.status === 'fulfilled' && r.value) avatarMap[r.value.name] = r.value.avatar })
      setPlayerAvatars(avatarMap)
    } catch (err) { console.error('Failed to load avatars:', err) }
  }

  const handleRematch = async () => {
    setShowRematchConfirm(false)
    if (!game || !game.players || rematching) return
    setRematching(true)
    try {
      const newGameId = uuidv4()
      const joinCode = generateJoinCode()
      const names = getPlayerNames(game.players)
      const playersArray = names.map(name => {
        const existing = (game.players || []).find(p => (typeof p === 'object' ? p.display_name : p) === name)
        return typeof existing === 'object' ? existing : { uid: null, display_name: name }
      })
      const playerUidsList = playersArray.filter(p => p.uid).map(p => p.uid)
      await setDoc(doc(db, 'games', newGameId), {
        createdBy: user.uid, username,
        players: playersArray, playerUids: playerUidsList,
        roundLength: game.roundLength || 5, joinCode,
        currentRound: 1, status: 'lobby', createdAt: serverTimestamp(),
      })
      navigate(`/point-entry/${newGameId}`)
    } catch (err) { console.error('Rematch failed:', err); setRematching(false) }
  }

  const loadGame = async () => {
    try {
      const gameDoc = await getDoc(doc(db, 'games', gameId))
      if (!gameDoc.exists()) {
        if (location.state?.archivedGameId) { setArchivedGameId(location.state.archivedGameId); setArchiving(false) }
        else {
          try {
            const token = await user.getIdToken()
            const res = await fetch(`${API_BASE}/history/${username}/${gameId}`, { headers: { Authorization: `Bearer ${token}` } })
            if (res.ok) {
              const data = await res.json()
              setGame({ players: data.players })
              const totals = {}
              data.players.forEach(p => totals[p] = 0)
              if (data.rounds) data.rounds.forEach(r => Object.entries(r.scores || {}).forEach(([p, s]) => { totals[p] = (totals[p] || 0) + s }))
              if (data.final_scores) Object.assign(totals, data.final_scores)
              setTotalScores(totals); setRoundData(data.rounds || []); setArchivedGameId(gameId); setArchiving(false); setLoading(false)
              if (data.players) loadAvatars(data.players)
              return
            }
          } catch {}
          navigate('/name-input')
        }
        setLoading(false); return
      }
      const gameData = gameDoc.data()
      setGame(gameData)
      const roundsSnap = await getDocs(collection(db, 'games', gameId, 'rounds'))
      const rounds = [], totals = {}
      const names = getPlayerNames(gameData.players)
      names.forEach(p => totals[p] = 0)
      roundsSnap.forEach(d => { const r = d.data(); rounds.push({ id: d.id, ...r }); Object.entries(r.scores).forEach(([p, s]) => { totals[p] = (totals[p] || 0) + s }) })
      rounds.sort((a, b) => parseInt(a.id) - parseInt(b.id))
      setRoundData(rounds); setTotalScores(totals); setArchivedGameId(gameId); setArchiving(false); setLoading(false); loadAvatars(names)
    } catch (err) { console.error('Failed to load results:', err); setArchiving(false); setLoading(false) }
  }

  const playerNames = useMemo(() => getPlayerNames(game?.players), [game?.players])

  const sortedPlayers = useMemo(() => {
    if (!game) return []
    return playerNames.map(name => ({ name, score: totalScores[name] || 0, avatar: playerAvatars[name] || null })).sort((a, b) => b.score - a.score)
  }, [playerNames, totalScores, playerAvatars])

  const analytics = useMemo(() => {
    if (!game || sortedPlayers.length === 0) return null
    const numRounds = roundData.length, allScores = Object.values(totalScores), totalPoints = allScores.reduce((a, b) => a + b, 0)
    const avgScore = numRounds > 0 ? (totalPoints / playerNames.length).toFixed(1) : 0
    let biggestLead = 0, leadLabel = ''
    const runningTotals = {}; playerNames.forEach(p => runningTotals[p] = 0)
    roundData.forEach((round, idx) => {
      Object.entries(round.scores || {}).forEach(([p, s]) => { runningTotals[p] = (runningTotals[p] || 0) + s })
      const vals = Object.values(runningTotals), max = Math.max(...vals), min = Math.min(...vals)
      if (max - min > biggestLead) { biggestLead = max - min; const leader = Object.keys(runningTotals).find(k => runningTotals[k] === max); leadLabel = `Round ${idx + 1}: ${leader} +${biggestLead}` }
    })
    const margin = sortedPlayers.length >= 2 ? sortedPlayers[0].score - sortedPlayers[1].score : sortedPlayers[0]?.score || 0
    const playerConsistency = playerNames.map(p => {
      const pScores = roundData.map(r => r.scores?.[p] || 0), mean = pScores.length > 0 ? pScores.reduce((a, b) => a + b, 0) / pScores.length : 0
      const variance = pScores.length > 0 ? pScores.reduce((a, s) => a + (s - mean) ** 2, 0) / pScores.length : 0
      return { name: p, stdDev: Math.sqrt(variance).toFixed(1), avg: mean.toFixed(1), avatar: playerAvatars[p] || null }
    }).sort((a, b) => parseFloat(a.stdDev) - parseFloat(b.stdDev))
    let highestRoundScore = 0, highestRoundPlayer = '', highestRoundNum = 0
    roundData.forEach((round, idx) => { Object.entries(round.scores || {}).forEach(([p, s]) => { if (s > highestRoundScore) { highestRoundScore = s; highestRoundPlayer = p; highestRoundNum = idx + 1 } }) })
    let maxComeback = 0, comebackPlayer = ''
    roundData.forEach((round, idx) => {
      Object.entries(round.scores || {}).forEach(([p, s]) => {
        const running = {}; playerNames.forEach(pl => running[pl] = 0)
        for (let r = 0; r <= idx; r++) Object.entries(roundData[r].scores || {}).forEach(([pl, sc]) => { running[pl] = (running[pl] || 0) + sc })
        const sorted = Object.entries(running).sort(([, a], [, b]) => b - a), rank = sorted.findIndex(([n]) => n === p)
        if (rank === 0 && idx > 0) {
          const prevRunning = {}; playerNames.forEach(pl => prevRunning[pl] = 0)
          for (let r = 0; r < idx; r++) Object.entries(roundData[r].scores || {}).forEach(([pl, sc]) => { prevRunning[pl] = (prevRunning[pl] || 0) + sc })
          const prevSorted = Object.entries(prevRunning).sort(([, a], [, b]) => b - a), prevRank = prevSorted.findIndex(([n]) => n === p)
          if (prevRank > 0) { const deficit = prevSorted[0][1] - prevSorted.find(([n]) => n === p)[1]; if (deficit > maxComeback) { maxComeback = deficit; comebackPlayer = p } }
        }
      })
    })
    return { numRounds, totalPoints, avgScore, biggestLead, leadLabel, margin, playerConsistency, highestRoundScore, highestRoundPlayer, highestRoundNum, maxComeback, comebackPlayer }
  }, [playerNames, sortedPlayers, roundData, totalScores, playerAvatars])

  if (loading) return <LoadingSkeleton />

  const top3 = sortedPlayers.slice(0, 3)
  const rest = sortedPlayers.slice(3)
  const maxScore = sortedPlayers.length > 0 ? sortedPlayers[0].score : 1

  // Podium layout: 2nd left, 1st center (tallest), 3rd right
  const podiumOrder = []
  if (top3[1]) podiumOrder.push({ ...top3[1], rank: 2 })
  if (top3[0]) podiumOrder.push({ ...top3[0], rank: 1 })
  if (top3[2]) podiumOrder.push({ ...top3[2], rank: 3 })

  const podiumHeights = { 1: 192, 2: 136, 3: 96 }
  const podiumDelay = { 1: 0.35, 2: 0.18, 3: 0.04 }
  const podiumLabel = { 1: '1ST', 2: '2ND', 3: '3RD' }
  const podiumGold = { 1: '#ee1f66', 2: '#888888', 3: '#cd7f32' }

  const FONT = "'Source Code Pro', monospace"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', fontFamily: FONT }}
    >
      {/* Background image */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'url(/bg/podium page.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(4px) brightness(0.85)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1 }} />

      <FireworksBackground />

      <div style={{ position: 'relative', zIndex: 10, padding: '32px 16px', maxWidth: '1080px', margin: '0 auto' }}>
        {/* Victory Music Toggle */}
        <div style={{ position: 'fixed', top: '60px', right: '16px', zIndex: 50 }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            style={{
              width: '44px', height: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#29292a', color: musicMuted ? 'rgba(255,255,255,0.4)' : '#ee1f66',
              border: '1px solid #ffffff', borderRadius: '15px',
              cursor: 'pointer', padding: 0, fontFamily: FONT,
            }}
            title={musicMuted ? 'Unmute victory music' : 'Mute victory music'}
          >
            {musicMuted ? (
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </motion.button>
        </div>

        {/* Coach */}
        {(coachComment || coachTyping) && (
          <motion.div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
            <GameCoach comment={coachComment} emotion={coachEmotion} fadeAfterMs={10000} permanent isTyping={coachTyping} />
          </motion.div>
        )}

        {/* Title */}
        <motion.div style={{ textAlign: 'center', marginBottom: '32px' }} initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <div className="kippo-label-bar" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px' }}>🏆</span>
            FINAL STANDINGS
          </div>
          <h1 style={{ fontFamily: FONT, fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: '900', color: '#ffffff', margin: '0 0 8px 0' }}>
            {sortedPlayers[0]?.name || 'Winner'} owns table.
          </h1>
          <p style={{ fontFamily: FONT, fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>
            Scores locked, bragging rights archived, rematch pressure fully loaded.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          {/* LEFT COLUMN — Podium + Score Overview */}
          <div>
            {/* Podium — Block Platforms (Part 6) */}
            <motion.div
              className="kippo-card"
              style={{ padding: '24px 16px', marginBottom: '16px', overflow: 'hidden' }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', paddingBottom: '8px' }}>
                {podiumOrder.map((player) => {
                  const isTied = podiumOrder.some(p => p.rank !== player.rank && p.score === player.score)
                  const height = podiumHeights[player.rank]
                  const gold = podiumGold[player.rank]
                  return (
                    <motion.div
                      key={player.name}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '160px' }}
                      initial={{ opacity: 0, y: 80 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: podiumDelay[player.rank], type: 'spring', stiffness: 220, damping: 18 }}
                    >
                      {/* Player info */}
                      <div style={{ marginBottom: '12px', textAlign: 'center', width: '100%' }}>
                        <div style={{ transform: player.rank === 1 ? 'scale(1.1)' : 'none', marginBottom: '8px' }}>
                          <PlayerAvatar name={player.name} avatar={player.avatar} size={player.rank === 1 ? 'lg' : 'md'} />
                        </div>
                        <p style={{ fontFamily: FONT, fontSize: '13px', fontWeight: '900', color: '#ffffff', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {player.name}
                        </p>
                        {isTied && (
                          <span style={{ fontFamily: FONT, fontSize: '8px', fontWeight: '700', color: '#ee1f66', background: 'rgba(238,31,102,0.2)', padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TIED</span>
                        )}
                        <p style={{ fontFamily: FONT, fontSize: '18px', fontWeight: '900', color: gold, margin: '4px 0 0 0', fontVariantNumeric: 'tabular-nums' }}>
                          {player.score}
                        </p>
                      </div>

                      {/* Block Platform */}
                      <motion.div
                        style={{
                          width: '100%', height: `${height}px`,
                          background: gold,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative', overflow: 'hidden',
                          border: '1px solid #ffffff',
                          borderRadius: '15px',
                        }}
                        initial={{ height: 0 }}
                        animate={{ height }}
                        transition={{ delay: podiumDelay[player.rank] + 0.16, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <span style={{
                          fontFamily: FONT, fontSize: player.rank === 1 ? '32px' : '24px', fontWeight: '900',
                          color: '#ffffff',
                          position: 'relative', zIndex: 1,
                        }}>
                          {podiumLabel[player.rank]}
                        </span>
                      </motion.div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>

            {/* Score Overview */}
            <motion.div className="kippo-card" style={{ padding: '16px', marginBottom: '16px' }} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}>
              <div className="kippo-label-bar" style={{ marginBottom: '12px' }}>SCORE OVERVIEW</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sortedPlayers.map((player, i) => {
                  const pct = maxScore > 0 ? (player.score / maxScore) * 100 : 0
                  return (
                    <motion.div key={player.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.06 }}>
                      <PlayerAvatar name={player.name} avatar={player.avatar} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontFamily: FONT, fontSize: '12px', fontWeight: '700', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
                          <span style={{ fontFamily: FONT, fontSize: '12px', fontWeight: '900', color: '#ee1f66', fontVariantNumeric: 'tabular-nums', marginLeft: '8px' }}>{player.score}</span>
                        </div>
                        <div style={{ width: '100%', height: '14px', background: '#1a1a1a', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <motion.div style={{ height: '100%', background: '#ee1f66' }} initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 3)}%` }} transition={{ delay: 0.8 + i * 0.08, duration: 0.55, ease: 'easeOut' }} />
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>

            {/* Also Played */}
            {rest.length > 0 && (
              <motion.div className="kippo-card" style={{ padding: '16px', marginBottom: '16px' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
                <div className="kippo-label-bar" style={{ marginBottom: '8px' }}>ALSO PLAYED</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {rest.map((player, i) => {
                    const isTied = i > 0 && player.score === rest[i - 1].score
                    return (
                      <div key={player.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                        <span style={{ fontFamily: FONT, width: '24px', fontSize: '9px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>#{i + 4}</span>
                        <PlayerAvatar name={player.name} avatar={player.avatar} size="sm" />
                        <span style={{ fontFamily: FONT, flex: 1, fontSize: '12px', fontWeight: '700', color: '#ffffff' }}>
                          {player.name}
                          {isTied && <span style={{ fontSize: '8px', color: '#ee1f66', marginLeft: '4px' }}>TIE</span>}
                        </span>
                        <span style={{ fontFamily: FONT, fontSize: '12px', fontWeight: '700', color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>{player.score}</span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </div>

          {/* RIGHT COLUMN — Analytics + Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Game Analytics */}
            {analytics && (
              <motion.div className="kippo-card" style={{ padding: '16px' }} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.72 }}>
                <div className="kippo-label-bar" style={{ marginBottom: '12px' }}>GAME ANALYTICS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { value: analytics.numRounds, label: 'Rounds' },
                    { value: analytics.totalPoints, label: 'Total Points' },
                    { value: analytics.avgScore, label: 'Avg / Player' },
                    { value: analytics.margin, label: 'Win Margin' },
                  ].map(({ value, label }) => (
                    <div key={label} style={{ padding: '12px', background: '#000000', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '15px' }}>
                      <p style={{ fontFamily: FONT, fontSize: '22px', fontWeight: '900', color: '#ee1f66', margin: 0 }}>{value}</p>
                      <p style={{ fontFamily: FONT, fontSize: '9px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '2px 0 0 0' }}>{label}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontFamily: FONT, color: '#ffffff' }}>
                  {analytics.highestRoundScore > 0 && (
                    <p style={{ margin: 0 }}>
                      <strong style={{ color: '#ffffff' }}>{analytics.highestRoundPlayer}</strong> scored{' '}
                      <span style={{ fontFamily: FONT, fontWeight: '900', color: '#ee1f66' }}>{analytics.highestRoundScore}</span> in round {analytics.highestRoundNum}.
                    </p>
                  )}
                  {analytics.biggestLead > 0 && (
                    <p style={{ margin: 0 }}>
                      Biggest lead: <span style={{ fontFamily: FONT, fontWeight: '900', color: '#ee1f66' }}>{analytics.biggestLead} pts</span>{' '}
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>({analytics.leadLabel})</span>
                    </p>
                  )}
                  {analytics.maxComeback > 0 && analytics.comebackPlayer && (
                    <p style={{ margin: 0 }}>
                      <strong style={{ color: '#ffffff' }}>{analytics.comebackPlayer}</strong> overcame a{' '}
                      <span style={{ fontFamily: FONT, fontWeight: '900', color: '#ee1f66' }}>{analytics.maxComeback} pt deficit</span> to win.
                    </p>
                  )}
                  {analytics.playerConsistency.length > 0 && (
                    <p style={{ margin: 0 }}>
                      Most consistent: <strong style={{ color: '#ffffff' }}>{analytics.playerConsistency[0].name}</strong>{' '}
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>(avg {analytics.playerConsistency[0].avg}, σ {analytics.playerConsistency[0].stdDev})</span>
                    </p>
                  )}
                </div>

                {analytics.playerConsistency.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="kippo-label-bar" style={{ marginBottom: '8px' }}>PLAYER AVERAGES</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {analytics.playerConsistency.map((p, i) => (
                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                          <span style={{ fontFamily: FONT, width: '16px', fontSize: '9px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>#{i + 1}</span>
                          <PlayerAvatar name={p.name} avatar={p.avatar} size="xs" />
                          <span style={{ fontFamily: FONT, flex: 1, fontSize: '11px', fontWeight: '600', color: '#ffffff' }}>{p.name}</span>
                          <span style={{ fontFamily: FONT, fontSize: '10px', color: '#ee1f66', fontVariantNumeric: 'tabular-nums' }}>avg {p.avg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Next Move */}
            <motion.div className="kippo-card" style={{ padding: '16px' }} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.86 }}>
              <div className="kippo-label-bar" style={{ marginBottom: '12px' }}>NEXT MOVE?</div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowRematchConfirm(true)} disabled={rematching} className="kippo-btn-primary" style={{ width: '100%', marginBottom: '8px', padding: '16px 24px', fontFamily: FONT }}>
                {rematching ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <svg style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    STARTING...
                  </span>
                ) : '🔄 REMATCH SAME CREW'}
              </motion.button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowHomeConfirm(true)} className="kippo-btn-ghost" style={{ fontFamily: FONT }}>
                  HOME
                </motion.button>
                {archivedGameId && !archiving && (
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowHistoryConfirm(true)} className="kippo-btn-ghost" style={{ fontFamily: FONT }}>
                    HISTORY
                  </motion.button>
                )}
                {archiving && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', background: '#000000', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '15px' }}>
                    <svg style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite', color: 'rgba(255,255,255,0.4)' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <ConfirmModal isOpen={showHomeConfirm} onClose={() => setShowHomeConfirm(false)} onConfirm={() => { setShowHomeConfirm(false); navigate('/name-input') }} title="Back to Home" message="Leave the podium and go back to the main menu?" confirmText="Yes, go home" cancelText="Stay here" />
      <ConfirmModal isOpen={showHistoryConfirm} onClose={() => setShowHistoryConfirm(false)} onConfirm={() => { setShowHistoryConfirm(false); navigate('/history') }} title="View Game History" message="Leave the podium to view your game history?" confirmText="View History" cancelText="Stay here" />
      <ConfirmModal isOpen={showRematchConfirm} onClose={() => setShowRematchConfirm(false)} onConfirm={handleRematch} title="Rematch?" message={`Start a new game with the same ${game?.players?.length || 0} players? Scores will be reset.`} confirmText="Let's go!" cancelText="Cancel" />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  )
}
