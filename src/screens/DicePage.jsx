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
      <rect x="2" y="2" width="96" height="96" rx="8" fill="#ffffff" stroke="#3d4f97" strokeWidth="3" />
      {face.dots.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r="9" fill="#21242e" />
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
      style={{ minHeight: 'calc(100vh - 48px)', background: '#7a8aba', padding: '16px' }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Section Label Bar */}
        <div className="section-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px' }}>🎲</span>
          DICE ROLLER
        </div>

        {/* Dice Panel */}
        <div className="ds-form-panel" style={{ padding: '24px', textAlign: 'center', marginBottom: '12px' }}>
          <motion.div
            animate={rolling ? { rotate: [0, 10, -10, 10, -10, 0], scale: [1, 1.05, 0.95, 1.05, 0.95, 1] } : {}}
            transition={{ duration: 0.5, repeat: rolling ? Infinity : 0 }}
            style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}
          >
            {currentValue ? (
              <DiceFace value={currentValue} />
            ) : (
              <div style={{
                width: '160px', height: '160px',
                border: '2px dashed #5a5f8c',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.3)',
              }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#60619c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ROLL TO SEE A NUMBER</span>
              </div>
            )}
          </motion.div>

          {currentValue && !rolling && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <span style={{ fontFamily: 'Arial Black, Arial', fontSize: '48px', fontWeight: '900', color: '#f68d1f', lineHeight: '1' }}>{currentValue}</span>
            </motion.div>
          )}
        </div>

        {/* Roll Button */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={rollDice}
            disabled={rolling}
            className="ds-btn-submit"
            style={{ padding: '16px 48px', fontSize: '13px' }}
          >
            {rolling ? 'ROLLING...' : '🎲 ROLL!'}
          </motion.button>
        </div>

        {/* Roll History */}
        {rollHistory.length > 0 && (
          <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="section-label-bar">≡ HISTORY ({rollHistory.length})</div>
            <div style={{ padding: '12px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {rollHistory.map((val, i) => (
                <motion.span
                  key={`${i}-${val}`}
                  initial={i === 0 ? { opacity: 0, scale: 0.5 } : {}}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i === 0 ? '#f68d1f' : '#dedede',
                    color: i === 0 ? '#ffffff' : '#60619c',
                    fontSize: '12px', fontWeight: '700',
                    fontFamily: 'Arial, monospace',
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
