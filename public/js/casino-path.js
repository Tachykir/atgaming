// casino-path.js — Path of Gambling

function initPathUI(table) {
  pgTable = table;
  document.getElementById('casino-path-name').textContent = table.name;
  document.getElementById('casino-path-balance').textContent = casinoWallet ? casinoWallet.balance.toLocaleString('pl-PL') + ' AT$' : '\u2014';
  pgBet = table.config.minBet || 10;
  pgLines = 50; pgFreeSpins = 0; pgPitMeter = 0; pgFreeMode = null; pgStickyLocks = [];
  pgStickyValdos = [];
  pgStatSpins = 0; pgStatPaid = 0; pgBestWin = 0; pgStatSpent = 0;
  pgAuto = false;
  const autoBtn = document.getElementById('pg-auto-btn');
  if (autoBtn) { autoBtn.classList.remove('on'); autoBtn.textContent = 'Auto'; }
  pgBuildGrid();
  pgUpdateStats();
  pgSetMsg('Ustaw zak\u0142ad i naci\u015bnij Spin');
  const logEl = document.getElementById('pg-win-log');
  if (logEl) logEl.innerHTML = '';
  pgUpdatePit(0);
  const fsBar = document.getElementById('pg-fs-bar');
  if (fsBar) fsBar.classList.remove('show');
  const winOv = document.getElementById('pg-win-ov');
  if (winOv) winOv.classList.remove('show');
  pgClearSVG();
  if (casinoDiscordId) loadSlotStats('path_of_gambling', 'pg');
}

function pgBuildGrid() {
  const grid = document.getElementById('pg-reels-grid');
  const svg  = document.getElementById('pg-svg-ov');
  [...grid.children].forEach(function(ch){ if (ch !== svg) ch.remove(); });
  for (let c = 0; c < PG_COLS; c++) {
    const col = document.createElement('div');
    col.className = 's5-reel';
    for (let r = 0; r < PG_ROWS; r++) {
      const cell = document.createElement('div');
      cell.className = 's5-cell pg-cell'; cell.id = 'pgc' + c + '_' + r;
      cell.style.height = '58px'; cell.style.fontSize = '22px';
      cell.textContent = '?';
      col.appendChild(cell);
    }
    grid.insertBefore(col, svg);
  }
}

function pgClearOverlay() {
  for (let c = 0; c < PG_COLS; c++) for (let r = 0; r < PG_ROWS; r++) {
    const el = document.getElementById('pgc' + c + '_' + r);
    if (el) el.classList.remove('win', 'bigwin');
  }
  pgClearSVG();
}

function pgClearSVG() {
  const svg = document.getElementById('pg-svg-ov');
  if (svg) svg.querySelectorAll('polyline,circle').forEach(function(e){ e.remove(); });
}

function pgDrawLines(lineIdxs, alpha) {
  const svg = document.getElementById('pg-svg-ov');
  if (!svg || !pgLinesDef.length) return;
  const gw  = document.getElementById('pg-reels-grid').clientWidth;
  const cellH = 58, cellGap = 4;
  const h = PG_ROWS * cellH + (PG_ROWS - 1) * cellGap;
  svg.style.height = h + 'px';
  svg.setAttribute('viewBox', '0 0 ' + gw + ' ' + h);
  const colW = (gw - (PG_COLS - 1) * 5) / PG_COLS;
  lineIdxs.forEach(function(li) {
    if (li >= pgLinesDef.length) return;
    const line = pgLinesDef[li];
    const col  = PG_LINE_COLORS[li % PG_LINE_COLORS.length];
    const pts  = line.map(function(r, c){ return (c * (colW + 5) + colW / 2) + ',' + (r * (cellH + cellGap) + cellH / 2); });
    const pl   = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', pts.join(' ')); pl.setAttribute('fill', 'none');
    pl.setAttribute('stroke', col); pl.setAttribute('stroke-width', '2');
    pl.setAttribute('stroke-opacity', alpha); pl.setAttribute('stroke-linecap', 'round');
    pl.setAttribute('stroke-linejoin', 'round'); svg.appendChild(pl);
    line.forEach(function(r, c) {
      const ci = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ci.setAttribute('cx', c * (colW + 5) + colW / 2); ci.setAttribute('cy', r * (cellH + cellGap) + cellH / 2);
      ci.setAttribute('r', '4'); ci.setAttribute('fill', col); ci.setAttribute('fill-opacity', alpha);
      svg.appendChild(ci);
    });
  });
}

