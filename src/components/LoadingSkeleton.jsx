import { motion } from 'framer-motion'

export function LoadingSkeleton() {
  return (
    <div style={{ minHeight: 'calc(100vh - 76px)', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {[1, 2, 3].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
            style={{
              background: '#29292a',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '15px',
              height: i === 1 ? '120px' : '80px',
            }}
          />
        ))}
      </div>
    </div>
  )
}
