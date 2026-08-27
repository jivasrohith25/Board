import { motion, AnimatePresence } from 'framer-motion'

export function Modal({ isOpen, onClose, children, title }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 40 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />
          <motion.div
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <motion.div
              style={{
                background: '#29292a',
                border: '1px solid #ffffff',
                borderRadius: '15px',
                padding: '30px',
                width: '100%',
                maxWidth: '400px',
                fontFamily: "'Source Code Pro', monospace",
              }}
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {title && (
                <h3 style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#ee1f66',
                  margin: '0 0 15px 0',
                }}>{title}</h3>
              )}
              {children}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'primary' }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', color: '#ffffff', marginBottom: '20px', lineHeight: '1.88', opacity: 0.7 }}>{message}</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onClose} className="kippo-btn-ghost" style={{ flex: 1, padding: '10px 15px' }}>{cancelText}</button>
        <button
          onClick={onConfirm}
          className={variant === 'danger' ? 'kippo-btn-danger' : 'kippo-btn-primary'}
          style={{ flex: 1, padding: '10px 15px' }}
        >{confirmText}</button>
      </div>
    </Modal>
  )
}