function pgShowWinScreen(payout, mult, label, tier, cb) {
  const ov = document.getElementById('pg-win-ov');
  ov.className = 's5-win-ov show s5-ov-' + tier;
  document.getElementById('pg-win-title').textContent = label;
  document.getElementById('pg-win-amt').textContent   = '+' + payout.toLocaleString('pl-PL') + ' AT$';
  document.getElementById('pg-win-mult').textContent  = mult.toFixed(1) + '\u00d7 zak\u0142adu';
  pgWinCb = cb;
  clearTimeout(pgWinTimer);
  const delay = tier === 'frito' ? 7000 : tier === 'giga' ? 5500 : tier === 'huge' ? 4500 : 3500;
  pgWinTimer = setTimeout(pgDismissWin, delay);
}

function pgDismissWin() {
  clearTimeout(pgWinTimer);
  const ov = document.getElementById('pg-win-ov');
  if (ov) ov.classList.remove('show');
  if (pgWinCb) { pgWinCb(); pgWinCb = null; }
}

function pgSetMsg(txt, cls) {
  const m = document.getElementById('pg-msg');
  if (!m) return;
  m.textContent = txt; m.className = 's5-msg' + (cls ? ' ' + cls : '');
}

function pgUpdateStats() {
  const bal = document.getElementById('casino-path-balance');
  if (bal) bal.textContent = casinoWallet ? casinoWallet.balance.toLocaleString('pl-PL') + ' AT$' : '\u2014';
  const elems = { 'pg-bet-val': pgBet, 'pg-lines-val': pgLines, 'pg-tot-bet': (pgBet * pgLines).toLocaleString('pl-PL'),
    'pg-stat-spins': pgStatSpins.toLocaleString('pl-PL'), 'pg-stat-paid': pgStatPaid.toLocaleString('pl-PL') + ' AT$',
    'pg-stat-best': pgBestWin > 0 ? pgBestWin.toLocaleString('pl-PL') + ' AT$' : '\u2014',
    'pg-stat-spent': pgStatSpent.toLocaleString('pl-PL') + ' AT$' };
  Object.entries(elems).forEach(function(e){ const el=document.getElementById(e[0]); if(el) el.textContent=e[1]; });
  updateProfitDisplay('pg-stat-profit', pgStatSpent, pgStatPaid);
}

function pgUpdateFSBar() {
  const b = document.getElementById('pg-fs-bar');
  if (!b) return;
  const fc = document.getElementById('pg-fs-count');
  if (fc) fc.textContent = pgFreeSpins;
  const fl = document.getElementById('pg-fs-label');
  if (fl) fl.textContent = pgFreeMode === 'pit' ? '\u26cf\ufe0f Pit Free Spins \u2014 Lock aktywna!' : '\uD83C\uDF81 Free Spins aktywne';
  pgFreeSpins > 0 ? b.classList.add('show') : b.classList.remove('show');
}

function pgUpdatePit(meter) {
  pgPitMeter = Math.min(300, meter || 0);
  const fill = document.getElementById('pg-pit-fill');
  if (fill) fill.style.width = (pgPitMeter / 300 * 100) + '%';
  const pts = document.getElementById('pg-pit-pts');
  if (pts) pts.textContent = pgPitMeter + ' / 300';
}

function pgAddWinLog(payout, mult, tier) {
  if (tier === 'win') return;
  const log = document.getElementById('pg-win-log');
  if (!log) return;
  const b = document.createElement('div'); b.className = 's5-log-tag ' + tier;
  b.textContent = getTierLabel(tier) + ' +' + payout.toLocaleString('pl-PL') + ' AT$ (' + mult.toFixed(1) + '\u00d7)';
  log.insertBefore(b, log.firstChild);
  while (log.children.length > 6) log.removeChild(log.lastChild);
}

function pgChBet(d, mode) {
  if (!pgTable) return;
  const cfg = pgTable.config;
  if (mode === 'max') pgBet = cfg.maxBet;
  else pgBet = Math.max(cfg.minBet, Math.min(cfg.maxBet, pgBet + d * cfg.minBet));
  pgUpdateStats();
}
function pgChLines(d, mode) {
  if (mode === 'max') pgLines = 50; else pgLines = Math.max(10, Math.min(50, pgLines + d));
  pgUpdateStats();
}
function pgPreset(mult) {
  if (!pgTable) return;
  pgBet = pgTable.config.minBet * mult;
  pgUpdateStats();
}

