import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import admin from 'firebase-admin'
import { archiveGame, getHistory } from './gameArchiver.js'

// Initialize Firebase Admin
admin.initializeApp()

const app = express()

app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST'],
}))
app.use(express.json({ limit: '1mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Auth middleware — verifies Firebase ID token
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.split('Bearer ')[1]
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.user = decoded
    next()
  } catch (err) {
    console.error('Token verification failed:', err.message)
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// POST /archive-game
app.post('/archive-game', authenticate, async (req, res) => {
  try {
    const { gameId, username, players, rounds, finalScores, winner } = req.body

    // Validate inputs
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ error: 'Invalid gameId' })
    }
    if (!username || typeof username !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Invalid username' })
    }
    if (!Array.isArray(players) || players.length < 2) {
      return res.status(400).json({ error: 'Invalid players array' })
    }
    if (!Array.isArray(rounds)) {
      return res.status(400).json({ error: 'Invalid rounds array' })
    }
    if (!finalScores || typeof finalScores !== 'object') {
      return res.status(400).json({ error: 'Invalid finalScores' })
    }

    // Verify players are strings
    for (const p of players) {
      if (typeof p !== 'string' || p.length === 0 || p.length > 20) {
        return res.status(400).json({ error: `Invalid player name: ${p}` })
      }
    }

    // Verify rounds contain valid scores
    for (const round of rounds) {
      if (typeof round !== 'object') {
        return res.status(400).json({ error: 'Invalid round data' })
      }
      for (const [key, val] of Object.entries(round)) {
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          return res.status(400).json({ error: `Invalid score for ${key}: ${val}` })
        }
      }
    }

    // Verify user owns this username via Firestore
    const db = admin.firestore()
    const userDoc = await db.collection('users').doc(req.user.uid).get()
    if (!userDoc.exists || userDoc.data().username !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Username does not match authenticated user' })
    }

    await archiveGame({
      gameId,
      username: username.toLowerCase(),
      players,
      rounds,
      finalScores,
      winner: winner || '',
    })

    res.json({ success: true })
  } catch (err) {
    console.error('Archive error:', err)
    res.status(500).json({ error: 'Failed to archive game' })
  }
})

// GET /history/:username
app.get('/history/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params

    if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Invalid username' })
    }

    const history = await getHistory(username.toLowerCase())
    res.json({ games: history })
  } catch (err) {
    console.error('History error:', err)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})