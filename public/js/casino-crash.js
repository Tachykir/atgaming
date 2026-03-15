// casino-crash.js

function initCrashUI(table) {
  document.getElementById('casino-crash-balance').textContent = casinoWallet ? casinoWallet.balance.toLocaleString('pl-PL') + ' AT$' : '—';
  const chips = [table.config.minBet, table.config.minBet*2, table.config.minBet*5, table.config.minBet*10];
  renderChipBtns('crash-chip-btns', [...new Set(chips)], 'crash-bet-input');
  document.getElementById('crash-bet-input').value = table.config.minBet;
  crashMyBet = 0;
  crashPoints = [];
  crashCanvas = document.getElementById('crash-canvas');
  crashCtx = crashCanvas ? crashCanvas.getContext('2d') : null;
  drawCrashGraph();
}

function drawCrashGraph() {
  if (!crashCtx) return;
  const W = 340, H = 220;
  crashCtx.clearRect(0,0,W,H);
  if (crashPoints.length < 2) return;
  const maxM = Math.max(...crashPoints, 2);
  crashCtx.strokeStyle = '#00c853';
  crashCtx.lineWidth = 2.5;
  crashCtx.shadowColor = '#00c853';
  crashCtx.shadowBlur = 8;
  crashCtx.beginPath();
  crashPoints.forEach((m, i) => {
    const x = (i / (crashPoints.length - 1)) * (W - 20) + 10;
    const y = H - 10 - ((m - 1) / (maxM - 1 || 1)) * (H - 30);
    i === 0 ? crashCtx.moveTo(x, y) : crashCtx.lineTo(x, y);
  });
  crashCtx.stroke();
  crashCtx.shadowBlur = 0;
}

socket.on('casinoCrashState', (state) => {
  if (state.tableId !== casinoTableId) return;
  crashPhase = state.phase;
  const multEl = document.getElementById('crash-multiplier');
  const phaseEl = document.getElementById('crash-phase-label');
  const betBtn = document.getElementById('crash-bet-btn');
  const cashBtn = document.getElementById('crash-cashout-btn');
  const resultEl = document.getElementById('crash-result-msg');

  if (state.phase === 'betting') {
    crashPoints = [];
    drawCrashGraph();
    if (multEl) { multEl.textContent = '1.00×'; multEl.style.color = '#00ff88'; }
    if (phaseEl) phaseEl.textContent = `⏳ Czas na zakłady: ${state.bettingTimeLeft}s`;
    if (betBtn) betBtn.style.display = '';
    if (cashBtn) cashBtn.style.display = 'none';
    if (resultEl) resultEl.textContent = '';
    crashMyBet = state.bets?.[casinoDiscordId]?.amount || 0;
    if (crashMyBet > 0 && betBtn) betBtn.disabled = true;
    else if (betBtn) betBtn.disabled = false;
  } else if (state.phase === 'running') {
    // Runda w toku — pokaż/ukryj cashout zależnie czy gracz postawił i nie wycofał
    const myBet = state.bets?.[casinoDiscordId];
    const canCashOut = myBet && !myBet.cashedOut;
    if (betBtn) { betBtn.style.display = canCashOut ? 'none' : ''; betBtn.disabled = true; }
    if (cashBtn) cashBtn.style.display = canCashOut ? '' : 'none';
    if (phaseEl) phaseEl.textContent = '🚀 Lot trwa…';
  } else if (state.phase === 'crashed') {
    if (multEl) { multEl.textContent = state.crashPoint.toFixed(2) + '×'; multEl.style.color = '#ff4444'; }
    if (phaseEl) phaseEl.textContent = '💥 CRASH!';
    if (betBtn) { betBtn.style.display = ''; betBtn.disabled = false; }
    if (cashBtn) cashBtn.style.display = 'none';
    const myBet = state.bets?.[casinoDiscordId];
    if (myBet && !myBet.cashedOut && resultEl) {
      resultEl.innerHTML = `<span style="color:var(--error)">💥 CRASH @ ${state.crashPoint.toFixed(2)}× — przegrałeś ${myBet.amount.toLocaleString('pl-PL')} AT$</span>`;
    }
    // Historia
    if (state.history?.length) {
      const hist = document.getElementById('crash-history');
      if (hist) hist.innerHTML = state.history.map(h => {
        const c = h.crashPoint < 1.5 ? '#ff4444' : h.crashPoint < 3 ? '#ffd200' : '#00c853';
        return `<span style="background:${c}22;border:1px solid ${c};color:${c};padding:2px 7px;border-radius:8px;font-size:12px;font-weight:700">${h.crashPoint.toFixed(2)}×</span>`;
      }).join('');
    }
  }

  // Aktualizuj graczy
  renderCrashPlayers(state.bets);
});

socket.on('casinoCrashTick', ({ tableId, multiplier }) => {
  if (tableId !== casinoTableId) return;
  crashPoints.push(multiplier);
  if (crashPoints.length > 100) crashPoints = crashPoints.slice(-100);
  drawCrashGraph();
  const el = document.getElementById('crash-multiplier');
  if (el) { el.textContent = multiplier.toFixed(2) + '×'; el.style.color = '#00ff88'; }
});

socket.on('casinoCrashCashedOut', ({ multiplier, winAmount, net, balance }) => {
  const resultEl = document.getElementById('crash-result-msg');
  if (resultEl) resultEl.innerHTML = `<span style="color:#00c853" class="result-pop">✅ Cash Out @ ${multiplier.toFixed(2)}× → +${winAmount.toLocaleString('pl-PL')} AT$</span>`;
  document.getElementById('casino-crash-balance').textContent = balance.toLocaleString('pl-PL') + ' AT$';
  if (casinoWallet) casinoWallet.balance = balance;
  const cashBtn = document.getElementById('crash-cashout-btn');
  if (cashBtn) cashBtn.style.display = 'none';
  spawnCoinFloat(winAmount);
});

function renderCrashPlayers(bets) {
  const el = document.getElementById('crash-players');
  if (!el || !bets) return;
  const entries = Object.values(bets);
  if (!entries.length) { el.innerHTML = ''; return; }
  el.innerHTML = entries.map(b => {
    let icon = b.cashedOut ? `✅ ${b.cashOutAt?.toFixed(2)}×` : '⏳';
    let color = b.cashedOut ? '#00c853' : 'var(--muted)';
    return `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:3px 8px;font-size:12px;color:${color}">
      ${escHtml(b.name)} — ${b.amount.toLocaleString('pl-PL')} AT$ ${icon}
    </span>`;
  }).join('');
}

function casinoCrashBet() {
  const bet = parseInt(document.getElementById('crash-bet-input').value) || 0;
  if (!bet) return showToast('Ustaw kwotę!', 'error');
  if (crashPhase !== 'betting') return showToast('Zakłady tylko przed rundą!', 'error');
  socket.emit('casinoCrashBet', { tableId: casinoTableId, bet, discordId: casinoDiscordId, socketToken: casinoSocketToken });
  document.getElementById('crash-bet-btn').disabled = true;
  document.getElementById('crash-cashout-btn').style.display = '';
}

function casinoCrashCashOut() {
  socket.emit('casinoCrashCashOut', { tableId: casinoTableId, discordId: casinoDiscordId, socketToken: casinoSocketToken });
}

// ── COINFLIP ──────────────────────────────────────────────────
let coinflipSide = 'heads';

