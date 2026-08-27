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
      label: options.label,
    }
    setToasts(prev => [...prev, toast])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showError = useCallback((message, options) => {
    return addToast(message, { type: 'error', duration: 0, ...options })
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
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
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
  const bgColors = {
    info: '#29292a',
    success: '#29292a',
    error: '#29292a',
  }
  const borderColors = {
    info: '#ffffff',
    success: '#40b466',
    error: '#ee1f66',
  }

  return (
    <div style={{
      pointerEvents: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 15px',
      background: bgColors[toast.type],
      border: `1px solid ${borderColors[toast.type]}`,
      borderRadius: '10px',
      minWidth: '260px',
      maxWidth: '400px',
      fontFamily: "'Source Code Pro', monospace",
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>
      <span style={{ fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{icons[toast.type]}</span>
      <span style={{ flex: 1, fontSize: '12px', lineHeight: '1.67', color: '#ffffff' }}>{toast.message}</span>
      {toast.label && toast.action && (
        <button
          onClick={() => { toast.action(); onClose(toast.id); }}
          style={{ fontSize: '10px', fontWeight: 700, color: '#ee1f66', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap', fontFamily: "'Source Code Pro', monospace" }}
        >
          {toast.label}
        </button>
      )}
      <button
        onClick={() => onClose(toast.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '2px', flexShrink: 0 }}
        aria-label="Dismiss"
      >
        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
