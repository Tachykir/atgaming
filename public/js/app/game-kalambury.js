// ── KALAMBURY ─────────────────────────────────────────────────
let canvas, ctx, drawing = false, currentColor = '#000000', currentSize = 4, isDrawer = false;
const COLORS = ['#000000','#ffffff','#ff4757','#ffa502','#2ed573','#1e90ff','#a55eea','#ff6b9d','#eccc68','#747d8c'];

function initKalamburyCanvas() {
  canvas = document.getElementById('drawing-canvas');
  ctx = canvas.getContext('2d');

  // Set canvas resolution
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(600, rect.width - 20);
  canvas.height = Math.floor(canvas.width * 3/4);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Color palette
  document.getElementById('color-palette').innerHTML = COLORS.map(c =>
    `<div class="color-btn ${c===currentColor?'active':''}" style="background:${c}" onclick="setColor('${c}',this)"></div>`
  ).join('');

  // Size palette
  document.getElementById('size-palette').innerHTML = [2,5,10,20].map(s =>
    `<button class="size-btn ${s===currentSize?'active':''}" onclick="setSize(${s},this)">${s}px</button>`
  ).join('');

  // Mouse events
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);
  // Touch
  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(e.touches[0]); }, {passive:false});
  canvas.addEventListener('touchmove', e => { e.preventDefault(); draw(e.touches[0]); }, {passive:false});
  canvas.addEventListener('touchend', stopDraw);
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function startDraw(e) {
  if (!isDrawer) return;
  drawing = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!drawing || !isDrawer) return;
  const pos = getPos(e);
  ctx.lineWidth = currentSize;
  ctx.strokeStyle = currentColor;
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  socket.emit('kalamburyDraw', { roomId: S.roomId, drawData: { x: pos.x, y: pos.y, color: currentColor, size: currentSize, type: 'draw' } });
}

function stopDraw() {
  if (!drawing) return;
  drawing = false;
  ctx.beginPath();
  socket.emit('kalamburyDraw', { roomId: S.roomId, drawData: { type: 'end' } });
}

function setColor(c, el) {
  currentColor = c;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function setSize(s, el) {
  currentSize = s;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function clearCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  socket.emit('kalamburyClearCanvas', { roomId: S.roomId });
}

function submitKalamGuess() {
  const inp = document.getElementById('kalam-guess');
  if (!inp || !inp.value.trim()) return;
  socket.emit('kalamburyGuess', { roomId: S.roomId, guess: inp.value.trim() });
  inp.value = '';
}

let kalamDrawing = false;

socket.on('kalamburyRound', ({roundIndex, total, drawerId, drawerName, room}) => {
  S.room = room;
  isDrawer = drawerId === S.playerId;
  document.getElementById('kalam-round').textContent = roundIndex + 1;
  document.getElementById('kalam-total').textContent = total;
  document.getElementById('kalam-drawer-info').textContent = isDrawer ? '✏️ Ty rysujesz!' : `✏️ Rysuje: ${drawerName}`;
  document.getElementById('clear-canvas-btn').style.display = isDrawer ? 'inline-flex' : 'none';
  document.getElementById('kalam-guess-area').style.display = isDrawer ? 'none' : 'block';
  document.getElementById('kalam-word-box').style.display = 'none';
  document.getElementById('kalam-chat').innerHTML = '';
  // clear canvas
  if (ctx) { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); }
  renderLiveScores(room, 'kalam-scores');
  // Start timer
  let t = 60;
  clearInterval(kalamTimer);
  kalamTimer = setInterval(() => {
    t--;
    const el = document.getElementById('kalam-timer');
    if (el) el.textContent = t;
    if (el) el.style.color = t < 15 ? 'var(--error)' : t < 30 ? 'var(--warning)' : 'var(--text)';
    if (t <= 0) clearInterval(kalamTimer);
  }, 1000);
});

socket.on('kalamburyYourWord', ({word}) => {
  const box = document.getElementById('kalam-word-box');
  box.textContent = word.toUpperCase();
  box.style.display = 'block';
});

socket.on('kalamburyDrawUpdate', ({drawData}) => {
  if (!ctx) return;
  if (drawData.type === 'end') { ctx.beginPath(); return; }
  ctx.lineWidth = drawData.size || 4;
  ctx.strokeStyle = drawData.color || '#000';
  ctx.lineTo(drawData.x, drawData.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(drawData.x, drawData.y);
});

socket.on('kalamburyClearCanvas', () => {
  if (ctx) { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); }
});

socket.on('kalamburyGuessResult', ({playerName, guess, correct, playerId}) => {
  const chat = document.getElementById('kalam-chat');
  if (!chat) return;
  const div = document.createElement('div');
  div.className = `kalambury-guess-item ${correct?'correct':'wrong'}`;
  div.textContent = `${playerName}: ${guess}${correct?' ✅':''}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

socket.on('kalamburyCorrect', ({playerName, points, room}) => {
  S.room = room;
  renderLiveScores(room, 'kalam-scores');
});

socket.on('kalamburyReveal', ({word, room}) => {
  S.room = room;
  clearInterval(kalamTimer);
  document.getElementById('kalam-timer').textContent = '⏰';
  const box = document.getElementById('kalam-word-box');
  box.textContent = word.toUpperCase();
  box.style.display = 'block';
  box.style.background = 'var(--accent2)';
  renderLiveScores(room, 'kalam-scores');
});
