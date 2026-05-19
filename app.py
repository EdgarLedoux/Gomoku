import uuid
import time
import sqlite3
import json
import os
from datetime import timedelta
from flask import (Flask, render_template, request, jsonify,
                   redirect, url_for, session, g)
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "CHANGE_THIS_SECRET_KEY_IN_PRODUCTION"
app.permanent_session_lifetime = timedelta(days=30)

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "gomoku.db")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
    return g.db


@app.teardown_appcontext
def close_db(e=None):
    db = g.pop("db", None)
    if db:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id        TEXT PRIMARY KEY,
            username  TEXT UNIQUE NOT NULL,
            password  TEXT NOT NULL,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS friendships (
            id         TEXT PRIMARY KEY,
            from_id    TEXT NOT NULL,
            to_id      TEXT NOT NULL,
            status     TEXT NOT NULL DEFAULT 'pending',
            created_at REAL NOT NULL,
            UNIQUE(from_id, to_id)
        );
        CREATE TABLE IF NOT EXISTS game_history (
            id          TEXT PRIMARY KEY,
            player1_id  TEXT NOT NULL,
            player2_id  TEXT NOT NULL,
            winner_id   TEXT,
            moves_json  TEXT NOT NULL DEFAULT '[]',
            played_at   REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS invitations (
            id         TEXT PRIMARY KEY,
            from_id    TEXT NOT NULL,
            to_id      TEXT NOT NULL,
            game_id    TEXT NOT NULL,
            status     TEXT NOT NULL DEFAULT 'pending',
            created_at REAL NOT NULL
        );
    """)
    db.commit()
    db.close()


init_db()

# ── In-memory game state ──────────────────────────────────────────────────────
games = {}
BOARD_SIZE = 15
WIN_LENGTH  = 5
DIRECTIONS  = [(1,0),(0,1),(1,1),(1,-1)]


def empty_board():
    return [[None]*BOARD_SIZE for _ in range(BOARD_SIZE)]


def make_game(game_id, player1_id, player2_id=None):
    return {
        "id": game_id,
        "board": empty_board(),
        "players": {player1_id: "black"},
        "player_ids": [player1_id] + ([player2_id] if player2_id else []),
        "current_turn": "black",
        "winner": None,
        "moves": [],
        "created_at": time.time(),
        "last_updated": time.time(),
    }


def check_win(board, row, col, color):
    for dr, dc in DIRECTIONS:
        count = 1
        for sign in (1, -1):
            r, c = row + dr*sign, col + dc*sign
            while 0 <= r < BOARD_SIZE and 0 <= c < BOARD_SIZE and board[r][c] == color:
                count += 1
                r += dr*sign
                c += dc*sign
        if count >= WIN_LENGTH:
            return True
    return False


# ── Auth helpers ──────────────────────────────────────────────────────────────
def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return get_db().execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated


# ── Auth routes ───────────────────────────────────────────────────────────────
@app.route("/login", methods=["GET","POST"])
def login_page():
    if request.method == "GET":
        if session.get("user_id"):
            return redirect(url_for("index"))
        return render_template("login.html")

    data = request.get_json()
    action = data.get("action")  # "login" or "register"
    username = data.get("username","").strip()
    password = data.get("password","")

    if not username or not password:
        return jsonify({"error": "Champs requis."}), 400

    db = get_db()

    if action == "register":
        if len(username) < 3:
            return jsonify({"error": "Pseudo trop court (min 3 caractères)."}), 400
        if len(password) < 6:
            return jsonify({"error": "Mot de passe trop court (min 6 caractères)."}), 400
        existing = db.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
        if existing:
            return jsonify({"error": "Ce pseudo est déjà pris."}), 400
        uid = str(uuid.uuid4())
        db.execute("INSERT INTO users VALUES (?,?,?,?)",
                   (uid, username, generate_password_hash(password), time.time()))
        db.commit()
        session.permanent = True
        session["user_id"] = uid
        return jsonify({"ok": True, "username": username})

    elif action == "login":
        user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        if not user or not check_password_hash(user["password"], password):
            return jsonify({"error": "Identifiants incorrects."}), 401
        session.permanent = True
        session["user_id"] = user["id"]
        return jsonify({"ok": True, "username": user["username"]})

    return jsonify({"error": "Action invalide."}), 400


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


# ── Main pages ────────────────────────────────────────────────────────────────
@app.route("/")
@login_required
def index():
    user = current_user()
    return render_template("index.html", username=user["username"])


@app.route("/profile")
@login_required
def profile_page():
    user = current_user()
    db   = get_db()

    # Game history
    rows = db.execute("""
        SELECT gh.*, u1.username as p1_name, u2.username as p2_name,
               uw.username as winner_name
        FROM game_history gh
        JOIN users u1 ON gh.player1_id = u1.id
        JOIN users u2 ON gh.player2_id = u2.id
        LEFT JOIN users uw ON gh.winner_id = uw.id
        WHERE gh.player1_id=? OR gh.player2_id=?
        ORDER BY gh.played_at DESC LIMIT 20
    """, (user["id"], user["id"])).fetchall()
    history = [dict(r) for r in rows]

    # Friends
    friends = db.execute("""
        SELECT u.id, u.username, f.status, f.from_id, f.id as friendship_id
        FROM friendships f
        JOIN users u ON (
            CASE WHEN f.from_id=? THEN f.to_id ELSE f.from_id END = u.id
        )
        WHERE f.from_id=? OR f.to_id=?
    """, (user["id"], user["id"], user["id"])).fetchall()
    friends = [dict(f) for f in friends]

    # Pending requests received
    pending = db.execute("""
        SELECT f.id as friendship_id, u.username, f.from_id
        FROM friendships f
        JOIN users u ON f.from_id = u.id
        WHERE f.to_id=? AND f.status='pending'
    """, (user["id"],)).fetchall()
    pending = [dict(p) for p in pending]

    return render_template("profile.html",
                           user=dict(user),
                           history=history,
                           friends=friends,
                           pending=pending)


@app.route("/game/<game_id>")
@login_required
def game_page(game_id):
    if game_id not in games:
        return redirect(url_for("index"))
    return render_template("game.html", game_id=game_id)


# ── Friend routes ─────────────────────────────────────────────────────────────
@app.route("/friends/search")
@login_required
def friends_search():
    q    = request.args.get("q","").strip()
    user = current_user()
    if len(q) < 2:
        return jsonify([])
    db   = get_db()
    rows = db.execute(
        "SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10",
        (f"%{q}%", user["id"])
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/friends/add", methods=["POST"])
@login_required
def friends_add():
    data      = request.get_json()
    to_id     = data.get("user_id")
    user      = current_user()
    db        = get_db()

    if to_id == user["id"]:
        return jsonify({"error": "Vous ne pouvez pas vous ajouter vous-même."}), 400

    target = db.execute("SELECT id FROM users WHERE id=?", (to_id,)).fetchone()
    if not target:
        return jsonify({"error": "Utilisateur introuvable."}), 404

    existing = db.execute(
        "SELECT id FROM friendships WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)",
        (user["id"], to_id, to_id, user["id"])
    ).fetchone()
    if existing:
        return jsonify({"error": "Demande déjà envoyée ou déjà amis."}), 400

    fid = str(uuid.uuid4())
    db.execute("INSERT INTO friendships VALUES (?,?,?,?,?)",
               (fid, user["id"], to_id, "pending", time.time()))
    db.commit()
    return jsonify({"ok": True})


@app.route("/friends/accept", methods=["POST"])
@login_required
def friends_accept():
    data = request.get_json()
    fid  = data.get("friendship_id")
    user = current_user()
    db   = get_db()
    db.execute(
        "UPDATE friendships SET status='accepted' WHERE id=? AND to_id=?",
        (fid, user["id"])
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/friends/remove", methods=["POST"])
@login_required
def friends_remove():
    data = request.get_json()
    fid  = data.get("friendship_id")
    user = current_user()
    db   = get_db()
    db.execute(
        "DELETE FROM friendships WHERE id=? AND (from_id=? OR to_id=?)",
        (fid, user["id"], user["id"])
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/friends/list")
@login_required
def friends_list():
    user = current_user()
    db   = get_db()
    rows = db.execute("""
        SELECT u.id, u.username, f.status, f.id as friendship_id
        FROM friendships f
        JOIN users u ON (
            CASE WHEN f.from_id=? THEN f.to_id ELSE f.from_id END = u.id
        )
        WHERE (f.from_id=? OR f.to_id=?) AND f.status='accepted'
    """, (user["id"], user["id"], user["id"])).fetchall()
    return jsonify([dict(r) for r in rows])


# ── Invitation routes ─────────────────────────────────────────────────────────
@app.route("/invite", methods=["POST"])
@login_required
def invite_friend():
    data    = request.get_json()
    to_id   = data.get("user_id")
    user    = current_user()
    db      = get_db()

    # Create a game
    player_id = str(uuid.uuid4())
    game_id   = str(uuid.uuid4())[:8].upper()
    games[game_id] = make_game(game_id, player_id)
    games[game_id]["user_ids"] = {player_id: user["id"]}

    # Create invitation
    inv_id = str(uuid.uuid4())
    db.execute("INSERT INTO invitations VALUES (?,?,?,?,?,?)",
               (inv_id, user["id"], to_id, game_id, "pending", time.time()))
    db.commit()

    return jsonify({"ok": True, "game_id": game_id, "player_id": player_id})


@app.route("/invitations/pending")
@login_required
def invitations_pending():
    user = current_user()
    db   = get_db()
    rows = db.execute("""
        SELECT i.*, u.username as from_username
        FROM invitations i
        JOIN users u ON i.from_id = u.id
        WHERE i.to_id=? AND i.status='pending'
        ORDER BY i.created_at DESC
    """, (user["id"],)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/invitations/respond", methods=["POST"])
@login_required
def invitations_respond():
    data   = request.get_json()
    inv_id = data.get("invitation_id")
    accept = data.get("accept", False)
    user   = current_user()
    db     = get_db()

    inv = db.execute("SELECT * FROM invitations WHERE id=? AND to_id=?",
                     (inv_id, user["id"])).fetchone()
    if not inv:
        return jsonify({"error": "Invitation introuvable."}), 404

    if not accept:
        db.execute("UPDATE invitations SET status='refused' WHERE id=?", (inv_id,))
        db.commit()
        return jsonify({"ok": True})

    game_id = inv["game_id"]
    if game_id not in games:
        db.execute("UPDATE invitations SET status='expired' WHERE id=?", (inv_id,))
        db.commit()
        return jsonify({"error": "La partie n'existe plus."}), 404

    game      = games[game_id]
    player_id = str(uuid.uuid4())
    game["players"][player_id] = "white"
    game["last_updated"] = time.time()
    if "user_ids" not in game:
        game["user_ids"] = {}
    game["user_ids"][player_id] = user["id"]

    db.execute("UPDATE invitations SET status='accepted' WHERE id=?", (inv_id,))
    db.commit()

    return jsonify({"ok": True, "game_id": game_id, "player_id": player_id})


# ── Game routes ───────────────────────────────────────────────────────────────
@app.route("/create", methods=["POST"])
@login_required
def create_game():
    user      = current_user()
    player_id = str(uuid.uuid4())
    game_id   = str(uuid.uuid4())[:8].upper()
    games[game_id] = make_game(game_id, player_id)
    games[game_id]["user_ids"] = {player_id: user["id"]}
    return jsonify({"game_id": game_id, "player_id": player_id, "color": "black"})


@app.route("/join", methods=["POST"])
@login_required
def join_game():
    data    = request.get_json()
    game_id = data.get("game_id","").strip().upper()
    user    = current_user()

    if game_id not in games:
        return jsonify({"error": "Partie introuvable."}), 404

    game = games[game_id]

    # Si déconnection d'un joueur
    if "user_ids" in game:
        for pid, uid in game["user_ids"].items():
            if uid == user["id"]:
                color = game["players"].get(pid, "white")
                
                return jsonify({"game_id": game_id, 
                                "player_id": pid, 
                                "color": color,
                                "status": "reconnected"
                                })
            
    # Si la partie est complète sans le joueur
    if len(game["players"]) >= 2:
        return jsonify({"error": "Partie déjà complète."}), 400

    # Sinon, il n'y a qu'un joueur en attente de la partie -> on ajoute le joueur
    player_id = str(uuid.uuid4())
    game["players"][player_id] = "white"
    game["last_updated"] = time.time()
    if "user_ids" not in game:
        game["user_ids"] = {}
    game["user_ids"][player_id] = user["id"]

    return jsonify({"game_id": game_id, "player_id": player_id, "color": "white"})


@app.route("/state/<game_id>")
@login_required
def get_state(game_id):
    player_id = request.args.get("player_id")
    if game_id not in games:
        return jsonify({"error": "Partie introuvable"}), 404
    game     = games[game_id]
    my_color = game["players"].get(player_id)

    # Resolve usernames
    db       = get_db()
    uid_map  = game.get("user_ids", {})
    names    = {}
    for pid, uid in uid_map.items():
        row = db.execute("SELECT username FROM users WHERE id=?", (uid,)).fetchone()
        if row:
            names[pid] = row["username"]

    return jsonify({
        "board":            game["board"],
        "current_turn":     game["current_turn"],
        "winner":           game["winner"],
        "my_color":         my_color,
        "opponent_joined":  len(game["players"]) >= 2,
        "moves":            game["moves"],
        "last_updated":     game["last_updated"],
        "player_names":     names,
    })


@app.route("/move", methods=["POST"])
@login_required
def play_move():
    data      = request.get_json()
    game_id   = data.get("game_id")
    player_id = data.get("player_id")
    row       = data.get("row")
    col       = data.get("col")

    if game_id not in games:
        return jsonify({"error": "Partie introuvable"}), 404

    game = games[game_id]
    if game["winner"]:
        return jsonify({"error": "La partie est terminée"}), 400
    if player_id not in game["players"]:
        return jsonify({"error": "Vous n'êtes pas dans cette partie"}), 403

    my_color = game["players"][player_id]
    if game["current_turn"] != my_color:
        return jsonify({"error": "Ce n'est pas votre tour"}), 400
    if game["board"][row][col] is not None:
        return jsonify({"error": "Case déjà occupée"}), 400

    game["board"][row][col] = my_color
    game["moves"].append({"row": row, "col": col, "color": my_color})
    game["last_updated"] = time.time()

    winner = None
    if check_win(game["board"], row, col, my_color):
        game["winner"] = my_color
        winner = my_color
        _save_game(game)
    else:
        game["current_turn"] = "white" if my_color == "black" else "black"

    return jsonify({"ok": True, "winner": winner})


@app.route("/resign", methods=["POST"])
@login_required
def resign():
    data      = request.get_json()
    game_id   = data.get("game_id")
    player_id = data.get("player_id")

    if game_id not in games:
        return jsonify({"error": "Partie introuvable"}), 404

    game     = games[game_id]
    my_color = game["players"].get(player_id)
    if not my_color:
        return jsonify({"error": "Joueur inconnu"}), 403

    winner = "white" if my_color == "black" else "black"
    game["winner"] = winner
    game["last_updated"] = time.time()
    _save_game(game)
    return jsonify({"ok": True})


@app.route("/rematch", methods=["POST"])
@login_required
def rematch():
    data      = request.get_json()
    game_id   = data.get("game_id")
    player_id = data.get("player_id")

    if game_id not in games:
        return jsonify({"error": "Partie introuvable"}), 404

    old_game = games[game_id]
    if player_id not in old_game["players"]:
        return jsonify({"error": "Joueur inconnu"}), 403

    # Check if rematch already exists
    rematch_id = old_game.get("rematch_id")
    if rematch_id and rematch_id in games:
        new_game  = games[rematch_id]
        old_color = old_game["players"][player_id]
        # Find player_id in new game that corresponds to this user
        uid_map   = old_game.get("user_ids", {})
        my_uid    = uid_map.get(player_id)
        new_uid_map = new_game.get("user_ids", {})
        for new_pid, uid in new_uid_map.items():
            if uid == my_uid:
                return jsonify({"ok": True, "game_id": rematch_id, "player_id": new_pid})
        # Not yet joined — join
        new_pid   = str(uuid.uuid4())
        new_color = "white" if old_color == "black" else "black"
        new_game["players"][new_pid] = new_color
        new_game["last_updated"] = time.time()
        if my_uid:
            new_game["user_ids"][new_pid] = my_uid
        return jsonify({"ok": True, "game_id": rematch_id, "player_id": new_pid})

    # Create new game — invert colors
    old_color   = old_game["players"][player_id]
    new_color   = "white" if old_color == "black" else "black"
    new_game_id = str(uuid.uuid4())[:8].upper()
    new_pid     = str(uuid.uuid4())
    new_game    = make_game(new_game_id, new_pid)
    new_game["players"][new_pid] = new_color
    # If new_color is white, black hasn't joined yet — fix current_turn
    if new_color == "white":
        # player chose white — they are not black, so board starts waiting for black
        pass

    uid_map = old_game.get("user_ids", {})
    my_uid  = uid_map.get(player_id)
    new_game["user_ids"] = {new_pid: my_uid} if my_uid else {}

    games[new_game_id] = new_game
    old_game["rematch_id"] = new_game_id

    return jsonify({"ok": True, "game_id": new_game_id, "player_id": new_pid})


# ── Helpers ───────────────────────────────────────────────────────────────────
def _save_game(game):
    """Persist finished game to SQLite."""
    uid_map = game.get("user_ids", {})
    pids    = list(game["players"].keys())
    if len(pids) < 2:
        return
    p1_uid = uid_map.get(pids[0])
    p2_uid = uid_map.get(pids[1])
    if not p1_uid or not p2_uid:
        return

    winner_uid = None
    if game["winner"]:
        for pid, color in game["players"].items():
            if color == game["winner"]:
                winner_uid = uid_map.get(pid)
                break

    db = get_db()
    existing = db.execute("SELECT id FROM game_history WHERE id=?", (game["id"],)).fetchone()
    if not existing:
        db.execute("INSERT INTO game_history VALUES (?,?,?,?,?,?)",
                   (game["id"], p1_uid, p2_uid, winner_uid,
                    json.dumps(game["moves"]), time.time()))
        db.commit()


# ── Me route (for JS) ─────────────────────────────────────────────────────────
@app.route("/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"logged_in": False})
    return jsonify({"logged_in": True, "user_id": user["id"], "username": user["username"]})


# ── Jinja2 filters ────────────────────────────────────────────────────────────
import datetime

@app.template_filter("format_date")
def format_date(ts):
    return datetime.datetime.fromtimestamp(ts).strftime("%d/%m/%Y")

@app.template_filter("count_moves")
def count_moves(moves_json):
    try:
        return len(json.loads(moves_json))
    except Exception:
        return 0


if __name__ == "__main__":
    app.run(debug=True)
