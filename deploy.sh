#!/bin/bash
# Board Game Scorekeeper — Full deployment script
# Prerequisites: gcloud CLI, firebase CLI, both authenticated
set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID env var}"
REGION="${GCP_REGION:-us-central1}"
BUCKET_NAME="${GCS_BUCKET:-bgsk-game-history}"
SERVICE_NAME="bgsk-backend"
SERVICE_ACCOUNT="${SERVICE_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🚀 Deploying Board Game Scorekeeper to project: ${PROJECT_ID}"

# ─── 1. Enable APIs ─────────────────────────────────────────────
echo "📦 Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  aiplatform.googleapis.com \
  --project="${PROJECT_ID}"

# ─── 2. Create Cloud Storage bucket with versioning ─────────────
echo "🪣 Creating storage bucket..."
gsutil mb -p "${PROJECT_ID}" -l "${REGION}" -b on "gs://${BUCKET_NAME}" 2>/dev/null || echo "Bucket already exists"
gsutil versioning set on "gs://${BUCKET_NAME}"

# ─── 3. Create service account with scoped permissions ──────────
echo "🔑 Setting up service account..."
gcloud iam service-accounts create "${SERVICE_NAME}" \
  --display-name="BGSK Backend" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "Service account already exists"

# Storage Object Admin on the specific bucket
gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT}:objectAdmin" "gs://${BUCKET_NAME}"

# Datastore User for Firestore access
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user" \
  --condition=None \
  --quiet

# Vertex AI User for Gemini model access
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user" \
  --condition=None \
  --quiet

# ─── 4. Deploy Firestore rules ──────────────────────────────────
echo "🔒 Deploying Firestore security rules..."
firebase deploy --only firestore:rules --project="${PROJECT_ID}"

# ─── 5. Build & deploy Cloud Run backend ────────────────────────
echo "🐳 Building and deploying backend to Cloud Run..."
cd backend

gcloud builds submit --tag "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" --project="${PROJECT_ID}"

gcloud run deploy "${SERVICE_NAME}" \
  --image="gcr.io/${PROJECT_ID}/${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --service-account="${SERVICE_ACCOUNT}" \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars="GCS_BUCKET=${BUCKET_NAME},GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=${REGION},ALLOWED_ORIGINS=https://${PROJECT_ID}.web.app,http://localhost:5173,http://localhost:3000" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=120

BACKEND_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo "✅ Backend deployed at: ${BACKEND_URL}"
cd ..

# ─── 6. Build & deploy frontend ─────────────────────────────────
echo "🏗️ Building frontend..."

# Write the API URL into .env for the build
echo "VITE_API_URL=${BACKEND_URL}" >> .env

npm install
npm run build

echo "🌐 Deploying frontend to Firebase Hosting..."
firebase deploy --only hosting --project="${PROJECT_ID}"

echo ""
echo "════════════════════════════════════════════"
echo "✅ Deployment complete!"
echo "   Backend:  ${BACKEND_URL}"
echo "   Frontend: https://${PROJECT_ID}.web.app"
echo "════════════════════════════════════════════"