let pgPvT = null, pgPvIdx = 0;
function pgPreviewLines() {
  clearTimeout(pgPvT); pgPvIdx = 0;
  if (!pgLinesDef.length) return;
  const count = Math.min(pgLines, pgLinesDef.length);
  function next() {
    pgClearSVG();
    if (pgPvIdx >= count) { pgDrawLines([...Array(count).keys()], 0.3); setTimeout(pgClearSVG, 1200); return; }
    pgDrawLines([pgPvIdx], 1); pgPvIdx++; pgPvT = setTimeout(next, 60);
  }
  next();
}

function pgSpin() {
  const winOv = document.getElementById('pg-win-ov');
  if (pgSpinning || !casinoTableId || (winOv && winOv.classList.contains('show'))) return;
  const totBet = pgBet * pgLines;
  const cost   = pgFreeSpins > 0 ? 0 : totBet;
  if (casinoWallet && casinoWallet.balance < cost && pgFreeSpins === 0) { pgSetMsg('Za ma\u0142o AT$!'); return; }
  if (pgFreeSpins > 0) { pgFreeSpins--; pgUpdateFSBar(); }
  else if (casinoWallet) casinoWallet.balance -= cost;
  pgSpinning = true;
  pgClearOverlay();
  const logEl = document.getElementById('pg-win-log');
  if (logEl) logEl.innerHTML = '';
  const btn = document.getElementById('pg-spin-btn');
  if (btn) { btn.disabled = true; btn.textContent = '\u23F3'; }

  for (let c = 0; c < PG_COLS; c++) for (let r = 0; r < PG_ROWS; r++) {
    const el = document.getElementById('pgc' + c + '_' + r); if (!el) continue;
    const isLocked = pgStickyLocks && pgStickyLocks.find(function(l){ return l.col===c && l.row===r; });
    const isValdo = pgStickyValdos && pgStickyValdos.find(function(v){ return v.col===c && v.row===r; });
    if (isLocked || isValdo) continue;
    el.className = 's5-cell pg-cell spinning'; el.style.height = '58px'; el.innerHTML = '';
    el._spinInt = setInterval(function() {
      if (!pgSyms.length) { el.textContent = '?'; return; }
      const rnd = pgSyms[Math.floor(Math.random() * Math.min(8, pgSyms.length))];
      el.innerHTML = '<img src="' + rnd.img + '" style="width:44px;height:44px;object-fit:contain;opacity:.65">';
    }, 80);
  }

  socket.emit('casinoPathSpin', { tableId: casinoTableId, bet: pgBet, lines: pgLines, socketToken: casinoSocketToken, discordId: casinoDiscordId });
}

