import { motion } from 'framer-motion'

export function EmptyState({ icon, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: '#29292a',
        border: '1px solid #ffffff',
        borderRadius: '15px',
        padding: '30px',
        textAlign: 'center',
        fontFamily: "'Source Code Pro', monospace",
      }}
    >
      {icon && <div style={{ fontSize: '48px', marginBottom: '15px' }}>{icon}</div>}
      {title && (
        <h3 style={{
          fontSize: '16px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#ffffff',
          margin: '0 0 10px 0',
        }}>{title}</h3>
      )}
      {description && (
        <p style={{
          fontSize: '12px',
          color: '#ffffff',
          opacity: 0.6,
          lineHeight: '1.88',
          margin: '0 0 20px 0',
        }}>{description}</p>
      )}
      {action}
    </motion.div>
  )
}
