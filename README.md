# 🎲 Board Game Scorekeeper

A full-stack web app to track board game scores during game night. Built for a GCP hackathon.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite, Tailwind CSS, Framer Motion, canvas-confetti |
| Backend | Node.js / Express on Cloud Run |
| Auth | Firebase Authentication (Google OAuth) |
| Live State | Cloud Firestore |
| History Archive | Cloud Storage (per-user SQLite files via better-sqlite3) |

## Features

- **Google OAuth login** with atomic username claiming (Firestore transaction)
- **Player management** with duplicate detection, localStorage draft persistence
- **Live scoring** with auto-sorted animated leaderboard, optimistic updates
- **Offline resilience** — queues round writes, retries on reconnect
- **Undo** last round (10-second window)
- **End Game** modal — Rematch (reset scores, keep players) or End (view results)
- **Results podium** with confetti burst and fireworks background
- **Game archival** to per-user SQLite files in Cloud Storage with write queue serialization
- **Responsive, mobile-first** — designed for phones at game night

## Project Structure

```
├── src/
│   ├── main.jsx              # Entry point
│   ├── App.jsx               # Routes + auth guards
│   ├── index.css             # Tailwind + custom styles
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Firebase Auth + username logic
│   │   └── ToastContext.jsx   # Toast notifications
│   ├── screens/
│   │   ├── LoginScreen.jsx    # Google OAuth + username claim
│   │   ├── NameInputScreen.jsx# Player list + round length
│   │   ├── PointEntryScreen.jsx# Score entry + leaderboard
│   │   └── ResultsScreen.jsx  # Podium + confetti
│   └── components/
│       ├── ErrorBoundary.jsx
│       ├── LoadingSkeleton.jsx
│       ├── Modal.jsx
│       ├── EmptyState.jsx
│       └── FireworksBackground.jsx
├── backend/
│   ├── server.js             # Express API (Cloud Run)
│   ├── gameArchiver.js       # SQLite archive read/write
│   ├── Dockerfile
│   └── package.json
├── firestore.rules           # Security rules
├── firebase.json             # Hosting + Firestore config
├── deploy.sh                 # One-command deploy script
└── .env.example              # Environment template
```

## Prerequisites

1. [Node.js 18+](https://nodejs.org)
2. [gcloud CLI](https://cloud.google.com/sdk/docs/install) — authenticated
3. [Firebase CLI](https://firebase.google.com/docs/cli) — authenticated

## Setup from Scratch

### 1. Create GCP Project & Firebase Project

```bash
# Create GCP project (or use existing)
gcloud projects create YOUR_PROJECT_ID
gcloud config set project YOUR_PROJECT_ID

# Enable billing (required for Cloud Run)
# Visit: https://console.cloud.google.com/billing

# Initialize Firebase
firebase login
firebase init  # select Firestore + Hosting, use existing GCP project
```

### 2. Enable Firebase Authentication

```bash
# In Firebase Console (https://console.firebase.google.com):
# 1. Go to Authentication → Sign-in method
# 2. Enable Google provider
# 3. Set support email
# 4. Copy your web app config
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Firebase config values from the console
```

### 4. Deploy Everything

```bash
export GCP_PROJECT_ID=your-project-id
chmod +x deploy.sh
./deploy.sh
```

This single script:
- Enables required GCP APIs
- Creates Cloud Storage bucket with versioning
- Creates a scoped service account (Storage Object Admin on bucket + Datastore User)
- Deploys Firestore security rules
- Builds & deploys backend to Cloud Run
- Builds & deploys frontend to Firebase Hosting

### 5. Manual Deploy Steps (if you prefer)

**Backend:**
```bash
cd backend
npm install

# Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/bgsk-backend

# Deploy to Cloud Run
gcloud run deploy bgsk-backend \
  --image gcr.io/YOUR_PROJECT_ID/bgsk-backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GCS_BUCKET=bgsk-game-history"
```

**Frontend:**
```bash
npm install
npm run build
firebase deploy --only hosting
```

**Firestore Rules:**
```bash
firebase deploy --only firestore:rules
```

## Local Development

```bash
# Frontend (port 3000)
npm install
npm run dev

# Backend (port 8080)
cd backend
npm install
npm run dev
```

## Backend API

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/archive-game` | POST | Bearer token | Archive completed game to user's SQLite file |
| `/history/:username` | GET | Bearer token | Read user's game history |

### SQLite Schema

```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  played_at TEXT,
  players TEXT,      -- JSON array
  rounds TEXT,       -- JSON array of score objects
  winner TEXT,
  final_scores TEXT  -- JSON object
);
```

## Security

- Firestore rules enforce: users write only their own data; username docs are create-once, immutable
- Backend validates all inputs server-side (username format, score types, ownership)
- Cloud Run service account scoped to only Storage Object Admin on the game-history bucket + Datastore User
- Firebase Auth tokens verified on every backend request
- Rate limiting: 100 requests per 15 minutes per IP
- Cloud Storage bucket has object versioning for rollback safety

## Architecture Decisions

- **SQLite in Cloud Storage** vs Firestore for history: keeps archival data cheap, portable, and queryable offline. Per-username mutex on the Cloud Run instance prevents concurrent-write corruption.
- **Optimistic UI** for round submission: leaderboard updates instantly, write errors show a toast with retry.
- **localStorage draft persistence**: refresh mid-setup doesn't lose player list.
- **Atomic username claiming**: Firestore `runTransaction` does check-and-create in one shot, no TOCTOU race.