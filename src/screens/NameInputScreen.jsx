import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'
import { TiltCard } from '../components/TiltCard'

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
  const { user, username, displayName } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isRajaRani = searchParams.get('game') === 'raja-rani'
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
        createdBy: user.uid, username, players,
        playerUids: [user.uid],
        roundLength,
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

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        minHeight: 'calc(100vh - 76px)',
        background: '#000000',
        backgroundImage: 'url(/bg/main_page.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dark overlay for readability */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', pointerEvents: 'none', zIndex: 0 }} />

      <div className="name-input-grid" style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '15px', alignItems: 'start', position: 'relative', zIndex: 1 }}>

        {/* === LEFT COLUMN — Game Setup === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* PLAYER NAME Panel */}
          <div style={{ background: '#29292a', border: '1px solid #ffffff', borderRadius: '15px', padding: '30px', overflow: 'hidden' }}>
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ee1f66', margin: '0 0 15px 0' }}>
              PLAYER NAME
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                ref={inputRef}
                type="text"
                value={nameInput}
                onChange={(e) => { setNameInput(e.target.value.slice(0, 20)); setError(''); }}
                onKeyDown={handleKeyDown}
                placeholder="ENTER NAME"
                style={{
                  flex: 1, fontFamily: "'Source Code Pro', monospace",
                  fontSize: '12px', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: '#ffffff',
                  background: '#000000', border: '1px solid #ffffff',
                  borderRadius: '10px', padding: '10px 15px', outline: 'none',
                }}
                maxLength={20}
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={addPlayer}
                style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: '#ffffff',
                  background: '#ee1f66', border: 'none',
                  borderRadius: '10px', padding: '10px 20px', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                + ADD
              </motion.button>
            </div>
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ fontFamily: "'Source Code Pro', monospace", color: '#ee1f66', fontSize: '10px', marginTop: '10px', fontWeight: 700 }}>
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* ROSTER + GAME LENGTH side by side */}
          <div className="name-input-inner-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', alignItems: 'start' }}>
            {/* ROSTER Panel */}
            <div style={{ background: '#29292a', border: '1px solid #ffffff', borderRadius: '15px', padding: '30px', overflow: 'hidden', minHeight: '200px' }}>
              <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ee1f66', margin: '0 0 15px 0' }}>
                ROSTER
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff' }}>
                  {players.length} {players.length === 1 ? 'PLAYER' : 'PLAYERS'}
                </span>
                {players.length >= 2 && (
                  <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, color: '#ee1f66', textTransform: 'uppercase' }}>READY</span>
                )}
              </div>
              {players.length === 0 ? (
                <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ffffff', borderRadius: '15px' }}>
                  <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4 }}>NO PLAYERS</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <AnimatePresence mode="popLayout">
                    {players.map((name, i) => (
                      <TiltCard key={name} style={{ display: 'inline-flex' }}>
                      <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#000000', border: '1px solid #ffffff', borderRadius: '10px' }}>
                        <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>{name}</span>
                        <button onClick={() => removePlayer(i)} style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid #ffffff', borderRadius: '50px', cursor: 'pointer', padding: 0, color: '#ffffff', fontSize: '12px', fontWeight: 700, lineHeight: 1 }} aria-label={`Remove ${name}`}>×</button>
                      </motion.div>
                      </TiltCard>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* GAME LENGTH Panel */}
            <div style={{ background: '#29292a', border: '1px solid #ffffff', borderRadius: '15px', padding: '30px', overflow: 'hidden' }}>
              <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ee1f66', margin: '0 0 15px 0' }}>
                GAME LENGTH
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustRoundLength(-1)} disabled={roundLength <= 1}
                  style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontFamily: "'Source Code Pro', monospace", background: 'transparent', border: '1px solid #ffffff', borderRadius: '10px', color: '#ffffff', cursor: 'pointer' }}
                  aria-label="Decrease rounds">−</motion.button>
                <div style={{ textAlign: 'center', minWidth: '60px' }}>
                  <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '36px', fontWeight: 700, color: '#ee1f66', lineHeight: '1', fontVariantNumeric: 'tabular-nums' }}>{roundLength}</span>
                  <div style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff', marginTop: '5px', opacity: 0.5 }}>ROUNDS</div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustRoundLength(1)} disabled={roundLength >= 99}
                  style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontFamily: "'Source Code Pro', monospace", background: '#ee1f66', border: 'none', borderRadius: '10px', color: '#ffffff', cursor: 'pointer' }}
                  aria-label="Increase rounds">+</motion.button>
              </div>
            </div>
          </div>

          {/* START BUTTON */}
          <motion.button whileTap={canStart ? { scale: 0.97 } : {}} onClick={handleStart} disabled={!canStart || starting}
            style={{
              width: '100%', padding: '20px 24px',
              fontFamily: "'Source Code Pro', monospace", fontSize: '12px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              background: '#ee1f66', color: '#ffffff', border: 'none',
              borderRadius: '10px', cursor: 'pointer',
              opacity: !canStart || starting ? 0.5 : 1,
            }}>
            {starting ? 'CREATING...' : 'START GAME'}
          </motion.button>
          <AnimatePresence>
            {!canStart && players.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ textAlign: 'center' }}>
                <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4 }}>ADD AT LEAST 2 PLAYERS</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* === RIGHT COLUMN — Tips Panel === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ background: '#29292a', border: '1px solid #ffffff', borderRadius: '15px', padding: '30px', overflow: 'hidden' }}>
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ee1f66', margin: '0 0 15px 0' }}>
              TIPS
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', color: '#ffffff', margin: 0, lineHeight: '1.88', opacity: 0.7 }}>
                Add players by typing names and hitting + ADD or Enter.
              </p>
              <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', color: '#ffffff', margin: 0, lineHeight: '1.88', opacity: 0.7 }}>
                Set rounds to control game length. Default is 20.
              </p>
              <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', color: '#ffffff', margin: 0, lineHeight: '1.88', opacity: 0.7 }}>
                Voice input is available on the score entry screen.
              </p>
              <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', color: '#ffffff', margin: 0, lineHeight: '1.88', opacity: 0.7 }}>
                Your draft is auto-saved — come back anytime.
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ background: '#29292a', border: '1px solid #ffffff', borderRadius: '15px', padding: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ textAlign: 'center', padding: '10px', background: '#000000', border: '1px solid #ffffff', borderRadius: '10px' }}>
                <p style={{ fontFamily: "'Source Code Pro', monospace", margin: 0, fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>{players.length}</p>
                <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', margin: '5px 0 0 0', opacity: 0.4 }}>PLAYERS</p>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: '#000000', border: '1px solid #ffffff', borderRadius: '10px' }}>
                <p style={{ fontFamily: "'Source Code Pro', monospace", margin: 0, fontSize: '20px', fontWeight: 700, color: '#ee1f66' }}>{roundLength}</p>
                <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', margin: '5px 0 0 0', opacity: 0.4 }}>ROUNDS</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div style={{ fontFamily: "'Source Code Pro', monospace", display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', maxWidth: '1200px', width: '100%', margin: '0 auto', borderTop: '1px solid #ffffff' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4 }}>
          {players.length >= 2 ? `${players.length} PLAYERS READY` : 'ADD PLAYERS TO BEGIN'}
        </span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4 }}>
          {roundLength} ROUNDS
        </span>
      </div>

      <style>{`@media (max-width: 768px) {
        .name-input-grid { grid-template-columns: 1fr !important; }
        .name-input-inner-grid { grid-template-columns: 1fr !important; }
      }`}</style>
    </motion.div>
  )
}
