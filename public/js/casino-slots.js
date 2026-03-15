// casino-slots.js — Lucky Fruits

function initSlotsUI(table) {
  window._s5Table = table;
  document.getElementById('casino-slots-name').textContent = table.name;
  document.getElementById('casino-slots-balance').textContent = casinoWallet ? casinoWallet.balance.toLocaleString('pl-PL') + ' AT$' : '—';
  s5Bet = table.config.minBet || 10;
  s5Lines = 50; s5FreeSpins = 0; s5PitPts = 0;
  s5StatSpins = 0; s5StatPaid = 0; s5BestWin = 0; s5StatSpent = 0;
  s5Auto = false;
  document.getElementById('s5-auto-btn').classList.remove('on');
  document.getElementById('s5-auto-btn').textContent = 'Auto';
  s5BuildGrid();
  s5UpdateStats();
  s5SetMsg('Ustaw zakład i naciśnij Spin');
  document.getElementById('s5-win-log').innerHTML = '';
  document.getElementById('s5-pit-fill').style.width = '0%';
  document.getElementById('s5-pit-lvl').textContent = 'poziom 1';
  document.getElementById('s5-pit-pts').textContent = '0 / 100';
  document.getElementById('s5-fs-bar').classList.remove('show');
  document.getElementById('s5-mg').classList.remove('show');
  document.getElementById('s5-win-ov').classList.remove('show');
  s5ClearSVG();
  if (casinoDiscordId) loadSlotStats('slots', 's5');
}

function s5BuildGrid() {
  const grid = document.getElementById('s5-reels-grid');
  const svg  = document.getElementById('s5-svg-ov');
  // Usuń stare kolumny (zostaw svg)
  [...grid.children].forEach(ch => { if (ch !== svg) ch.remove(); });
  for (let c = 0; c < S5_COLS; c++) {
    const col = document.createElement('div'); col.className = 's5-reel';
    for (let r = 0; r < S5_ROWS; r++) {
      const cell = document.createElement('div');
      cell.className = 's5-cell'; cell.id = `s5c${c}_${r}`;
      cell.textContent = S5_SPIN_SYMS[Math.floor(Math.random() * S5_SPIN_SYMS.length)];
      col.appendChild(cell);
    }
    grid.insertBefore(col, svg);
  }
}

function s5RenderGrid(grid, syms) {
  for (let c = 0; c < S5_COLS; c++) for (let r = 0; r < S5_ROWS; r++) {
    const el = document.getElementById(`s5c${c}_${r}`);
    if (!el) continue;
    const s = syms[grid[c][r]];
    el.className = 's5-cell' + (s.wild ? ' wild' : s.scatter ? ' scatter' : '');
    el.innerHTML = s.e + (s.wild ? '<span class="s5-badge s5-wild-b">W</span>' : s.scatter ? '<span class="s5-badge s5-scat-b">S</span>' : '');
  }
}

function s5ClearOverlay() {
  for (let c = 0; c < S5_COLS; c++) for (let r = 0; r < S5_ROWS; r++) {
    const el = document.getElementById(`s5c${c}_${r}`);
    if (el) el.classList.remove('win', 'bigwin');
  }
  s5ClearSVG();
}

function s5ClearSVG() {
  document.getElementById('s5-svg-ov').querySelectorAll('polyline,circle').forEach(e => e.remove());
}

function s5DrawLines(lineIdxs, alpha, linesDef) {
  const svg = document.getElementById('s5-svg-ov');
  const gw  = document.getElementById('s5-reels-grid').clientWidth;
  const h   = S5_ROWS * 68 + (S5_ROWS - 1) * 4;
  svg.style.height = h + 'px';
  svg.setAttribute('viewBox', `0 0 ${gw} ${h}`);
  const colW = (gw - (S5_COLS - 1) * 5) / S5_COLS;
  lineIdxs.forEach(li => {
    if (!linesDef || li >= linesDef.length) return;
    const line = linesDef[li];
    const col  = S5_LINE_COLORS[li % S5_LINE_COLORS.length];
    const pts  = line.map((r, c) => `${c * (colW + 5) + colW / 2},${r * (68 + 4) + 34}`);
    const pl   = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', pts.join(' ')); pl.setAttribute('fill', 'none');
    pl.setAttribute('stroke', col); pl.setAttribute('stroke-width', '2');
    pl.setAttribute('stroke-opacity', alpha); pl.setAttribute('stroke-linecap', 'round');
    pl.setAttribute('stroke-linejoin', 'round'); svg.appendChild(pl);
    line.forEach((r, c) => {
      const ci = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ci.setAttribute('cx', c * (colW + 5) + colW / 2); ci.setAttribute('cy', r * (68 + 4) + 34);
      ci.setAttribute('r', '4'); ci.setAttribute('fill', col); ci.setAttribute('fill-opacity', alpha);
      svg.appendChild(ci);
    });
  });
}

