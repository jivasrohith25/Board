import { useState, useEffect, useRef, memo } from 'react'
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

const BUBBLE_COLORS = {
  default: { bg: '#29292a', border: '#ffffff' },
  happy: { bg: 'rgba(40, 180, 99, 0.1)', border: 'rgba(40, 180, 99, 0.3)' },
  laugh: { bg: 'rgba(238, 31, 102, 0.1)', border: 'rgba(238, 31, 102, 0.3)' },
  shocked: { bg: 'rgba(238, 31, 102, 0.1)', border: 'rgba(238, 31, 102, 0.3)' },
  sad: { bg: 'rgba(238, 31, 102, 0.1)', border: 'rgba(238, 31, 102, 0.3)' },
}

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
    if (isTyping) {
      setCurrentComment('...')
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

  useEffect(() => {
    if (!bubbleVisible && permanent) {
      const t = setTimeout(() => setCurrentEmotion('default'), 400)
      return () => clearTimeout(t)
    }
  }, [bubbleVisible, permanent])

  const colors = BUBBLE_COLORS[currentEmotion] || BUBBLE_COLORS.default

  const Bubble = () => (
    <motion.div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '15px',
        padding: '10px 15px',
        marginBottom: '8px',
        fontFamily: "'Source Code Pro', monospace",
      }}
      initial={{ opacity: 0, y: 8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
    >
      <p style={{ fontSize: '12px', fontWeight: 700, lineHeight: '1.88', textAlign: 'center', color: '#ffffff', margin: 0 }}>
        {currentComment}
      </p>
    </motion.div>
  )

  const Character = ({ size = 110 }) => (
    <AnimatePresence mode="wait">
      <motion.img
        key={currentEmotion}
        src={EMOTION_IMAGES[currentEmotion] || EMOTION_IMAGES.default}
        alt="Coach"
        style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
    </AnimatePresence>
  )

  if (permanent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '220px' }}>
        <AnimatePresence>
          {bubbleVisible && currentComment && <Bubble />}
        </AnimatePresence>
        <Character />
      </div>
    )
  }

  return (
    <AnimatePresence>
      {bubbleVisible && currentComment && (
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '220px' }}
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

export const GameCoach = memo(GameCoachInner)
