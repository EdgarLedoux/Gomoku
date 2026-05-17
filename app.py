import json
import uuid
import time
import os
from flask import Flask, render_template, request, jsonify, Response, redirect, url_for

app = Flask(__name__)
app.secret_key = "CHANGE_THIS_SECRET_KEY_IN_PRODUCTION"

# ── In-memory game state ─────────────────────────────────────────────────────
games = {}      # game_id -> Game dict
lobbies = {}    # game_id -> [player1_id, player2_id]

BOARD_SIZE = 15
WIN_LENGTH = 5


def empty_board():
    return [[None] * BOARD_SIZE for _ in range(BOARD_SIZE)]


def make_game(game_id, player1_id):
    return {
        "id": game_id,
        "board": empty_board(),
        "players": {player1_id: "black"},
        "current_turn": "black",
        "winner": None,
        "moves": [],
        "created_at": time.time(),
        "last_updated": time.time(),   # ← utilisé par le polling
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


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/create", methods=["POST"])
def create_game():
    player_id = str(uuid.uuid4())
    game_id = str(uuid.uuid4())[:8].upper()

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
    game["players"][player_id] = "white"
    game["last_updated"] = time.time()
    lobbies[game_id].append(player_id)

    return jsonify({"game_id": game_id, "player_id": player_id, "color": "white"})


@app.route("/game/<game_id>")
def game_page(game_id):
    if game_id not in games:
        return redirect(url_for("index"))
    return render_template("game.html", game_id=game_id)


@app.route("/state/<game_id>")
def get_state(game_id):
    """Polling endpoint — appelé toutes les 2s par chaque joueur."""
    player_id = request.args.get("player_id")
    if game_id not in games:
        return jsonify({"error": "Partie introuvable"}), 404
    game = games[game_id]
    my_color = game["players"].get(player_id)
    return jsonify({
        "board": game["board"],
        "current_turn": game["current_turn"],
        "winner": game["winner"],
        "my_color": my_color,
        "opponent_joined": len(game["players"]) >= 2,
        "moves": game["moves"],
        "last_updated": game["last_updated"],
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

    game["board"][row][col] = my_color
    game["moves"].append({"row": row, "col": col, "color": my_color})
    game["last_updated"] = time.time()

    winner = None
    if check_win(game["board"], row, col, my_color):
        game["winner"] = my_color
        winner = my_color
    else:
        game["current_turn"] = "white" if my_color == "black" else "black"

    return jsonify({"ok": True, "winner": winner})


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
    game["last_updated"] = time.time()
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True)