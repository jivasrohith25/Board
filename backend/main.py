"""
Board Game Scorekeeper Backend
FastAPI app with Firebase auth, Cloud Storage SQLite archiving, and voice parsing.
"""

import asyncio
import difflib
import io
import json
import os
import re
import sqlite3
import tempfile
from datetime import datetime, timezone
from typing import Any

import firebase_admin
from firebase_admin import auth, firestore
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.cloud import storage as gcs_storage
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Firebase Admin init
# ---------------------------------------------------------------------------
if not firebase_admin._apps:
    firebase_admin.initialize_app()

# ---------------------------------------------------------------------------
# GCS client (auto-authenticated on Cloud Run)
# ---------------------------------------------------------------------------
gcs_client = gcs_storage.Client()
BUCKET_NAME = os.environ.get("GCS_BUCKET", "bgsk-game-history")

# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------
sessions: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# Per-username write locks
# ---------------------------------------------------------------------------
_write_locks: dict[str, asyncio.Lock] = {}


def _get_write_lock(username: str) -> asyncio.Lock:
    if username not in _write_locks:
        _write_locks[username] = asyncio.Lock()
    return _write_locks[username]


# ---------------------------------------------------------------------------
# SQLite schema
# ---------------------------------------------------------------------------
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    played_at TEXT NOT NULL,
    players TEXT NOT NULL,
    rounds TEXT NOT NULL,
    winner TEXT NOT NULL,
    final_scores TEXT NOT NULL
)
"""

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Board Game Scorekeeper API")

# CORS
allowed_origin = os.environ.get("ALLOWED_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def authenticate(request: Request) -> dict:
    """Verify Firebase ID token and return decoded token + username."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header.split("Bearer ", 1)[1]
    try:
        decoded = auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing uid")

    # Look up username from Firestore
    db = firestore.client()
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=403, detail="User profile not found")

    username = user_doc.to_dict().get("username")
    if not username:
        raise HTTPException(status_code=403, detail="Username not set")

    return {"uid": uid, "username": username.lower()}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_bucket() -> gcs_storage.Bucket:
    return gcs_client.bucket(BUCKET_NAME)


def _download_db(username: str, local_path: str) -> bool:
    """Download user's SQLite file from GCS. Returns True if file existed."""
    bucket = _get_bucket()
    blob = bucket.blob(f"{username}.db")
    if blob.exists():
        blob.download_to_filename(local_path)
        return True
    return False


def _upload_db(username: str, local_path: str) -> None:
    """Upload SQLite file to GCS."""
    bucket = _get_bucket()
    blob = bucket.blob(f"{username}.db")
    blob.upload_from_filename(
        local_path,
        content_type="application/x-sqlite3",
    )
    blob.metadata = {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "username": username,
    }
    blob.patch()


def _open_db(local_path: str) -> sqlite3.Connection:
    """Open SQLite and ensure games table exists."""
    conn = sqlite3.connect(local_path)
    conn.execute(CREATE_TABLE_SQL)
    conn.commit()
    return conn


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class ArchiveGameRequest(BaseModel):
    players: list[str]
    rounds: list[dict[str, Any]]
    final_scores: dict[str, float]
    winner: str


class VoiceParseRequest(BaseModel):
    game_id: str
    text: str


# ---------------------------------------------------------------------------
# a) GET /health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# b) GET /players/{game_id}
# ---------------------------------------------------------------------------
@app.get("/players/{game_id}")
async def get_players(game_id: str):
    session = sessions.get(game_id)
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    return {
        "players": session.get("players", []),
        "scores": session.get("scores", {}),
        "current_round": session.get("current_round", 0),
    }


# ---------------------------------------------------------------------------
# c) POST /parse-voice
# ---------------------------------------------------------------------------
def _parse_voice_text(text: str, player_names: list[str]) -> dict:
    matches = []
    recognized_players = set()
    lower_to_original = {n.lower(): n for n in player_names}

    # Normalize speech
    text = text.lower()
    text = re.sub(r"\b(scored|score|got|gets|get|points|point)\b", " ", text)
    text = re.sub(r"[,:;]", " ", text)

    words = text.split()

    i = 0
    while i < len(words):
        best_match = None
        best_len = 0

        for name_lower, name_orig in lower_to_original.items():
            name_words = name_lower.split()

            if words[i:i + len(name_words)] == name_words:
                best_match = name_orig
                best_len = len(name_words)
                break

        if best_match:
            j = i + best_len

            if j < len(words):
                try:
                    score = int(words[j])

                    if best_match.lower() not in recognized_players:
                        matches.append({
                            "player": best_match,
                            "score": score
                        })
                        recognized_players.add(best_match.lower())

                    i = j + 1
                    continue
                except ValueError:
                    pass

        i += 1

    unrecognized = []

    for name_orig in player_names:
        if name_orig.lower() not in recognized_players:
            close = difflib.get_close_matches(
                name_orig.lower(),
                re.findall(r"[a-z]+", text),
                n=1,
                cutoff=0.6,
            )

            if close:
                unrecognized.append(name_orig)

    return {
        "matches": matches,
        "unrecognized_names": unrecognized
    }


@app.post("/parse-voice")
async def parse_voice(req: VoiceParseRequest):
    session = sessions.get(req.game_id)
    if not session:
        # Session lost (cold start / scale-to-zero) — can't parse without players
        raise HTTPException(
            status_code=404,
            detail="Game session not found. Please refresh the page to re-register players.",
        )

    player_names = session.get("players", [])
    if not player_names:
        raise HTTPException(status_code=400, detail="No players in session")

    result = _parse_voice_text(req.text, player_names)
    return result


