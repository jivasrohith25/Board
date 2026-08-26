"""
Board Game Scorekeeper Backend
FastAPI app with Firebase auth and Cloud Storage SQLite archiving.
"""

import asyncio
import json
import logging
import os
import re
import sqlite3
import tempfile
from datetime import datetime, timezone
from typing import Any

import firebase_admin
from google.cloud.firestore_v1 import ArrayUnion
from firebase_admin import auth, firestore
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.cloud import storage as gcs_storage
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("bgsk")

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
# Vertex AI — Game Coach (uses google.genai — the current supported API)
# ---------------------------------------------------------------------------
COACH_ENABLED = False
_gemini_client = None
_gemini_model = None

try:
    from google import genai
    from google.genai import types

    GCP_PROJECT = os.environ.get(
        "GCP_PROJECT_ID",
        os.environ.get("GOOGLE_CLOUD_PROJECT", ""),
    )
    GCP_LOCATION = os.environ.get("GCP_LOCATION", "us-central1")

    if not GCP_PROJECT:
        logger.warning(
            "Vertex AI disabled: no GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT env var"
        )
    else:
        _gemini_client = genai.Client(
            vertexai=True,
            project=GCP_PROJECT,
            location=GCP_LOCATION,
            http_options=types.HttpOptions(api_version="v1"),
        )
        _gemini_model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        COACH_ENABLED = True
        logger.info(
            "Vertex AI initialized: project=%s location=%s model=%s",
            GCP_PROJECT, GCP_LOCATION, _gemini_model,
        )
except Exception as e:
    logger.exception("Vertex AI init failed — coach disabled")
    COACH_ENABLED = False
    _gemini_client = None
    _gemini_model = None

class CoachResponse(BaseModel):
    comment: str
    emotion: str


# Coach generation config — structured JSON, capped for latency
COACH_GEN_CONFIG = types.GenerateContentConfig(
    temperature=0.9,
    max_output_tokens=150,
    response_mime_type="application/json",
    response_schema=CoachResponse,
) if COACH_ENABLED else None

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

# CORS — support both local dev and production
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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


# ---------------------------------------------------------------------------
# a) GET /health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# b) GET /players?game_id=...
# ---------------------------------------------------------------------------
@app.get("/players")
async def get_players(
    game_id: str,
    user: dict = Depends(authenticate),
):
    if not game_id:
        raise HTTPException(status_code=400, detail="game_id query param required")

    db = firestore.client()
    game_doc = db.collection("games").document(game_id).get()
    if not game_doc.exists:
        raise HTTPException(status_code=404, detail="Game not found")

    game_data = game_doc.to_dict()
    if game_data.get("createdBy") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not your game")

    return {
        "game_id": game_id,
        "players": game_data.get("players", []),
        "currentRound": game_data.get("currentRound", 1),
    }


# ---------------------------------------------------------------------------
# c) POST /parse-voice
# ---------------------------------------------------------------------------
class ParseVoiceRequest(BaseModel):
    text: str
    game_id: str


def _number_from_text(text: str) -> int | None:
    """Extract the first integer from a text fragment."""
    m = re.search(r"(-?\d+)", text)
    if m:
        return int(m.group(1))
    return None


# Regex verbs that indicate someone scored
_VERB_RE = re.compile(
    r"(?:gets?|got|scored?|gives?|give|has|have|earns?|earned|makes?|made|total(?:s|ed)?)",
    re.IGNORECASE,
)


