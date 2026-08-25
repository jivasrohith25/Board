import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import coachDefault from '/coach/default.png'
import coachHappy from '/coach/happy.png'
import coachLaugh from '/coach/laugh.png'
import coachShocked from '/coach/shocked.png'
import coachSad from '/coach/sad.png'

const EMOTION_IMAGES = {
  default: coachDefault,
  happy: coachHappy,
  laugh: coachLaugh,
  shocked: coachShocked,
  sad: coachSad,
}

const EMOTION_COLORS = {
  default: 'bg-warm-100 border-warm-300 text-warm-800',
  happy: 'bg-primary-50 border-primary-300 text-primary-800',
  laugh: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  shocked: 'bg-red-50 border-red-300 text-red-800',
  sad: 'bg-blue-50 border-blue-300 text-blue-800',
}

export function GameCoach({ comment, emotion = 'default', fadeAfterMs = 5000 }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!comment) {
      setVisible(false)
      return
    }
    setVisible(true)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), fadeAfterMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [comment, fadeAfterMs])

  if (!comment) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="flex flex-col items-center max-w-[220px]"
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {/* Speech Bubble */}
          <div className={`relative px-3 py-2 rounded-2xl border-2 ${EMOTION_COLORS[emotion] || EMOTION_COLORS.default} shadow-sm mb-1`}>
            <p className="text-xs font-medium leading-relaxed text-center">
              {comment}
            </p>
            {/* Tail */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-inherit border-b-2 border-r-2 border-inherit" />
          </div>

          {/* Character Image */}
          <AnimatePresence mode="wait">
            <motion.img
              key={emotion}
              src={EMOTION_IMAGES[emotion] || EMOTION_IMAGES.default}
              alt="Mr. Slow"
              className="w-[120px] h-[120px] object-contain"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            />
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
