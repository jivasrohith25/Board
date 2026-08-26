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
    if (!trimmed) {
      setError('Name cannot be empty')
      return
    }
    if (trimmed.length > 20) {
      setError('Name must be 20 characters or less')
      return
    }
    if (players.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      setError('This name is already added')
      return
    }
    setPlayers(prev => [...prev, trimmed])
    setNameInput('')
    setError('')
    inputRef.current?.focus()
  }

  const removePlayer = (index) => {
    setPlayers(prev => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPlayer()
    }
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
        createdBy: user.uid,
        username: username,
        players,
        roundLength,
        currentRound: 1,
        status: 'active',
        createdAt: serverTimestamp(),
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
      className="min-h-screen bg-bg-primary px-4 py-6"
    >
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-display-sm text-text-primary">New Game</h1>
            <p className="text-text-secondary text-sm">Add players to get started</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/dice')}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-bg-secondary border border-ui-border hover:bg-ui-border transition-colors shadow-sm"
              title="Dice Roller"
            >
              <span className="text-xl">🎲</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/history')}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-bg-secondary border border-ui-border hover:bg-ui-border transition-colors shadow-sm"
              title="Game History"
            >
              <span className="text-xl">📜</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-xl overflow-hidden border-2 border-ui-border hover:border-accent-primary transition-colors flex-shrink-0 shadow-sm ml-1"
              title="Profile"
            >
              {avatar ? (
                <img src={getAvatarUrl(avatar)} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-accent-primary/10 flex items-center justify-center text-xs font-bold text-accent-primary">
                  {username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </motion.button>
          </div>
        </div>

        {/* Name Input */}
        <div className="card p-5 mb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/5 rounded-bl-full pointer-events-none" />
          <label className="section-label mb-3 block">Player Name</label>
          <div className="flex gap-3 relative z-10">
            <input
              ref={inputRef}
              type="text"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value.slice(0, 20)); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="Enter player name"
              className={`input-field flex-1 text-lg ${error ? 'input-error' : ''}`}
              maxLength={20}
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={addPlayer}
              className="bg-bg-primary text-text-primary border-2 border-ui-border hover:border-accent-primary font-semibold px-6 py-3 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
            >
              Add
            </motion.button>
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-status-error text-sm mt-3 font-medium"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Player Chips */}
        <div className="card p-5 mb-4 min-h-[96px]">
          <div className="flex items-center justify-between mb-4">
            <label className="section-label">Roster</label>
            <span className="text-xs font-mono font-bold text-accent-primary bg-accent-primary/10 px-2.5 py-1 rounded-full">
              {players.length} {players.length === 1 ? 'Player' : 'Players'}
            </span>
          </div>
          {players.length === 0 ? (
            <div className="h-12 flex items-center justify-center border-2 border-dashed border-ui-border rounded-xl">
              <p className="text-text-muted text-sm font-medium">No players added yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              <AnimatePresence mode="popLayout">
                {players.map((name, i) => (
                  <motion.div
                    key={name}
                    layout
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="flex items-center gap-2 pl-3 pr-1 py-1 bg-bg-primary border-2 border-ui-border rounded-lg shadow-sm hover:border-accent-primary transition-colors group"
                  >
                    <span className="text-text-primary font-medium">{name}</span>
                    <button
                      onClick={() => removePlayer(i)}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-ui-border/50 text-text-muted hover:bg-status-error hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-status-error"
                      aria-label={`Remove ${name}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Round Length */}
        <div className="card p-5 mb-6">
          <label className="section-label mb-4 block">Game Length</label>
          <div className="flex items-center justify-between bg-bg-primary border border-ui-border rounded-xl p-2 shadow-inner">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustRoundLength(-1)}
              disabled={roundLength <= 1}
              className="w-12 h-12 rounded-lg bg-bg-elevated border border-ui-border hover:border-accent-primary text-text-primary flex items-center justify-center transition-all disabled:opacity-40 shadow-sm"
              aria-label="Decrease rounds"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.33331 8H12.6666" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>
            <div className="flex flex-col items-center justify-center w-24">
              <span className="text-4xl font-display font-extrabold text-accent-primary font-mono tabular-nums leading-none">
                {roundLength}
              </span>
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-1">Rounds</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustRoundLength(1)}
              disabled={roundLength >= 99}
              className="w-12 h-12 rounded-lg bg-bg-elevated border border-ui-border hover:border-accent-primary text-text-primary flex items-center justify-center transition-all disabled:opacity-40 shadow-sm"
              aria-label="Increase rounds"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3.33331V12.6666M3.33331 8H12.6666" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>
          </div>
        </div>

        {/* Start Button */}
        <div className="relative group mt-8">
          <motion.button
            whileTap={canStart ? { scale: 0.97 } : {}}
            whileHover={canStart ? { y: -2 } : {}}
            onClick={handleStart}
            disabled={!canStart || starting}
            className="btn-primary w-full py-4 text-lg font-display flex items-center justify-center gap-2 shadow-md disabled:shadow-none"
          >
            {starting ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Creating game...
              </>
            ) : (
              <>
                <span className="text-xl">🎮</span> Start Game
              </>
            )}
          </motion.button>

          <AnimatePresence>
            {!canStart && players.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute -top-8 w-full text-center"
              >
                <span className="text-xs font-medium text-text-muted bg-bg-secondary px-3 py-1 rounded-full border border-ui-border shadow-sm">
                  Add at least 2 players to start
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
