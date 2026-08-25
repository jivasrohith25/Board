import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { AVATARS } from '../config/avatars'

export function ProfileScreen() {
  const { user, username, avatar, setAvatar } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(avatar || null)

  const handleSave = async () => {
    if (!selected) {
      showError('Pick an avatar first')
      return
    }
    setSaving(true)
    const result = await setAvatar(selected)
    setSaving(false)
    if (result.success) {
      showSuccess('Avatar updated!')
      navigate('/name-input')
    } else {
      showError(`Failed: ${result.error}`)
    }
  }

  return (
    <div className="min-h-screen bg-warm-50 px-4 py-5">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/name-input')} className="btn-ghost text-sm p-2">
            ←
          </button>
          <div>
            <h1 className="font-display text-display-sm text-warm-900">Profile</h1>
            <p className="text-warm-400 text-sm">Choose your avatar</p>
          </div>
        </div>

        {/* Current User */}
        <div className="card p-4 mb-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-primary-100 flex items-center justify-center flex-shrink-0 ring-2 ring-primary-200/50 ring-offset-2 ring-offset-white">
            {selected ? (
              <img
                src={AVATARS.find(a => a.id === selected)?.file}
                alt={selected}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-primary-600">
                {username?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div>
            <p className="font-display font-bold text-warm-900">{user?.displayName || username}</p>
            <p className="text-warm-400 text-xs font-medium">@{username}</p>
          </div>
        </div>

        {/* Avatar Grid */}
        <div className="card p-4 mb-5">
          <label className="section-label mb-3 block">Pick Your Character</label>
          <div className="grid grid-cols-4 gap-2.5">
            {AVATARS.map(avatarItem => {
              const isSelected = selected === avatarItem.id
              return (
                <motion.button
                  key={avatarItem.id}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setSelected(avatarItem.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? 'bg-primary-50 border-2 border-primary-400 shadow-sm shadow-primary-200/40'
                      : 'bg-warm-50/60 border-2 border-transparent hover:border-warm-200 hover:bg-warm-50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center transition-all ${
                    isSelected ? 'ring-2 ring-primary-400 ring-offset-1 ring-offset-primary-50' : ''
                  }`}>
                    <img
                      src={avatarItem.file}
                      alt={avatarItem.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className={`text-[10px] font-medium truncate w-full text-center ${
                    isSelected ? 'text-primary-700' : 'text-warm-500'
                  }`}>
                    {avatarItem.name}
                  </span>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-4 h-4 rounded-full bg-primary-500 text-white flex items-center justify-center -mt-0.5"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Save Button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={!selected || saving}
          className="btn-primary w-full"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Saving…
            </span>
          ) : '💾 Save Avatar'}
        </motion.button>
      </div>
    </div>
  )
}
