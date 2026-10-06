// ══════════════════════════════════════════════════════════════
//  RULETKA EUROPEJSKA — koło (canvas), plansza z żetonami, multiplayer
// ══════════════════════════════════════════════════════════════
const RL_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const RL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RL_LABELS = { straight: 'Numer', split: 'Split', street: 'Street', corner: 'Corner', sixline: 'Six Line', red: 'Czerwone', black: 'Czarne', even: 'Parzyste', odd: 'Nieparzyste', low: '1–18', high: '19–36', dozen1: '1–12', dozen2: '13–24', dozen3: '25–36', col1: 'Kolumna 1', col2: 'Kolumna 2', col3: 'Kolumna 3' };
const RL_PAYOUT = { straight: 35, split: 17, street: 11, corner: 8, sixline: 5, red: 1, black: 1, even: 1, odd: 1, low: 1, high: 1, dozen1: 2, dozen2: 2, dozen3: 2, col1: 2, col2: 2, col3: 2 };
let rl = null;

function rlColor(n) { return n === 0 ? 'green' : RL_RED.has(n) ? 'red' : 'black'; }

function initRouletteUI(table) {
  if (rl?.raf) cancelAnimationFrame(rl.raf);
  const chips = cxChipValues(table.config.minBet, table.config.maxBet, 7);
  rl = { table, chip: chips[0], chips, state: null, myBets: [], lastBets: [], anchors: {}, spin: null, wheelAngle: 0, lastT: performance.now(), raf: null, resultShown: null };
  const scr = cxScreen('casino-roulette');
  scr.innerHTML = `<div class="cx-shell">
    ${cxTopbar({ icon: '🎡', title: table.name, sub: `Europejska · zakład ${cxShort(table.config.minBet)}–${cxShort(table.config.maxBet)} AT$ / runda`, info: 'rlInfo()' })}
    <div class="rl-top">
      <div class="rl-wheel-wrap"><canvas id="rl-canvas" width="640" height="640"></canvas><div class="rl-result" id="rl-result">?</div></div>
      <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
        <div class="cx-panel"><div class="cx-row" style="justify-content:space-between"><b id="rl-phase" style="font-size:16px">Łączenie…</b><span class="cx-pill">Twoje zakłady: <b id="rl-mytotal" style="color:var(--cx-gold)">0</b></span></div>
          <div class="cx-bar" style="margin-top:10px"><i id="rl-cdbar"></i></div></div>
        <div class="cx-panel"><h4>Ostatnie wyniki</h4><div class="rl-history" id="rl-history"></div></div>
        <div class="cx-panel"><h4>Gracze przy stole</h4><div class="rl-players" id="rl-players"></div></div>
      </div>
    </div>
    <div class="rl-board-wrap"><div class="rl-board" id="rl-board"></div></div>
    <div class="cx-actionbar">
      <span style="font-size:12px;color:var(--muted);font-weight:700">ŻETON</span>
      <div id="rl-chips"></div>
      <div style="width:1px;height:36px;background:var(--cx-line2)"></div>
      <button class="cx-btn sm" onclick="rlRebet()">↺ Powtórz</button>
      <button class="cx-btn sm" onclick="rlDouble()">×2 Podwój</button>
      <button class="cx-btn sm red" onclick="rlClear()">✕ Wyczyść</button>
    </div>
    <div class="cx-status-line" id="rl-msg">Kliknij pole na planszy, aby postawić wybrany żeton.</div>
  </div>`;
  cxChips('rl-chips', chips, v => { rl.chip = v; }, rl.chip);
  rlBuildBoard();
  rlDraw();
  socket.emit('casinoRouletteJoin', cxAuth());
}

function rlInfo() {
  cxModal(`<h3>🎡 Ruletka Europejska</h3><div class="cx-rules"><ul>
    <li>Koło ma 37 pól (0–36). Masz ${20} s na obstawienie, potem kula się toczy.</li>
    <li>Klikaj pola na planszy. Krawędzie między numerami to <b>split</b> (2 numery), dolna krawędź kolumny to <b>street</b> (3), przecięcia to <b>corner</b> (4), a dolne przecięcia to <b>six line</b> (6).</li>
    <li>Wypłaty: numer 35:1 · split 17:1 · street 11:1 · corner 8:1 · six line 5:1 · tuzin/kolumna 2:1 · kolor/parzystość/połowa 1:1.</li>
    <li>Limit stołu dotyczy sumy Twoich zakładów w rundzie. Zakłady możesz zdjąć przed końcem odliczania.</li>
    <li>Przewaga kasyna: 2,7% (jedno zero).</li></ul></div>`);
}

