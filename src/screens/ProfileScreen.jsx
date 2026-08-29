import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { AVATARS } from '../config/avatars'

export function ProfileScreen() {
  const { user, username, displayName, avatar, setAvatar, setDisplayName, logout } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(avatar || null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [nameInput, setNameInput] = useState(displayName || username || '')
  const [savingName, setSavingName] = useState(false)

  const handleSave = async () => {
    if (!selected) { showError('Pick an avatar first'); return }
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

  const handleLogout = async () => {
    try {
      await logout()
      localStorage.clear()
      navigate('/login')
    } catch (err) {
      showError('Logout failed')
    }
  }

  const handleSaveName = async () => {
    if (!nameInput.trim()) { showError('Name cannot be empty'); return }
    setSavingName(true)
    const result = await setDisplayName(nameInput)
    setSavingName(false)
    if (result.success) { showSuccess('Name updated!') }
    else { showError(`Failed: ${result.error}`) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      style={{ minHeight: 'calc(100vh - 76px)', background: '#000000', padding: '16px' }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Section Label */}
        <div className="kippo-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <span style={{ fontSize: '14px' }}>👤</span>
          PROFILE
          <span style={{ marginLeft: 'auto', fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 400, letterSpacing: 0, textTransform: 'none', opacity: 0.5 }}>Choose your avatar</span>
        </div>

        {/* Current User */}
        <div className="kippo-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
          <div style={{
            width: '48px', height: '48px',
            overflow: 'hidden',
            background: '#29292a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid #ee1f66',
            borderRadius: '50px',
          }}>
            {selected ? (
              <img src={AVATARS.find(a => a.id === selected)?.file} alt={selected} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontFamily: "'Source Code Pro', monospace", color: '#ee1f66', fontSize: '18px', fontWeight: 700 }}>
                {displayName?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div>
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>{displayName || username}</p>
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', margin: 0 }}>@{username}</p>
          </div>
        </div>

        {/* Change Name */}
        <div className="kippo-card-sm" style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '5px' }}>DISPLAY NAME</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.slice(0, 20))}
                className="kippo-input"
                style={{ width: '100%', fontSize: '12px' }}
                placeholder="Your display name"
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSaveName}
              disabled={savingName || !nameInput.trim() || nameInput === displayName}
              className="kippo-btn-primary"
              style={{ marginTop: '18px', padding: '8px 15px', fontSize: '10px' }}
            >
              {savingName ? '...' : 'SAVE'}
            </motion.button>
          </div>
        </div>

        {/* Avatar Grid */}
        <div className="kippo-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '15px' }}>
          <div className="kippo-label-bar">≡ PICK YOUR CHARACTER</div>
          <div className="profile-avatar-grid" style={{ padding: '15px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {AVATARS.map(avatarItem => {
              const isSelected = selected === avatarItem.id
              return (
                <motion.button
                  key={avatarItem.id}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setSelected(avatarItem.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    padding: '8px',
                    background: isSelected ? 'rgba(238, 31, 102, 0.1)' : '#000000',
                    border: isSelected ? '1px solid #ee1f66' : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '15px',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{
                    width: '40px', height: '40px',
                    overflow: 'hidden',
                    borderRadius: '50px',
                    border: isSelected ? '1px solid #ee1f66' : '1px solid rgba(255,255,255,0.15)',
                  }}>
                    <img src={avatarItem.file} alt={avatarItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '9px', fontWeight: 700, color: isSelected ? '#ee1f66' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                    {avatarItem.name}
                  </span>
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
          className="kippo-btn-primary"
          style={{ width: '100%', marginBottom: '15px' }}
        >
          {saving ? 'SAVING...' : '💾 SAVE AVATAR'}
        </motion.button>

        {/* Logout */}
        {!showLogoutConfirm ? (
          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="kippo-btn-ghost"
              style={{ fontSize: '10px', padding: '10px 24px' }}
            >
              LOG OUT
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="kippo-card"
            style={{ textAlign: 'center', borderColor: '#ee1f66' }}
          >
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '12px', fontWeight: 700, color: '#ffffff', marginBottom: '15px' }}>
              Are you sure you want to log out?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setShowLogoutConfirm(false)} className="kippo-btn-ghost" style={{ fontSize: '10px', padding: '8px 15px' }}>
                CANCEL
              </button>
              <button onClick={handleLogout} className="kippo-btn-danger" style={{ fontSize: '10px', padding: '8px 15px' }}>
                CONFIRM LOGOUT
              </button>
            </div>
          </motion.div>
        )}

      <style>{`
        @media (max-width: 360px) {
          .profile-avatar-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
        }
      `}</style>
      </div>
    </motion.div>
  )
}
