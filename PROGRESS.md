# Kippo — Project Progress

> **Kippo** — *Track scores. Crown winners.*

A full-stack board game scorekeeper web app. Two game modes: standard board game scoring and a multiplayer **Raja Rani** party game (social deduction — police, thief, civilians each round). Built for a GCP hackathon.

**Live:** https://board-game-scorekeeper-d61df.web.app

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS 3.4 + inline styles |
| Animation | Framer Motion 11 |
| UI Extras | canvas-confetti, lucide-react, uuid |
| Font | Source Code Pro (monospace-only design system) |
| Auth | Firebase Authentication (Google OAuth) |
| Live State | Cloud Firestore |
| Backend | Python FastAPI on Cloud Run |
| AI Commentary | Google Vertex AI — Gemini 2.5 Flash (`google.genai`) |
| History Archive | Per-user SQLite files in GCS bucket `bgsk-game-history` |
| Hosting | Firebase Hosting |
| Container | Docker (Python 3.12-slim) |

---

## What's Built

### Frontend Screens (12 screens)

| Screen | File | Description |
|--------|------|-------------|
| **LoginScreen** | `src/screens/LoginScreen.jsx` | Landing page — background image, Google OAuth button, username claiming form, post-login actions (Start Game, Join, Raja Rani, History) |
| **NameInputScreen** | `src/screens/NameInputScreen.jsx` | Game setup — player name entry (duplicate detection, localStorage draft persistence), round length selector, game creation to Firestore |
| **PointEntryScreen** | `src/screens/PointEntryScreen.jsx` | Core gameplay — score inputs, live leaderboard sidebar, voice input, offline queue, undo last round, end-game modal, join code with copy, AI coach commentary per round, lobby mode for non-host |
| **ResultsScreen** | `src/screens/ResultsScreen.jsx` | Post-game — animated podium with confetti, fireworks, victory music, game analytics (total points, avg score, win margin, biggest lead, comeback stats, player consistency/std dev), AI coach finale comment |
| **HistoryScreen** | `src/screens/HistoryScreen.jsx` | Game history list from Cloud Storage SQLite archive via backend API |
| **HistoryDetailScreen** | `src/screens/HistoryDetailScreen.jsx` | Single game detail — winner banner, final standings, round-by-round table |
| **DicePage** | `src/screens/DicePage.jsx` | SVG dice roller with animated roll and roll history |
| **ProfileScreen** | `src/screens/ProfileScreen.jsx` | Avatar selection grid (8 avatars), display name change, logout |
| **JoinGameScreen** | `src/screens/JoinGameScreen.jsx` | Join existing game by 6-character code |
| **RajaRaniLobbyScreen** | `src/screens/RajaRaniLobbyScreen.jsx` | Raja Rani multiplayer lobby — create room (police time limit, total rounds) or join by code |
| **RajaRaniGameScreen** | `src/screens/RajaRaniGameScreen.jsx` | Raja Rani gameplay — card reveal, role assignment (Fisher-Yates shuffle), police selection phase with countdown, round results, cumulative scores, host controls |
| **RajaRaniPodiumScreen** | `src/screens/RajaRaniPodiumScreen.jsx` | Raja Rani results — podium bars, final standings with police catches/thief escapes stats, round-by-round summary with role outcomes, confetti, victory music |

### Frontend Components (10 components)