def _parse_voice_impl(raw_text: str, players: list[str]) -> dict:
    """
    Match spoken player names against the text, extract the nearest
    following number as their score.

    Returns: { raw_text, matched: [{player, score}], unrecognized_names, errors }
    """
    matched = []
    errors = []
    unrecognized = []
    lower_text = raw_text.lower()

    # Build (name_lower, original_name) pairs sorted longest-first
    player_pairs = sorted(
        [(p.lower(), p) for p in players],
        key=lambda x: len(x[0]),
        reverse=True,
    )

    # Track which character positions are consumed by player matches
    consumed_spans: list[tuple[int, int]] = []

    for name_lower, name_orig in player_pairs:
        idx = lower_text.find(name_lower)
        if idx == -1:
            continue

        end = idx + len(name_lower)
        consumed_spans.append((idx, end))

        # Search for a number in the text AFTER the player name
        segment_after = raw_text[end:]
        score = _number_from_text(segment_after)

        if score is not None:
            matched.append({"player": name_orig, "score": score})
        else:
            errors.append(f"Found '{name_orig}' but no score after it")

    # Find name-like words (capitalized or near scoring verbs) not matching any player
    for word_match in re.finditer(r"\b([A-Z][a-z]{1,19})\b", raw_text):
        word = word_match.group(1)
        word_lower = word.lower()
        start, end = word_match.span()

        overlaps = any(
            start < ce and end > cs for cs, ce in consumed_spans
        )
        if overlaps:
            continue

        if any(word_lower == p.lower() for p, _ in player_pairs):
            continue

        after = raw_text[end:]
        if _VERB_RE.search(after) or _number_from_text(after) is not None:
            unrecognized.append(word)

    return {
        "raw_text": raw_text,
        "matched": matched,
        "unrecognized_names": unrecognized,
        "errors": errors,
    }