# ---------------------------------------------------------------------------
# Session registration (called by frontend when game starts)
# ---------------------------------------------------------------------------
class RegisterSessionRequest(BaseModel):
    players: list[str]


@app.post("/sessions/{game_id}")
async def register_session(game_id: str, req: RegisterSessionRequest):
    """Register a game session's player list for voice parsing."""
    sessions[game_id] = {
        "players": req.players,
        "scores": {p: 0 for p in req.players},
        "current_round": 1,
    }
    return {"success": True}


# ---------------------------------------------------------------------------
# d) POST /games/{game_id}/complete
# ---------------------------------------------------------------------------
@app.post("/games/{game_id}/complete")
async def complete_game(
    game_id: str,
    req: ArchiveGameRequest,
    user: dict = Depends(authenticate),
):
    username = user["username"]

    # Validate inputs
    if not game_id or not isinstance(game_id, str):
        raise HTTPException(status_code=400, detail="Invalid game_id")

    if not isinstance(req.players, list) or len(req.players) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")

    for p in req.players:
        if not isinstance(p, str) or len(p) == 0 or len(p) > 20:
            raise HTTPException(status_code=400, detail=f"Invalid player name: {p}")

    if not isinstance(req.rounds, list):
        raise HTTPException(status_code=400, detail="Invalid rounds data")

    if not isinstance(req.final_scores, dict) or not req.final_scores:
        raise HTTPException(status_code=400, detail="Invalid final_scores")

    # Validate round scores
    for i, rnd in enumerate(req.rounds):
        if not isinstance(rnd, dict):
            raise HTTPException(
                status_code=400, detail=f"Round {i} is not an object"
            )
        scores = rnd.get("scores", {})
        if not isinstance(scores, dict):
            raise HTTPException(
                status_code=400, detail=f"Round {i} scores not an object"
            )
        for key, val in scores.items():
            if not isinstance(val, (int, float)):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid score for {key} in round {i}: {val}",
                )

    # Serialize data for storage
    now_iso = datetime.now(timezone.utc).isoformat()
    rounds_json = json.dumps(req.rounds)
    players_json = json.dumps(req.players)
    final_scores_json = json.dumps(req.final_scores)
    winner = req.winner or ""

    # Per-username write lock
    lock = _get_write_lock(username)
    async with lock:
        tmp_dir = tempfile.gettempdir()
        local_path = os.path.join(tmp_dir, f"{username}.db")

        try:
            # Download existing DB (or create fresh)
            existed = _download_db(username, local_path)

            conn = _open_db(local_path)
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO games
                        (id, played_at, players, rounds, winner, final_scores)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (game_id, now_iso, players_json, rounds_json, winner, final_scores_json),
                )
                conn.commit()
            finally:
                conn.close()

            # Re-upload
            _upload_db(username, local_path)

        except Exception as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to archive game: {exc}"
            )
        finally:
            # Cleanup temp file
            try:
                os.unlink(local_path)
            except OSError:
                pass

    return {"success": True, "id": game_id}


# ---------------------------------------------------------------------------
# e) GET /history/{username}
# ---------------------------------------------------------------------------
@app.get("/history/{username}")
async def get_history(
    username: str,
    user: dict = Depends(authenticate),
):
    if not username or not re.match(r"^[a-zA-Z0-9_-]+$", username):
        raise HTTPException(status_code=400, detail="Invalid username")

    if user["username"] != username.lower():
        raise HTTPException(status_code=403, detail="Cannot access another user's history")

    username = username.lower()
    tmp_dir = tempfile.gettempdir()
    local_path = os.path.join(tmp_dir, f"{username}_read.db")

    try:
        existed = _download_db(username, local_path)
        if not existed:
            return {"games": []}

        conn = _open_db(local_path)
        try:
            cursor = conn.execute(
                "SELECT id, played_at, players, rounds, winner, final_scores "
                "FROM games ORDER BY played_at DESC"
            )
            rows = cursor.fetchall()
        finally:
            conn.close()

        games = []
        for row in rows:
            games.append({
                "id": row[0],
                "played_at": row[1],
                "players": json.loads(row[2]),
                "winner": row[4],
                "final_scores": json.loads(row[5]),
            })

        return {"games": games}

    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch history: {exc}"
        )
    finally:
        try:
            os.unlink(local_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# f) GET /history/{username}/{game_id}
# ---------------------------------------------------------------------------
@app.get("/history/{username}/{game_id}")
async def get_game_detail(
    username: str,
    game_id: str,
    user: dict = Depends(authenticate),
):
    if not username or not re.match(r"^[a-zA-Z0-9_-]+$", username):
        raise HTTPException(status_code=400, detail="Invalid username")

    if user["username"] != username.lower():
        raise HTTPException(status_code=403, detail="Cannot access another user's history")

    username = username.lower()
    tmp_dir = tempfile.gettempdir()
    local_path = os.path.join(tmp_dir, f"{username}_detail.db")

    try:
        existed = _download_db(username, local_path)
        if not existed:
            raise HTTPException(status_code=404, detail="Game not found")

        conn = _open_db(local_path)
        try:
            cursor = conn.execute(
                "SELECT id, played_at, players, rounds, winner, final_scores "
                "FROM games WHERE id = ?",
                (game_id,),
            )
            row = cursor.fetchone()
        finally:
            conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Game not found")

        return {
            "id": row[0],
            "played_at": row[1],
            "players": json.loads(row[2]),
            "rounds": json.loads(row[3]),
            "winner": row[4],
            "final_scores": json.loads(row[5]),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch game detail: {exc}"
        )
    finally:
        try:
            os.unlink(local_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Local dev entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
