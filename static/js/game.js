// ── Constants ────────────────────────────────────────────────────────────────
const BOARD_SIZE  = 15;
const COLS        = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];

// Board visual config (recalculated on resize)
let CELL, MARGIN, canvas, ctx;

// Game state (local mirror of server state)
let state = {
  board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)),
  myColor: null,
  currentTurn: null,
  winner: null,
  opponentJoined: false,
};

let gameId   = null;
let playerId = null;
let es       = null;   // EventSource

// ── Entry point ──────────────────────────────────────────────────────────────
async function initGame(gid, pid) {
  gameId   = gid;
  playerId = pid;

  setupCanvas();
  window.addEventListener("resize", () => { setupCanvas(); drawBoard(); });

  await fetchState();
  connectSSE();
  renderSidebar();
  drawBoard();
}

// ── Canvas setup ─────────────────────────────────────────────────────────────
function setupCanvas() {
  canvas = document.getElementById("board-canvas");
  ctx    = canvas.getContext("2d");

  const area   = document.querySelector(".board-area");
  const maxSide = Math.min(area.clientWidth - 32, area.clientHeight - 32, 700);

  MARGIN = Math.round(maxSide * 0.045);
  CELL   = Math.round((maxSide - MARGIN * 2) / (BOARD_SIZE - 1));
  const size = MARGIN * 2 + CELL * (BOARD_SIZE - 1);

  canvas.width  = size;
  canvas.height = size;

  canvas.removeEventListener("click", onCanvasClick);
  canvas.addEventListener("click", onCanvasClick);
  canvas.removeEventListener("mousemove", onCanvasHover);
  canvas.addEventListener("mousemove", onCanvasHover);
}

// ── Fetch state from server ──────────────────────────────────────────────────
async function fetchState() {
  const res  = await fetch(`/state/${gameId}?player_id=${playerId}`);
  const data = await res.json();
  applyState(data);
}

function applyState(data) {
  state.board          = data.board;
  state.myColor        = data.my_color;
  state.currentTurn    = data.current_turn;
  state.winner         = data.winner;
  state.opponentJoined = data.opponent_joined;

  // Rebuild moves list from board (or use data.moves if available)
  if (data.moves) {
    const list = document.getElementById("moves-list");
    list.innerHTML = "";
    data.moves.forEach((m, i) => addMoveToList(m, i + 1));
  }
}

