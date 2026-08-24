import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const diceFaces = [
  // 1
  { dots: [{ x: 50, y: 50 }] },
  // 2
  { dots: [{ x: 25, y: 25 }, { x: 75, y: 75 }] },
  // 3
  { dots: [{ x: 25, y: 25 }, { x: 50, y: 50 }, { x: 75, y: 75 }] },
  // 4
  { dots: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 25, y: 75 }, { x: 75, y: 75 }] },
  // 5
  { dots: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 50, y: 50 }, { x: 25, y: 75 }, { x: 75, y: 75 }] },
  // 6
  { dots: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 25, y: 50 }, { x: 75, y: 50 }, { x: 25, y: 75 }, { x: 75, y: 75 }] },
]

function DiceFace({ value }) {
  const face = diceFaces[value - 1]
  return (
    <svg viewBox="0 0 100 100" className="w-48 h-48 md:w-64 md:h-64">
      {/* Dice body */}
      <rect x="2" y="2" width="96" height="96" rx="14" fill="white" stroke="#e8e0d8" strokeWidth="2.5" />
      {/* Dots */}
      {face.dots.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r="9" fill="#3a3028" />
      ))}
    </svg>
  )
}

export function DicePage() {
  const navigate = useNavigate()
  const [currentValue, setCurrentValue] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [rollHistory, setRollHistory] = useState([])
  const intervalRef = useRef(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const rollDice = () => {
    if (rolling) return
    setRolling(true)
    setCurrentValue(null)

    let count = 0
    const maxCycles = 15 + Math.floor(Math.random() * 10)
    let delay = 50

    intervalRef.current = setInterval(() => {
      count++
      setCurrentValue(Math.floor(Math.random() * 6) + 1)

      if (count >= maxCycles) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        const finalValue = Math.floor(Math.random() * 6) + 1
        setCurrentValue(finalValue)
        setRollHistory(prev => [finalValue, ...prev].slice(0, 20))
        setRolling(false)
      } else {
        delay += 20
        clearInterval(intervalRef.current)
        intervalRef.current = setInterval(() => {
          count++
          setCurrentValue(Math.floor(Math.random() * 6) + 1)
          if (count >= maxCycles) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
            const finalValue = Math.floor(Math.random() * 6) + 1
            setCurrentValue(finalValue)
            setRollHistory(prev => [finalValue, ...prev].slice(0, 20))
            setRolling(false)
          }
        }, delay)
      }
    }, delay)
  }

  return (
    <div className="min-h-screen bg-warm-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-warm-900">🎲 Dice Roller</h1>
          <div className="w-16" />
        </div>

        {/* Dice */}
        <div className="flex justify-center mb-8">
          <motion.div
            animate={rolling ? {
              rotate: [0, 10, -10, 10, -10, 0],
              scale: [1, 1.05, 0.95, 1.05, 0.95, 1],
            } : {}}
            transition={{ duration: 0.5, repeat: rolling ? Infinity : 0 }}
          >
            {currentValue ? (
              <DiceFace value={currentValue} />
            ) : (
              <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl border-2 border-dashed border-warm-300 flex items-center justify-center">
                <span className="text-warm-400 text-sm">Roll to see a number</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Result Display */}
        {currentValue && !rolling && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <span className="text-6xl font-extrabold text-primary-600 font-mono">{currentValue}</span>
          </motion.div>
        )}

        {/* Roll Button */}
        <div className="flex justify-center mb-10">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={rollDice}
            disabled={rolling}
            className="btn-primary text-lg px-10 py-4"
          >
            {rolling ? (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Rolling…
              </span>
            ) : '🎲 Roll!'}
          </motion.button>
        </div>

        {/* Roll History */}
        {rollHistory.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-bold text-warm-500 uppercase tracking-wider mb-3">
              History ({rollHistory.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {rollHistory.map((val, i) => (
                <motion.span
                  key={`${i}-${val}`}
                  initial={i === 0 ? { opacity: 0, scale: 0.5 } : {}}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-mono text-lg ${
                    i === 0
                      ? 'bg-primary-500 text-white'
                      : 'bg-warm-100 text-warm-600'
                  }`}
                >
                  {val}
                </motion.span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}