function s5ShowWinScreen(payout, mult, label, tier, cb) {
  const ov = document.getElementById('s5-win-ov');
  ov.className = 's5-win-ov show s5-ov-' + tier;
  document.getElementById('s5-win-title').textContent = label;
  document.getElementById('s5-win-amt').textContent   = '+' + payout.toLocaleString('pl-PL') + ' AT$';
  document.getElementById('s5-win-mult').textContent  = mult.toFixed(1) + '× zakładu';
  s5WinCb = cb;
  clearTimeout(s5WinTimer);
  const delay = tier === 'frito' ? 7000 : tier === 'giga' ? 5500 : tier === 'huge' ? 4500 : 3500;
  s5WinTimer = setTimeout(s5DismissWin, delay);
}
function s5DismissWin() {
  clearTimeout(s5WinTimer);
  document.getElementById('s5-win-ov').classList.remove('show');
  if (s5WinCb) { s5WinCb(); s5WinCb = null; }
}

function s5SetMsg(txt, cls = '') {
  const m = document.getElementById('s5-msg');
  m.textContent = txt; m.className = 's5-msg' + (cls ? ' ' + cls : '');
}

function addRecentWin(listId, payout, tier) {
  var list = document.getElementById(listId); if (!list) return;
  if (payout <= 0) return;
  var item = document.createElement('span');
  item.className = 's5-recent-item ' + (tier || 'win');
  item.textContent = payout.toLocaleString('pl-PL') + ' AT$';
  if (list.querySelector('.s5-recent-item.none')) list.innerHTML = '';
  list.insertBefore(item, list.firstChild);
  while (list.children.length > 20) list.removeChild(list.lastChild);
}

function s5UpdateStats() {
  document.getElementById('casino-slots-balance').textContent = casinoWallet ? casinoWallet.balance.toLocaleString('pl-PL') + ' AT$' : '—';
  document.getElementById('s5-bet-val').textContent   = s5Bet;
  document.getElementById('s5-lines-val').textContent = s5Lines;
  document.getElementById('s5-tot-bet').textContent   = (s5Bet * s5Lines).toLocaleString('pl-PL');
  document.getElementById('s5-stat-spins').textContent = s5StatSpins.toLocaleString('pl-PL');
  document.getElementById('s5-stat-paid').textContent  = s5StatPaid.toLocaleString('pl-PL') + ' AT$';
  document.getElementById('s5-stat-best').textContent  = s5BestWin > 0 ? s5BestWin.toLocaleString('pl-PL') + ' AT$' : '—';
  const s5Spent = document.getElementById('s5-stat-spent');
  if (s5Spent) s5Spent.textContent = s5StatSpent.toLocaleString('pl-PL') + ' AT$';
  updateProfitDisplay('s5-stat-profit', s5StatSpent, s5StatPaid);
}

function s5UpdateFSBar() {
  const b = document.getElementById('s5-fs-bar');
  document.getElementById('s5-fs-count').textContent = s5FreeSpins;
  s5FreeSpins > 0 ? b.classList.add('show') : b.classList.remove('show');
}

function s5AddPit(n) {
  s5PitPts = Math.min(100, s5PitPts + n);
  document.getElementById('s5-pit-fill').style.width = (s5PitPts / 300 * 100) + '%';
  document.getElementById('s5-pit-lvl').textContent  = s5PitPts < 34 ? 'poziom 1' : s5PitPts < 67 ? 'poziom 2' : 'poziom 3!';
  document.getElementById('s5-pit-pts').textContent  = s5PitPts + ' / 100';
  if (s5PitPts >= 100) { s5PitPts = 0; document.getElementById('s5-pit-fill').style.width = '0%'; document.getElementById('s5-pit-lvl').textContent = 'poziom 1'; setTimeout(s5TriggerMG, 300); }
}