| Component | File | Description |
|-----------|------|-------------|
| **NavBar** | `src/components/NavBar.jsx` | Top nav — Raja Rani, Dice, History links + profile avatar; subnav with username |
| **ErrorBoundary** | `src/components/ErrorBoundary.jsx` | React error boundary with styled fallback UI |
| **LoadingSkeleton** | `src/components/LoadingSkeleton.jsx` | Pulsing card skeleton loader |
| **Modal** | `src/components/Modal.jsx` | Modal + ConfirmModal with backdrop, spring animation |
| **EmptyState** | `src/components/EmptyState.jsx` | Generic empty state (icon, title, description, action) |
| **FireworksBackground** | `src/components/FireworksBackground.jsx` | Canvas-based fireworks particle system for results page |
| **GameCoach** | `src/components/GameCoach.jsx` | AI commentator "Mr. Slow" — comment bubble with emotion-driven character images (default/happy/laugh/shocked/sad), typing indicator |
| **PlayerAvatar** | `src/components/PlayerAvatar.jsx` | Circular avatar display with image or initials fallback, multiple sizes |
| **TiltCard** | `src/components/TiltCard.jsx` | 3D tilt card effect using Framer Motion (mouse-follow rotation, glare sweep) |
| **ThemeToggle** | `src/components/ThemeToggle.jsx` | No-op placeholder (Kippo is dark-only) |

### Frontend Contexts (3 contexts)

| Context | File | Description |
|---------|------|-------------|
| **AuthContext** | `src/contexts/AuthContext.jsx` | Firebase Auth init, Google OAuth login, username claim (Firestore transaction), avatar management, displayName update, username availability check (debounced) |
| **ToastContext** | `src/contexts/ToastContext.jsx` | Toast notifications (info/success/error), auto-dismiss, action buttons |
| **ThemeContext** | `src/contexts/ThemeContext.jsx` | Static dark-theme context (no-op, Kippo is dark-only) |

### Hooks & Config

| File | Description |
|------|-------------|
| `src/hooks/useVoiceInput.js` | Web Speech API hook — speech recognition with interim/final results, returns raw transcript for server-side parsing |
| `src/config/avatars.js` | 8 predefined avatar definitions (rohith, dinesh, david, anirudh, roshaun, dhanya, kiruthika, afna) |

### Styles

| File | Description |
|------|-------------|
| `src/index.css` | Tailwind directives, Kippo design tokens (CSS custom properties), component classes (kippo-card, kippo-btn-primary, kippo-btn-ghost, kippo-btn-danger, kippo-input, kippo-nav, kippo-subnav, kippo-stat), animations (confetti-burst, spin, pulse), scrollbar styling, reduced-motion media query |

### Backend (Python FastAPI)

**Files:** `backend/main.py`, `backend/requirements.txt`, `backend/Dockerfile`, `backend/.dockerignore`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/players` | GET | Get players for a game (auth required) |
| `/parse-voice` | POST | Parse spoken text into player-score pairs (regex-based) |
| `/games/{game_id}/complete` | POST | Archive completed game to per-user SQLite in GCS |
| `/history/{username}` | GET | List all past games |
| `/history/{username}/{game_id}` | GET | Single game detail with rounds |
| `/coach-comment` | POST | AI in-round commentary (Gemini 2.5 Flash) |
| `/coach-finale` | POST | AI end-of-game wrap-up commentary |

**Security:** Firebase ID token verification on all data endpoints. Per-username `asyncio.Lock` for GCS write concurrency. Rate limiting: 100 req/15 min per IP. CORS restricted to `ALLOWED_ORIGINS` env var.

### Design System

Fully documented in `DESIGN.md`. Dark-only "Kippo" brand:

| Token | Value | Usage |
|-------|-------|-------|
| Void Black | `#000000` | Page canvas |
| Carbon | `#29292a` | Card surfaces |
| Kippo Pink | `#ee1f66` | Single chromatic accent (CTAs, active states, highlights) |
| Ghost White | `#ffffff` | Borders, text |
| Font | Source Code Pro | Monospace-only, all uppercase, generous letter-spacing |

Tailwind config in `tailwind.config.js` maps these to utility classes.

### Static Assets

