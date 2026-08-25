import { motion, AnimatePresence } from 'framer-motion'

export function Modal({ isOpen, onClose, children, title }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-warm-900/30 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="card p-6 w-full max-w-sm"
              style={{ boxShadow: '0 8px 24px rgba(104, 51, 40, 0.12), 0 2px 8px rgba(104, 51, 40, 0.06)' }}
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
            >
              {title && (
                <h3 className="font-display text-lg font-bold text-warm-900 mb-3">{title}</h3>
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
  const confirmClass = variant === 'danger' ? 'btn-danger' : 'btn-primary'
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-warm-500 mb-5 text-sm leading-relaxed">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">{cancelText}</button>
        <button onClick={onConfirm} className={`${confirmClass} flex-1`}>{confirmText}</button>
      </div>
    </Modal>
  )
}
