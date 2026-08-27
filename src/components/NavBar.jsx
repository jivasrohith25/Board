import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../config/avatars'

export function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, displayName, avatar } = useAuth()

  const navItems = [
    { label: 'NEW GAME', path: '/name-input' },
    { label: 'JOIN', path: '/join' },
    { label: 'DICE', path: '/dice' },
    { label: 'HISTORY', path: '/history' },
  ]

  return (
    <>
      {/* Primary Carbon Nav Bar */}
      <div className="ds-nav-bar" style={{ height: 'auto', minHeight: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '1440px', margin: '0 auto', padding: '0 12px', gap: '4px' }}>
          {/* Logo pill */}
          <button
            onClick={() => navigate('/name-input')}
            style={{
              background: '#ffffff',
              color: '#e60012',
              borderRadius: '9999px',
              padding: '2px 10px',
              fontFamily: 'Arial Black, Arial, sans-serif',
              fontSize: '13px',
              fontWeight: '900',
              lineHeight: '1',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              letterSpacing: '0',
            }}
          >
            BGS
          </button>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Nav links */}
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: location.pathname === item.path ? 'rgba(228, 134, 0, 0.2)' : 'transparent',
                color: '#e48600',
                border: 'none',
                borderRadius: '2px',
                padding: '4px 10px',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                borderBottom: location.pathname === item.path ? '2px solid #e48600' : '2px solid transparent',
              }}
            >
              {item.label}
            </button>
          ))}

          {/* Profile avatar */}
          <button
            onClick={() => navigate('/profile')}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '2px solid rgba(228, 134, 0, 0.5)',
              background: '#3d4f97',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              marginLeft: '8px',
            }}
          >
            {avatar ? (
              <img src={getAvatarUrl(avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#ecab37', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                {displayName?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Subnav strip */}
      <div className="ds-subnav" style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '1440px', margin: '0 auto' }}>
        <span style={{ opacity: 0.6 }}>Players: {displayName || '---'}</span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span style={{ opacity: 0.6, fontSize: '10px' }}>BOARD GAME SCOREKEEPER v1.0</span>
      </div>
    </>
  )
}