function s5TriggerMG() {
  const mg = document.getElementById('s5-mg'); mg.classList.add('show');
  let items = [...[50, 100, 200, 500, 1000, 50, 100].map(v => ({ t: 'ok', v })), { t: 'bad' }, { t: 'bad' }, { t: 'bad' }];
  items.sort(() => Math.random() - .5);
  let tries = 3, done = false;
  document.getElementById('s5-mg-desc').textContent = 'Masz 3 próby. Unikaj bomb.';
  const picks = document.getElementById('s5-mg-picks'); picks.innerHTML = '';
  items.forEach(item => {
    const b = document.createElement('button'); b.className = 's5-mp'; b.textContent = '📦';
    b.onclick = () => {
      if (done || b.disabled) return; b.disabled = true;
      if (item.t === 'bad') { b.className = 's5-mp bad'; b.textContent = '💣'; done = true; document.getElementById('s5-mg-desc').textContent = 'Bomba! Koniec.'; setTimeout(() => mg.classList.remove('show'), 2000); }
      else { b.className = 's5-mp ok'; b.textContent = '💰'; if (casinoWallet) casinoWallet.balance += item.v; tries--; s5UpdateStats(); document.getElementById('s5-mg-desc').textContent = `+${item.v} AT$! Pozostało: ${tries}`; if (tries <= 0) { done = true; setTimeout(() => mg.classList.remove('show'), 1500); } }
    };
    picks.appendChild(b);
  });
}

function s5AddWinLog(payout, mult, tier) {
  if (tier === 'win') return;
  const log = document.getElementById('s5-win-log');
  const b   = document.createElement('div'); b.className = 's5-log-tag ' + tier;
  b.textContent = getTierLabel(tier) + ' +' + payout.toLocaleString('pl-PL') + ' AT$ (' + mult.toFixed(1) + '×)';
  log.insertBefore(b, log.firstChild);
  while (log.children.length > 6) log.removeChild(log.lastChild);
}

function getTierLabel(tier) {
  const map = { win:'Win', big:'Big Win', mega:'Mega Win', huge:'Huge Win', giga:'Giga Win', frito:'Mega Giga Frito Win' };
  return map[tier] || tier;
}

function s5ChBet(d, mode) {
  if (!window._s5Table) return;
  const cfg = window._s5Table.config;
  if (mode === 'max') s5Bet = cfg.maxBet;
  else s5Bet = Math.max(cfg.minBet, Math.min(cfg.maxBet, s5Bet + d * cfg.minBet));
  s5UpdateStats();
}
function s5ChLines(d, mode) {
  if (mode === 'max') s5Lines = 50; else s5Lines = Math.max(10, Math.min(50, s5Lines + d));
  s5UpdateStats();
}
function s5Preset(mult) {
  if (!window._s5Table) return;
  s5Bet = window._s5Table.config.minBet * mult;
  s5UpdateStats();
}

let s5PvT = null, s5PvIdx = 0;
function s5PreviewLines() {
  clearTimeout(s5PvT); s5PvIdx = 0;
  if (!s5LinesDef.length) return;
  const count = Math.min(s5Lines, s5LinesDef.length);
  function next() {
    s5ClearSVG();
    if (s5PvIdx >= count) { s5DrawLines([...Array(count).keys()], 0.3, s5LinesDef); setTimeout(s5ClearSVG, 1200); return; }
    s5DrawLines([s5PvIdx], 1, s5LinesDef); s5PvIdx++; s5PvT = setTimeout(next, 70);
  }
  next();
}

function s5Spin() {
  if (s5Spinning || !casinoTableId || document.getElementById('s5-win-ov').classList.contains('show')) return;
  const totBet = s5Bet * s5Lines;
  const cost   = s5FreeSpins > 0 ? 0 : totBet;
  if (casinoWallet && casinoWallet.balance < cost && s5FreeSpins === 0) { s5SetMsg('Za mało AT$!'); return; }
  if (s5FreeSpins > 0) { s5FreeSpins--; s5UpdateFSBar(); }
  else if (casinoWallet) casinoWallet.balance -= cost;
  s5Spinning = true;
  s5ClearOverlay();
  document.getElementById('s5-win-log').innerHTML = '';
  const btn = document.getElementById('s5-spin-btn'); btn.disabled = true; btn.textContent = '⏳';

  // Animacja kręcenia
  for (let c = 0; c < S5_COLS; c++) for (let r = 0; r < S5_ROWS; r++) {
    const el = document.getElementById(`s5c${c}_${r}`); if (!el) continue;
    el.className = 's5-cell spinning'; el.innerHTML = '';
    el._spinInt = setInterval(() => { el.textContent = S5_SPIN_SYMS[Math.floor(Math.random() * S5_SPIN_SYMS.length)]; }, 80);
  }

  socket.emit('casinoSlotsSpin', { tableId: casinoTableId, bet: s5Bet, lines: s5Lines, socketToken: casinoSocketToken, discordId: casinoDiscordId });
}

