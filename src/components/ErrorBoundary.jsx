import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          fontFamily: "'Source Code Pro', monospace",
        }}>
          <div style={{
            background: '#29292a',
            border: '1px solid #ffffff',
            borderRadius: '15px',
            padding: '30px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>⚠️</div>
            <h1 style={{
              fontSize: '16px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#ee1f66',
              margin: '0 0 10px 0',
            }}>SOMETHING BROKE</h1>
            <p style={{
              fontSize: '12px',
              color: '#ffffff',
              opacity: 0.6,
              lineHeight: '1.88',
              margin: '0 0 20px 0',
            }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="kippo-btn-primary"
            >
              GO HOME
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