// ── Plansza ───────────────────────────────────────────────────
function rlBuildBoard() {
  const b = document.getElementById('rl-board');
  let h = `<div class="rl-cell green" style="grid-column:1;grid-row:1/4" data-bet="straight:0">0</div>`;
  for (let j = 0; j < 12; j++) for (let i = 0; i < 3; i++) {
    const n = 3 * j + (3 - i);
    h += `<div class="rl-cell ${rlColor(n)}" style="grid-column:${j + 2};grid-row:${i + 1}" data-bet="straight:${n}" data-n="${n}">${n}</div>`;
  }
  ['col3', 'col2', 'col1'].forEach((k, i) => h += `<div class="rl-cell out" style="grid-column:14;grid-row:${i + 1}" data-bet="${k}:">2:1</div>`);
  ['dozen1', 'dozen2', 'dozen3'].forEach((k, i) => h += `<div class="rl-cell out" style="grid-column:${2 + i * 4}/${6 + i * 4};grid-row:4" data-bet="${k}:">${RL_LABELS[k]}</div>`);
  const outs = [['low', '1–18'], ['even', 'Parz.'], ['red', '<span style="color:#ff6f8a">◆</span>'], ['black', '◆'], ['odd', 'Nieparz.'], ['high', '19–36']];
  outs.forEach(([k, l], i) => h += `<div class="rl-cell out${k === 'red' ? ' red' : k === 'black' ? ' black' : ''}" style="grid-column:${2 + i * 2}/${4 + i * 2};grid-row:5" data-bet="${k}:">${l}</div>`);
  b.innerHTML = h;
  b.onclick = e => {
    const t = e.target.closest('[data-bet]');
    if (!t) return;
    const [type, value] = t.dataset.bet.split(':');
    rlPlace(type, value);
  };
  b.onmouseover = e => rlHover(e.target.closest('[data-bet]'));
  b.onmouseleave = () => rlHover(null);
  requestAnimationFrame(rlBuildHotspots);
}

function rlNumsOf(type, value) {
  const v = Number(value);
  switch (type) {
    case 'straight': return [v];
    case 'split': return String(value).split('-').map(Number);
    case 'street': return [v, v + 1, v + 2];
    case 'corner': return [v, v + 1, v + 3, v + 4];
    case 'sixline': return [v, v + 1, v + 2, v + 3, v + 4, v + 5];
    case 'red': return [...RL_RED];
    case 'black': return Array.from({ length: 36 }, (_, i) => i + 1).filter(n => !RL_RED.has(n));
    case 'even': return Array.from({ length: 18 }, (_, i) => (i + 1) * 2);
    case 'odd': return Array.from({ length: 18 }, (_, i) => i * 2 + 1);
    case 'low': return Array.from({ length: 18 }, (_, i) => i + 1);
    case 'high': return Array.from({ length: 18 }, (_, i) => i + 19);
    case 'dozen1': case 'dozen2': case 'dozen3': { const d = Number(type.slice(-1)) - 1; return Array.from({ length: 12 }, (_, i) => d * 12 + i + 1); }
    case 'col1': case 'col2': case 'col3': { const c = Number(type.slice(-1)); return Array.from({ length: 12 }, (_, i) => i * 3 + c); }
  }
  return [];
}
function rlHover(el) {
  document.querySelectorAll('#rl-board .rl-cell.hl').forEach(c => c.classList.remove('hl'));
  if (!el) return;
  const [type, value] = el.dataset.bet.split(':');
  rlNumsOf(type, value).forEach(n => document.querySelector(`#rl-board [data-bet="straight:${n}"]`)?.classList.add('hl'));
}

