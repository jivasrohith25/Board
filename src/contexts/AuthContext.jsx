import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  initializeApp
} from 'firebase/app'
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const isConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
)

let app = null
let auth = null
let db = null

if (isConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
}

export { auth, db }

let googleProvider = null
if (auth) {
  googleProvider = new GoogleAuthProvider()
  googleProvider.setCustomParameters({ prompt: 'select_account' })
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(null)
  const [displayName, setDisplayNameState] = useState(null)
  const [avatar, setAvatarState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState(null)
  const [usernameAvailable, setUsernameAvailable] = useState(null)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        if (userDoc.exists()) {
          setUsername(userDoc.data().username)
          setDisplayNameState(userDoc.data().displayName || userDoc.data().display_name || userDoc.data().username)
          setAvatarState(userDoc.data().avatar || null)
        }
      } else {
        setUsername(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const checkUsernameAvailability = useCallback(async (name) => {
    if (!name || name.length < 2) {
      setUsernameError('Username must be at least 2 characters')
      setUsernameAvailable(false)
      return
    }
    if (name.length > 20) {
      setUsernameError('Username must be 20 characters or less')
      setUsernameAvailable(false)
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setUsernameError('Username can only contain letters, numbers, underscores, and hyphens')
      setUsernameAvailable(false)
      return
    }

    setCheckingUsername(true)
    setUsernameError(null)
    setUsernameAvailable(null)

    const timeoutId = setTimeout(async () => {
      try {
        const usernameDoc = await getDoc(doc(db, 'usernames', name.toLowerCase()))
        if (usernameDoc.exists()) {
          setUsernameError('Username is taken')
          setUsernameAvailable(false)
        } else {
          setUsernameAvailable(true)
        }
      } catch (err) {
        console.error('Username check failed:', err)
        setUsernameError('Failed to check availability')
        setUsernameAvailable(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [])

  const claimUsername = async (name) => {
    const lowerName = name.toLowerCase()
    try {
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, 'usernames', lowerName)
        const usernameSnap = await transaction.get(usernameRef)
        if (usernameSnap.exists()) {
          throw new Error('Username is taken')
        }
        transaction.set(usernameRef, { uid: user.uid, claimedAt: serverTimestamp() })
        transaction.set(doc(db, 'users', user.uid), {
          username: lowerName,
          displayName: user.displayName || lowerName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp()
        })
      })
      setUsername(lowerName)
      setDisplayNameState(lowerName)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const loginWithGoogle = async () => {
    if (!auth || !googleProvider) {
      throw new Error('Firebase not configured')
    }
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const u = result.user
      await setDoc(doc(db, 'users', u.uid), {
        username: u.displayName || u.email?.split('@')[0] || 'player',
        displayName: u.displayName || u.email?.split('@')[0] || 'player',
        photoURL: u.photoURL,
        createdAt: serverTimestamp(),
      }, { merge: true })
      return u
    } catch (err) {
      throw err
    }
  }

  const setAvatar = async (avatarId) => {
    try {
      await setDoc(doc(db, 'users', user.uid), { avatar: avatarId }, { merge: true })
      setAvatarState(avatarId)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const logout = async () => {
    await signOut(auth)
  }

  const setDisplayName = async (newName) => {
    if (!newName || newName.trim().length < 1) return { success: false, error: 'Name cannot be empty' }
    const trimmed = newName.trim().slice(0, 20)
    try {
      await setDoc(doc(db, 'users', user.uid), { displayName: trimmed }, { merge: true })
      setDisplayNameState(trimmed)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      username,
      displayName,
      avatar,
      setAvatar,
      loading,
      configMissing: !isConfigured,
      checkingUsername,
      usernameError,
      usernameAvailable,
      checkUsernameAvailability,
      claimUsername,
      loginWithGoogle,
      logout,
      setDisplayName,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}