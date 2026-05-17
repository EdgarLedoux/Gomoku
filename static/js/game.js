// ── Constants ────────────────────────────────────────────────────────────────
const BOARD_SIZE = 15;
const COLS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];

let CELL, MARGIN, canvas, ctx;

let state = {
  board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)),
  myColor: null,
  currentTurn: null,
  winner: null,
  opponentJoined: false,
  lastUpdated: 0,
  playerNames: {},
};

let gameId       = null;
let playerId     = null;
let pollInterval = null;

// ── Entry point ───────────────────────────────────────────────────────────────
async function initGame(gid, pid) {
  gameId   = gid;
  playerId = pid;

  setupCanvas();
  window.addEventListener("resize", () => { setupCanvas(); drawBoard(); });

  await fetchState();
  renderSidebar();
  drawBoard();

  pollInterval = setInterval(poll, 2000);

  // Resign button
  const btn = document.getElementById("btn-resign");
  if (btn) btn.addEventListener("click", async () => {
    if (!confirm("Abandonner la partie ?")) return;
    await fetch("/resign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: gameId, player_id: playerId }),
    });
    await poll();
  });

  // Rematch button
  const rematchBtn = document.getElementById("btn-rematch");
  if (rematchBtn) rematchBtn.addEventListener("click", doRematch);
}

// ── Polling ───────────────────────────────────────────────────────────────────
async function poll() {
  try {
    const res  = await fetch(`/state/${gameId}?player_id=${playerId}`);
    const data = await res.json();

    if (data.last_updated !== state.lastUpdated) {
      const wasOpponentJoined = state.opponentJoined;
      applyState(data);
      drawBoard();
      renderSidebar();

      if (!wasOpponentJoined && state.opponentJoined) {
        setStatus("L'adversaire a rejoint !");
        setTimeout(() => setStatus(turnStatus()), 1500);
      }
      if (state.winner) {
        clearInterval(pollInterval);
        showEndOverlay(state.winner);
      }
    }
  } catch(e) {}
}

// ── Fetch state ───────────────────────────────────────────────────────────────
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
  state.lastUpdated    = data.last_updated;
  state.playerNames    = data.player_names || {};

  if (data.moves) {
    const list = document.getElementById("moves-list");
    list.innerHTML = "";
    data.moves.forEach((m, i) => addMoveToList(m, i + 1));
  }
}