// Hotspoty dla split/street/corner/sixline + punkty zaczepienia żetonów
function rlBuildHotspots() {
  const b = document.getElementById('rl-board');
  if (!b) return;
  b.querySelectorAll('.rl-hot, .rl-stack').forEach(e => e.remove());
  const cell = n => b.querySelector(`[data-bet="straight:${n}"]`);
  const box = el => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  rl.anchors = {};
  b.querySelectorAll('[data-bet]').forEach(el => { const bx = box(el); rl.anchors[el.dataset.bet] = [bx.x + bx.w / 2, bx.y + bx.h / 2]; });
  const add = (type, value, cx, cy, w, h) => {
    const d = document.createElement('div');
    d.className = 'rl-hot';
    d.dataset.bet = `${type}:${value}`;
    d.style.cssText = `left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px`;
    d.title = `${RL_LABELS[type]} ${value} (${RL_PAYOUT[type]}:1)`;
    b.appendChild(d);
    rl.anchors[`${type}:${value}`] = [cx, cy];
  };
  for (let n = 1; n <= 36; n++) {
    const c = box(cell(n));
    if (n <= 33) add('split', `${n}-${n + 3}`, c.x + c.w + 1.5, c.y + c.h / 2, 14, c.h * .55);       // poziomy split
    if (n % 3 !== 0) add('split', `${n}-${n + 1}`, c.x + c.w / 2, c.y - 1.5, c.w * .55, 14);          // pionowy split
    if (n % 3 !== 0 && n <= 32) add('corner', n, c.x + c.w + 1.5, c.y - 1.5, 16, 16);
    if (n % 3 === 1) add('street', n, c.x + c.w / 2, c.y + c.h + 1.5, c.w * .6, 12);
    if (n % 3 === 1 && n <= 31) add('sixline', n, c.x + c.w + 1.5, c.y + c.h + 1.5, 16, 14);
    if (n <= 3) add('split', `0-${n}`, c.x - 1.5, c.y + c.h / 2, 14, c.h * .55);
  }
  rlRenderStacks();
}
window.addEventListener('resize', () => { if (rl && document.getElementById('rl-board')) rlBuildHotspots(); });

function rlKey(type, value) {
  if (type === 'straight' || type === 'split') return `${type}:${value}`;
  if (['street', 'corner', 'sixline'].includes(type)) return `${type}:${value}`;
  return `${type}:`;
}
function rlRenderStacks() {
  const b = document.getElementById('rl-board');
  if (!b || !rl.state) return;
  b.querySelectorAll('.rl-stack').forEach(e => e.remove());
  const totals = {};
  for (const p of rl.state.players || []) for (const bet of p.bets || []) {
    const k = rlKey(bet.type, bet.value);
    totals[k] = totals[k] || { mine: 0, other: 0 };
    totals[k][p.discordId === casinoDiscordId ? 'mine' : 'other'] += bet.amount;
  }
  for (const [k, t] of Object.entries(totals)) {
    const a = rl.anchors[k];
    if (!a) continue;
    const mk = (amt, mine, dx) => { const s = document.createElement('div'); s.className = 'rl-stack' + (mine ? ' mine' : ''); s.style.left = (a[0] + dx) + 'px'; s.style.top = a[1] + 'px'; s.textContent = cxShort(amt); s.title = `${mine ? 'Twój zakład' : 'Inni gracze'}: ${cxFmt(amt)} AT$`; b.appendChild(s); };
    if (t.other) mk(t.other, false, t.mine ? -7 : 0);
    if (t.mine) mk(t.mine, true, t.other ? 7 : 0);
  }
}

// ── Zakłady ───────────────────────────────────────────────────
function rlPlace(type, value, amount) {
  if (!rl?.state || rl.state.phase !== 'betting') return cxToast('Poczekaj na kolejną rundę zakładów', 'error');
  amount = amount || rl.chip;
  if (cxBalance() < amount) return cxToast('Za mało AT$!', 'error');
  cxSound.play('chip');
  socket.emit('casinoRouletteBet', cxAuth({ type, value, amount }));
}
function rlClear() { socket.emit('casinoRouletteClear', cxAuth()); }
function rlRebet() {
  if (!rl.lastBets.length) return cxToast('Brak zakładów z poprzedniej rundy', '');
  rl.lastBets.forEach(b => rlPlace(b.type, b.value, b.amount));
}
function rlDouble() {
  if (!rl.myBets.length) return cxToast('Najpierw postaw zakład', '');
  rl.myBets.forEach(b => rlPlace(b.type, b.value, b.amount));
}