| Directory | Contents |
|-----------|----------|
| `public/avatars/` | 8 player avatar PNGs |
| `public/coach/` | 5 coach character emotion PNGs (default, happy, laugh, shocked, sad) |
| `public/bg/` | Background images (main_page.jpg, podium page.png, pointinput.png) |
| `public/victory_music.mpeg` | Victory celebration music |
| `public/favicon.svg` | Favicon |

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users/{uid}` | User profiles (username, displayName, photoURL, avatar, createdAt) |
| `usernames/{username}` | Username uniqueness registry (uid, claimedAt) — create-once, immutable |
| `games/{gameId}` | Board game sessions (createdBy, players, playerUids, roundLength, currentRound, status, joinCode) |
| `games/{gameId}/rounds/{roundId}` | Individual round scores |
| `rajaRaniRooms/{roomId}` | Raja Rani multiplayer rooms (host, players, scores, settings) |
| `rajaRaniRooms/{roomId}/rounds/{roundId}` | Raja Rani round data (roles, police selection, scores) |

### Security

- Firestore rules enforce owner-only writes, immutable usernames, authenticated reads
- Backend verifies Firebase ID tokens on every request
- Service account scoped to Storage Object Admin + Datastore User + Vertex AI User only
- CORS restricted to `ALLOWED_ORIGINS` env var

---

## What's Broken Right Now

### Cloud Run backend is DOWN
The service `bgsk-backend` no longer exists or was deleted. All API calls fail with `ERR_NAME_NOT_RESOLVED`.

**Impact:** Game archival, history retrieval, voice input parsing, and AI coach commentary are all non-functional. Core gameplay (Firestore-based) still works.

**Fix:** Redeploy the backend (see Steps below).

---

## Steps To Get It Running Again

### Step 1 — Install gcloud CLI (if not installed)
```
winget install Google.SDK
```
Then restart terminal. Verify:
```
gcloud --version
```

### Step 2 — Authenticate gcloud
```
gcloud auth login
gcloud config set project board-game-scorekeeper-d61df
```

### Step 3 — Create GCS bucket (if not exists)
Go to https://console.cloud.google.com/storage/browser
- Click **Create bucket**
- Name: `bgsk-game-history`
- Location: `us-central1`
- Click **Create**

### Step 4 — Create service account (if not exists)
```
gcloud iam service-accounts create bgsk-backend --display-name="BGSK Backend"
```
Grant permissions:
```
gcloud projects add-iam-policy-binding board-game-scorekeeper-d61df --member="serviceAccount:bgsk-backend@board-game-scorekeeper-d61df.iam.gserviceaccount.com" --role="roles/datastore.user" --quiet
gsutil iam ch serviceAccount:bgsk-backend@board-game-scorekeeper-d61df.iam.gserviceaccount.com:objectAdmin gs://bgsk-game-history
```

### Step 5 — Deploy backend to Cloud Run
From the project root:
```
gcloud run deploy bgsk-backend --source=backend --region=us-central1 --allow-unauthenticated --set-env-vars=GCS_BUCKET=bgsk-game-history --min-instances=1 --memory=512Mi --port=8080 --service-account=bgsk-backend@board-game-scorekeeper-d61df.iam.gserviceaccount.com
```
Copy the URL it outputs (looks like `https://bgsk-backend-XXXXXXX-uc.a.run.app`).

### Step 6 — Update .env with new URL
```
powershell -Command "(Get-Content .env) -replace 'VITE_API_URL=.*', 'VITE_API_URL=YOUR_NEW_URL' | Set-Content .env"
```

### Step 7 — Rebuild frontend
```
npm run build
```

### Step 8 — Deploy frontend to Firebase Hosting
```
firebase deploy --only hosting
```

### Step 9 — Verify
- Open https://board-game-scorekeeper-d61df.web.app
- Login with Google
- Start a game, submit rounds, end game
- Check history page shows archived game
- Check results/podium page loads

### Alternative: Use deploy.sh
```
bash deploy.sh
```
Full automation — enables GCP APIs, creates bucket + service account, deploys Firestore rules, builds/deploys backend and frontend.

---

## .env File

Located at project root (`.env`) and `.env.local`. **NOT committed to git** (in .gitignore).

