import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, useAuth } from '../contexts/AuthContext'

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
  const { user, username, logout } = useAuth()
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
    <div className="min-h-screen bg-warm-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-warm-900">New Game</h1>
            <p className="text-warm-500 text-sm">Add players to get started</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/dice')}
              className="btn-ghost text-sm flex items-center gap-1"
              title="Dice Roller"
            >
              🎲
            </motion.button>
            <button onClick={logout} className="btn-ghost text-sm">
              Logout
            </button>
          </div>
        </div>

        {/* Name Input */}
        <div className="card p-4 mb-4">
          <label className="block text-sm font-medium text-warm-700 mb-2">
            Player Name
          </label>
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
              className="btn-primary px-4"
            >
              Add
            </motion.button>
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-danger-500 text-xs mt-2"
            >
              {error}
            </motion.p>
          )}
        </div>

        {/* Player Chips */}
        <div className="card p-4 mb-4 min-h-[80px]">
          <label className="block text-sm font-medium text-warm-700 mb-3">
            Players ({players.length})
          </label>
          {players.length === 0 ? (
            <p className="text-warm-400 text-sm text-center py-2">No players added yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AnimatePresence mode="popLayout">
                {players.map((name, i) => (
                  <motion.div
                    key={name}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="chip"
                  >
                    <span>{name}</span>
                    <button
                      onClick={() => removePlayer(i)}
                      className="w-4 h-4 flex items-center justify-center rounded-full bg-warm-300 hover:bg-danger-400 text-white text-xs transition-colors"
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
        <div className="card p-4 mb-6">
          <label className="block text-sm font-medium text-warm-700 mb-3">
            Round Length (points per round)
          </label>
          <div className="flex items-center justify-center gap-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustRoundLength(-1)}
              disabled={roundLength <= 1}
              className="w-10 h-10 rounded-full bg-warm-200 hover:bg-warm-300 text-warm-800 font-bold text-lg flex items-center justify-center transition-colors disabled:opacity-30"
            >
              −
            </motion.button>
            <span className="text-3xl font-bold text-warm-900 w-16 text-center font-mono">
              {roundLength}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustRoundLength(1)}
              disabled={roundLength >= 99}
              className="w-10 h-10 rounded-full bg-warm-200 hover:bg-warm-300 text-warm-800 font-bold text-lg flex items-center justify-center transition-colors disabled:opacity-30"
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
            className="btn-primary w-full text-lg"
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
          {!canStart && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-warm-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Add at least 2 players to start
            </div>
          )}
        </div>
      </div>
    </div>
  )
}