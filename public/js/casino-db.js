// casino-db.js — Dual Blades

let dbTable = null, dbBet = 10, dbSpinning = false, dbAuto = false, dbAutoT = null;
let dbFreeSpins = 0, dbSyncMeter = 0, dbSyms = [], dbLines_def = [];
let dbStatSpins = 0, dbStatPaid = 0, dbBestWin = 0, dbStatSpent = 0;
const DB_COLS = 3, DB_ROWS = 3;
const DB_ACCESS = '12345';

function initDBUI(table) {
  dbTable = table;
  dbBet = table.config.minBet || 10;
  dbFreeSpins = 0; dbSyncMeter = 0; dbSpinning = false; dbAuto = false;
  dbStatSpins = 0; dbStatPaid = 0; dbBestWin = 0; dbStatSpent = 0;
  const nameEl = document.getElementById('db-name');
  if (nameEl) nameEl.textContent = table.name;
  dbUpdateBalance();
  dbBuildGrid('db-left-grid', 'dbl');
  dbBuildGrid('db-right-grid', 'dbr');
  dbUpdateStats();
  dbSetMsg('Ustaw zakład i naciśnij Spin');
  const wl = document.getElementById('db-win-log'); if (wl) wl.innerHTML = '';
  const ab = document.getElementById('db-auto-btn');
  if (ab) { ab.classList.remove('on'); ab.textContent = 'Auto'; }
  dbUpdateSyncMeter(0);
  dbRenderFSBar();
  if (casinoDiscordId) loadSlotStats('dual_blades', 'db');
}

function dbUpdateBalance() {
  const el = document.getElementById('db-balance');
  if (el && casinoWallet) el.textContent = casinoWallet.balance.toLocaleString('pl-PL') + ' AT$';
}

