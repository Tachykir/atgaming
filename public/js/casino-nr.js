// casino-nr.js — Neon Racer

let nrTable = null, nrBet = 10, nrLines = 20, nrSpinning = false, nrAuto = false, nrAutoT = null;
let nrFreeSpins = 0, nrIsTurbo = false, nrTurboLeft = 0, nrSpeedMeter = 0;
let nrSyms = [], nrLines_def = [];
let nrStatSpins = 0, nrStatPaid = 0, nrBestWin = 0, nrStatSpent = 0;
const NR_COLS = 5, NR_ROWS = 3;
const NR_ACCESS = '12345';

function initNRUI(table) {
  nrTable = table;
  nrBet = table.config.minBet || 10;
  nrLines = 20; nrFreeSpins = 0; nrIsTurbo = false; nrTurboLeft = 0; nrSpeedMeter = 0;
  nrSpinning = false; nrAuto = false;
  nrStatSpins = 0; nrStatPaid = 0; nrBestWin = 0; nrStatSpent = 0;
  const nameEl = document.getElementById('nr-name');
  if (nameEl) nameEl.textContent = table.name;
  nrUpdateBalance();
  nrBuildGrid();
  nrUpdateStats();
  nrSetMsg('Ustaw zakład i naciśnij Spin');
  const wl = document.getElementById('nr-win-log'); if (wl) wl.innerHTML = '';
  const ab = document.getElementById('nr-auto-btn');
  if (ab) { ab.classList.remove('on'); ab.textContent = 'Auto'; }
  nrUpdateSpeedMeter(0);
  nrRenderFSBar();
  nrRenderTurboBar();
  if (casinoDiscordId) loadSlotStats('neon_racer', 'nr');
}

function nrUpdateBalance() {
  const el = document.getElementById('nr-balance');
  if (el && casinoWallet) el.textContent = casinoWallet.balance.toLocaleString('pl-PL') + ' AT$';
}

