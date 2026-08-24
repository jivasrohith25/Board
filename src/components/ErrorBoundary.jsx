import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-warm-50 p-6">
          <div className="card p-8 max-w-md w-full text-center">
            <div className="text-5xl mb-4">😵</div>
            <h2 className="text-xl font-bold text-warm-900 mb-2">Something went wrong</h2>
            <p className="text-warm-600 mb-6 text-sm">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/'
              }}
              className="btn-primary"
            >
              Go Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}