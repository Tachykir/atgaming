// casino-aa.js — Arcane Academy

let aaTable = null, aaBet = 10, aaSpinning = false, aaAuto = false, aaAutoT = null;
let aaFreeSpins = 0, aaSyms = [], aaStatSpins = 0, aaStatPaid = 0, aaBestWin = 0, aaStatSpent = 0;
const AA_COLS = 5, AA_ROWS = 5;
const AA_ACCESS = '12345';

function initAAUI(table) {
  aaTable = table;
  aaBet = table.config.minBet || 10;
  aaFreeSpins = 0; aaSpinning = false; aaAuto = false;
  aaStatSpins = 0; aaStatPaid = 0; aaBestWin = 0; aaStatSpent = 0;
  const nameEl = document.getElementById('aa-name');
  if (nameEl) nameEl.textContent = table.name;
  aaUpdateBalance();
  aaBuildGrid();
  aaUpdateStats();
  aaSetMsg('Ustaw zakład i naciśnij Spin');
  const wl = document.getElementById('aa-win-log'); if (wl) wl.innerHTML = '';
  const ab = document.getElementById('aa-auto-btn');
  if (ab) { ab.classList.remove('on'); ab.textContent = 'Auto'; }
  aaRenderFSBar();
  if (casinoDiscordId) loadSlotStats('arcane_academy', 'aa');
}

function aaUpdateBalance() {
  const el = document.getElementById('aa-balance');
  if (el && casinoWallet) el.textContent = casinoWallet.balance.toLocaleString('pl-PL') + ' AT$';
}

