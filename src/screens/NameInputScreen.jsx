import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../config/avatars'

const STORAGE_KEY = 'bgsk_draft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { players: [], roundLength: 5 }
}

function saveDraft(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function NameInputScreen() {
  const { user, username, avatar, logout } = useAuth()
  const navigate = useNavigate()
  const draft = loadDraft()

  const [players, setPlayers] = useState(draft.players || [])
  const [roundLength, setRoundLength] = useState(draft.roundLength || 20)
  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    saveDraft({ players, roundLength })
  }, [players, roundLength])

  const addPlayer = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) { setError('Name cannot be empty'); return }
    if (trimmed.length > 20) { setError('Name must be 20 characters or less'); return }
    if (players.some(p => p.toLowerCase() === trimmed.toLowerCase())) { setError('This name is already added'); return }
    setPlayers(prev => [...prev, trimmed])
    setNameInput('')
    setError('')
    inputRef.current?.focus()
  }

  const removePlayer = (index) => {
    setPlayers(prev => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addPlayer() }
  }

  const adjustRoundLength = (delta) => {
    setRoundLength(prev => Math.max(1, Math.min(99, prev + delta)))
  }

  const handleStart = async () => {
    if (players.length < 2 || starting) return
    setStarting(true)
    try {
      const gameId = uuidv4()
      await setDoc(doc(db, 'games', gameId), {
        createdBy: user.uid, username, players, roundLength,
        currentRound: 1, status: 'active', createdAt: serverTimestamp(),
      })
      localStorage.removeItem(STORAGE_KEY)
      navigate(`/point-entry/${gameId}`)
    } catch (err) {
      console.error('Failed to create game:', err)
      setError('Failed to create game. Please try again.')
      setStarting(false)
    }
  }

  const canStart = players.length >= 2

  const SectionHeader = ({ title, icon }) => (
    <div className="section-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '12px' }}>{icon}</span>
      {title}
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        minHeight: 'calc(100vh - 48px)',
        background: '#7a8aba',
        padding: '0',
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', alignItems: 'start' }}>

        {/* === PLAYER NAME Panel === */}
        <div style={{ gridColumn: '1 / -1' }}>
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
        </div>

        {/* === ROSTER Panel === */}
        <div>
          <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden', minHeight: '200px' }}>
            <SectionHeader title="ROSTER" icon="≡" />
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3d4f97' }}>
                  {players.length} {players.length === 1 ? 'PLAYER' : 'PLAYERS'}
                </span>
                {players.length >= 2 && (
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase' }}>✓ READY</span>
                )}
              </div>

              {players.length === 0 ? (
                <div style={{
                  height: '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #5a5f8c',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.3)',
                }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NO PLAYERS ADDED</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <AnimatePresence mode="popLayout">
                    {players.map((name, i) => (
                      <motion.div
                        key={name}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 6px 4px 10px',
                          background: '#ffffff',
                          border: '1px solid #5a5f8c',
                          borderTop: '1px solid rgba(255,255,255,0.6)',
                          borderRadius: '2px',
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#21242e' }}>{name}</span>
                        <button
                          onClick={() => removePlayer(i)}
                          style={{
                            width: '18px', height: '18px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#dedede', border: 'none', borderRadius: '2px',
                            cursor: 'pointer', padding: 0, color: '#60619c',
                            fontSize: '12px', fontWeight: '700', lineHeight: 1,
                          }}
                          aria-label={`Remove ${name}`}
                        >
                          ×
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === GAME LENGTH Panel === */}
        <div>
          <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <SectionHeader title="GAME LENGTH" icon="≡" />
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => adjustRoundLength(-1)}
                  disabled={roundLength <= 1}
                  className="ds-btn-secondary"
                  style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
                  aria-label="Decrease rounds"
                >
                  −
                </motion.button>
                <div style={{ textAlign: 'center', minWidth: '60px' }}>
                  <span style={{
                    fontFamily: 'Arial Black, Arial',
                    fontSize: '36px', fontWeight: '900',
                    color: '#f68d1f', lineHeight: '1',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {roundLength}
                  </span>
                  <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60619c', marginTop: '4px' }}>ROUNDS</div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => adjustRoundLength(1)}
                  disabled={roundLength >= 99}
                  className="ds-btn-primary"
                  style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
                  aria-label="Increase rounds"
                >
                  +
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* === START BUTTON === */}
        <div style={{ gridColumn: '1 / -1' }}>
          <motion.button
            whileTap={canStart ? { scale: 0.97 } : {}}
            onClick={handleStart}
            disabled={!canStart || starting}
            className="ds-btn-submit"
            style={{
              width: '100%',
              padding: '20px 24px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              opacity: !canStart || starting ? 0.5 : 1,
            }}
          >
            {starting ? (
              <>
                <svg style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                CREATING GAME...
              </>
            ) : (
              <>🎮 START GAME</>
            )}
          </motion.button>

          <AnimatePresence>
            {!canStart && players.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ textAlign: 'center', marginTop: '8px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: '700', color: '#60619c',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  background: '#2a2e3a', padding: '4px 12px', display: 'inline-block',
                }}>
                  ADD AT LEAST 2 PLAYERS
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  )
}
