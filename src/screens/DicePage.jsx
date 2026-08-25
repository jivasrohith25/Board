import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const diceFaces = [
  { dots: [{ x: 50, y: 50 }] },
  { dots: [{ x: 25, y: 25 }, { x: 75, y: 75 }] },
  { dots: [{ x: 25, y: 25 }, { x: 50, y: 50 }, { x: 75, y: 75 }] },
  { dots: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 25, y: 75 }, { x: 75, y: 75 }] },
  { dots: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 50, y: 50 }, { x: 25, y: 75 }, { x: 75, y: 75 }] },
  { dots: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 25, y: 50 }, { x: 75, y: 50 }, { x: 25, y: 75 }, { x: 75, y: 75 }] },
]

function DiceFace({ value }) {
  const face = diceFaces[value - 1]
  return (
    <svg viewBox="0 0 100 100" className="w-44 h-44 md:w-56 md:h-56 drop-shadow-md">
      <rect x="2" y="2" width="96" height="96" rx="14" fill="white" stroke="#e8e0d8" strokeWidth="2" />
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
    <div className="min-h-screen bg-warm-50 px-4 py-5">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm">
            ← Back
          </button>
          <h1 className="font-display text-display-sm text-warm-900">🎲 Dice Roller</h1>
          <div className="w-16" />
        </div>

        {/* Dice */}
        <div className="flex justify-center mb-6">
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
              <div className="w-44 h-44 md:w-56 md:h-56 rounded-2xl border-2 border-dashed border-warm-200 flex items-center justify-center">
                <span className="text-warm-300 text-sm">Roll to see a number</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Result Display */}
        {currentValue && !rolling && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center mb-6"
          >
            <span className="text-6xl font-display font-extrabold text-primary-600 font-mono">{currentValue}</span>
          </motion.div>
        )}

        {/* Roll Button */}
        <div className="flex justify-center mb-8">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={rollDice}
            disabled={rolling}
            className="btn-primary text-base px-10 py-3.5 font-display"
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
            <h3 className="section-label mb-2.5">
              History ({rollHistory.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {rollHistory.map((val, i) => (
                <motion.span
                  key={`${i}-${val}`}
                  initial={i === 0 ? { opacity: 0, scale: 0.5 } : {}}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold font-mono text-sm ${
                    i === 0
                      ? 'bg-primary-500 text-white shadow-sm shadow-primary-300/30'
                      : 'bg-warm-100 text-warm-500'
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