function aaBuildGrid() {
  const grid = document.getElementById('aa-reels-grid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${AA_COLS}, 1fr)`;
  grid.style.gap = '4px';
  for (let c = 0; c < AA_COLS; c++) {
    const col = document.createElement('div');
    col.style.display = 'flex'; col.style.flexDirection = 'column'; col.style.gap = '4px';
    for (let r = 0; r < AA_ROWS; r++) {
      const cell = document.createElement('div');
      cell.className = 's5-cell'; cell.id = `aac${c}_${r}`;
      cell.style.height = '52px'; cell.style.fontSize = '22px'; cell.style.display = 'flex';
      cell.style.alignItems = 'center'; cell.style.justifyContent = 'center';
      cell.textContent = '🔮';
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

function aaRenderGrid(grid, syms, clusterCells) {
  if (syms && syms.length) aaSyms = syms;
  const highlight = new Set(clusterCells ? clusterCells.map(([c,r]) => `${c},${r}`) : []);
  for (let c = 0; c < AA_COLS; c++) for (let r = 0; r < AA_ROWS; r++) {
    const el = document.getElementById(`aac${c}_${r}`);
    if (!el) continue;
    const s = aaSyms[grid[c][r]];
    if (!s) continue;
    const inCluster = highlight.has(`${c},${r}`);
    el.className = 's5-cell' + (s.wild ? ' wild' : s.scatter ? ' scatter' : inCluster ? ' win' : '');
    el.innerHTML = s.e || '?';
    el.style.boxShadow = inCluster ? '0 0 10px rgba(168,85,247,.8)' : 'none';
    el.style.transform  = inCluster ? 'scale(1.08)' : '';
  }
}

function aaRenderFSBar() {
  const bar = document.getElementById('aa-fs-bar');
  if (!bar) return;
  bar.style.display = aaFreeSpins > 0 ? 'flex' : 'none';
  const cnt = document.getElementById('aa-fs-count');
  if (cnt) cnt.textContent = aaFreeSpins;
}

function aaUpdateStats() {
  const si = id => document.getElementById(id);
  if (si('aa-stat-spins'))  si('aa-stat-spins').textContent  = aaStatSpins.toLocaleString('pl-PL');
  if (si('aa-stat-paid'))   si('aa-stat-paid').textContent   = aaStatPaid.toLocaleString('pl-PL') + ' AT$';
  if (si('aa-stat-best'))   si('aa-stat-best').textContent   = aaBestWin > 0 ? aaBestWin.toLocaleString('pl-PL') + ' AT$' : '—';
  if (si('aa-stat-spent'))  si('aa-stat-spent').textContent  = aaStatSpent.toLocaleString('pl-PL') + ' AT$';
  updateProfitDisplay('aa-stat-profit', aaStatSpent, aaStatPaid);
}

function aaSetMsg(txt, cls) {
  const m = document.getElementById('aa-msg');
  if (m) { m.textContent = txt; m.className = 's5-msg' + (cls ? ' ' + cls : ''); }
}

function aaAddWinLog(payout, tier, extra) {
  const lg = document.getElementById('aa-win-log');
  if (!lg) return;
  const d = document.createElement('div');
  d.className = 's5-win-log-item ' + (tier || 'win');
  d.textContent = (extra ? extra + ' ' : '') + (payout > 0 ? '+' + payout.toLocaleString('pl-PL') + ' AT$' : '');
  lg.insertBefore(d, lg.firstChild);
  if (lg.children.length > 20) lg.removeChild(lg.lastChild);
}

function aaSpin() {
  if (aaSpinning) return;
  if (!casinoDiscordId) { showToast('Zaloguj się przez Discord!', 'error'); return; }
  if (!casinoTableId) return;
  const betEl = document.getElementById('aa-bet-input');
  if (betEl) aaBet = parseInt(betEl.value) || aaBet;
  aaSpinning = true;
  const btn = document.getElementById('aa-spin-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  for (let c = 0; c < AA_COLS; c++) for (let r = 0; r < AA_ROWS; r++) {
    const el = document.getElementById(`aac${c}_${r}`);
    if (el) { el.className = 's5-cell spinning'; el._int = setInterval(() => { el.textContent = ['🔮','💫','📚','⭐','🪄'][Math.floor(Math.random()*5)]; }, 80); }
  }
  setTimeout(() => {
    socket.emit('casinoAASpin', { tableId: casinoTableId, bet: aaBet, socketToken: casinoSocketToken, discordId: casinoDiscordId, password: AA_ACCESS });
  }, 200);
}

function aaToggleAuto() {
  aaAuto = !aaAuto;
  const b = document.getElementById('aa-auto-btn');
  if (b) { b.textContent = aaAuto ? '■ Stop' : 'Auto'; b.classList.toggle('on', aaAuto); }
  if (aaAuto && !aaSpinning) aaSpin();
}

socket.on('casinoAAResult', function(data) {
  for (let c = 0; c < AA_COLS; c++) for (let r = 0; r < AA_ROWS; r++) {
    const el = document.getElementById(`aac${c}_${r}`);
    if (el && el._int) { clearInterval(el._int); el._int = null; }
  }

  const { finalGrid, cascadeLog, totalPayout, cascadeCount, finalMultiplier, balance,
    totBet, isFree, freeSpinsAwarded, freeSpinsRemaining, scatterCount, tier, label, syms } = data;

  if (syms) aaSyms = syms;
  aaFreeSpins = freeSpinsRemaining || 0;

  // Animacja kaskad
  let delay = 0;
  if (cascadeLog && cascadeLog.length > 0) {
    cascadeLog.forEach((step, i) => {
      setTimeout(() => {
        const allCells = step.clusters.reduce((acc, cl) => acc.concat(cl.cells), []);
        aaRenderGrid(step.grid, syms, allCells);
        const multEl = document.getElementById('aa-cascade-mult');
        if (multEl) multEl.textContent = `x${step.mult} mnożnik`;
        aaSetMsg(`Kaskada ${i+1} — x${step.mult} — +${step.afterMult.toLocaleString('pl-PL')} AT$`);
      }, delay);
      delay += 600;
    });
  }

  setTimeout(() => {
    aaRenderGrid(finalGrid, syms, []);
    aaRenderFSBar();

    if (totalPayout > 0) {
      aaSetMsg(`🎉 ${label} — Łącznie: +${totalPayout.toLocaleString('pl-PL')} AT$`, 'big');
      aaAddWinLog(totalPayout, tier, cascadeCount > 1 ? `(${cascadeCount} kaskad x${finalMultiplier})` : '');
      s5Fireworks(tier);
      addRecentWin('aa-recent-list', totalPayout, tier);
    } else {
      aaSetMsg(isFree ? `Free Spin — zostało: ${aaFreeSpins}` : 'Postaw zakład i zakręć!');
    }
    if (freeSpinsAwarded > 0) aaSetMsg(`📚 ${freeSpinsAwarded} Free Spins!`, 'big');

    aaStatSpins++;
    aaStatPaid += totalPayout;
    if (totalPayout > aaBestWin) aaBestWin = totalPayout;
    aaStatSpent += isFree ? 0 : totBet;
    if (casinoWallet) casinoWallet.balance = balance;
    aaUpdateBalance();
    aaUpdateStats();

    const multEl = document.getElementById('aa-cascade-mult');
    if (multEl) multEl.textContent = '';

    aaSpinning = false;
    const btn = document.getElementById('aa-spin-btn');
    if (btn) { btn.disabled = false; btn.textContent = '🔮 SPIN'; }
    if (aaAuto) aaAutoT = setTimeout(aaSpin, 1200);
  }, delay + 200);
});
