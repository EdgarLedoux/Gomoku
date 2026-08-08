// ── Constants (identiques à game.js pour un rendu cohérent) ───────────────────
const BOARD_SIZE = 19;
const COLS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S'];

let CELL, MARGIN, canvas, ctx;
let moves     = [];   // liste brute des coups {row, col, color, think_time}
let cursor    = 0;    // nombre de coups affichés (0 = plateau vide)
let gameId    = null;
let myColor   = null;

// ── Entry point ───────────────────────────────────────────────────────────────
async function initReplay(gid, color) {
  gameId  = gid;
  myColor = color;

  setupCanvas();
  window.addEventListener('resize', () => { setupCanvas(); render(); });

  const res  = await fetch(`/replay_data/${gameId}`);
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Erreur');
    window.location.href = '/profile';
    return;
  }
  moves  = data.moves || [];
  cursor = moves.length; // partir à la fin de la partie

  buildMovesList();
  setupControls();
  render();
}

// ── Canvas setup ──────────────────────────────────────────────────────────────
function setupCanvas() {
  canvas = document.getElementById('board-canvas');
  ctx    = canvas.getContext('2d');

  const area    = document.querySelector('.board-area');
  const maxSide = Math.min(area.clientWidth - 32, area.clientHeight - 32, 700);

  MARGIN = Math.round(maxSide * 0.045);
  CELL   = Math.round((maxSide - MARGIN * 2) / (BOARD_SIZE - 1));
  const size = MARGIN * 2 + CELL * (BOARD_SIZE - 1);

  canvas.width  = size;
  canvas.height = size;
}

// ── Board reconstruction ────────────────────────────────────────────────────
function boardAtCursor() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  for (let i = 0; i < cursor; i++) {
    const m = moves[i];
    board[m.row][m.col] = m.color;
  }
  return board;
}

// ── Drawing (repris de game.js) ─────────────────────────────────────────────
function drawBoard(board) {
  if (!ctx) return;
  const size = canvas.width;

  ctx.fillStyle = '#c8854a';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(140,80,30,0.18)';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.3) * 3);
    ctx.lineTo(size, y + Math.sin((y + 10) * 0.3) * 3);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(60,30,5,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = MARGIN + i * CELL, y = MARGIN + i * CELL;
    ctx.beginPath(); ctx.moveTo(x, MARGIN); ctx.lineTo(x, MARGIN + (BOARD_SIZE-1)*CELL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(MARGIN, y); ctx.lineTo(MARGIN + (BOARD_SIZE-1)*CELL, y); ctx.stroke();
  }

  ctx.fillStyle = 'rgba(60,30,5,0.55)';
  ctx.font = `${Math.round(CELL*0.28)}px 'Space Mono', monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < BOARD_SIZE; i++) {
    ctx.fillText(COLS[i], MARGIN + i*CELL, MARGIN - CELL*0.55);
    ctx.fillText(String(i+1).padStart(2,' '), MARGIN - CELL*0.6, MARGIN + i*CELL);
  }

  const stars = [3, 9, 15];
  for (const sr of stars) for (const sc of stars) {
    ctx.fillStyle = 'rgba(60,30,5,0.6)';
    ctx.beginPath();
    ctx.arc(MARGIN + sc*CELL, MARGIN + sr*CELL, CELL*0.1, 0, Math.PI*2);
    ctx.fill();
  }

  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c]) drawStone(r, c, board[r][c]);

  // Surligne le dernier coup affiché
  if (cursor > 0) {
    const last = moves[cursor - 1];
    ctx.strokeStyle = 'rgba(192,57,43,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(MARGIN + last.col*CELL, MARGIN + last.row*CELL, CELL*0.19, 0, Math.PI*2);
    ctx.stroke();
  }
}

function drawStone(row, col, color) {
  const x = MARGIN + col*CELL, y = MARGIN + row*CELL, r = CELL*0.44;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;

  const grad = ctx.createRadialGradient(x-r*0.3, y-r*0.3, r*0.05, x, y, r);
  if (color === 'black') { grad.addColorStop(0,'#4a3820'); grad.addColorStop(1,'#0d0803'); }
  else                   { grad.addColorStop(0,'#ffffff'); grad.addColorStop(1,'#d0c8b0'); }
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();

  ctx.shadowColor = 'transparent';
  const shine = ctx.createRadialGradient(x-r*0.35, y-r*0.35, 0, x-r*0.1, y-r*0.1, r*0.55);
  shine.addColorStop(0, color==='black' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// ── Moves list / sidebar ────────────────────────────────────────────────────
function buildMovesList() {
  const list = document.getElementById('moves-list');
  list.innerHTML = '';
  moves.forEach((m, i) => {
    const li = document.createElement('li');
    li.textContent = `${i+1}. ${m.color==='black'?'●':'○'} ${COLS[m.col]}${m.row+1}` +
      (m.think_time !== undefined ? `  (${m.think_time}s)` : '');
    li.dataset.index = i + 1;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => { cursor = i + 1; render(); });
    list.appendChild(li);
  });

  const slider = document.getElementById('move-slider');
  slider.max = moves.length;
  document.getElementById('move-total').textContent = moves.length;
}

function setupControls() {
  document.getElementById('btn-first').addEventListener('click', () => { cursor = 0; render(); });
  document.getElementById('btn-prev').addEventListener('click',  () => { cursor = Math.max(0, cursor - 1); render(); });
  document.getElementById('btn-next').addEventListener('click',  () => { cursor = Math.min(moves.length, cursor + 1); render(); });
  document.getElementById('btn-last').addEventListener('click',  () => { cursor = moves.length; render(); });
  document.getElementById('move-slider').addEventListener('input', (e) => {
    cursor = Number(e.target.value);
    render();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { cursor = Math.max(0, cursor - 1); render(); }
    if (e.key === 'ArrowRight') { cursor = Math.min(moves.length, cursor + 1); render(); }
  });
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  drawBoard(boardAtCursor());
  document.getElementById('move-counter').textContent = cursor;
  document.getElementById('move-slider').value = cursor;

  const list = document.getElementById('moves-list');
  [...list.children].forEach((li, i) => {
    li.classList.toggle('replay-move-current', i + 1 === cursor);
  });
  if (cursor > 0 && list.children[cursor - 1]) {
    list.children[cursor - 1].scrollIntoView({ block: 'nearest' });
  }

  document.getElementById('btn-first').disabled = cursor === 0;
  document.getElementById('btn-prev').disabled  = cursor === 0;
  document.getElementById('btn-next').disabled  = cursor === moves.length;
  document.getElementById('btn-last').disabled  = cursor === moves.length;
}