function nrBuildGrid() {
  const grid = document.getElementById('nr-reels-grid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${NR_COLS}, 1fr)`;
  grid.style.gap = '4px';
  for (let c = 0; c < NR_COLS; c++) {
    const col = document.createElement('div');
    col.style.display = 'flex'; col.style.flexDirection = 'column'; col.style.gap = '4px';
    for (let r = 0; r < NR_ROWS; r++) {
      const cell = document.createElement('div');
      cell.className = 's5-cell'; cell.id = `nrc${c}_${r}`;
      cell.style.height = '66px'; cell.style.fontSize = '26px'; cell.style.display = 'flex';
      cell.style.alignItems = 'center'; cell.style.justifyContent = 'center';
      cell.textContent = '🏎️';
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

function nrRenderGrid(grid, syms, winLines) {
  if (syms && syms.length) nrSyms = syms;
  const winCells = new Set();
  if (winLines) winLines.forEach(w => {
    const line = nrLines_def[w.line];
    if (line) for (let c = 0; c < NR_COLS; c++) winCells.add(`${c},${line[c]}`);
  });
  for (let c = 0; c < NR_COLS; c++) for (let r = 0; r < NR_ROWS; r++) {
    const el = document.getElementById(`nrc${c}_${r}`);
    if (!el) continue;
    const s = nrSyms[grid[c][r]];
    if (!s) continue;
    const inWin = winCells.has(`${c},${r}`);
    el.className = 's5-cell' + (s.wild ? ' wild' : s.scatter ? ' scatter' : inWin ? ' win' : '');
    el.innerHTML = s.e || '?';
    el.style.boxShadow = inWin ? '0 0 10px rgba(0,255,120,.7)' : 'none';
  }
}

function nrUpdateSpeedMeter(pct) {
  const fill = document.getElementById('nr-speed-fill');
  const pts  = document.getElementById('nr-speed-pts');
  if (fill) fill.style.width = Math.min(100, pct) + '%';
  if (pts)  pts.textContent  = Math.round(pct) + '%';
  // kolor zielony → żółty → czerwony
  const hue = Math.max(0, 120 - pct * 1.2);
  if (fill) fill.style.background = `hsl(${hue},100%,50%)`;
}

function nrRenderFSBar() {
  const bar = document.getElementById('nr-fs-bar');
  if (!bar) return;
  bar.style.display = nrFreeSpins > 0 ? 'flex' : 'none';
  const cnt = document.getElementById('nr-fs-count');
  if (cnt) cnt.textContent = nrFreeSpins;
}

function nrRenderTurboBar() {
  const bar = document.getElementById('nr-turbo-bar');
  if (!bar) return;
  bar.style.display = nrIsTurbo ? 'flex' : 'none';
  const cnt = document.getElementById('nr-turbo-count');
  if (cnt) cnt.textContent = nrTurboLeft;
}

function nrUpdateStats() {
  const si = id => document.getElementById(id);
  if (si('nr-stat-spins'))  si('nr-stat-spins').textContent  = nrStatSpins.toLocaleString('pl-PL');
  if (si('nr-stat-paid'))   si('nr-stat-paid').textContent   = nrStatPaid.toLocaleString('pl-PL') + ' AT$';
  if (si('nr-stat-best'))   si('nr-stat-best').textContent   = nrBestWin > 0 ? nrBestWin.toLocaleString('pl-PL') + ' AT$' : '—';
  if (si('nr-stat-spent'))  si('nr-stat-spent').textContent  = nrStatSpent.toLocaleString('pl-PL') + ' AT$';
  updateProfitDisplay('nr-stat-profit', nrStatSpent, nrStatPaid);
}

function nrSetMsg(txt, cls) {
  const m = document.getElementById('nr-msg');
  if (m) { m.textContent = txt; m.className = 's5-msg' + (cls ? ' ' + cls : ''); }
}

function nrAddWinLog(payout, tier, extra) {
  const lg = document.getElementById('nr-win-log');
  if (!lg) return;
  const d = document.createElement('div');
  d.className = 's5-win-log-item ' + (tier || 'win');
  d.textContent = (extra ? extra + ' ' : '') + (payout > 0 ? '+' + payout.toLocaleString('pl-PL') + ' AT$' : '');
  lg.insertBefore(d, lg.firstChild);
  if (lg.children.length > 20) lg.removeChild(lg.lastChild);
}

function nrSpin() {
  if (nrSpinning) return;
  if (!casinoDiscordId) { showToast('Zaloguj się przez Discord!', 'error'); return; }
  if (!casinoTableId) return;
  const betEl = document.getElementById('nr-bet-input');
  if (betEl) nrBet = parseInt(betEl.value) || nrBet;
  nrSpinning = true;
  const btn = document.getElementById('nr-spin-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  for (let c = 0; c < NR_COLS; c++) for (let r = 0; r < NR_ROWS; r++) {
    const el = document.getElementById(`nrc${c}_${r}`);
    if (el) { el.className = 's5-cell spinning'; el._int = setInterval(() => { el.textContent = ['🏎️','🏆','⛑️','🎡','⛽'][Math.floor(Math.random()*5)]; }, 80); }
  }
  setTimeout(() => {
    socket.emit('casinoNRSpin', { tableId: casinoTableId, bet: nrBet, lines: nrLines, socketToken: casinoSocketToken, discordId: casinoDiscordId, password: NR_ACCESS });
  }, 200);
}

function nrToggleAuto() {
  nrAuto = !nrAuto;
  const b = document.getElementById('nr-auto-btn');
  if (b) { b.textContent = nrAuto ? '■ Stop' : 'Auto'; b.classList.toggle('on', nrAuto); }
  if (nrAuto && !nrSpinning) nrSpin();
}

socket.on('casinoNRResult', function(data) {
  for (let c = 0; c < NR_COLS; c++) for (let r = 0; r < NR_ROWS; r++) {
    const el = document.getElementById(`nrc${c}_${r}`);
    if (el && el._int) { clearInterval(el._int); el._int = null; }
  }

  const { grid, winLines, rawPayout, payout, balance, totBet, isFree,
    freeSpinsAwarded, freeSpinsRemaining, isTurbo, turboSpinsLeft, turboTriggered,
    turboMult, speedMeter, tier, label, syms, lines, scatterCount, nitroSpeedBoost } = data;

  if (syms) nrSyms = syms;
  if (lines) nrLines_def = lines;
  nrFreeSpins = freeSpinsRemaining || 0;
  nrIsTurbo = isTurbo || false;
  nrTurboLeft = turboSpinsLeft || 0;
  nrSpeedMeter = speedMeter || 0;

  nrRenderGrid(grid, syms, winLines);
  nrUpdateSpeedMeter(nrSpeedMeter);
  nrRenderFSBar();
  nrRenderTurboBar();

  if (turboTriggered) nrSetMsg('🏁 TURBO MODE! x3 mnożnik!', 'big');
  else if (isTurbo && payout > 0) nrSetMsg(`🏎️ TURBO x3 — +${payout.toLocaleString('pl-PL')} AT$`, 'big');
  else if (payout > 0) nrSetMsg(`+${payout.toLocaleString('pl-PL')} AT$`);
  else nrSetMsg(isFree ? `Free Spin — zostało: ${nrFreeSpins}` : 'Postaw zakład i zakręć!');

  if (freeSpinsAwarded > 0) nrSetMsg(`💨 ${freeSpinsAwarded} Free Spins!`, 'big');
  if (nitroSpeedBoost > 0 && !turboTriggered) {
    const el = document.getElementById('nr-speed-pts');
    if (el) { const old = el.textContent; el.textContent = `+${nitroSpeedBoost}% 💨`; setTimeout(() => el.textContent = old, 1000); }
  }

  nrStatSpins++;
  nrStatPaid += payout;
  if (payout > nrBestWin) nrBestWin = payout;
  nrStatSpent += isFree ? 0 : totBet;
  if (casinoWallet) casinoWallet.balance = balance;
  nrUpdateBalance();
  nrUpdateStats();

  if (payout > 0) {
    nrAddWinLog(payout, tier, isTurbo ? '🏁 TURBO' : '');
    s5Fireworks(tier);
    addRecentWin('nr-recent-list', payout, tier);
  }

  nrSpinning = false;
  const btn = document.getElementById('nr-spin-btn');
  if (btn) { btn.disabled = false; btn.textContent = '🏎️ SPIN'; }
  if (nrAuto) nrAutoT = setTimeout(nrSpin, nrIsTurbo ? 700 : 1200);
});