// ── Canvas setup ──────────────────────────────────────────────────────────────
function setupCanvas() {
  canvas = document.getElementById("board-canvas");
  ctx    = canvas.getContext("2d");

  const area    = document.querySelector(".board-area");
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

// ── Drawing ───────────────────────────────────────────────────────────────────
let hoverCell = null;

function drawBoard() {
  if (!ctx) return;
  const size = canvas.width;

  ctx.fillStyle = "#c8854a";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(140,80,30,0.18)";
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.3) * 3);
    ctx.lineTo(size, y + Math.sin((y + 10) * 0.3) * 3);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(60,30,5,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = MARGIN + i * CELL, y = MARGIN + i * CELL;
    ctx.beginPath(); ctx.moveTo(x, MARGIN); ctx.lineTo(x, MARGIN + (BOARD_SIZE-1)*CELL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(MARGIN, y); ctx.lineTo(MARGIN + (BOARD_SIZE-1)*CELL, y); ctx.stroke();
  }

  ctx.fillStyle = "rgba(60,30,5,0.55)";
  ctx.font = `${Math.round(CELL*0.28)}px 'Space Mono', monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = 0; i < BOARD_SIZE; i++) {
    ctx.fillText(COLS[i], MARGIN + i*CELL, MARGIN - CELL*0.55);
    ctx.fillText(String(i+1).padStart(2,' '), MARGIN - CELL*0.6, MARGIN + i*CELL);
  }

  const stars = [3, 7, 11];
  for (const sr of stars) for (const sc of stars) {
    ctx.fillStyle = "rgba(60,30,5,0.6)";
    ctx.beginPath();
    ctx.arc(MARGIN + sc*CELL, MARGIN + sr*CELL, CELL*0.1, 0, Math.PI*2);
    ctx.fill();
  }

  if (hoverCell && isMyTurn() && !state.winner) {
    const { r, c } = hoverCell;
    if (state.board[r][c] === null) drawStone(r, c, state.myColor, 0.35);
  }

  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (state.board[r][c]) drawStone(r, c, state.board[r][c], 1);

  const moves = document.getElementById("moves-list").children;
  if (moves.length > 0) {
    const last = moves[moves.length - 1];
    const rc   = last.dataset;
    if (rc.row !== undefined) {
      ctx.strokeStyle = "rgba(192,57,43,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(MARGIN + Number(rc.col)*CELL, MARGIN + Number(rc.row)*CELL, CELL*0.19, 0, Math.PI*2);
      ctx.stroke();
    }
  }
}

function drawStone(row, col, color, alpha) {
  const x = MARGIN + col*CELL, y = MARGIN + row*CELL, r = CELL*0.44;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;

  const grad = ctx.createRadialGradient(x-r*0.3, y-r*0.3, r*0.05, x, y, r);
  if (color === "black") { grad.addColorStop(0,"#4a3820"); grad.addColorStop(1,"#0d0803"); }
  else                   { grad.addColorStop(0,"#ffffff"); grad.addColorStop(1,"#d0c8b0"); }
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();

  ctx.shadowColor = "transparent";
  const shine = ctx.createRadialGradient(x-r*0.35, y-r*0.35, 0, x-r*0.1, y-r*0.1, r*0.55);
  shine.addColorStop(0, color==="black" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
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

function onCanvasHover(e) { hoverCell = cellFromEvent(e); drawBoard(); }

async function onCanvasClick(e) {
  if (!isMyTurn() || state.winner) return;
  const cell = cellFromEvent(e);
  if (!cell) return;
  const { r, c } = cell;
  if (state.board[r][c] !== null) return;

  state.board[r][c] = state.myColor;
  drawBoard();

  const res  = await fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game_id: gameId, player_id: playerId, row: r, col: c }),
  });
  const data = await res.json();

  if (!res.ok) {
    state.board[r][c] = null;
    drawBoard();
    setStatus("⚠ " + (data.error || "Erreur"));
    return;
  }
  await poll();
}

// ── Rematch ───────────────────────────────────────────────────────────────────
let rematchPollInterval = null;

async function doRematch() {
  document.getElementById("btn-rematch").disabled = true;
  document.getElementById("rematch-status").classList.remove("hidden");

  const res  = await fetch("/rematch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game_id: gameId, player_id: playerId }),
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error); return; }

  const newGameId  = data.game_id;
  const newPlayerId = data.player_id;

  // Poll until opponent joins the new game
  rematchPollInterval = setInterval(async () => {
    const r2 = await fetch(`/state/${newGameId}?player_id=${newPlayerId}`);
    const st = await r2.json();
    if (st.opponent_joined) {
      clearInterval(rematchPollInterval);
      window.location.href = `/game/${newGameId}?player_id=${newPlayerId}`;
    }
  }, 2000);
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function isMyTurn() {
  return state.opponentJoined && state.currentTurn === state.myColor && !state.winner;
}

function turnStatus() {
  if (!state.opponentJoined) return "En attente de l'adversaire…";
  if (state.winner)          return "Partie terminée";
  if (isMyTurn())            return "🔴 À votre tour";
  return "⏳ Tour de l'adversaire";
}

function setStatus(msg) {
  document.getElementById("status-text").textContent = msg;
}

function renderSidebar() {
  const myStone  = document.getElementById("my-stone");
  const oppStone = document.getElementById("opp-stone");
  const myLabel  = document.getElementById("my-name-label");
  const oppLabel = document.getElementById("opp-name-label");

  // Find my player_id's username
  const myName  = state.playerNames[playerId] || (state.myColor === "black" ? "Noir" : "Blanc");
  let oppName   = "–";
  for (const [pid, name] of Object.entries(state.playerNames)) {
    if (pid !== playerId) { oppName = name; break; }
  }

  myLabel.textContent  = myName;
  oppLabel.textContent = oppName;

  if (state.myColor === "white") {
    myStone.classList.add("white-stone");
  } else {
    oppStone.classList.add("white-stone");
  }

  setStatus(turnStatus());
}

function addMoveToList(move, n) {
  const li = document.createElement("li");
  li.textContent = `${n}. ${move.color==="black"?"●":"○"} ${COLS[move.col]}${move.row+1}`;
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
    ? (winner === state.myColor ? "L'adversaire a abandonné !" : "Vous avez abandonné")
    : winnerLabel;
  overlay.classList.remove("hidden");
  setStatus("Partie terminée");
}