function dbBuildGrid(containerId, prefix) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${DB_COLS}, 1fr)`;
  grid.style.gap = '4px';
  for (let c = 0; c < DB_COLS; c++) {
    const col = document.createElement('div');
    col.style.display = 'flex'; col.style.flexDirection = 'column'; col.style.gap = '4px';
    for (let r = 0; r < DB_ROWS; r++) {
      const cell = document.createElement('div');
      cell.className = 's5-cell'; cell.id = `${prefix}c${c}_${r}`;
      cell.style.height = '60px'; cell.style.fontSize = '26px'; cell.style.display = 'flex';
      cell.style.alignItems = 'center'; cell.style.justifyContent = 'center';
      cell.textContent = '⚔️';
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

function dbRenderSingleGrid(grid, prefix, syms, wins, shadowCols) {
  const winCells = new Set();
  if (wins) wins.forEach(w => {
    const line = dbLines_def[w.line];
    if (line) for (let c = 0; c < DB_COLS; c++) winCells.add(`${c},${line[c]}`);
  });
  for (let c = 0; c < DB_COLS; c++) for (let r = 0; r < DB_ROWS; r++) {
    const el = document.getElementById(`${prefix}c${c}_${r}`);
    if (!el) continue;
    const s = syms[grid[c][r]];
    if (!s) continue;
    const inWin = winCells.has(`${c},${r}`);
    const isShadow = shadowCols && shadowCols.includes(c);
    el.className = 's5-cell' + (s.wild ? ' wild' : s.scatter ? ' scatter' : inWin ? ' win' : '');
    el.innerHTML = s.e || '?';
    el.style.boxShadow = isShadow ? '0 0 14px rgba(100,100,255,.9)' : inWin ? '0 0 8px rgba(255,200,0,.7)' : 'none';
  }
}

function dbUpdateSyncMeter(val) {
  const fill = document.getElementById('db-sync-fill');
  const pts  = document.getElementById('db-sync-pts');
  if (fill) fill.style.width = Math.min(100, (val / 5) * 100) + '%';
  if (pts) pts.textContent = `${val} / 5`;
}

function dbRenderFSBar() {
  const bar = document.getElementById('db-fs-bar');
  if (!bar) return;
  bar.style.display = dbFreeSpins > 0 ? 'flex' : 'none';
  const cnt = document.getElementById('db-fs-count');
  if (cnt) cnt.textContent = dbFreeSpins;
}

function dbUpdateStats() {
  const si = id => document.getElementById(id);
  if (si('db-stat-spins'))  si('db-stat-spins').textContent  = dbStatSpins.toLocaleString('pl-PL');
  if (si('db-stat-paid'))   si('db-stat-paid').textContent   = dbStatPaid.toLocaleString('pl-PL') + ' AT$';
  if (si('db-stat-best'))   si('db-stat-best').textContent   = dbBestWin > 0 ? dbBestWin.toLocaleString('pl-PL') + ' AT$' : '—';
  if (si('db-stat-spent'))  si('db-stat-spent').textContent  = dbStatSpent.toLocaleString('pl-PL') + ' AT$';
  updateProfitDisplay('db-stat-profit', dbStatSpent, dbStatPaid);
}

function dbSetMsg(txt, cls) {
  const m = document.getElementById('db-msg');
  if (m) { m.textContent = txt; m.className = 's5-msg' + (cls ? ' ' + cls : ''); }
}

function dbAddWinLog(payout, tier, extra) {
  const lg = document.getElementById('db-win-log');
  if (!lg) return;
  const d = document.createElement('div');
  d.className = 's5-win-log-item ' + (tier || 'win');
  d.textContent = (extra ? extra + ' ' : '') + (payout > 0 ? '+' + payout.toLocaleString('pl-PL') + ' AT$' : '');
  lg.insertBefore(d, lg.firstChild);
  if (lg.children.length > 20) lg.removeChild(lg.lastChild);
}

function dbSpin() {
  if (dbSpinning) return;
  if (!casinoDiscordId) { showToast('Zaloguj się przez Discord!', 'error'); return; }
  if (!casinoTableId) return;
  const betEl = document.getElementById('db-bet-input');
  if (betEl) dbBet = parseInt(betEl.value) || dbBet;
  dbSpinning = true;
  const btn = document.getElementById('db-spin-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  ['dbl', 'dbr'].forEach(prefix => {
    for (let c = 0; c < DB_COLS; c++) for (let r = 0; r < DB_ROWS; r++) {
      const el = document.getElementById(`${prefix}c${c}_${r}`);
      if (el) { el.className = 's5-cell spinning'; el._int = setInterval(() => { el.textContent = ['⚔️','🗡️','✴️','🎭','💨'][Math.floor(Math.random()*5)]; }, 80); }
    }
  });
  setTimeout(() => {
    socket.emit('casinoDBSpin', { tableId: casinoTableId, bet: dbBet, socketToken: casinoSocketToken, discordId: casinoDiscordId, password: DB_ACCESS });
  }, 200);
}

function dbToggleAuto() {
  dbAuto = !dbAuto;
  const b = document.getElementById('db-auto-btn');
  if (b) { b.textContent = dbAuto ? '■ Stop' : 'Auto'; b.classList.toggle('on', dbAuto); }
  if (dbAuto && !dbSpinning) dbSpin();
}

socket.on('casinoDBResult', function(data) {
  ['dbl', 'dbr'].forEach(prefix => {
    for (let c = 0; c < DB_COLS; c++) for (let r = 0; r < DB_ROWS; r++) {
      const el = document.getElementById(`${prefix}c${c}_${r}`);
      if (el && el._int) { clearInterval(el._int); el._int = null; }
    }
  });

  const { leftGrid, rightGrid, shadowCols, leftWins, rightWins, leftPay, rightPay,
    syncBonus, syncMult, syncMeter, syncFSAwarded, payout, balance, totBet, isFree,
    freeSpinsAwarded, freeSpinsRemaining, tier, label, syms, lines } = data;

  if (syms) dbSyms = syms;
  if (lines) dbLines_def = lines;
  dbFreeSpins = freeSpinsRemaining || 0;
  dbSyncMeter = syncMeter || 0;

  dbRenderSingleGrid(leftGrid, 'dbl', dbSyms, leftWins, shadowCols);
  dbRenderSingleGrid(rightGrid, 'dbr', dbSyms, rightWins, shadowCols);
  dbUpdateSyncMeter(dbSyncMeter);
  dbRenderFSBar();

  if (syncBonus) {
    dbSetMsg(`⚡ SYNC BONUS! x${syncMult} — +${payout.toLocaleString('pl-PL')} AT$`, 'big');
    const syncEl = document.getElementById('db-sync-flash');
    if (syncEl) { syncEl.classList.add('active'); setTimeout(() => syncEl.classList.remove('active'), 800); }
  } else if (payout > 0) {
    dbSetMsg(`+${payout.toLocaleString('pl-PL')} AT$`);
  } else {
    dbSetMsg(isFree ? `Free Spin — zostało: ${dbFreeSpins}` : 'Postaw zakład i zakręć!');
  }

  if (freeSpinsAwarded > 0 || syncFSAwarded > 0)
    dbSetMsg(`⚡ ${(freeSpinsAwarded || syncFSAwarded)} Free Spins!`, 'big');

  dbStatSpins++;
  dbStatPaid += payout;
  if (payout > dbBestWin) dbBestWin = payout;
  dbStatSpent += isFree ? 0 : totBet;
  if (casinoWallet) casinoWallet.balance = balance;
  dbUpdateBalance();
  dbUpdateStats();

  if (payout > 0) {
    dbAddWinLog(payout, tier, syncBonus ? '⚡ SYNC' : '');
    s5Fireworks(tier);
    addRecentWin('db-recent-list', payout, tier);
  }

  dbSpinning = false;
  const btn = document.getElementById('db-spin-btn');
  if (btn) { btn.disabled = false; btn.textContent = '⚔️ SPIN'; }
  if (dbAuto) dbAutoT = setTimeout(dbSpin, 1200);
});
