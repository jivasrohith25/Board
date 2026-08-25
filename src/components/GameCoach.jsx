import { useState, useEffect, useRef, memo, useMemo } from 'react'
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

// Preload all images at module load — eliminates network flicker on emotion swap
const PRELOADED_IMAGES = (() => {
  const imgs = {}
  Object.values(EMOTION_IMAGES).forEach(src => {
    const img = new Image()
    img.src = src
    imgs[src] = img
  })
  return imgs
})()

const BUBBLE_STYLES = {
  default: { bg: '#faf5f0', border: '#ebb7a3', text: '#683328' },
  happy: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  laugh: { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
  shocked: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  sad: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
}

/**
 * GameCoach — Mr. Slow
 * permanent=true: character always visible, bubble fades in/out on comments
 * permanent=false: entire block fades in/out (results screen mode)
 */
function GameCoachInner({ comment, emotion = 'default', fadeAfterMs = 5000, permanent = false, isTyping = false }) {
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [currentComment, setCurrentComment] = useState('')
  const [currentEmotion, setCurrentEmotion] = useState(emotion)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!comment && !isTyping) {
      setBubbleVisible(false)
      return
    }
    // When typing, show a thinking bubble immediately
    if (isTyping) {
      setCurrentComment('…')
      setCurrentEmotion(emotion)
      setBubbleVisible(true)
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
  }, [comment, emotion, fadeAfterMs, isTyping])

  // Reset to default emotion when bubble fades
  useEffect(() => {
    if (!bubbleVisible && permanent) {
      const t = setTimeout(() => setCurrentEmotion('default'), 400)
      return () => clearTimeout(t)
    }
  }, [bubbleVisible, permanent])

  const bubbleStyle = BUBBLE_STYLES[currentEmotion] || BUBBLE_STYLES.default

  const Bubble = () => (
    <motion.div
      className="relative px-3.5 py-2.5 rounded-2xl mb-1.5"
      style={{
        backgroundColor: bubbleStyle.bg,
        border: `1.5px solid ${bubbleStyle.border}`,
      }}
      initial={{ opacity: 0, y: 8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
    >
      <p className="text-xs font-medium leading-relaxed text-center" style={{ color: bubbleStyle.text }}>
        {currentComment}
      </p>
      <div
        className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-b-[1.5px] border-r-[1.5px]"
        style={{ borderColor: bubbleStyle.border, backgroundColor: bubbleStyle.bg }}
      />
    </motion.div>
  )

  // Character image — key ONLY on emotion, not comment, so text updates don't remount image
  const Character = ({ size = 'w-[110px] h-[110px]' }) => (
    <AnimatePresence mode="wait">
      <motion.img
        key={currentEmotion}
        src={EMOTION_IMAGES[currentEmotion] || EMOTION_IMAGES.default}
        alt="Mr. Slow"
        className={`${size} object-contain drop-shadow-sm`}
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
    </AnimatePresence>
  )

  // Permanent mode: always render the character
  if (permanent) {
    return (
      <div className="flex flex-col items-center max-w-[200px]">
        <AnimatePresence>
          {bubbleVisible && currentComment && <Bubble />}
        </AnimatePresence>
        <Character />
      </div>
    )
  }

  // Non-permanent mode: entire block fades (for results screen)
  return (
    <AnimatePresence>
      {bubbleVisible && currentComment && (
        <motion.div
          className="flex flex-col items-center max-w-[200px]"
          initial={{ opacity: 0, y: 16, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          <Bubble />
          <Character />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Memoized export — only re-renders when props actually change
export const GameCoach = memo(GameCoachInner)