@app.post("/parse-voice")
async def parse_voice(
    req: ParseVoiceRequest,
    user: dict = Depends(authenticate),
):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    if not req.game_id:
        raise HTTPException(status_code=400, detail="game_id is required")

    db = firestore.client()
    game_doc = db.collection("games").document(req.game_id).get()
    if not game_doc.exists:
        raise HTTPException(status_code=404, detail="Game not found")

    game_data = game_doc.to_dict()
    if game_data.get("createdBy") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not your game")

    players = game_data.get("players", [])
    if not players:
        raise HTTPException(status_code=400, detail="Game has no players")

    return _parse_voice_impl(req.text.strip(), players)


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

    for i, rnd in enumerate(req.rounds):
        if not isinstance(rnd, dict):
            raise HTTPException(status_code=400, detail=f"Round {i} is not an object")
        scores = rnd.get("scores", {})
        if not isinstance(scores, dict):
            raise HTTPException(status_code=400, detail=f"Round {i} scores not an object")
        for key, val in scores.items():
            if not isinstance(val, (int, float)):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid score for {key} in round {i}: {val}",
                )

    now_iso = datetime.now(timezone.utc).isoformat()
    rounds_json = json.dumps(req.rounds)
    players_json = json.dumps(req.players)
    final_scores_json = json.dumps(req.final_scores)
    winner = req.winner or ""

    lock = _get_write_lock(username)
    async with lock:
        tmp_dir = tempfile.gettempdir()
        local_path = os.path.join(tmp_dir, f"{username}.db")

        try:
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

            _upload_db(username, local_path)

        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to archive game: {exc}")
        finally:
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {exc}")
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch game detail: {exc}")
    finally:
        try:
            os.unlink(local_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# g) POST /coach-comment — in-round AI commentary
# ---------------------------------------------------------------------------
class CoachCommentRequest(BaseModel):
    game_id: str
    round_number: int
    scores: dict[str, int]
    totals: dict[str, int]


@app.post("/coach-comment")
async def coach_comment(
    req: CoachCommentRequest,
    user: dict = Depends(authenticate),
):
    if not COACH_ENABLED:
        logger.warning(
            "Coach called but COACH_ENABLED=False (check GCP_PROJECT_ID env var)"
        )
        return {"comment": "Great round!", "favorite_player": "", "emotion": "default"}

    db = firestore.client()
    game_ref = db.collection("games").document(req.game_id)
    game_doc = game_ref.get()
    if not game_doc.exists:
        raise HTTPException(status_code=404, detail="Game not found")
    if game_doc.to_dict().get("createdBy") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not your game")

    game_data = game_doc.to_dict()

    # Read favorite/teased FIRST (before prompt) — don't block on writes
    favorite = game_data.get("favorite_player")
    if not favorite:
        players = list(req.totals.keys())
        favorite = players[req.round_number % len(players)]
        game_ref.update({"favorite_player": favorite})

    teased = game_data.get("teased_players", [])
    last_place = min(req.totals, key=req.totals.get) if req.totals else ""

    # Backend determines emotion (single source of truth)
    fav_score = req.totals.get(favorite, 0)
    max_score = max(req.totals.values()) if req.totals else 0
    is_fav_winning = fav_score == max_score and fav_score > 0
    is_fav_last = fav_score > 0 and fav_score == min(req.totals.values())

    was_teased_now_doing_well = any(
        p in teased and req.totals.get(p, 0) == max_score and max_score > 0
        for p in req.totals
    )

    if is_fav_winning:
        backend_emotion = "happy"
    elif is_fav_last:
        backend_emotion = "sad"
    elif was_teased_now_doing_well:
        backend_emotion = "laugh"
    else:
        backend_emotion = "default"

    prompt = (
        f"You are Mr. Slow — dramatic, biased board game coach. "
        f"Favorite: {favorite}. Last: {last_place}. Teased: {json.dumps(teased)}. "
        f"Round {req.round_number}: scores={json.dumps(req.scores)}, "
        f"totals={json.dumps(req.totals)}. "
        f"Write a dramatic, funny board-game coach comment in 1-2 sentences, around 20-35 words. "
        f"Make it specific to the scores and what just happened. "
        f"Do not give generic phrases like 'Great round'. "
        f"Return JSON: {{\"comment\": \"...\", \"emotion\": \"{backend_emotion}\"}}"
    )

    comment = "Great round, everyone! 🎲"
    emotion = backend_emotion

    try:
        response = _gemini_client.models.generate_content(
            model=_gemini_model,
            contents=prompt,
            config=COACH_GEN_CONFIG,
        )

        # 1) Use SDK-parsed response (response_schema gives us a CoachResponse)
        parsed_obj = getattr(response, "parsed", None)
        if parsed_obj is not None and hasattr(parsed_obj, "comment"):
            comment = str(parsed_obj.comment)[:300]
        else:
            # 2) Fall back to text parsing
            raw = (getattr(response, "text", None) or "").strip()
            if not raw:
                raise ValueError("empty Gemini response")

            fenced = re.match(r"^```(?:json)?\s*\n?(.*?)\n?\s*```$", raw, re.DOTALL)
            if fenced:
                raw = fenced.group(1).strip()

            parsed = None
            try:
                parsed = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                pass

            if parsed is None:
                json_match = re.search(r'\{.*?\}', raw, re.DOTALL)
                if json_match:
                    try:
                        parsed = json.loads(json_match.group())
                    except (json.JSONDecodeError, TypeError):
                        pass

            if isinstance(parsed, dict) and "comment" in parsed:
                comment = str(parsed["comment"])[:300]
            else:
                logger.warning(
                    "Could not parse coach comment from Gemini output: %s",
                    raw[:200],
                )

        logger.info(
            "Coach comment generated: emotion=%s round=%d comment=%s",
            backend_emotion,
            req.round_number,
            comment,
        )

    except Exception as e:
        logger.error(
            "Coach comment generation failed for game=%s round=%d: %s",
            req.game_id, req.round_number, e,
        )
        # Fallback comment — score submission must never break

    # Track teased players AFTER returning response (fire-and-forget)
    if last_place and last_place not in teased:
        try:
            game_ref.update({"teased_players": ArrayUnion([last_place])})
        except Exception as e:
            logger.error("Failed to update teased_players: %s", e)

    return {"comment": comment, "favorite_player": favorite, "emotion": emotion}


# ---------------------------------------------------------------------------
# h) POST /coach-finale — end-of-game AI commentary
# ---------------------------------------------------------------------------
class CoachFinaleRequest(BaseModel):
    game_id: str
    winner: str
    final_scores: dict[str, int]


@app.post("/coach-finale")
async def coach_finale(
    req: CoachFinaleRequest,
    user: dict = Depends(authenticate),
):
    if not COACH_ENABLED:
        logger.warning(
            "Coach finale called but COACH_ENABLED=False (check GCP_PROJECT_ID env var)"
        )
        return {
            "comment": "What a game!",
            "was_teased": False,
            "was_favorite": False,
            "emotion": "default",
        }

    db = firestore.client()
    game_doc = db.collection("games").document(req.game_id).get()
    if not game_doc.exists:
        raise HTTPException(status_code=404, detail="Game not found")
    if game_doc.to_dict().get("createdBy") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not your game")

    game_data = game_doc.to_dict()
    favorite = game_data.get("favorite_player", "")
    teased = game_data.get("teased_players", [])

    was_teased = req.winner in teased
    was_favorite = req.winner == favorite

    if was_teased:
        backend_emotion = "shocked"
        scenario = (
            f"The winner is {req.winner} — a player you ROASTED all game! "
            f"Eat your words dramatically. You're SHAKEN."
        )
    elif was_favorite:
        backend_emotion = "happy"
        scenario = (
            f"The winner is {req.winner} — YOUR favorite! I CALLED IT! "
            f"Take all the credit! 🎉"
        )
    else:
        backend_emotion = "laugh"
        scenario = (
            f"The winner is {req.winner}. Your favorite {favorite} didn't win, "
            f"but you're gracious — maybe a tiny tear."
        )

    prompt = (
        f"You are Mr. Slow — dramatic biased coach. {scenario} "
        f"Final: {json.dumps(req.final_scores)}. "
        f"Write a dramatic, funny board-game coach comment in 1-2 sentences, around 25-40 words. "
        f"Make it specific to the final scores and who won. "
        f"Do not give generic phrases. "
        f"Return JSON: {{\"comment\": \"...\", \"emotion\": \"{backend_emotion}\"}}"
    )

    comment = "What a game! Congratulations! 🏆"
    emotion = backend_emotion

    try:
        response = _gemini_client.models.generate_content(
            model=_gemini_model,
            contents=prompt,
            config=COACH_GEN_CONFIG,
        )

        # 1) Use SDK-parsed response
        parsed_obj = getattr(response, "parsed", None)
        if parsed_obj is not None and hasattr(parsed_obj, "comment"):
            comment = str(parsed_obj.comment)[:300]
        else:
            # 2) Fall back to text parsing
            raw = (getattr(response, "text", None) or "").strip()
            if not raw:
                raise ValueError("empty Gemini response")

            fenced = re.match(r"^```(?:json)?\s*\n?(.*?)\n?\s*```$", raw, re.DOTALL)
            if fenced:
                raw = fenced.group(1).strip()

            parsed = None
            try:
                parsed = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                pass

            if parsed is None:
                json_match = re.search(r'\{.*?\}', raw, re.DOTALL)
                if json_match:
                    try:
                        parsed = json.loads(json_match.group())
                    except (json.JSONDecodeError, TypeError):
                        pass

            if isinstance(parsed, dict) and "comment" in parsed:
                comment = str(parsed["comment"])[:300]
            else:
                logger.warning(
                    "Could not parse coach finale from Gemini output: %s",
                    raw[:200],
                )

        logger.info(
            "Coach finale generated: emotion=%s winner=%s comment=%s",
            backend_emotion,
            req.winner,
            comment,
        )

    except Exception as e:
        logger.error(
            "Coach finale generation failed for game=%s winner=%s: %s",
            req.game_id, req.winner, e,
        )
        # Fallback — game results must never break

    return {
        "comment": comment,
        "was_teased": was_teased,
        "was_favorite": was_favorite,
        "emotion": emotion,
    }


# ---------------------------------------------------------------------------
# Local dev entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))