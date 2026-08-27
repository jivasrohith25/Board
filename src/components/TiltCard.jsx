import { useRef, useCallback } from 'react'
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'

export function TiltCard({ children, style = {}, className = '', onTap }) {
  const ref = useRef(null)
  const x = useMotionValue(0.5)
  const y = useMotionValue(0.5)

  const rotateX = useSpring(useTransform(y, [0, 1], [8, -8]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [0, 1], [-8, 8]), { stiffness: 300, damping: 30 })
  const glareX = useSpring(useTransform(x, [0, 1], [0, 100]), { stiffness: 300, damping: 30 })
  const glareY = useSpring(useTransform(y, [0, 1], [0, 100]), { stiffness: 300, damping: 30 })

  const shadowX = useSpring(useTransform(rotateY, [-8, 8], [-6, 6]), { stiffness: 300, damping: 30 })
  const shadowY = useSpring(useTransform(rotateX, [-8, 8], [6, -6]), { stiffness: 300, damping: 30 })

  const handleMouseMove = useCallback((e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width)
    y.set((e.clientY - rect.top) / rect.height)
  }, [x, y])

  const handleMouseLeave = useCallback(() => {
    x.set(0.5)
    y.set(0.5)
  }, [x, y])

  const handleTap = useCallback(() => {
    if (onTap) onTap()
  }, [onTap])

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTap={handleTap}
      style={{
        perspective: 600,
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          boxShadow: useTransform(
            [shadowX, shadowY],
            ([sx, sy]) => `${sx}px ${sy}px 12px rgba(33,36,46,0.18), ${sx * 0.5}px ${sy * 0.5}px 4px rgba(33,36,46,0.10)`
          ),
          transition: 'box-shadow 0.15s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {children}
        {/* Glare sweep */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            background: useTransform(
              [glareX, glareY],
              ([gx, gy]) => `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.12) 0%, transparent 60%)`
            ),
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      </motion.div>
    </motion.div>
  )
}
