# Firebase & GCP Setup Guide — Kippo

Step-by-step guide to get the app running locally and deployed.

---

## 1. Local Development Setup

### Prerequisites
- Node.js 18+ installed
- npm installed
- A Google account (for Firebase)

### Step 1: Install dependencies
```bash
cd gcp
npm install
```

### Step 2: Environment file
`.env.local` already exists with your Firebase config. Vite uses `.env.local` for local dev — it overrides `.env`.

To verify, check `.env.local` has all these lines:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_URL=https://bgsk-backend-267879242324.us-central1.run.app
```

### Step 3: Start dev server
```bash
npm run dev
```
Opens at `http://localhost:3000`

### Step 4: Deploy Firestore rules
```bash
npx firebase deploy --only firestore:rules
```
This pushes `firestore.rules` to your Firebase project. Must be done once (and whenever rules change).

---

## 2. Firebase Console Setup (One-Time)

### 2a. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Name it `board-game-scorekeeper` (or whatever you want)
4. Disable Google Analytics (not needed)
5. Click **Create project**

### 2b. Enable Google Auth
1. In the project sidebar, click **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in providers**, click **Google**
4. Toggle **Enable**
5. Select your email as project support email
6. Click **Save**

### 2c. Create Firestore Database
1. In the sidebar, click **Build → Firestore Database**
2. Click **Create database**
3. Select **Start in test mode** (we'll add rules later)
4. Choose a location closest to your users (e.g., `us-central1`)
5. Click **Enable**

### 2d. Deploy Firestore Rules
```bash
# Install Firebase CLI if you haven't
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
# Select your project when prompted
firebase init

# Deploy rules
firebase deploy --only firestore:rules
```

### 2e. Get Firebase Config
1. In Firebase Console, click the **gear icon → Project settings**
2. Scroll to **Your apps** section
3. If no web app exists:
   - Click the web icon `</>`
   - Register app name: `kippo`
   - Copy the config object
4. If app exists: click it to see the config
5. The config values map to `.env.local`:
   ```
   apiKey → VITE_FIREBASE_API_KEY
   authDomain → VITE_FIREBASE_AUTH_DOMAIN
   projectId → VITE_FIREBASE_PROJECT_ID
   storageBucket → VITE_FIREBASE_STORAGE_BUCKET
   messagingSenderId → VITE_FIREBASE_MESSAGING_SENDER_ID
   appId → VITE_FIREBASE_APP_ID
   ```

---

## 3. Firestore Collections Used

The app uses these Firestore collections:

### `users/{uid}`
User profiles. Created automatically on first login.
```
{
  username: string,
  displayName: string,
  photoURL: string,
  avatar: number,
  createdAt: timestamp
}
```

### `usernames/{username}`
Username uniqueness registry. One-way claim.
```
{
  uid: string,
  claimedAt: timestamp
}
```

### `games/{gameId}`
Board game scorekeeper sessions.
```
{
  createdBy: uid,
  username: string,
  players: string[],
  playerUids: string[],
  roundLength: number,
  currentRound: number,
  status: 'lobby' | 'active' | 'finished',
  joinCode: string,
  createdAt: timestamp
}
```

### `games/{gameId}/rounds/{roundId}`
Individual round scores (board game).
```
{
  scores: { [playerName]: number },
  submittedAt: timestamp
}
```

### `rajaRaniRooms/{roomId}`
Raja Rani multiplayer rooms.
```
{
  hostUid: uid,
  hostUsername: string,
  players: [{ uid: string, displayName: string }],
  playerUids: string[],
  status: 'lobby' | 'active' | 'finished',
  policeTimeLimit: number,
  totalRounds: number,
  currentRound: number,
  joinCode: string,
  createdAt: timestamp,
  scores: { [uid]: number }
}
```

### `rajaRaniRooms/{roomId}/rounds/{roundId}`
Raja Rani round data.
```
{
  roundNumber: number,
  roles: { [uid]: 'police' | 'thief' | 'civilian' },
  policeSelection: uid | null,
  policeSelectionCorrect: boolean | null,
  roundScores: { [uid]: number },
  policeTurnStartedAt: timestamp | null,
  status: 'active' | 'completed'
}
```

---

## 4. Backend (Optional — AI Coach)

The backend is a Python FastAPI service deployed to Google Cloud Run.

### Local Backend Dev
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

Set `VITE_API_URL=http://localhost:8080` in `.env.local` to point frontend to local backend.

### Backend Environment
The backend needs these GCP services enabled:
- **Firebase Admin SDK** — service account key
- **Google Cloud Storage** — bucket `bgsk-game-history` for game archives
- **Vertex AI** — for Gemini AI coach (optional)

### Deploy Backend
```bash
./deploy.sh
```
Deploys to Cloud Run at `https://bgsk-backend-267879242324.us-central1.run.app`

---

## 5. Firebase Hosting Deploy

```bash
# Build the frontend
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## 6. Common Issues

### "Permission denied" on Firestore
→ Firestore rules not deployed. Run `firebase deploy --only firestore:rules`

### Auth popup blocked
→ Allow popups for `localhost:3000` in your browser

### Room join fails silently
→ Check Firestore rules include `rajaRaniRooms` collection (deploy rules)

### Build works but features missing
→ Run `npm run build` again after adding new files. Vite only bundles what's imported.

### `VITE_API_URL` not working
→ Vite env vars require `VITE_` prefix. Restart dev server after changing `.env.local`.
