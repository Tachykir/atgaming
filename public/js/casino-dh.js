// casino-dh.js — Dragon Hoard

let dhTable = null, dhBet = 10, dhLines = 20, dhSpinning = false, dhAuto = false, dhAutoT = null;
let dhFreeSpins = 0, dhRespinMode = false, dhRespinsLeft = 0, dhLockedGems = [];
let dhSyms = [], dhLines_def = [], dhStatSpins = 0, dhStatPaid = 0, dhBestWin = 0, dhStatSpent = 0;
const DH_COLS = 4, DH_ROWS = 5;
const DH_ACCESS = '12345';

function initDHUI(table) {
  dhTable = table;
  dhBet = table.config.minBet || 10;
  dhLines = 20; dhFreeSpins = 0; dhRespinMode = false; dhRespinsLeft = 0; dhLockedGems = [];
  dhSpinning = false; dhAuto = false; dhStatSpins = 0; dhStatPaid = 0; dhBestWin = 0; dhStatSpent = 0;
  const nameEl = document.getElementById('dh-name');
  if (nameEl) nameEl.textContent = table.name;
  dhUpdateBalance();
  dhBuildGrid();
  dhUpdateStats();
  dhSetMsg('Ustaw zakład i naciśnij Spin');
  const wl = document.getElementById('dh-win-log'); if (wl) wl.innerHTML = '';
  const autoBtn = document.getElementById('dh-auto-btn');
  if (autoBtn) { autoBtn.classList.remove('on'); autoBtn.textContent = 'Auto'; }
  dhRenderRespinBar();
  dhRenderFSBar();
  if (casinoDiscordId) loadSlotStats('dragon_hoard', 'dh');
}

function dhUpdateBalance() {
  const el = document.getElementById('dh-balance');
  if (el && casinoWallet) el.textContent = casinoWallet.balance.toLocaleString('pl-PL') + ' AT$';
}

