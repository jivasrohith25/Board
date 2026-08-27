import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { doc, setDoc, serverTimestamp, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../config/avatars'
import { TiltCard } from '../components/TiltCard'

const STORAGE_KEY = 'bgsk_draft'

// Join code: uppercase letters+digits, excluding ambiguous chars (0, O, 1, I)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateJoinCode() {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { playerNames: [], roundLength: 5 }
}

function saveDraft(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function NameInputScreen() {
  const { user, username, displayName, avatar, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isRajaRani = searchParams.get('game') === 'raja-rani'
  const draft = loadDraft()

  const [playerNames, setPlayerNames] = useState(draft.playerNames || [])
  const [roundLength, setRoundLength] = useState(draft.roundLength || 20)
  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const inputRef = useRef(null)

  // Lobby state (after game is created)
  const [gameId, setGameId] = useState(null)
  const [gameData, setGameData] = useState(null)
  const [copied, setCopied] = useState(false)
  const unsubRef = useRef(null)

  useEffect(() => {
    if (!gameId) saveDraft({ playerNames, roundLength })
  }, [playerNames, roundLength, gameId])

  // Clean up snapshot listener on unmount
  useEffect(() => {
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [])

  const addPlayer = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) { setError('Name cannot be empty'); return }
    if (trimmed.length > 20) { setError('Name must be 20 characters or less'); return }
    if (playerNames.some(p => p.toLowerCase() === trimmed.toLowerCase())) { setError('This name is already added'); return }
    setPlayerNames(prev => [...prev, trimmed])
    setNameInput('')
    setError('')
    inputRef.current?.focus()
  }

  const removePlayer = (index) => {
    setPlayerNames(prev => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addPlayer() }
  }

  const adjustRoundLength = (delta) => {
    setRoundLength(prev => Math.max(1, Math.min(99, prev + delta)))
  }

  const handleStart = async () => {
    if (playerNames.length < 2 || starting) return
    setStarting(true)
    try {
      const newGameId = uuidv4()
      const joinCode = generateJoinCode()

      // Build players array: first is host, rest are pending (uid: null)
      const hostDisplayName = displayName || username
      const playersArray = [
        { uid: user.uid, display_name: hostDisplayName },
        ...playerNames
          .filter(n => n.toLowerCase() !== hostDisplayName.toLowerCase())
          .map(n => ({ uid: null, display_name: n })),
      ]
      const playerUids = [user.uid]

      await setDoc(doc(db, 'games', newGameId), {
        createdBy: user.uid,
        username,
        players: playersArray,
        playerUids,
        roundLength,
        joinCode,
        currentRound: 1,
        status: 'lobby',
        createdAt: serverTimestamp(),
      })

      localStorage.removeItem(STORAGE_KEY)
      setGameId(newGameId)

      // Subscribe to live game updates
      unsubRef.current = onSnapshot(doc(db, 'games', newGameId), (snap) => {
        if (!snap.exists()) return
        setGameData(snap.data())
      }, (err) => {
        console.error('Lobby listener error:', err)
      })
    } catch (err) {
      console.error('Failed to create game:', err)
      setError('Failed to create game. Please try again.')
      setStarting(false)
    }
  }

  const handleCopyCode = async () => {
    if (!gameData?.joinCode) return
    try {
      await navigator.clipboard.writeText(gameData.joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for non-HTTPS
      const ta = document.createElement('textarea')
      ta.value = gameData.joinCode
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleStartGame = async () => {
    if (!gameId || !gameData) return
    try {
      await updateDoc(doc(db, 'games', gameId), {
        startedAt: serverTimestamp(),
        status: 'active',
      })
      if (unsubRef.current) unsubRef.current()
      navigate(`/point-entry/${gameId}`)
    } catch (err) {
      console.error('Failed to start game:', err)
      setError('Failed to start game.')
    }
  }

  const canStart = playerNames.length >= 2

  // Determine current user's display name for lobby identification
  const myDisplayName = displayName || username
  const isHost = gameData?.createdBy === user.uid
  const lobbyPlayers = gameData?.players || []
  const lobbyUids = gameData?.playerUids || []

  const SectionHeader = ({ title, icon }) => (
    <div className="section-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '12px' }}>{icon}</span>
      {title}
    </div>
  )

  // LOBBY VIEW — after game is created
  if (gameId && gameData) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        style={{
          minHeight: 'calc(100vh - 48px)',
          background: '#7a8aba',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="name-input-grid" style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '12px', alignItems: 'start' }}>

          {/* LEFT COLUMN — Lobby */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Raja Rani Banner */}
            {isRajaRani && (
              <div style={{ background: 'linear-gradient(135deg, #21242e, #3d4f97)', borderTop: '1px solid rgba(255,255,255,0.15)', borderBottom: '3px solid #ecab37', padding: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: '24px', margin: '0 0 4px 0' }}>👑</p>
                <h1 style={{ fontFamily: 'Arial Black, Arial', fontSize: '20px', fontWeight: '900', color: '#ecab37', margin: '0 0 4px 0' }}>RAJA RANI</h1>
                <p style={{ fontSize: '10px', fontWeight: '700', color: '#9fbee7', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Waiting for players to join the court</p>
              </div>
            )}

            {/* Join Code Display */}
            <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <SectionHeader title="GAME CODE" icon="🔗" />
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' }}>
                  Share this code with friends to join
                </p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: '#21242e', padding: '12px 20px', marginBottom: '12px',
                  border: '2px solid rgba(236, 171, 55, 0.4)',
                }}>
                  <span style={{
                    fontFamily: 'Arial, monospace', fontSize: '28px', fontWeight: '900',
                    color: '#ecab37', letterSpacing: '8px',
                  }}>{gameData.joinCode}</span>
                </div>
                <div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyCode}
                    className={copied ? 'ds-btn-primary' : 'ds-btn-secondary'}
                    style={{
                      padding: '8px 20px', fontSize: '11px',
                      background: copied ? '#15803d' : undefined,
                      color: copied ? '#ffffff' : undefined,
                      borderBottomColor: copied ? '#15803d' : undefined,
                    }}
                  >
                    {copied ? '✓ COPIED!' : '📋 COPY CODE'}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Live Player List */}
            <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <SectionHeader title="PLAYERS IN LOBBY" icon="👥" />
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3d4f97' }}>
                    {lobbyPlayers.length} {lobbyPlayers.length === 1 ? 'PLAYER' : 'PLAYERS'} CONNECTED
                  </span>
                  {isHost && lobbyPlayers.length >= 2 && (
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase' }}>✓ READY</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <AnimatePresence mode="popLayout">
                    {lobbyPlayers.map((p) => {
                      const isMe = p.uid === user.uid
                      const isPlayerHost = p.uid === gameData.createdBy
                      return (
                        <motion.div
                          key={p.uid || p.display_name}
                          layout
                          initial={{ opacity: 0, scale: 0.9, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px',
                            background: isMe ? 'rgba(236, 171, 55, 0.12)' : '#ffffff',
                            borderLeft: isMe ? '3px solid #ecab37' : '3px solid transparent',
                          }}
                        >
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '9999px',
                            background: isPlayerHost ? '#ecab37' : '#3d4f97',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: isPlayerHost ? '#21242e' : '#ffffff',
                            fontSize: '11px', fontWeight: '700', flexShrink: 0,
                          }}>
                            {isPlayerHost ? '👑' : p.display_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#21242e' }}>
                              {p.display_name}
                            </span>
                            {isMe && <span style={{ fontSize: '9px', fontWeight: '700', color: '#ecab37', marginLeft: '6px' }}>(YOU)</span>}
                            {isPlayerHost && <span style={{ fontSize: '9px', fontWeight: '700', color: '#ecab37', marginLeft: '6px' }}>HOST</span>}
                          </div>
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '9999px',
                            background: '#15803d', flexShrink: 0,
                          }} title="Connected" />
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Start / Waiting */}
            {isHost ? (
              <motion.button
                whileTap={lobbyPlayers.length >= 2 ? { scale: 0.97 } : {}}
                onClick={handleStartGame}
                disabled={lobbyPlayers.length < 2}
                className="ds-btn-submit"
                style={{
                  width: '100%', padding: '20px 24px', fontSize: '13px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  opacity: lobbyPlayers.length < 2 ? 0.5 : 1,
                }}
              >
                🎮 START GAME ({lobbyPlayers.length} PLAYER{lobbyPlayers.length !== 1 ? 'S' : ''})
              </motion.button>
            ) : (
              <div className="ds-form-panel" style={{ padding: '16px', textAlign: 'center' }}>
                <motion.p
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ fontSize: '12px', fontWeight: '700', color: '#ecab37', margin: 0 }}
                >
                  ⏳ Waiting for host to start the game...
                </motion.p>
              </div>
            )}

            {error && (
              <p style={{ color: '#e60012', fontSize: '11px', fontWeight: '700', textAlign: 'center' }}>{error}</p>
            )}
          </div>

          {/* RIGHT COLUMN — Game Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="section-label-bar">📊 GAME INFO</div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#60619c', fontWeight: '700' }}>ROUNDS</span>
                  <span style={{ fontSize: '11px', color: '#21242e', fontWeight: '900', fontFamily: 'Arial, monospace' }}>{roundLength}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#60619c', fontWeight: '700' }}>PLAYERS</span>
                  <span style={{ fontSize: '11px', color: '#21242e', fontWeight: '900', fontFamily: 'Arial, monospace' }}>{lobbyPlayers.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#60619c', fontWeight: '700' }}>STATUS</span>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700', textTransform: 'uppercase' }}>LOBBY</span>
                </div>
              </div>
            </div>

            <div className="ds-form-panel" style={{ padding: '12px' }}>
              <p style={{ fontSize: '11px', color: '#3d4f97', margin: 0, lineHeight: '1.5' }}>
                <strong style={{ color: '#21242e' }}>Share the code</strong> with friends so they can join from their own device.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ds-nav-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
          <span style={{ fontSize: '9px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {lobbyPlayers.length >= 2 ? `✓ ${lobbyPlayers.length} PLAYERS CONNECTED` : 'WAITING FOR PLAYERS'}
          </span>
          <span style={{ fontSize: '9px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {roundLength} ROUNDS • {isRajaRani ? '👑 RAJA RANI' : 'BOARD GAME SCOREKEEPER'}
          </span>
        </div>

        <style>{`@media (max-width: 768px) {
          .name-input-grid { grid-template-columns: 1fr !important; }
          .name-input-inner-grid { grid-template-columns: 1fr !important; }
        }`}</style>
      </motion.div>
    )
  }

  // SETUP VIEW — before game is created
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        minHeight: 'calc(100vh - 48px)',
        background: '#7a8aba',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="name-input-grid" style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '12px', alignItems: 'start' }}>

        {/* === LEFT COLUMN — Game Setup === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Raja Rani Banner */}
          {isRajaRani && (
            <div style={{ background: 'linear-gradient(135deg, #21242e, #3d4f97)', borderTop: '1px solid rgba(255,255,255,0.15)', borderBottom: '3px solid #ecab37', padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '24px', margin: '0 0 4px 0' }}>👑</p>
              <h1 style={{ fontFamily: 'Arial Black, Arial', fontSize: '20px', fontWeight: '900', color: '#ecab37', margin: '0 0 4px 0' }}>RAJA RANI</h1>
              <p style={{ fontSize: '10px', fontWeight: '700', color: '#9fbee7', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Set up your royal court below</p>
            </div>
          )}

          {/* PLAYER NAME Panel */}
          <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <SectionHeader title="PLAYER NAME" icon="≡" />
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => { setNameInput(e.target.value.slice(0, 20)); setError(''); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter player name"
                  className="ds-input"
                  style={{ flex: 1, height: 'auto', padding: '10px 12px', fontSize: '13px' }}
                  maxLength={20}
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={addPlayer}
                  className="ds-btn-primary"
                  style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
                >
                  + ADD
                </motion.button>
              </div>
              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ color: '#e60012', fontSize: '11px', marginTop: '8px', fontWeight: '700' }}>
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ROSTER + GAME LENGTH side by side */}
          <div className="name-input-inner-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
            {/* ROSTER Panel */}
            <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden', minHeight: '200px' }}>
              <SectionHeader title="ROSTER" icon="≡" />
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3d4f97' }}>
                    {playerNames.length} {playerNames.length === 1 ? 'PLAYER' : 'PLAYERS'}
                  </span>
                  {playerNames.length >= 2 && (
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase' }}>✓ READY</span>
                  )}
                </div>
                {playerNames.length === 0 ? (
                  <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #5a5f8c', borderRadius: '2px', background: 'rgba(255,255,255,0.3)' }}>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NO PLAYERS ADDED</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <AnimatePresence mode="popLayout">
                      {playerNames.map((name, i) => (
                        <TiltCard key={name} style={{ display: 'inline-flex' }}>
                        <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px 4px 10px', background: '#ffffff', border: '1px solid #5a5f8c', borderTop: '1px solid rgba(255,255,255,0.6)', borderRadius: '2px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#21242e' }}>{name}</span>
                          <button onClick={() => removePlayer(i)} style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dedede', border: 'none', borderRadius: '2px', cursor: 'pointer', padding: 0, color: '#60619c', fontSize: '12px', fontWeight: '700', lineHeight: 1 }} aria-label={`Remove ${name}`}>×</button>
                        </motion.div>
                        </TiltCard>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* GAME LENGTH Panel */}
            <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <SectionHeader title="GAME LENGTH" icon="≡" />
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustRoundLength(-1)} disabled={roundLength <= 1} className="ds-btn-secondary" style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }} aria-label="Decrease rounds">−</motion.button>
                  <div style={{ textAlign: 'center', minWidth: '60px' }}>
                    <span style={{ fontFamily: 'Arial Black, Arial', fontSize: '36px', fontWeight: '900', color: '#f68d1f', lineHeight: '1', fontVariantNumeric: 'tabular-nums' }}>{roundLength}</span>
                    <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60619c', marginTop: '4px' }}>ROUNDS</div>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustRoundLength(1)} disabled={roundLength >= 99} className="ds-btn-primary" style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }} aria-label="Increase rounds">+</motion.button>
                </div>
              </div>
            </div>
          </div>

          {/* CREATE GAME BUTTON */}
          <motion.button whileTap={canStart ? { scale: 0.97 } : {}} onClick={handleStart} disabled={!canStart || starting} className="ds-btn-submit"
            style={{ width: '100%', padding: '20px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: !canStart || starting ? 0.5 : 1 }}>
            {starting ? (<><svg style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg> CREATING GAME...</>) : (<>🔗 CREATE & GET JOIN CODE</>)}
          </motion.button>
          <AnimatePresence>
            {!canStart && playerNames.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#2a2e3a', padding: '4px 12px', display: 'inline-block' }}>ADD AT LEAST 2 PLAYERS</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* === RIGHT COLUMN — Tips Panel === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="section-label-bar">💡 TIPS</div>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '11px', color: '#3d4f97', margin: 0, lineHeight: '1.5' }}>
                <strong style={{ color: '#21242e' }}>Add players</strong> by typing names and hitting + ADD or Enter.
              </p>
              <p style={{ fontSize: '11px', color: '#3d4f97', margin: 0, lineHeight: '1.5' }}>
                <strong style={{ color: '#21242e' }}>Set rounds</strong> to control game length. Default is 20.
              </p>
              <p style={{ fontSize: '11px', color: '#3d4f97', margin: 0, lineHeight: '1.5' }}>
                After creating, <strong style={{ color: '#21242e' }}>share the join code</strong> with friends.
              </p>
              <p style={{ fontSize: '11px', color: '#3d4f97', margin: 0, lineHeight: '1.5' }}>
                Your draft is <strong style={{ color: '#21242e' }}>auto-saved</strong> — come back anytime.
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="ds-form-panel" style={{ padding: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ textAlign: 'center', padding: '8px', background: '#dedede' }}>
                <p className="stat-value" style={{ margin: 0, fontSize: '20px' }}>{playerNames.length}</p>
                <p style={{ fontSize: '9px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', margin: '2px 0 0 0' }}>Players</p>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', background: '#dedede' }}>
                <p className="stat-value" style={{ margin: 0, fontSize: '20px' }}>{roundLength}</p>
                <p style={{ fontSize: '9px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', margin: '2px 0 0 0' }}>Rounds</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="ds-nav-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        <span style={{ fontSize: '9px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {playerNames.length >= 2 ? `✓ ${playerNames.length} PLAYERS READY` : 'ADD PLAYERS TO BEGIN'}
        </span>
        <span style={{ fontSize: '9px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {roundLength} ROUNDS • {isRajaRani ? '👑 RAJA RANI' : 'BOARD GAME SCOREKEEPER'}
        </span>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .name-input-grid { grid-template-columns: 1fr !important; }
          .name-input-inner-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </motion.div>
  )
}
