import { Storage } from '@google-cloud/storage'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'

const storage = new Storage()
const BUCKET_NAME = process.env.GCS_BUCKET || 'bgsk-game-history'

// Per-username write queue to prevent concurrent write corruption
const writeLocks = new Map()

function getWriteLock(username) {
  if (!writeLocks.has(username)) {
    writeLocks.set(username, Promise.resolve())
  }
  return writeLocks.get(username)
}

function setWriteLock(username, promise) {
  writeLocks.set(username, promise)
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    played_at TEXT NOT NULL,
    players TEXT NOT NULL,
    rounds TEXT NOT NULL,
    winner TEXT NOT NULL,
    final_scores TEXT NOT NULL
  )
`

/**
 * Archive a completed game to the user's SQLite file in Cloud Storage.
 * Uses an in-memory per-username mutex so concurrent requests serialize.
 */
export async function archiveGame({ gameId, username, players, rounds, finalScores, winner }) {
  // Queue behind any pending write for this username
  const currentLock = getWriteLock(username)

  const writePromise = currentLock.then(async () => {
    const tmpDir = os.tmpdir()
    const localPath = path.join(tmpDir, `${username}.db`)
    const remotePath = `${username}.db`
    const bucket = storage.bucket(BUCKET_NAME)
    const file = bucket.file(remotePath)

    try {
      // Download existing DB or start fresh
      const [exists] = await file.exists()
      if (exists) {
        await file.download({ destination: localPath })
      }

      // Open SQLite and ensure table exists
      const db = new Database(localPath)
      db.pragma('journal_mode = WAL')
      db.exec(CREATE_TABLE_SQL)

      // Insert game row
      const insert = db.prepare(`
        INSERT OR REPLACE INTO games (id, played_at, players, rounds, winner, final_scores)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      insert.run(
        gameId,
        new Date().toISOString(),
        JSON.stringify(players),
        JSON.stringify(rounds),
        winner,
        JSON.stringify(finalScores)
      )

      db.close()

      // Re-upload to Cloud Storage
      await bucket.upload(localPath, {
        destination: remotePath,
        metadata: {
          contentType: 'application/x-sqlite3',
          metadata: {
            lastUpdated: new Date().toISOString(),
            username,
          },
        },
      })

      // Cleanup local file
      try { fs.unlinkSync(localPath) } catch {}

    } catch (err) {
      // Cleanup on error too
      try { fs.unlinkSync(localPath) } catch {}
      throw err
    }
  })

  setWriteLock(username, writePromise.catch(() => {})) // Don't let failures block next write
  return writePromise
}

/**
 * Read a user's game history from their SQLite file in Cloud Storage.
 */
export async function getHistory(username) {
  const tmpDir = os.tmpdir()
  const localPath = path.join(tmpDir, `${username}_read.db`)
  const remotePath = `${username}.db`
  const bucket = storage.bucket(BUCKET_NAME)
  const file = bucket.file(remotePath)

  try {
    const [exists] = await file.exists()
    if (!exists) {
      return []
    }

    await file.download({ destination: localPath })

    const db = new Database(localPath, { readonly: true })
    const rows = db.prepare('SELECT * FROM games ORDER BY played_at DESC').all()
    db.close()

    try { fs.unlinkSync(localPath) } catch {}

    return rows.map(row => ({
      id: row.id,
      playedAt: row.played_at,
      players: JSON.parse(row.players),
      rounds: JSON.parse(row.rounds),
      winner: row.winner,
      finalScores: JSON.parse(row.final_scores),
    }))
  } catch (err) {
    try { fs.unlinkSync(localPath) } catch {}
    throw err
  }
}