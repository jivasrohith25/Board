import { motion, AnimatePresence } from 'framer-motion'

export function Modal({ isOpen, onClose, children, title }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="card p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              {title && (
                <h3 className="text-lg font-bold text-warm-900 mb-4">{title}</h3>
              )}
              {children}
            </div>
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
      <p className="text-warm-600 mb-6 text-sm">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">{cancelText}</button>
        <button onClick={onConfirm} className={`${confirmClass} flex-1`}>{confirmText}</button>
      </div>
    </Modal>
  )
}