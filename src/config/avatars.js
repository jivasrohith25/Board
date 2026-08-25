export const AVATARS = [
  { id: 'rohith', name: 'Rohith', file: '/avatars/rohith.png' },
  { id: 'dinesh', name: 'Dinesh', file: '/avatars/dinesh.png' },
  { id: 'david', name: 'David', file: '/avatars/david.png' },
  { id: 'anirudh', name: 'Anirudh', file: '/avatars/anirudh.png' },
  { id: 'roshaun', name: 'Roshaun', file: '/avatars/roshaun.png' },
  { id: 'dhanya', name: 'Dhanya', file: '/avatars/dhanya.png' },
  { id: 'kiruthika', name: 'Kiruthika', file: '/avatars/kiruthika.png' },
  { id: 'afna', name: 'Afna', file: '/avatars/afna.png' },
]

export function getAvatarUrl(avatarId) {
  if (!avatarId) return null
  const avatar = AVATARS.find(a => a.id === avatarId)
  return avatar ? avatar.file : null
}