```
VITE_FIREBASE_API_KEY=AIzaSyDaDFXL7Mg4JJyPyVAUjDagWz_VBDDxYSA
VITE_FIREBASE_AUTH_DOMAIN=board-game-scorekeeper-d61df.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=board-game-scorekeeper-d61df
VITE_FIREBASE_STORAGE_BUCKET=board-game-scorekeeper-d61df.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=552858812552
VITE_FIREBASE_APP_ID=1:552858812552:web:d9cf5046a81c5462181f3d
VITE_API_URL=<CLOUD_RUN_BACKEND_URL>
```

**CRITICAL:** `VITE_API_URL` is baked into the frontend at build time. Must exist BEFORE `npm run build`.

---

## Key Code Patterns

- **Optimistic UI:** Leaderboard updates instantly on round submit before Firestore write completes
- **Offline resilience:** Failed writes queue up and retry on reconnect
- **Atomic operations:** Username claim uses Firestore `runTransaction` for check-and-create
- **Per-username write locks:** Backend uses `asyncio.Lock` per username to prevent SQLite corruption from concurrent GCS writes
- **Join code system:** 6-character alphanumeric codes (ambiguous chars like 0/O/1/I removed) for multiplayer game joining
- **Draft persistence:** Player list saved to `localStorage` so mid-setup refresh doesn't lose data
- **Undo window:** 10-second window to undo last round submission
- **Rematch:** Archives current game, resets scores, keeps players, generates new join code
- **Raja Rani scoring:** Raja=1000pts, Rani=800pts, Police=-100 if catches thief/0 if not, Thief=0 if caught/200-799 random if escaped, Civilians=100-799 unique random

---

## Architecture

```
Browser (Firebase Hosting)
  │
  ├── Firebase Auth (Google OAuth)
  ├── Cloud Firestore (games, rounds, users, usernames, rajaRaniRooms)
  │
  └── API calls → Cloud Run backend (FastAPI)
                    ├── Firebase Admin (token verification)
                    ├── Cloud Storage (per-user .db SQLite files)
                    └── Vertex AI / Gemini 2.5 Flash (AI coach commentary)
```

---

## Key Gotchas
- **Vite bakes env vars at build time** — `.env` must exist before `npm run build`
- **SPA rewrite catches all routes** — if `VITE_API_URL` is empty, API calls return HTML → `res.json()` fails silently
- **Cloud Run cold starts** — `--min-instances=0` loses in-memory state. Use `--min-instances=1`
- **Firestore security rules** — usernames immutable, games/rounds owner-only CRUD
- **GCS write concurrency** — per-username asyncio.Lock prevents lost writes on parallel requests
- **Voice input** — Web Speech API browser support varies; works best in Chrome

---

## Git Remotes
- `origin` → `https://github.com/Dineshreddy-13/gcp.git`
- `board` → `https://github.com/jivasrohith25/Board.git`

Push with: `git push board main`

---

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview, architecture, setup, deploy, API docs |
| `progress.md` | This file — current build status, known issues, recovery steps |
| `DESIGN.md` | Full Kippo design system (colors, typography, spacing, components) |
| `FIREBASE_SETUP.md` | Firebase + GCP setup guide, Firestore schema documentation |
| `deploy.sh` | Full deployment automation script |

---

## What's NOT Needed Anymore
- Voice input parsing on frontend (moved to backend server-side regex)
- Session registration endpoints (removed)
- `difflib` / `io` imports (removed from backend)
- Light mode / theme toggle (Kippo is dark-only)

---

## GCP Console Links
- Cloud Run: https://console.cloud.google.com/run
- Cloud Storage: https://console.cloud.google.com/storage/browser
- Firestore: https://console.cloud.google.com/firestore
- Firebase Auth: https://console.firebase.google.com → Authentication
- IAM: https://console.cloud.google.com/iam/admin/iam
- Firebase Hosting: https://console.firebase.google.com → Hosting
- Vertex AI: https://console.cloud.google.com/vertex-ai