socket.on('casinoPathResult', function(data) {
  const grid=data.grid, winLines=data.winLines, payout=data.payout;
  const balance=data.balance, mult=data.mult, tier=data.tier, label=data.label;
  const freeSpinsAwarded=data.freeSpinsAwarded||0, freeMode=data.freeMode;
  const pitMeter=data.pitMeter||0, pitTriggered=data.pitTriggered;
  const stickyLocks=data.stickyLocks||[], newLocks=data.newLocks||[];
  const stickyValdos=data.stickyValdos||[], newValdos=data.newValdos||[];
  const sacredPitBonus=data.sacredPitBonus||0, valdoMult=data.valdoMult||0;
  const syms=data.syms, linesDef=data.lines;

  if (syms && syms.length)         pgSyms     = syms;
  if (linesDef && linesDef.length) pgLinesDef = linesDef;
  pgStickyLocks = stickyLocks;
    pgStickyValdos = stickyValdos;

  // Policz Sacred na każdej kolumnie z wyniku (do anticipation)
  var sacredPerCol = [0,0,0,0,0];
  for (var _c=0; _c<5; _c++) for (var _r=0; _r<5; _r++) {
    if (pgSyms.length && grid[_c][_r] < pgSyms.length && pgSyms[grid[_c][_r]].sacred) sacredPerCol[_c]++;
  }
  // Opóźnienia bazowe — anticipation wydłuża bębny 3,4 gdy 2+ sacred na 0-2
  var sacredSoFar = 0;
  var baseDelays = [350, 620, 900, 1180, 1470];
  var finalDelays = baseDelays.slice();
  // Sprawdź ile Sacred będzie na bębnach 0+1 i 0+1+2 żeby zdecydować o anticipation
  var sacred01  = sacredPerCol[0] + sacredPerCol[1];
  var sacred012 = sacredPerCol[0] + sacredPerCol[1] + sacredPerCol[2];
  var sacred0123= sacredPerCol[0] + sacredPerCol[1] + sacredPerCol[2] + sacredPerCol[3];
  var anticipate3 = (sacred01 >= 2);   // po bębnie 1 — anticipate bęben 2
  var anticipate4 = (sacred012 >= 2);  // po bębnie 2 — anticipate bęben 3
  var anticipate5 = (sacred0123 >= 2); // po bębnie 3 — anticipate bęben 4
  if (anticipate3) finalDelays[2] += 500;
  if (anticipate4) finalDelays[3] += 500;
  if (anticipate5) finalDelays[4] += 500;

  for (let c = 0; c < PG_COLS; c++) {
    (function(col){
      setTimeout(function() {
        // Przed zatrzymaniem — czy trzeba zapalić anticipation na NASTĘPNYM bębnie?
        // Licze Sacred które już wylądowały (col 0..col-1) + ten col
        var sacredLanded = 0;
        for (var _sc=0; _sc<=col; _sc++) sacredLanded += sacredPerCol[_sc];
        var nextCol = col + 1;
        if (sacredLanded >= 2 && nextCol < PG_COLS) {
          // Zapal anticipation na następnym bębnie
          setTimeout(function() {
            var reelOuter = document.getElementById('pg-reels-outer');
            if (reelOuter) reelOuter.classList.add('pg-reel-glow');
            for (var _r=0; _r<PG_ROWS; _r++) {
              var _el = document.getElementById('pgc'+nextCol+'_'+_r);
              if (_el) _el.classList.add('pg-anticipate');
            }
            // Dźwięk anticipation — flash białego tła
            var flash = document.createElement('div');
            flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,220,50,.08);z-index:999;pointer-events:none;animation:s5fw .3s ease-out forwards';
            document.body.appendChild(flash);
            setTimeout(function(){ flash.remove(); }, 350);
          }, 100);
        }
        // Usuń anticipation z TEGO bębna
        for (var _cr=0; _cr<PG_ROWS; _cr++) {
          var _cel = document.getElementById('pgc'+col+'_'+_cr);
          if (_cel) _cel.classList.remove('pg-anticipate');
        }
        if (col === PG_COLS-1) {
          var ro = document.getElementById('pg-reels-outer');
          if (ro) ro.classList.remove('pg-reel-glow');
        }

        for (let r = 0; r < PG_ROWS; r++) {
          const el = document.getElementById('pgc' + col + '_' + r); if (!el) continue;
          if (el._spinInt) { clearInterval(el._spinInt); el._spinInt = null; }
          const s = pgSyms[grid[col][r]]; if (!s) continue;
          const isLocked = s.sticky && pgStickyLocks.find(function(l){ return l.col===col && l.row===r; });
          el.className = 's5-cell pg-cell' + (s.wild ? ' wild' : s.scatter ? ' scatter' : '') + ' landed';
          if (isLocked) el.classList.add('pg-locked');
          if (s.sacred) el.classList.add('pg-sacred');
          if (s.valdo) { el.classList.add('pg-valdo'); }
          el.style.height = '58px';
          el.innerHTML = '<img src="' + s.img + '" style="width:44px;height:44px;object-fit:contain">'
          if (s.valdo) { el.classList.add('pg-valdo'); var sv2=(pgStickyValdos||[]).find(function(v){return v.col===col&&v.row===r;}); if(sv2){ var mb2=document.createElement('span'); mb2.className='s5-badge pg-valdo-b'; mb2.textContent=sv2.mult+'x'; el.appendChild(mb2); } }
          if (s.sacred) el.classList.add('pg-sacred');
            + (s.wild && !s.sticky ? '<span class="s5-badge s5-wild-b">W</span>' : '')
            + (s.scatter ? '<span class="s5-badge s5-scat-b">S</span>' : '')
            + (isLocked ? '<span class="s5-badge pg-lock-b">\uD83D\uDD12</span>' : '');
        }
        if (col === PG_COLS - 1) {
          setTimeout(function() {
            pgSpinning = false;
            const btn = document.getElementById('pg-spin-btn');
            if (btn) { btn.disabled = false; btn.textContent = '⛏️ SPIN'; }
            if (casinoWallet) casinoWallet.balance = balance;
            pgStatSpins++; pgStatPaid += payout; if (payout > pgBestWin) pgBestWin = payout;
            if (payout > 0) addRecentWin('pg-recent-list', payout, tier);
            pgStatSpent += (pgFreeSpins > 0 ? 0 : pgBet * pgLines);
            // Synchronizuj pgFreeSpins z backendem (source of truth)
            pgFreeSpins = data.freeSpinsRemaining || 0;
            if (freeSpinsAwarded > 0) {
              // pgFreeSpins już zsynchronizowane z backendem (freeSpinsRemaining uwzględnia bonus)
              pgFreeMode = freeMode || pgFreeMode;
              pgUpdateFSBar();
              var fsIcon = (freeMode === 'sacred') ? '\u2728' : '\uD83C\uDF81';
              var fsEl = document.createElement('div'); fsEl.className = 's5-log-tag big';
              fsEl.textContent = fsIcon + ' +' + freeSpinsAwarded + ' Free Spin\u00f3w!';
              var fsLg = document.getElementById('pg-win-log');
              if (fsLg) { fsLg.insertBefore(fsEl, fsLg.firstChild); while(fsLg.children.length>6) fsLg.removeChild(fsLg.lastChild); }
            }
            pgUpdatePit(pitMeter);
            if (sacredPitBonus > 0) { var sEl=document.createElement('div'); sEl.className='s5-log-tag big'; sEl.textContent='✨ Sacred Orb! +'+sacredPitBonus+' Free Spiny'; var slg=document.getElementById('pg-win-log'); if(slg){slg.insertBefore(sEl,slg.firstChild);while(slg.children.length>6)slg.removeChild(slg.lastChild);} pgSetMsg('✨ Sacred Orb! +'+sacredPitBonus+' Free Spinów!','big'); }
            if (payout > 0) {
              const isBig = mult >= 1.5;
              winLines.forEach(function(w) {
                for (let c2 = 0; c2 < w.streak; c2++) {
                  const el = document.getElementById('pgc' + c2 + '_' + w.line[c2]);
                  if (el) el.classList.add(isBig ? 'bigwin' : 'win');
                }
              });
              const winLineIdxs = winLines.map(function(w){ return w.li; });
              if (winLineIdxs.length) pgDrawLines(winLineIdxs, 0.85);
              else if (pgLinesDef.length) pgDrawLines([0], 0.85);
              pgAddWinLog(payout, mult, tier);
              if (valdoMult > 0) { var vEl=document.createElement('div'); vEl.className='s5-log-tag giga'; vEl.textContent='📦 Valdo\'s Box! x'+valdoMult+' — '+payout.toLocaleString('pl-PL')+' AT$'; var vlg=document.getElementById('pg-win-log'); if(vlg){vlg.insertBefore(vEl,vlg.firstChild);while(vlg.children.length>6)vlg.removeChild(vlg.lastChild);} }
              s5Fireworks(tier);
              pgUpdateStats();
              pgShowWinScreen(payout, mult, label, tier, function() {
                pgSetMsg(label + '! +' + payout.toLocaleString('pl-PL') + ' AT$ (' + mult.toFixed(1) + '\u00d7)', isBig ? 'big' : 'win');
                pgUpdateStats();
                if (pgAuto) pgAutoT = setTimeout(pgSpin, 800);
              });
            } else {
              if (pitTriggered) pgSetMsg('\u26cf\ufe0f PIT METER PE\u0141NY! 8 Free Spin\u00f3w!', 'big');
              else if (freeSpinsAwarded > 0) { var mIcon = freeMode === 'sacred' ? '\u2728' : '🎁'; pgSetMsg(mIcon + ' ' + freeSpinsAwarded + ' Free Spinów!', 'big'); }
              else pgSetMsg(pgFreeSpins > 0 ? ('Free Spin \u2014 ' + pgFreeSpins + ' pozosta\u0142o') : 'Bez wygranej');
              pgUpdateStats();
              if (pgAuto) pgAutoT = setTimeout(pgSpin, pgFreeSpins > 0 ? 500 : 1200);
            }
          }, 200);
        }
      }, finalDelays[col]);
    }(c));
  }
});

function pgToggleAuto() {
  pgAuto = !pgAuto;
  const b = document.getElementById('pg-auto-btn');
  if (!b) return;
  if (pgAuto) {
    b.textContent = 'Stop'; b.classList.add('on');
    var run = function() {
      if (!pgAuto || (casinoWallet && casinoWallet.balance < pgBet * pgLines && pgFreeSpins === 0)) {
        pgAuto = false; b.textContent = 'Auto'; b.classList.remove('on'); return;
      }
      const winOv = document.getElementById('pg-win-ov');
      if (pgSpinning || (winOv && winOv.classList.contains('show'))) { pgAutoT = setTimeout(run, 300); return; }
      pgSpin(); pgAutoT = setTimeout(run, 1800);
    };
    setTimeout(run, 300);
  } else { clearTimeout(pgAutoT); b.textContent = 'Auto'; b.classList.remove('on'); }
}


// ══ PANEL GRACZE ONLINE ════════════════════════════════════════
let _opOpen = false, _opRefreshTimer = null;