// ── Stan z serwera ────────────────────────────────────────────
socket.on('casinoRouletteBalance', ({ balance }) => cxSetBalance(balance));
socket.on('casinoRouletteState', state => {
  if (!rl || state.tableId !== casinoTableId) return;
  const prev = rl.state;
  rl.state = state;
  const me = state.players.find(p => p.discordId === casinoDiscordId);
  rl.myBets = me?.bets || [];
  document.getElementById('rl-mytotal').textContent = cxFmt(me?.totalBet || 0) + ' AT$';
  const ph = document.getElementById('rl-phase');
  const bar = document.getElementById('rl-cdbar');
  if (state.phase === 'betting') {
    ph.innerHTML = `🎲 Obstawiaj! <span class="cx-mono" style="color:var(--cx-gold)">${state.countdown}s</span>`;
    bar.style.width = (state.countdown / (state.bettingTime || 20) * 100) + '%';
    if (prev?.phase !== 'betting') {
      document.querySelectorAll('#rl-board .rl-cell.win').forEach(c => c.classList.remove('win'));
      document.getElementById('rl-msg').textContent = 'Kliknij pole na planszy, aby postawić wybrany żeton.';
      rl.resultShown = null;
    }
    if (state.countdown <= 5 && state.countdown > 0) cxSound.play('tick');
  } else if (state.phase === 'spinning') {
    ph.textContent = '🎡 Kula w grze… zakłady zamknięte';
    bar.style.width = '0%';
    if (!rl.spin && state.result) rlStartSpin(state.result, state.spinTime || 7000);
  } else if (state.phase === 'results' && state.result) {
    ph.innerHTML = `Wynik: <b class="rl-hn ${state.result.color}" style="display:inline-grid;width:auto;padding:0 8px">${state.result.number}</b>`;
    if (!rl.spin) rlLandNow(state.result);
    rlShowResult(state);
  }
  // Historia
  document.getElementById('rl-history').innerHTML = (state.history || []).map(h => `<div class="rl-hn ${h.color}">${h.number}</div>`).join('') || '<span style="color:var(--muted);font-size:12px">—</span>';
  // Gracze
  document.getElementById('rl-players').innerHTML = state.players.map(p => `<div class="rl-player">${p.avatar ? `<img src="${cxEsc(p.avatar)}" alt="" onerror="this.style.display='none'">` : ''}<span>${cxEsc(p.name)}${p.discordId === casinoDiscordId ? ' (Ty)' : ''}</span>
    <span class="amt ${p.net > 0 ? 'cx-pos' : p.net < 0 ? 'cx-neg' : ''}">${p.net !== null && p.net !== undefined && state.phase === 'results' ? (p.net > 0 ? '+' : '') + cxFmt(p.net) : p.totalBet ? cxFmt(p.totalBet) : '—'}</span></div>`).join('');
  rlRenderStacks();
});

function rlShowResult(state) {
  if (rl.resultShown === state.result.number + ':' + (state.history?.length || 0)) return;
  rl.resultShown = state.result.number + ':' + (state.history?.length || 0);
  const n = state.result.number;
  document.querySelector(`#rl-board [data-bet="straight:${n}"]`)?.classList.add('win');
  const res = (state.results || []).find(r => r.discordId === casinoDiscordId);
  if (rl.myBets.length) rl.lastBets = rl.myBets.map(b => ({ ...b }));
  if (res) {
    if (res.balance !== null && res.balance !== undefined) cxSetBalance(res.balance);
    if (res.won > 0) {
      cxSound.play('win');
      cxFloat(res.won, document.getElementById('rl-result'));
      document.getElementById('rl-msg').innerHTML = `🎉 Wygrywasz <b style="color:var(--cx-win)">${cxFmt(res.won)} AT$</b> (bilans ${res.net >= 0 ? '+' : ''}${cxFmt(res.net)})`;
      if (res.won >= res.staked * 10 && res.won >= 1000) cxBigWin({ amount: res.won, bet: res.staked, tier: res.won >= res.staked * 30 ? 'huge' : 'mega', title: `🎡 ${n}!` });
    } else {
      cxSound.play('lose');
      document.getElementById('rl-msg').innerHTML = `Tym razem nie — przegrywasz <b style="color:var(--cx-lose)">${cxFmt(res.staked)} AT$</b>`;
    }
  } else document.getElementById('rl-msg').textContent = `Wypadło ${n}. Postaw w kolejnej rundzie!`;
}

