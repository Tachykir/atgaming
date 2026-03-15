// casino-pachinko.js

function initPachinkoUI(table) {
  document.getElementById('casino-pachinko-balance').textContent = casinoWallet ? casinoWallet.balance.toLocaleString('pl-PL') + ' AT$' : '—';
  const chips = [table.config.minBet, table.config.minBet*5, table.config.minBet*20, 1000, 5000, 10000].filter(c=>c<=100000);
  renderChipBtns('pachinko-chip-btns', [...new Set(chips)], 'pachinko-bet-input');
  document.getElementById('pachinko-bet-input').value = table.config.minBet;
  document.getElementById('pachinko-result-msg').textContent = '';
  currentPachinkoRisk = 'low';
  document.querySelectorAll('.risk-btn').forEach(b => b.classList.toggle('active', b.dataset.risk === 'low'));
  buildPachinkoBoard();
  buildPachinkoSlots();
}

function buildPachinkoBoard() {
  const board = document.getElementById('pachinko-board');
  if (!board) return;
  // Usuń stare pegi (zachowaj kulki!)
  board.querySelectorAll('.pachinko-peg').forEach(p=>p.remove());
  const riskCfg = PACHINKO_RISK_DATA[currentPachinkoRisk];
  const rows = riskCfg.rows;
  const slots = riskCfg.slots;
  const cols = Math.ceil(slots.length / 2) + 2;
  const boardW = 360;
  const boardH = 400;
  for (let row=0; row<rows; row++) {
    const pegsInRow = row%2===0 ? cols : cols-1;
    const offset = row%2===0 ? 0 : (boardW/(cols-1))/2;
    for (let col=0; col<pegsInRow; col++) {
      const peg = document.createElement('div');
      peg.className = 'pachinko-peg';
      peg.style.left = (offset + col * boardW/(cols-1) - 5) + 'px';
      peg.style.top  = (20 + row * ((boardH-40)/rows) - 5) + 'px';
      board.appendChild(peg);
    }
  }
}

function buildPachinkoSlots() {
  const row = document.getElementById('pachinko-slots-row');
  if (!row) return;
  const slots = PACHINKO_RISK_DATA[currentPachinkoRisk].slots;
  const n = slots.length;
  row.innerHTML = slots.map((s, i) => {
    // Kolorowanie wg wartości: środek niski, boki wysokie
    let cls = '';
    const distFromEdge = Math.min(i, n-1-i);
    const pct = distFromEdge / Math.floor(n/2);
    if (s.mult >= 10) cls = 'big-win';
    else if (s.mult >= 2) cls = 'mid-win';
    else if (s.mult >= 1) cls = 'low-win';
    return `<div class="pachinko-slot ${cls}" id="pslot-${i}" title="${s.mult}×">${s.label}</div>`;
  }).join('');
}

async function casinoPachinkoDrop() {
  if (!casinoTableId) return;
  const bet = parseInt(document.getElementById('pachinko-bet-input').value) || 0;
  if (!bet) return showToast('Ustaw kwotę zakładu!','error');
  document.getElementById('pachinko-drop-btn').disabled = true;
  setTimeout(() => { document.getElementById('pachinko-drop-btn').disabled = false; }, 400);
  socket.emit('casinoPachinkoDrop', { tableId: casinoTableId, bet, risk: currentPachinkoRisk, discordId: casinoDiscordId, socketToken: casinoSocketToken });
}

