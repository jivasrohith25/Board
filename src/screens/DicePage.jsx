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
    <svg viewBox="0 0 100 100" style={{ width: '160px', height: '160px' }}>
      <rect x="2" y="2" width="96" height="96" rx="8" fill="#ffffff" stroke="#ee1f66" strokeWidth="3" />
      {face.dots.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r="9" fill="#000000" />
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const rollDice = () => {
    if (rolling) return
    setRolling(true)
    setCurrentValue(null)
    let count = 0
    const maxCycles = 15 + Math.floor(Math.random() * 10)
    let delay = 50

    const tick = () => {
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
    }

    intervalRef.current = setInterval(() => {
      tick()
      if (count >= maxCycles) return
      delay += 20
      clearInterval(intervalRef.current)
      intervalRef.current = setInterval(tick, delay)
    }, delay)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      style={{ minHeight: 'calc(100vh - 76px)', background: '#000000', padding: '16px' }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Section Label */}
        <div className="kippo-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <span style={{ fontSize: '14px' }}>🎲</span>
          DICE ROLLER
        </div>

        {/* Dice Panel */}
        <div className="kippo-card" style={{ textAlign: 'center', marginBottom: '15px' }}>
          <motion.div
            animate={rolling ? { rotate: [0, 10, -10, 10, -10, 0], scale: [1, 1.05, 0.95, 1.05, 0.95, 1] } : {}}
            transition={{ duration: 0.5, repeat: rolling ? Infinity : 0 }}
            style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}
          >
            {currentValue ? (
              <DiceFace value={currentValue} />
            ) : (
              <div style={{
                width: '160px', height: '160px',
                border: '1px dashed rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '15px',
              }}>
                <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ROLL TO SEE A NUMBER</span>
              </div>
            )}
          </motion.div>

          {currentValue && !rolling && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '48px', fontWeight: 700, color: '#ee1f66', lineHeight: '1' }}>{currentValue}</span>
            </motion.div>
          )}
        </div>

        {/* Roll Button */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={rollDice}
            disabled={rolling}
            className="kippo-btn-primary"
            style={{ padding: '15px 48px', fontSize: '12px' }}
          >
            {rolling ? 'ROLLING...' : '🎲 ROLL!'}
          </motion.button>
        </div>

        {/* Roll History */}
        {rollHistory.length > 0 && (
          <div className="kippo-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="kippo-label-bar">≡ HISTORY ({rollHistory.length})</div>
            <div style={{ padding: '15px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {rollHistory.map((val, i) => (
                <motion.span
                  key={`${i}-${val}`}
                  initial={i === 0 ? { opacity: 0, scale: 0.5 } : {}}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i === 0 ? '#ee1f66' : '#29292a',
                    color: i === 0 ? '#ffffff' : 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    fontSize: '12px', fontWeight: 700,
                    fontFamily: "'Source Code Pro', monospace",
                  }}
                >
                  {val}
                </motion.span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
