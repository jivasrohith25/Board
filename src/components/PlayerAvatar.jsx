import { getAvatarUrl } from '../config/avatars'

const sizeClasses = {
  xs: 'w-6 h-6 text-[8px]',
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-lg',
}

const ringClasses = {
  xs: '',
  sm: '',
  md: '',
  lg: 'ring-2 ring-primary-200 ring-offset-2 ring-offset-warm-50',
  xl: 'ring-3 ring-primary-200 ring-offset-2 ring-offset-warm-50',
}

export function PlayerAvatar({ name, avatar, size = 'md', className = '' }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const avatarUrl = getAvatarUrl(avatar)

  return (
    <div
      className={`${sizeClasses[size]} rounded-full overflow-hidden bg-primary-100 text-primary-700 font-bold flex items-center justify-center flex-shrink-0 ${ringClasses[size]} ${className}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