// ── Koło (canvas) ─────────────────────────────────────────────
const RL_TAU = Math.PI * 2;
const RL_SEG = RL_TAU / 37;
function rlEase(t) { return 1 - Math.pow(1 - t, 3.2); }
function rlStartSpin(result, dur) {
  const t0 = performance.now();
  const pocket = RL_ORDER.indexOf(result.number);
  const wheelAtEnd = rl.wheelAngle + 0.55 * dur / 1000;
  const endBall = wheelAtEnd + pocket * RL_SEG + RL_SEG / 2;
  rl.spin = { t0, dur, pocket, endBall, startBall: endBall + RL_TAU * 7, result };
  document.getElementById('rl-result').className = 'rl-result';
  document.getElementById('rl-result').textContent = '';
}
function rlLandNow(result) {
  rl.spin = { t0: performance.now() - 1e6, dur: 1, pocket: RL_ORDER.indexOf(result.number), endBall: 0, startBall: 0, result, landed: true };
  rlOnLanded(result);
}
function rlOnLanded(result) {
  const el = document.getElementById('rl-result');
  el.className = 'rl-result ' + result.color;
  el.textContent = result.number;
  el.animate([{ transform: 'translate(-50%,-50%) scale(.4)' }, { transform: 'translate(-50%,-50%) scale(1.15)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 450 });
}

function rlDraw() {
  const cv = document.getElementById('rl-canvas');
  if (!cv || !rl) return;
  const ctx = cv.getContext('2d');
  const now = performance.now();
  const dt = (now - rl.lastT) / 1000;
  rl.lastT = now;
  rl.wheelAngle += 0.55 * dt;
  const W = cv.width, C = W / 2;
  ctx.clearRect(0, 0, W, W);
  // Rant
  let g = ctx.createRadialGradient(C, C, C * .7, C, C, C);
  g.addColorStop(0, '#5a3418'); g.addColorStop(.6, '#3b2413'); g.addColorStop(1, '#1d1009');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, C - 2, 0, RL_TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,211,107,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(C, C, C * .9, 0, RL_TAU); ctx.stroke();
  // Pola
  const R1 = C * .86, R2 = C * .62;
  ctx.save(); ctx.translate(C, C); ctx.rotate(rl.wheelAngle - Math.PI / 2);
  for (let i = 0; i < 37; i++) {
    const n = RL_ORDER[i];
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R1, i * RL_SEG, (i + 1) * RL_SEG); ctx.closePath();
    ctx.fillStyle = n === 0 ? '#138a51' : RL_RED.has(n) ? '#c62840' : '#15151c'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,107,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.rotate(i * RL_SEG + RL_SEG / 2); ctx.translate(R1 * .86, 0); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(C * .07)}px Syne, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n, 0, 0); ctx.restore();
  }
  // Wewnętrzny stożek
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, R2);
  g.addColorStop(0, '#6b4423'); g.addColorStop(.7, '#3b2413'); g.addColorStop(1, '#24150b');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R2, 0, RL_TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,211,107,.7)'; ctx.lineWidth = 3; ctx.stroke();
  for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(k * Math.PI / 2); ctx.fillStyle = '#d4a64a'; ctx.fillRect(-4, -R2 * .9, 8, R2 * .75); ctx.restore(); }
  ctx.restore();
  // Kula
  if (rl.spin) {
    const s = rl.spin;
    const p = Math.min(1, (now - s.t0) / s.dur);
    let ang, rad;
    const pocketAng = rl.wheelAngle + s.pocket * RL_SEG + RL_SEG / 2;
    if (p < 1) {
      ang = s.startBall + (s.endBall - s.startBall) * rlEase(p);
      // płynne dociągnięcie do aktualnej pozycji pola pod koniec
      if (p > .85) { const k = (p - .85) / .15; ang = ang * (1 - k) + pocketAng * k; }
      rad = p < .72 ? C * .95 : C * .95 - (C * .95 - R1 * .7) * Math.min(1, (p - .72) / .2);
      if (p > .72 && p < .95) rad += Math.sin(p * 90) * C * .015 * (1 - p);
    } else {
      ang = pocketAng; rad = R1 * .7;
      if (!s.landed) { s.landed = true; rlOnLanded(s.result); cxSound.play('stop'); }
    }
    const bx = C + Math.cos(ang - Math.PI / 2) * rad, by = C + Math.sin(ang - Math.PI / 2) * rad;
    const bg = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, C * .035);
    bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#b8bcc8');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, C * .032, 0, RL_TAU); ctx.fill();
    ctx.shadowBlur = 0;
    if (rl.state?.phase === 'betting') rl.spin = null;
  }
  rl.raf = requestAnimationFrame(rlDraw);
}
document.addEventListener('cx-leave', e => { if (e.detail.game === 'roulette' && rl) { cancelAnimationFrame(rl.raf); rl = null; } });
