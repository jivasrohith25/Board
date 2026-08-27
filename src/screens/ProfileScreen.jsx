import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { AVATARS } from '../config/avatars'

export function ProfileScreen() {
  const { user, username, avatar, setAvatar, logout } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(avatar || null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      style={{ minHeight: 'calc(100vh - 48px)', background: '#7a8aba', padding: '16px' }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Section Label Bar */}
        <div className="section-label-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px' }}>👤</span>
          PROFILE
          <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '400', letterSpacing: '0', textTransform: 'none' }}>Choose your avatar</span>
        </div>

        {/* Current User */}
        <div className="ds-form-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', padding: '16px' }}>
          <div style={{
            width: '48px', height: '48px',
            overflow: 'hidden',
            background: '#3d4f97',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            border: '2px solid #ecab37',
            borderRadius: '0',
          }}>
            {selected ? (
              <img src={AVATARS.find(a => a.id === selected)?.file} alt={selected} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#ecab37', fontSize: '18px', fontWeight: '900' }}>
                {username?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div>
            <p style={{ fontFamily: 'Arial Black, Arial', fontSize: '14px', fontWeight: '900', color: '#21242e', margin: '0 0 2px 0' }}>{user?.displayName || username}</p>
            <p style={{ fontSize: '10px', fontWeight: '700', color: '#60619c', margin: 0 }}>@{username}</p>
          </div>
        </div>

        {/* Avatar Grid */}
        <div className="ds-form-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: '12px' }}>
          <div className="section-label-bar">≡ PICK YOUR CHARACTER</div>
          <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
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
                    background: isSelected ? 'rgba(246, 141, 31, 0.1)' : '#ffffff',
                    border: isSelected ? '2px solid #f68d1f' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{
                    width: '40px', height: '40px',
                    overflow: 'hidden',
                    borderRadius: '0',
                    border: isSelected ? '2px solid #f68d1f' : '1px solid #5a5f8c',
                  }}>
                    <img src={avatarItem.file} alt={avatarItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: isSelected ? '#f68d1f' : '#60619c', textTransform: 'uppercase', letterSpacing: '0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
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
          className="ds-btn-submit"
          style={{ width: '100%', marginBottom: '12px' }}
        >
          {saving ? 'SAVING...' : '💾 SAVE AVATAR'}
        </motion.button>

        {/* Logout */}
        {!showLogoutConfirm ? (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="ds-btn-secondary"
              style={{ fontSize: '10px', padding: '10px 24px' }}
            >
              LOG OUT
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="ds-form-panel"
            style={{ textAlign: 'center', padding: '16px', background: 'rgba(230, 0, 18, 0.05)', borderTop: '2px solid #e60012' }}
          >
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#21242e', marginBottom: '12px' }}>
              Are you sure you want to log out?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={() => setShowLogoutConfirm(false)} className="ds-btn-secondary" style={{ fontSize: '10px', padding: '8px 16px' }}>
                CANCEL
              </button>
              <button onClick={handleLogout} className="ds-btn-submit" style={{ fontSize: '10px', padding: '8px 16px', background: '#e60012', borderBottomColor: 'rgba(0,0,0,0.3)' }}>
                CONFIRM LOGOUT
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