function dhBuildGrid() {
  const grid = document.getElementById('dh-reels-grid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${DH_COLS}, 1fr)`;
  grid.style.gap = '4px';
  for (let c = 0; c < DH_COLS; c++) {
    const col = document.createElement('div');
    col.style.display = 'flex'; col.style.flexDirection = 'column'; col.style.gap = '4px';
    for (let r = 0; r < DH_ROWS; r++) {
      const cell = document.createElement('div');
      cell.className = 's5-cell'; cell.id = `dhc${c}_${r}`;
      cell.style.height = '52px'; cell.style.fontSize = '24px'; cell.style.display = 'flex';
      cell.style.alignItems = 'center'; cell.style.justifyContent = 'center';
      cell.textContent = '🐉';
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

function dhRenderGrid(grid, syms, lockedGems, newGems) {
  if (syms && syms.length) dhSyms = syms;
  for (let c = 0; c < DH_COLS; c++) for (let r = 0; r < DH_ROWS; r++) {
    const el = document.getElementById(`dhc${c}_${r}`);
    if (!el) continue;
    const s = dhSyms[grid[c][r]];
    if (!s) continue;
    const isLocked = lockedGems && lockedGems.find(g => g.col === c && g.row === r);
    const isNew = newGems && newGems.find(g => g.col === c && g.row === r);
    el.className = 's5-cell' + (s.wild ? ' wild' : s.scatter ? ' scatter' : s.gem ? ' win' : '');
    if (isLocked) el.style.outline = '2px solid #ffd200';
    else el.style.outline = 'none';
    if (isNew) el.style.boxShadow = '0 0 12px rgba(255,200,0,.8)';
    else el.style.boxShadow = 'none';
    el.innerHTML = s.e || '?';
    if (s.gem) {
      const colors = { mini: '#94a3b8', minor: '#22c55e', major: '#3b82f6', grand: '#f59e0b' };
      el.style.background = colors[s.gemTier] || 'transparent';
      el.style.borderRadius = '8px';
    } else {
      el.style.background = 'transparent';
    }
  }
}

function dhRenderRespinBar() {
  const bar = document.getElementById('dh-respin-bar');
  if (!bar) return;
  if (dhRespinMode) {
    bar.style.display = 'flex';
    const cnt = document.getElementById('dh-respin-count');
    if (cnt) cnt.textContent = dhRespinsLeft;
  } else {
    bar.style.display = 'none';
  }
}

function dhRenderFSBar() {
  const bar = document.getElementById('dh-fs-bar');
  if (!bar) return;
  if (dhFreeSpins > 0) {
    bar.style.display = 'flex';
    const cnt = document.getElementById('dh-fs-count');
    if (cnt) cnt.textContent = dhFreeSpins;
  } else {
    bar.style.display = 'none';
  }
}

function dhUpdateStats() {
  const si = id => document.getElementById(id);
  if (si('dh-stat-spins'))  si('dh-stat-spins').textContent  = dhStatSpins.toLocaleString('pl-PL');
  if (si('dh-stat-paid'))   si('dh-stat-paid').textContent   = dhStatPaid.toLocaleString('pl-PL') + ' AT$';
  if (si('dh-stat-best'))   si('dh-stat-best').textContent   = dhBestWin > 0 ? dhBestWin.toLocaleString('pl-PL') + ' AT$' : '—';
  if (si('dh-stat-spent'))  si('dh-stat-spent').textContent  = dhStatSpent.toLocaleString('pl-PL') + ' AT$';
  updateProfitDisplay('dh-stat-profit', dhStatSpent, dhStatPaid);
}

function dhSetMsg(txt, cls) {
  const m = document.getElementById('dh-msg');
  if (m) { m.textContent = txt; m.className = 's5-msg' + (cls ? ' ' + cls : ''); }
}

function dhAddWinLog(payout, tier) {
  const lg = document.getElementById('dh-win-log');
  if (!lg) return;
  const d = document.createElement('div');
  d.className = 's5-win-log-item ' + (tier || 'win');
  d.textContent = payout > 0 ? '+' + payout.toLocaleString('pl-PL') + ' AT$' : '';
  lg.insertBefore(d, lg.firstChild);
  if (lg.children.length > 20) lg.removeChild(lg.lastChild);
}

function dhSpin() {
  if (dhSpinning) return;
  if (!casinoDiscordId) { showToast('Zaloguj się przez Discord!', 'error'); return; }
  if (!casinoTableId) return;
  const betEl = document.getElementById('dh-bet-input');
  if (betEl) dhBet = parseInt(betEl.value) || dhBet;
  dhSpinning = true;
  const btn = document.getElementById('dh-spin-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  // Animacja
  for (let c = 0; c < DH_COLS; c++) for (let r = 0; r < DH_ROWS; r++) {
    const el = document.getElementById(`dhc${c}_${r}`);
    const isLocked = dhLockedGems.find(g => g.col === c && g.row === r);
    if (el && !isLocked) {
      el.className = 's5-cell spinning';
      el._int = setInterval(() => { el.textContent = ['🐉','👑','⚔️','🛡️','💎'][Math.floor(Math.random()*5)]; }, 80);
    }
  }
  setTimeout(() => {
    socket.emit('casinoDHSpin', {
      tableId: casinoTableId, bet: dhBet, lines: dhLines,
      socketToken: casinoSocketToken, discordId: casinoDiscordId, password: DH_ACCESS,
    });
  }, 200);
}

function dhToggleAuto() {
  dhAuto = !dhAuto;
  const b = document.getElementById('dh-auto-btn');
  if (b) { b.textContent = dhAuto ? '■ Stop' : 'Auto'; b.classList.toggle('on', dhAuto); }
  if (dhAuto && !dhSpinning) dhSpin();
}

socket.on('casinoDHResult', function(data) {
  // Zatrzymaj animacje spinowania
  for (let c = 0; c < DH_COLS; c++) for (let r = 0; r < DH_ROWS; r++) {
    const el = document.getElementById(`dhc${c}_${r}`);
    if (el && el._int) { clearInterval(el._int); el._int = null; }
  }

  const { grid, winLines, payout, balance, totBet, isFree, freeSpinsAwarded, freeSpinsRemaining,
    isRespin, respinsLeft, respinTriggered, respinEnded, jackpotWins, lockedGems, newGems,
    scatterCount, tier, label, syms, lines, jackpots, activeLines } = data;

  if (syms) dhSyms = syms;
  if (lines) dhLines_def = lines;
  dhLockedGems = lockedGems || [];
  dhRespinMode = isRespin || false;
  dhRespinsLeft = respinsLeft || 0;
  dhFreeSpins = freeSpinsRemaining || 0;

  dhRenderGrid(grid, syms, lockedGems, newGems);
  dhRenderRespinBar();
  dhRenderFSBar();

  // Wygrane linie
  if (winLines && winLines.length > 0) {
    winLines.forEach(w => {
      const el = document.getElementById(`dhc${w.line}_${0}`);
      // podświetl komórki na linii
    });
  }

  // Jackpoty z Respin
  if (respinEnded && jackpotWins && jackpotWins.length > 0) {
    const jpLabels = { mini: 'Mini', minor: 'Minor', major: 'Major', grand: '🌟 GRAND' };
    jackpotWins.forEach(j => {
      dhAddWinLog(j.amount, j.tier === 'grand' ? 'frito' : j.tier === 'major' ? 'giga' : 'mega');
      dhSetMsg(`🐉 ${jpLabels[j.tier]} Jackpot! +${j.amount.toLocaleString('pl-PL')} AT$`, 'big');
    });
  }

  // Powiadomienia
  if (respinTriggered) dhSetMsg('🔒 Respin Mode! Gemy zablokowane!', 'big');
  if (freeSpinsAwarded > 0) dhSetMsg(`🔥 ${freeSpinsAwarded} Free Spins!`, 'big');
  if (isFree && dhFreeSpins > 0) dhSetMsg(`Free Spin — zostało: ${dhFreeSpins}`);

  if (payout > 0 && !respinEnded) dhSetMsg(`+${payout.toLocaleString('pl-PL')} AT$`);

  // Stats
  dhStatSpins++;
  dhStatPaid += payout;
  if (payout > dhBestWin) dhBestWin = payout;
  dhStatSpent += isFree ? 0 : totBet;
  if (casinoWallet) casinoWallet.balance = balance;
  dhUpdateBalance();
  dhUpdateStats();

  if (payout > 0) {
    dhAddWinLog(payout, tier);
    s5Fireworks(tier);
    addRecentWin('dh-recent-list', payout, tier);
  }

  dhSpinning = false;
  const btn = document.getElementById('dh-spin-btn');
  if (btn) { btn.disabled = false; btn.textContent = '🐉 SPIN'; }
  if (dhAuto) dhAutoT = setTimeout(dhSpin, dhRespinMode ? 500 : 1200);
});
