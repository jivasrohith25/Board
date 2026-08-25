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
    <div className="min-h-screen bg-warm-50 px-4 py-5">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-display-sm text-warm-900">New Game</h1>
            <p className="text-warm-400 text-sm">Add players to get started</p>
          </div>
          <div className="flex items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/dice')}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl hover:bg-warm-100 transition-colors"
              title="Dice Roller"
            >
              <span className="text-lg">🎲</span>
              <span className="text-[10px] font-medium text-warm-400">Dice</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/history')}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl hover:bg-warm-100 transition-colors"
              title="Game History"
            >
              <span className="text-lg">📜</span>
              <span className="text-[10px] font-medium text-warm-400">History</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/profile')}
              className="w-8 h-8 rounded-full overflow-hidden border-2 border-warm-200 hover:border-primary-400 transition-colors flex-shrink-0 ml-1"
              title="Profile"
            >
              {avatar ? (
                <img src={getAvatarUrl(avatar)} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-600">
                  {username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </motion.button>
            <button onClick={logout} className="btn-ghost text-xs ml-1">
              Logout
            </button>
          </div>
        </div>

        {/* Name Input */}
        <div className="card p-4 mb-3">
          <label className="section-label mb-2 block">Player Name</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value.slice(0, 20)); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="Enter player name"
              className={`input-field flex-1 ${error ? 'input-error' : ''}`}
              maxLength={20}
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={addPlayer}
              className="btn-primary px-5"
            >
              Add
            </motion.button>
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-danger-500 text-xs mt-2"
            >
              {error}
            </motion.p>
          )}
        </div>

        {/* Player Chips */}
        <div className="card p-4 mb-3 min-h-[72px]">
          <div className="flex items-center justify-between mb-2.5">
            <label className="section-label">Players</label>
            <span className="text-xs font-mono font-bold text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full">
              {players.length}
            </span>
          </div>
          {players.length === 0 ? (
            <p className="text-warm-300 text-sm text-center py-3">No players added yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AnimatePresence mode="popLayout">
                {players.map((name, i) => (
                  <motion.div
                    key={name}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="chip group"
                  >
                    <span className="text-warm-700">{name}</span>
                    <button
                      onClick={() => removePlayer(i)}
                      className="w-4 h-4 flex items-center justify-center rounded-full bg-warm-300/70 hover:bg-danger-400 text-white text-xs transition-colors"
                    >
                      ×
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Round Length */}
        <div className="card p-4 mb-5">
          <label className="section-label mb-3 block">Rounds</label>
          <div className="flex items-center justify-center gap-5">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => adjustRoundLength(-1)}
              disabled={roundLength <= 1}
              className="w-11 h-11 rounded-full bg-warm-100 hover:bg-warm-200 text-warm-600 font-bold text-lg flex items-center justify-center transition-colors disabled:opacity-30 border border-warm-200/50"
            >
              −
            </motion.button>
            <div className="text-center">
              <span className="text-4xl font-display font-extrabold text-warm-900 w-16 text-center font-mono tabular-nums">
                {roundLength}
              </span>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => adjustRoundLength(1)}
              disabled={roundLength >= 99}
              className="w-11 h-11 rounded-full bg-warm-100 hover:bg-warm-200 text-warm-600 font-bold text-lg flex items-center justify-center transition-colors disabled:opacity-30 border border-warm-200/50"
            >
              +
            </motion.button>
          </div>
        </div>

        {/* Start Button */}
        <div className="relative group">
          <motion.button
            whileTap={canStart ? { scale: 0.97 } : {}}
            onClick={handleStart}
            disabled={!canStart || starting}
            className="btn-primary w-full text-base font-display"
          >
            {starting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Creating game…
              </span>
            ) : '🎮 Start Game'}
          </motion.button>
          {!canStart && players.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-xs text-warm-400 mt-2"
            >
              Add at least 2 players to start
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
