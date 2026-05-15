import json
import uuid
import time
import threading
from flask import Flask, render_template, request, session, jsonify, Response, redirect, url_for
import os
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.secret_key = "CHANGE_THIS_SECRET_KEY_IN_PRODUCTION"

# ── In-memory game state ─────────────────────────────────────────────────────
# In production you'd use a database; for 2 players this is fine.

games = {}          # game_id -> Game dict
lobbies = {}        # game_id -> [player1_id, player2_id]
sse_clients = {}    # game_id -> {player_id: queue}

BOARD_SIZE = 15
WIN_LENGTH = 5


def empty_board():
    return [[None] * BOARD_SIZE for _ in range(BOARD_SIZE)]


def make_game(game_id, player1_id):
    return {
        "id": game_id,
        "board": empty_board(),
        "players": {player1_id: "black"},   # first player = black
        "current_turn": "black",
        "winner": None,
        "moves": [],
        "created_at": time.time(),
    }


# ── Win detection ────────────────────────────────────────────────────────────

DIRECTIONS = [(1, 0), (0, 1), (1, 1), (1, -1)]


def check_win(board, row, col, color):
    for dr, dc in DIRECTIONS:
        count = 1
        for sign in (1, -1):
            r, c = row + dr * sign, col + dc * sign
            while 0 <= r < BOARD_SIZE and 0 <= c < BOARD_SIZE and board[r][c] == color:
                count += 1
                r += dr * sign
                c += dc * sign
        if count >= WIN_LENGTH:
            return True
    return False


# ── SSE helpers ──────────────────────────────────────────────────────────────

def get_client_queue(game_id, player_id):
    import queue
    if game_id not in sse_clients:
        sse_clients[game_id] = {}
    if player_id not in sse_clients[game_id]:
        sse_clients[game_id][player_id] = queue.Queue()
    return sse_clients[game_id][player_id]


def broadcast(game_id, event_type, data):
    """Send an SSE event to all connected players in a game."""
    if game_id not in sse_clients:
        return
    payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    dead = []
    for pid, q in sse_clients[game_id].items():
        try:
            q.put_nowait(payload)
        except Exception:
            dead.append(pid)
    for pid in dead:
        sse_clients[game_id].pop(pid, None)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/create", methods=["POST"])
def create_game():
    player_id = str(uuid.uuid4())
    game_id = str(uuid.uuid4())[:8].upper()   # short code to share
    session["player_id"] = player_id
    session["game_id"] = game_id

    games[game_id] = make_game(game_id, player_id)
    lobbies[game_id] = [player_id]
    return jsonify({"game_id": game_id, "player_id": player_id, "color": "black"})


@app.route("/join", methods=["POST"])
def join_game():
    data = request.get_json()
    game_id = data.get("game_id", "").strip().upper()

    if game_id not in games:
        return jsonify({"error": "Partie introuvable."}), 404

    game = games[game_id]
    if len(game["players"]) >= 2:
        return jsonify({"error": "Partie déjà complète."}), 400

    player_id = str(uuid.uuid4())
    session["player_id"] = player_id
    session["game_id"] = game_id

    game["players"][player_id] = "white"
    lobbies[game_id].append(player_id)

    # Notify player 1 that opponent joined
    broadcast(game_id, "player_joined", {"message": "Votre adversaire a rejoint la partie !"})

    return jsonify({"game_id": game_id, "player_id": player_id, "color": "white"})


@app.route("/game/<game_id>")
def game_page(game_id):
    if game_id not in games:
        return redirect(url_for("index"))
    return render_template("game.html", game_id=game_id)


@app.route("/state/<game_id>")
def get_state(game_id):
    """Return current game state (used on page load)."""
    player_id = request.args.get("player_id")
    if game_id not in games:
        return jsonify({"error": "Partie introuvable"}), 404
    game = games[game_id]
    my_color = game["players"].get(player_id)
    opponent_count = len(game["players"])
    return jsonify({
        "board": game["board"],
        "current_turn": game["current_turn"],
        "winner": game["winner"],
        "my_color": my_color,
        "opponent_joined": opponent_count >= 2,
        "moves": game["moves"],
    })


@app.route("/move", methods=["POST"])
def play_move():
    data = request.get_json()
    game_id = data.get("game_id")
    player_id = data.get("player_id")
    row = data.get("row")
    col = data.get("col")

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

    # Play the move
    game["board"][row][col] = my_color
    game["moves"].append({"row": row, "col": col, "color": my_color})

    winner = None
    if check_win(game["board"], row, col, my_color):
        game["winner"] = my_color
        winner = my_color
    else:
        game["current_turn"] = "white" if my_color == "black" else "black"

    broadcast(game_id, "move", {
        "row": row,
        "col": col,
        "color": my_color,
        "current_turn": game["current_turn"],
        "winner": winner,
    })

    return jsonify({"ok": True, "winner": winner})


@app.route("/stream/<game_id>")
def stream(game_id):
    """SSE endpoint — keeps connection open and pushes events."""
    player_id = request.args.get("player_id")
    if not player_id or game_id not in games:
        return Response("data: error\n\n", mimetype="text/event-stream")

    q = get_client_queue(game_id, player_id)

    def event_stream():
        # Send a heartbeat immediately so the connection is confirmed
        yield f"event: connected\ndata: {json.dumps({'ok': True})}\n\n"
        while True:
            try:
                msg = q.get(timeout=25)
                yield msg
            except Exception:
                # Heartbeat to keep connection alive
                yield ": heartbeat\n\n"

    return Response(event_stream(), mimetype="text/event-stream",
                    headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


@app.route("/resign", methods=["POST"])
def resign():
    data = request.get_json()
    game_id = data.get("game_id")
    player_id = data.get("player_id")
    if game_id not in games:
        return jsonify({"error": "Partie introuvable"}), 404
    game = games[game_id]
    my_color = game["players"].get(player_id)
    if not my_color:
        return jsonify({"error": "Joueur inconnu"}), 403
    winner = "white" if my_color == "black" else "black"
    game["winner"] = winner
    broadcast(game_id, "resign", {"winner": winner, "resigned": my_color})
    return jsonify({"ok": True})


if __name__ == '__main__':
    # Récupère le port donné par Alwaysdata (ou 5000 par défaut si tu testes sur ton PC)
    port = int(os.environ.get("PORT", 5000))
    
    # host="::" est obligatoire pour qu'Alwaysdata puisse connecter ton jeu à internet
    # (Si tu utilises Flask classique sans SocketIO, remplace socketio.run par app.run)
    socketio.run(app, host="::", port=port)