socket.on('casinoPachinkoResult', ({ path, finalSlot, slot, bet, winAmount, net, balance, risk, slots: slotsFromServer, rows }) => {
  // Odblokuj przycisk
  const btn = document.getElementById('pachinko-drop-btn');
  if (btn) btn.disabled = false;

  const board = document.getElementById('pachinko-board');
  if (!board) return;

  // Użyj slotów z serwera jeśli dostarczone, inaczej lokalne
  const activeSlots = slotsFromServer || PACHINKO_RISK_DATA[risk || currentPachinkoRisk].slots;
  const activeRows = rows || PACHINKO_RISK_DATA[risk || currentPachinkoRisk].rows;

  // Stwórz nową kulkę (nie usuwamy poprzednich - będą się animować i same znikną)
  const ball = document.createElement('div');
  ball.className = 'pachinko-ball';
  board.appendChild(ball);

  const boardH = board.offsetHeight || 400;
  const boardW = board.offsetWidth || 360;
  const slotW  = boardW / activeSlots.length;
  const stepDelay = 180;

  ball.style.left = (boardW/2 - 9) + 'px';
  ball.style.top  = '-10px';

  function spawnTrail(x, y) {
    const t = document.createElement('div');
    t.className = 'pachinko-trail';
    t.style.left = (x+3) + 'px'; t.style.top = (y+3) + 'px';
    board.appendChild(t);
    setTimeout(() => t.remove(), 400);
  }

  function highlightPeg(x, y) {
    const pegs = board.querySelectorAll('.pachinko-peg');
    let best = null, bestDist = 999;
    pegs.forEach(peg => {
      const px = parseFloat(peg.style.left), py = parseFloat(peg.style.top);
      const dist = Math.abs(px-x) + Math.abs(py-y);
      if (dist < bestDist) { bestDist = dist; best = peg; }
    });
    if (best && bestDist < 40) {
      best.classList.add('hit');
      setTimeout(() => best.classList.remove('hit'), 300);
    }
  }

  let step = 0;
  function animateStep() {
    if (step >= path.length) {
      const finalX = finalSlot * slotW + slotW/2 - 9;
      const finalY = boardH - 22;
      spawnTrail(finalX, finalY);
      ball.style.transition = `left ${stepDelay*0.8}ms ease, top ${stepDelay*0.8}ms ease`;
      ball.style.left = finalX + 'px';
      ball.style.top  = finalY + 'px';
      ball.classList.add('bounce');

      setTimeout(() => {
        // Animacja znikania kulki
        ball.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        ball.style.opacity = '0';
        ball.style.transform = 'scale(0.2)';
        setTimeout(() => ball.remove(), 400);

        // Podświetl slot
        const slotEl = document.getElementById(`pslot-${finalSlot}`);
        if (slotEl) {
          slotEl.classList.add('active');
          setTimeout(() => slotEl.classList.remove('active'), 2000);
        }
        const msgEl = document.getElementById('pachinko-result-msg');
        if (winAmount > 0) {
          msgEl.innerHTML = `<span style="color:#ffd200" class="result-pop">🎉 ${slot.label} → +${winAmount.toLocaleString('pl-PL')} AT$!</span>`;
          spawnCoinFloat(winAmount);
        } else {
          msgEl.innerHTML = `<span style="color:var(--error)" class="result-pop">📉 ${slot.label} → ${winAmount.toLocaleString('pl-PL')} AT$</span>`;
        }
        document.getElementById('casino-pachinko-balance').textContent = balance.toLocaleString('pl-PL') + ' AT$';
        if (casinoWallet) casinoWallet.balance = balance;
      }, stepDelay + 200);
      return;
    }
    const p = path[step];
    const bx = p.pos * slotW + slotW/2 - 9;
    const by = 20 + step * ((boardH-40) / activeRows);
    spawnTrail(bx, by);
    highlightPeg(bx, by);
    ball.style.transition = `left ${stepDelay*0.9}ms cubic-bezier(.25,.46,.45,.94), top ${stepDelay*0.9}ms ease`;
    ball.style.left = bx + 'px';
    ball.style.top  = by + 'px';
    ball.classList.remove('bounce'); void ball.offsetWidth; ball.classList.add('bounce');
    step++;
    setTimeout(animateStep, stepDelay);
  }
  setTimeout(animateStep, 80);
});


// ── CRASH ──────────────────────────────────────────────────────
let crashMyBet = 0;
let crashPhase = 'betting';
let crashAnimFrame = null;
let crashPoints = [];
let crashCanvas = null;
let crashCtx = null;

