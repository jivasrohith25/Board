import { getAvatarUrl } from '../config/avatars'

const SIZES = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 56,
  xl: 80,
}

export function PlayerAvatar({ name, avatar, size = 'md' }) {
  const px = SIZES[size] || SIZES.md
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div style={{
      width: `${px}px`,
      height: `${px}px`,
      borderRadius: '50px',
      overflow: 'hidden',
      border: '1px solid #ffffff',
      background: '#29292a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {avatar ? (
        <img src={getAvatarUrl(avatar)} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{
          fontFamily: "'Source Code Pro', monospace",
          fontSize: `${Math.max(px * 0.3, 8)}px`,
          fontWeight: 700,
          color: '#ee1f66',
        }}>
          {initials}
        </span>
      )}
    </div>
  )
}
