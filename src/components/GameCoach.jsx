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
  default: 'bg-bg-elevated border-ui-border text-text-primary',
  happy: 'bg-status-success/10 border-status-success/30 text-text-primary',
  laugh: 'bg-status-warning/10 border-status-warning/30 text-text-primary',
  shocked: 'bg-status-error/10 border-status-error/30 text-text-primary',
  sad: 'bg-accent-primary/10 border-accent-primary/30 text-text-primary',
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

  const bubbleClass = BUBBLE_STYLES[currentEmotion] || BUBBLE_STYLES.default

  const Bubble = () => (
    <motion.div
      className={`relative px-4 py-3 rounded-2xl mb-2 border shadow-card ${bubbleClass}`}
      initial={{ opacity: 0, y: 8, scale: 0.92, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -4, scale: 0.96, filter: 'blur(2px)' }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
    >
      <p className="text-xs font-bold leading-relaxed text-center">
        {currentComment}
      </p>
      <div className={`absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-b border-r ${bubbleClass}`} />
    </motion.div>
  )

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

  if (permanent) {
    return (
      <div className="flex flex-col items-center max-w-[220px]">
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
          className="flex flex-col items-center max-w-[220px]"
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
