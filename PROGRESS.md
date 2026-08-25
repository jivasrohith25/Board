# Board Game Scorekeeper — Project Progress

## What's Built

### Frontend (React + Vite + Tailwind)
- **LoginScreen** — Google OAuth via Firebase, atomic username claim
- **NameInputScreen** — Player chips, round length selector (default 5), dice button, game history button
- **PointEntryScreen** — Live score inputs, leaderboard sidebar, submit/undo rounds, end game modal (rematch + end)
- **ResultsScreen** — Podium with confetti, fireworks, crown animation, view-in-history button
- **HistoryScreen** — Scrollable list of past games from SQLite archive
- **HistoryDetailScreen** — Round-by-round table, winner card, final standings
- **DicePage** — Animated SVG dice roller with roll history
- **ToastContext** — Toast notifications (info/success/error)
- **ErrorBoundary** — Global error catch

### Backend (Python FastAPI on Cloud Run)
- `POST /games/{game_id}/complete` — Archive game to per-user SQLite in GCS
- `GET /history/{username}` — List all past games
- `GET /history/{username}/{game_id}` — Single game detail with rounds
- `GET /health` — Health check
- Firebase ID token auth for all data endpoints
- Per-username asyncio.Lock for GCS write concurrency

### Infrastructure
- Firebase Auth (Google OAuth)
- Cloud Firestore (live game state + user profiles)
- Cloud Storage bucket `bgsk-game-history` (SQLite archives)
- Firebase Hosting (SPA with rewrites)

---

## What's Broken Right Now

### Cloud Run backend is DOWN
The service `bgsk-backend` no longer exists or was deleted. All API calls fail with `ERR_NAME_NOT_RESOLVED`.

**Fix:** Redeploy the backend.

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

---

## .env File
Located at project root, NOT committed to git (in .gitignore).
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

## Git Remotes
- `origin` → `https://github.com/Dineshreddy-13/gcp.git`
- `board` → `https://github.com/jivasrohith25/Board.git`

Push with: `git push board main`

---

## Architecture

```
Browser (Firebase Hosting)
  │
  ├── Firebase Auth (Google OAuth)
  ├── Cloud Firestore (games, rounds, users, usernames)
  │
  └── API calls → Cloud Run backend (FastAPI)
                    ├── Firebase Admin (token verification)
                    └── Cloud Storage (per-user .db SQLite files)
```

---

## Key Gotchas
- **Vite bakes env vars at build time** — `.env` must exist before `npm run build`
- **SPA rewrite catches all routes** — if `VITE_API_URL` is empty, API calls return HTML → `res.json()` fails silently
- **Cloud Run cold starts** — `--min-instances=0` loses in-memory state. Use `--min-instances=1`
- **Firestore security rules** — usernames immutable, games/rounds owner-only CRUD
- **GCS write concurrency** — per-username asyncio.Lock prevents lost writes on parallel requests

---

## What's NOT Needed Anymore
- Voice input (removed from frontend and backend)
- Session registration endpoints (removed)
- `difflib` / `io` imports (removed from backend)

---

## GCP Console Links
- Cloud Run: https://console.cloud.google.com/run
- Cloud Storage: https://console.cloud.google.com/storage/browser
- Firestore: https://console.cloud.google.com/firestore
- Firebase Auth: https://console.firebase.google.com → Authentication
- IAM: https://console.cloud.google.com/iam/admin/iam
- Firebase Hosting: https://console.firebase.google.com → Hosting
