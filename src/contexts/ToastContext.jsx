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
  const bgColors = {
    info: 'bg-primary-500',
    success: 'bg-green-500',
    error: 'bg-danger-500',
  }
  const iconColors = {
    info: 'text-white',
    success: 'text-white',
    error: 'text-white',
  }

  return (
    <div className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[280px] max-w-md animate-slide-up ${bgColors[toast.type]}`}>
      <span className="flex-1 text-white text-sm font-medium">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => { toast.action(); onClose(toast.id); }}
          className="text-white font-semibold underline hover:no-underline whitespace-nowrap"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onClose(toast.id)}
        className="text-white/80 hover:text-white transition-opacity p-1"
        aria-label="Dismiss"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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