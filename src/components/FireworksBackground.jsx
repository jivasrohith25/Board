import { useEffect, useRef, useCallback } from 'react'

export function FireworksBackground() {
  const canvasRef = useRef(null)
  const particles = useRef([])
  const animationId = useRef(null)

  const createParticle = useCallback((canvas) => {
    const colors = ['#f19b4a', '#ed8027', '#e06416', '#fad8ad', '#f6bd7b', '#ef4444', '#fca5a5']
    return {
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 50,
      vx: (Math.random() - 0.5) * 2,
      vy: -(Math.random() * 3 + 2),
      radius: Math.random() * 2.5 + 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.4 + 0.1,
      life: Math.random() * 200 + 100,
      maxLife: 300,
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 30; i++) {
      particles.current.push(createParticle(canvas))
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.current.forEach((p, i) => {
        p.x += p.vx
        p.y += p.vy
        p.life--
        p.alpha = Math.max(0, (p.life / p.maxLife) * 0.3)

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fill()
        ctx.globalAlpha = 1

        if (p.life <= 0) {
          particles.current[i] = createParticle(canvas)
        }
      })

      animationId.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      if (animationId.current) cancelAnimationFrame(animationId.current)
    }
  }, [createParticle])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.3 }}
    />
  )
}