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

/**
 * GameCoach — Mr. Slow
 * permanent=true: character always visible, bubble fades in/out on comments
 * permanent=false: entire block fades in/out (results screen mode)
 */
export function GameCoach({ comment, emotion = 'default', fadeAfterMs = 5000, permanent = false }) {
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [currentComment, setCurrentComment] = useState('')
  const [currentEmotion, setCurrentEmotion] = useState(emotion)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!comment) {
      setBubbleVisible(false)
      return
    }
    setCurrentComment(comment)
    setCurrentEmotion(emotion)
    setBubbleVisible(true)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setBubbleVisible(false), fadeAfterMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [comment, emotion, fadeAfterMs])

  // Reset to default emotion when bubble fades
  useEffect(() => {
    if (!bubbleVisible && permanent) {
      const t = setTimeout(() => setCurrentEmotion('default'), 400)
      return () => clearTimeout(t)
    }
  }, [bubbleVisible, permanent])

  // Permanent mode: always render the character
  if (permanent) {
    return (
      <div className="flex flex-col items-center max-w-[220px]">
        {/* Speech Bubble — fades in/out */}
        <AnimatePresence>
          {bubbleVisible && currentComment && (
            <motion.div
              className="relative px-3 py-2 rounded-2xl border-2 shadow-sm mb-1"
              style={{
                backgroundColor: EMOTION_COLORS[currentEmotion]?.includes('primary') ? '#eff6ff'
                  : EMOTION_COLORS[currentEmotion]?.includes('yellow') ? '#fefce8'
                  : EMOTION_COLORS[currentEmotion]?.includes('red') ? '#fef2f2'
                  : EMOTION_COLORS[currentEmotion]?.includes('blue') ? '#eff6ff'
                  : '#faf5f0',
              }}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <p className="text-xs font-medium leading-relaxed text-center text-warm-800">
                {currentComment}
              </p>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-b-2 border-r-2 border-warm-300 bg-[#faf5f0]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Character — always visible, swaps emotion */}
        <AnimatePresence mode="wait">
          <motion.img
            key={currentEmotion}
            src={EMOTION_IMAGES[currentEmotion] || EMOTION_IMAGES.default}
            alt="Mr. Slow"
            className="w-[120px] h-[120px] object-contain"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          />
        </AnimatePresence>
      </div>
    )
  }

  // Non-permanent mode: entire block fades (for results screen)
  return (
    <AnimatePresence>
      {bubbleVisible && currentComment && (
        <motion.div
          className="flex flex-col items-center max-w-[220px]"
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <motion.div
            className="relative px-3 py-2 rounded-2xl border-2 shadow-sm mb-1"
            style={{
              backgroundColor: EMOTION_COLORS[currentEmotion]?.includes('primary') ? '#eff6ff'
                : EMOTION_COLORS[currentEmotion]?.includes('yellow') ? '#fefce8'
                : EMOTION_COLORS[currentEmotion]?.includes('red') ? '#fef2f2'
                : EMOTION_COLORS[currentEmotion]?.includes('blue') ? '#eff6ff'
                : '#faf5f0',
            }}
          >
            <p className="text-xs font-medium leading-relaxed text-center text-warm-800">
              {currentComment}
            </p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-b-2 border-r-2 border-warm-300 bg-[#faf5f0]" />
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.img
              key={currentEmotion}
              src={EMOTION_IMAGES[currentEmotion] || EMOTION_IMAGES.default}
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