socket.on('casinoSlotsResult', ({ grid, winLines, payout, net, balance, bet, activeLines, totBet, mult, tier, label, freeSpinsAwarded, syms, lines: linesDef }) => {
  s5Syms    = syms    || s5Syms;
  s5LinesDef = linesDef || s5LinesDef;

  // Zatrzymuj bębny kaskadowo
  const delays = [350, 600, 850, 1100, 1350];
  for (let c = 0; c < S5_COLS; c++) {
    setTimeout(() => {
      for (let r = 0; r < S5_ROWS; r++) {
        const el = document.getElementById(`s5c${c}_${r}`); if (!el) continue;
        if (el._spinInt) { clearInterval(el._spinInt); el._spinInt = null; }
        const s = s5Syms[grid[c][r]];
        el.className = 's5-cell' + (s.wild ? ' wild' : s.scatter ? ' scatter' : '') + ' landed';
        el.innerHTML = s.e + (s.wild ? '<span class="s5-badge s5-wild-b">W</span>' : s.scatter ? '<span class="s5-badge s5-scat-b">S</span>' : '');
      }

      if (c === S5_COLS - 1) {
        setTimeout(() => {
          s5Spinning = false;
          const btn = document.getElementById('s5-spin-btn'); btn.disabled = false; btn.textContent = '🎰 SPIN';
          if (casinoWallet) casinoWallet.balance = balance;
          s5StatSpins++; s5StatPaid += payout; if (payout > s5BestWin) s5BestWin = payout;
          if (payout > 0) addRecentWin('s5-recent-list', payout, tier);
          s5StatSpent += (s5FreeSpins > 0 ? 0 : totBet);

          if (freeSpinsAwarded > 0) { s5FreeSpins += freeSpinsAwarded; s5UpdateFSBar(); }

          if (payout > 0) {
            const isBig = mult >= 1.5;
            // Podświetl komórki
            winLines.forEach(w => { for (let c2 = 0; c2 < w.streak; c2++) { const el = document.getElementById(`s5c${c2}_${w.line[c2]}`); if (el) el.classList.add(isBig ? 'bigwin' : 'win'); } });
            if (winLines.length === 0) { s5LinesDef.length && s5LinesDef[0].forEach((r, c2) => { const el = document.getElementById(`s5c${c2}_${r}`); if (el) el.classList.add(isBig ? 'bigwin' : 'win'); }); }
            // SVG linie
            const winLineIdxs = winLines.map(w => w.li);
            if (winLineIdxs.length && s5LinesDef.length) s5DrawLines(winLineIdxs, 0.85, s5LinesDef);
            else if (s5LinesDef.length) s5DrawLines([0], 0.85, s5LinesDef);

            s5AddPit(tier === 'frito' ? 5 : tier === 'giga' ? 4 : tier === 'huge' ? 3 : tier === 'mega' ? 2 : 1);
            s5AddWinLog(payout, mult, tier);
            s5Fireworks(tier);
            s5UpdateStats();
            s5ShowWinScreen(payout, mult, label, tier, () => {
              s5SetMsg(label + '! +' + payout.toLocaleString('pl-PL') + ' AT$ (' + mult.toFixed(1) + '×)', isBig ? 'big' : 'win');
              s5UpdateStats();
            });
          } else {
            s5SetMsg(s5FreeSpins > 0 ? `Free Spin — ${s5FreeSpins} pozostało` : 'Bez wygranej');
            s5UpdateStats();
          }
        }, 200);
      }
    }, delays[c]);
  }
});

function s5ToggleAuto() {
  s5Auto = !s5Auto;
  const b = document.getElementById('s5-auto-btn');
  if (s5Auto) {
    b.textContent = 'Stop'; b.classList.add('on');
    const run = () => {
      if (!s5Auto || (casinoWallet && casinoWallet.balance < s5Bet * s5Lines && s5FreeSpins === 0)) { s5Auto = false; b.textContent = 'Auto'; b.classList.remove('on'); return; }
      if (s5Spinning || document.getElementById('s5-win-ov').classList.contains('show')) { s5AutoT = setTimeout(run, 300); return; }
      s5Spin(); s5AutoT = setTimeout(run, 1600);
    };
    setTimeout(run, 300);
  } else { clearTimeout(s5AutoT); b.textContent = 'Auto'; b.classList.remove('on'); }
}

// ── FAJERWERKI (skalowane do tieru wygranej) ──────────────────
