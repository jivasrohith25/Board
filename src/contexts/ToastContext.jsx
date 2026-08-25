import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, options = {}) => {
    const id = Date.now() + Math.random()
    const toast = {
      id,
      message,
      type: options.type || 'info',
      duration: options.duration ?? 4000,
      action: options.action,
      ...options,
    }
    setToasts(prev => [...prev, toast])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showError = useCallback((message, action) => {
    return addToast(message, { type: 'error', action, duration: 0 })
  }, [addToast])

  const showSuccess = useCallback((message) => {
    return addToast(message, { type: 'success' })
  }, [addToast])

  const showInfo = useCallback((message) => {
    return addToast(message, { type: 'info' })
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, showError, showSuccess, showInfo }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ toast, onClose }) {
  const icons = {
    info: '💡',
    success: '✓',
    error: '✕',
  }
  const styles = {
    info: 'bg-warm-800 text-white',
    success: 'bg-green-600 text-white',
    error: 'bg-danger-600 text-white',
  }

  return (
    <div className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl min-w-[260px] max-w-md animate-slide-up ${styles[toast.type]}`}
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
    >
      <span className="flex-shrink-0 text-sm font-bold">{icons[toast.type]}</span>
      <span className="flex-1 text-sm font-medium leading-snug">{toast.message}</span>
      {toast.label && toast.action && (
        <button
          onClick={() => { toast.action(); onClose(toast.id); }}
          className="text-white font-semibold underline text-xs hover:no-underline whitespace-nowrap flex-shrink-0"
        >
          {toast.label}
        </button>
      )}
      <button
        onClick={() => onClose(toast.id)}
        className="text-white/70 hover:text-white transition-colors p-0.5 flex-shrink-0"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}