// ── SSE ──────────────────────────────────────────────────────────────────────
function connectSSE() {
  es = new EventSource(`/stream/${gameId}?player_id=${playerId}`);

  es.addEventListener("connected", () => {
    setStatus(state.opponentJoined ? "Partie en cours" : "En attente de l'adversaire…");
  });

  es.addEventListener("player_joined", () => {
    state.opponentJoined = true;
    setStatus("L'adversaire a rejoint !");
    renderSidebar();
    setTimeout(() => setStatus(turnStatus()), 1500);
  });

  es.addEventListener("move", e => {
    const d = JSON.parse(e.data);
    state.board[d.row][d.col] = d.color;
    state.currentTurn = d.current_turn;
    state.winner = d.winner;
    addMoveToList({ row: d.row, col: d.col, color: d.color },
                  document.getElementById("moves-list").children.length + 1);
    drawBoard();
    renderSidebar();
    if (d.winner) showEndOverlay(d.winner);
    hoverCell = null;
  });

  es.addEventListener("resign", e => {
    const d = JSON.parse(e.data);
    state.winner = d.winner;
    renderSidebar();
    showEndOverlay(d.winner, true);
  });

  es.onerror = () => {
    // Reconnect silently after 3s
    setTimeout(connectSSE, 3000);
  };
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
let hoverCell = null;

function drawBoard() {
  if (!ctx) return;
  const size = canvas.width;

  // Background – warm wood color
  ctx.fillStyle = "#c8854a";
  ctx.fillRect(0, 0, size, size);

  // Wood grain (subtle lines)
  ctx.strokeStyle = "rgba(140,80,30,0.18)";
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.3) * 3);
    ctx.lineTo(size, y + Math.sin((y + 10) * 0.3) * 3);
    ctx.stroke();
  }

  // Grid lines
  ctx.strokeStyle = "rgba(60,30,5,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = MARGIN + i * CELL;
    const y = MARGIN + i * CELL;
    ctx.beginPath(); ctx.moveTo(x, MARGIN); ctx.lineTo(x, MARGIN + (BOARD_SIZE - 1) * CELL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(MARGIN, y); ctx.lineTo(MARGIN + (BOARD_SIZE - 1) * CELL, y); ctx.stroke();
  }

  // Coordinate labels
  ctx.fillStyle = "rgba(60,30,5,0.55)";
  ctx.font = `${Math.round(CELL * 0.28)}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = MARGIN + i * CELL;
    const y = MARGIN + i * CELL;
    ctx.fillText(COLS[i], x, MARGIN - CELL * 0.55);
    ctx.fillText(String(i + 1).padStart(2, ' '), MARGIN - CELL * 0.6, y);
  }

  // Star points (traditional gomoku dots)
  const stars = [3, 7, 11];
  for (const sr of stars) {
    for (const sc of stars) {
      ctx.fillStyle = "rgba(60,30,5,0.6)";
      ctx.beginPath();
      ctx.arc(MARGIN + sc * CELL, MARGIN + sr * CELL, CELL * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Hover ghost
  if (hoverCell && isMyTurn() && !state.winner) {
    const { r, c } = hoverCell;
    if (state.board[r][c] === null) {
      drawStone(r, c, state.myColor, 0.35);
    }
  }

  // Stones
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c]) drawStone(r, c, state.board[r][c], 1);
    }
  }

  // Highlight last move
  const moves = document.getElementById("moves-list").children;
  if (moves.length > 0) {
    const last = moves[moves.length - 1];
    const rc = last.dataset;
    if (rc.row !== undefined) {
      const x = MARGIN + Number(rc.col) * CELL;
      const y = MARGIN + Number(rc.row) * CELL;
      ctx.strokeStyle = "rgba(192,57,43,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.19, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawStone(row, col, color, alpha) {
  const x = MARGIN + col * CELL;
  const y = MARGIN + row * CELL;
  const r = CELL * 0.44;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur  = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // Stone body
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x, y, r);
  if (color === "black") {
    grad.addColorStop(0, "#4a3820");
    grad.addColorStop(1, "#0d0803");
  } else {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#d0c8b0");
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Shine
  ctx.shadowColor = "transparent";
  const shine = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x - r * 0.1, y - r * 0.1, r * 0.55);
  shine.addColorStop(0, color === "black" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── Interaction ───────────────────────────────────────────────────────────────
function cellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const px   = (e.clientX - rect.left) * (canvas.width / rect.width);
  const py   = (e.clientY - rect.top)  * (canvas.height / rect.height);
  const c    = Math.round((px - MARGIN) / CELL);
  const r    = Math.round((py - MARGIN) / CELL);
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) return { r, c };
  return null;
}

function onCanvasHover(e) {
  hoverCell = cellFromEvent(e);
  drawBoard();
}

async function onCanvasClick(e) {
  if (!isMyTurn() || state.winner) return;
  const cell = cellFromEvent(e);
  if (!cell) return;
  const { r, c } = cell;
  if (state.board[r][c] !== null) return;

  // Optimistic update
  state.board[r][c] = state.myColor;
  drawBoard();

  const res  = await fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game_id: gameId, player_id: playerId, row: r, col: c }),
  });
  const data = await res.json();

  if (!res.ok) {
    // Revert optimistic update
    state.board[r][c] = null;
    drawBoard();
    setStatus("⚠ " + (data.error || "Erreur"));
    return;
  }

  if (data.winner) {
    state.winner = data.winner;
    showEndOverlay(data.winner);
  }
}

// ── Resign ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-resign");
  if (btn) btn.addEventListener("click", async () => {
    if (!confirm("Abandonner la partie ?")) return;
    await fetch("/resign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: gameId, player_id: playerId }),
    });
  });
});

// ── UI helpers ────────────────────────────────────────────────────────────────
function isMyTurn() {
  return state.opponentJoined && state.currentTurn === state.myColor && !state.winner;
}

function turnStatus() {
  if (!state.opponentJoined) return "En attente de l'adversaire…";
  if (state.winner) return `Partie terminée`;
  if (isMyTurn()) return "🔴 À votre tour";
  return "⏳ Tour de l'adversaire";
}

function setStatus(msg) {
  document.getElementById("status-text").textContent = msg;
}

function renderSidebar() {
  // My color
  const myStone = document.getElementById("my-stone");
  const oppStone = document.getElementById("opp-stone");
  const myLabel = document.getElementById("my-color-label");
  const oppLabel = document.getElementById("opp-color-label");

  if (state.myColor === "white") {
    myStone.classList.add("white-stone");
    myLabel.textContent = "Blanc";
    oppLabel.textContent = "Noir";
  } else {
    myLabel.textContent = "Noir";
    oppStone.classList.add("white-stone");
    oppLabel.textContent = "Blanc";
  }

  setStatus(turnStatus());
}

function addMoveToList(move, n) {
  const li = document.createElement("li");
  li.textContent = `${n}. ${move.color === "black" ? "●" : "○"} ${COLS[move.col]}${move.row + 1}`;
  li.dataset.row = move.row;
  li.dataset.col = move.col;
  const list = document.getElementById("moves-list");
  list.appendChild(li);
  list.scrollTop = list.scrollHeight;
}

function showEndOverlay(winner, resigned = false) {
  const overlay = document.getElementById("overlay");
  const title   = document.getElementById("overlay-title");

  const winnerLabel = winner === state.myColor ? "Vous avez gagné 🎉" : "Votre adversaire a gagné";
  title.textContent = resigned
    ? (winner === state.myColor ? "L'adversaire a abandonné — Vous gagnez !" : "Vous avez abandonné")
    : winnerLabel;

  overlay.classList.remove("hidden");
  setStatus("Partie terminée");
}
