import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../config/avatars'

export function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, displayName, avatar } = useAuth()

  const navItems = [
    { label: '👑 RAJA RANI', path: '/raja-rani/lobby' },
    { label: 'DICE', path: '/dice' },
    { label: 'HISTORY', path: '/history' },
  ]

  return (
    <>
      <div className="kippo-nav">
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '1200px', margin: '0 auto', gap: '4px' }}>
          <div style={{ flex: 1 }} />

          {/* Nav Links */}
          {navItems.map(item => {
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  background: 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  borderBottom: isActive ? '1px solid #ee1f66' : '1px solid transparent',
                  padding: '4px 10px',
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '12px',
                  fontWeight: '700',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </button>
            )
          })}

          {/* Profile Avatar */}
          <button
            onClick={() => navigate('/profile')}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50px',
              overflow: 'hidden',
              border: '1px solid #ffffff',
              background: '#29292a',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              marginLeft: '8px',
            }}
          >
            {avatar ? (
              <img src={getAvatarUrl(avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#ee1f66', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontFamily: "'Source Code Pro', monospace" }}>
                {displayName?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="kippo-subnav">
        <span>{displayName || '---'}</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>KIPPO</span>
      </div>
    </>
  )
}
