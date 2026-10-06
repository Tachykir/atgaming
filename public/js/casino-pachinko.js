// ══════════════════════════════════════════════════════════════
//  PACHINKO (Plinko) — canvas, 3 poziomy ryzyka, do 10 kulek naraz
// ══════════════════════════════════════════════════════════════
const PK_CFG = {
  low:    { rows: 8,  mults: [5.6, 2.1, 1.1, 1, 0.4, 1, 1.1, 2.1, 5.6] },
  medium: { rows: 12, mults: [33, 11, 4, 2, 1.1, 0.6, 0.17, 0.6, 1.1, 2, 4, 11, 33] },
  high:   { rows: 16, mults: [1000, 130, 26, 9, 4, 2, 0.16, 0.16, 0.16, 0.16, 0.16, 2, 4, 9, 26, 130, 1000] },
};
let pk = null;

function initPachinkoUI(table) {
  if (pk?.raf) cancelAnimationFrame(pk.raf);
  const chips = cxChipValues(table.config.minBet, table.config.maxBet, 6);
  let risk = 'medium';
  try { risk = localStorage.getItem('pk_risk') || 'medium'; } catch (e) {}
  pk = { table, risk, bet: chips[0], balls: 1, flying: [], flash: {}, last: [], raf: null, busy: false, auto: false };
  const scr = cxScreen('casino-pachinko');
  scr.innerHTML = `<div class="cx-shell">
    ${cxTopbar({ icon: '🎯', title: table.name, sub: 'Plinko · RTP ≈ 96%', info: 'pkInfo()' })}
    <div class="pk-wrap">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="cx-panel"><h4>Ryzyko</h4><div class="pk-risk">
          <button class="cx-btn sm green" data-r="low" onclick="pkSetRisk('low')">Niskie</button>
          <button class="cx-btn sm gold" data-r="medium" onclick="pkSetRisk('medium')">Średnie</button>
          <button class="cx-btn sm red" data-r="high" onclick="pkSetRisk('high')">Wysokie</button></div>
          <div style="font-size:11px;color:var(--muted);margin-top:8px" id="pk-riskdesc"></div></div>
        <div class="cx-panel"><h4>Stawka za kulkę</h4>
          <div class="cx-row"><input class="cx-input cx-grow" id="pk-bet" type="number" value="${pk.bet}" min="${table.config.minBet}" max="${table.config.maxBet}"></div>
          <div id="pk-chips" style="margin-top:10px"></div></div>
        <div class="cx-panel"><h4>Liczba kulek</h4><div class="cx-row" id="pk-balls">${[1, 3, 5, 10].map(n => `<button class="cx-btn sm${n === 1 ? ' purple' : ''}" data-b="${n}" onclick="pkSetBalls(${n})">${n}</button>`).join('')}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:8px">Łącznie: <b id="pk-total" class="cx-mono" style="color:var(--cx-gold)"></b></div></div>
        <button class="cx-btn gold lg" id="pk-drop" onclick="pkDrop()">🎯 Upuść kulki</button>
        <button class="cx-btn sm" id="pk-auto" onclick="pkToggleAuto()">🔁 Auto</button>
        <div class="cx-panel"><h4>Ostatnie</h4><div class="pk-last" id="pk-last"><span style="color:var(--muted)">—</span></div></div>
      </div>
      <div class="pk-stage"><canvas id="pk-canvas"></canvas></div>
    </div>
  </div>`;
  cxChips('pk-chips', chips, v => { document.getElementById('pk-bet').value = v; pkUpdateTotal(); }, pk.bet);
  document.getElementById('pk-bet').oninput = pkUpdateTotal;
  pkSetRisk(risk);
  pkResize();
  pkLoop();
}
function pkInfo() {
  cxModal(`<h3>🎯 Pachinko</h3><div class="cx-rules"><ul>
    <li>Kulka spada przez rzędy kołków i w każdym odbija się w lewo lub prawo (50/50). Pole, w które wpadnie, mnoży stawkę.</li>
    <li>Ryzyko niskie: 8 rzędów, mnożniki 0,4×–5,6×. Średnie: 12 rzędów, 0,17×–33×. Wysokie: 16 rzędów, 0,16×–1000×.</li>
    <li>Możesz zrzucić do 10 kulek naraz — każda gra osobno.</li>
    <li>RTP ≈ 96% na każdym poziomie ryzyka.</li></ul></div>`);
}
function pkSetRisk(r) {
  if (pk.flying.length) return;
  pk.risk = r;
  try { localStorage.setItem('pk_risk', r); } catch (e) {}
  document.querySelectorAll('.pk-risk button').forEach(b => b.classList.toggle('active', b.dataset.r === r));
  const c = PK_CFG[r];
  document.getElementById('pk-riskdesc').textContent = `${c.rows} rzędów · mnożniki ${Math.min(...c.mults)}× – ${Math.max(...c.mults)}×`;
  pkResize();
}
function pkSetBalls(n) {
  pk.balls = n;
  document.querySelectorAll('#pk-balls button').forEach(b => b.classList.toggle('purple', Number(b.dataset.b) === n));
  pkUpdateTotal();
}
function pkUpdateTotal() { const b = Number(document.getElementById('pk-bet').value) || 0; document.getElementById('pk-total').textContent = cxFmt(b * pk.balls) + ' AT$'; }
function pkToggleAuto() {
  pk.auto = !pk.auto;
  document.getElementById('pk-auto').className = 'cx-btn sm' + (pk.auto ? ' red' : '');
  document.getElementById('pk-auto').textContent = pk.auto ? '⏹ Stop auto' : '🔁 Auto';
  if (pk.auto && !pk.busy) pkDrop();
}
function pkDrop() {
  if (pk.busy) return;
  const bet = Math.floor(Number(document.getElementById('pk-bet').value) || 0);
  const cfg = pk.table.config;
  if (bet < cfg.minBet || bet > cfg.maxBet) return cxToast(`Stawka: ${cxShort(cfg.minBet)}–${cxShort(cfg.maxBet)} AT$`, 'error');
  if (cxBalance() < bet * pk.balls) { pk.auto && pkToggleAuto(); return cxToast('Za mało AT$!', 'error'); }
  pk.busy = true;
  document.getElementById('pk-drop').disabled = true;
  cxSetBalance(cxBalance() - bet * pk.balls, false);
  socket.emit('casinoPachinkoDrop', cxAuth({ bet, risk: pk.risk, balls: pk.balls }));
  setTimeout(() => { if (pk?.busy && !pk.flying.length) { pk.busy = false; document.getElementById('pk-drop').disabled = false; } }, 8000);
}

socket.on('casinoPachinkoResult', d => {
  if (!pk) return;
  const cfg = PK_CFG[d.risk];
  pk.pending = { left: d.balls.length, balance: d.balance, total: d.winAmount, totalBet: d.totalBet };
  d.balls.forEach((b, i) => setTimeout(() => {
    if (!pk) return;
    pk.flying.push({ path: b.path, slot: b.slot, mult: b.mult, win: b.win, rows: cfg.rows, t0: performance.now(), dur: cfg.rows * (pk.balls > 3 ? 95 : 120) + 200, jitter: (Math.random() - .5) * .3 });
  }, i * 220));
});
socket.on('casinoError', () => { if (pk?.busy && !pk.flying.length) { pk.busy = false; const b = document.getElementById('pk-drop'); if (b) b.disabled = false; } });

function pkLanded(ball) {
  pk.flash[ball.slot] = performance.now();
  cxSound.play(ball.mult >= 2 ? 'win' : 'tick');
  cxSetBalance(cxBalance() + ball.win, ball.win > 0);
  pk.last.unshift(ball.mult);
  pk.last = pk.last.slice(0, 16);
  document.getElementById('pk-last').innerHTML = pk.last.map(m => `<span class="${m >= 2 ? 'cx-pos' : m < 1 ? 'cx-neg' : ''}">${m}×</span>`).join('');
  if (ball.mult >= 26) cxBigWin({ amount: ball.win, bet: ball.win / ball.mult, tier: ball.mult >= 100 ? 'giga' : 'huge', title: `🎯 ${ball.mult}×` });
  pk.pending.left--;
  if (pk.pending.left <= 0) {
    cxSetBalance(pk.pending.balance, false);
    pk.busy = false;
    const btn = document.getElementById('pk-drop'); if (btn) btn.disabled = false;
    if (pk.auto) setTimeout(() => pk?.auto && pkDrop(), 500);
  }
}

function pkResize() {
  const cv = document.getElementById('pk-canvas');
  if (!cv) return;
  const w = cv.parentElement.getBoundingClientRect().width;
  if (!w) return;
  const h = Math.min(window.innerHeight * .72, w * 0.95);
  cv.style.height = h + 'px';
  cv.width = w * devicePixelRatio; cv.height = h * devicePixelRatio;
}
window.addEventListener('resize', () => { if (pk) pkResize(); });

function pkGeom() {
  const cv = document.getElementById('pk-canvas');
  const cfg = PK_CFG[pk.risk];
  const W = cv.width, H = cv.height, R = cfg.rows;
  const s = Math.min(W / (R + 3), (H * .86) / (R + 1));
  const top = H * .06 + s * .4;
  return { W, H, R, s, C: W / 2, top, rowY: r => top + r * s, binY: top + R * s + s * .1 };
}
function pkPosX(g, row, pos) { return g.C + (pos - row / 2) * g.s; }

function pkLoop() {
  const cv = document.getElementById('pk-canvas');
  if (!cv || !pk) return;
  if (cv.clientWidth && Math.abs(cv.width - cv.clientWidth * devicePixelRatio) > 2) pkResize();
  if (!cv.width) { pk.raf = requestAnimationFrame(pkLoop); return; }
  const ctx = cv.getContext('2d');
  const g = pkGeom(), cfg = PK_CFG[pk.risk], now = performance.now();
  ctx.clearRect(0, 0, g.W, g.H);
  // kołki
  for (let r = 0; r < g.R; r++) for (let k = 0; k < r + 3; k++) {
    const x = g.C + (k - (r + 2) / 2) * g.s, y = g.rowY(r);
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, g.s * .09), 0, Math.PI * 2);
    ctx.fillStyle = '#d9d4ff'; ctx.shadowColor = 'rgba(167,139,250,.8)'; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
  }
  // przegródki z mnożnikami
  const n = cfg.mults.length;
  for (let i = 0; i < n; i++) {
    const x = g.C + (i - g.R / 2) * g.s, w = g.s * .9, h = g.s * .7;
    const m = cfg.mults[i];
    const t = Math.min(1, Math.abs(i - (n - 1) / 2) / ((n - 1) / 2));
    const col = `hsl(${(1 - t) * 50 + t * -10}, 90%, ${45 + t * 10}%)`;
    const fl = pk.flash[i] ? Math.max(0, 1 - (now - pk.flash[i]) / 500) : 0;
    ctx.save(); ctx.translate(x, g.binY + h / 2 + fl * -6);
    ctx.fillStyle = col; ctx.globalAlpha = .85 + fl * .15;
    const rr = 6 * devicePixelRatio;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, rr) : ctx.rect(-w / 2, -h / 2, w, h); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#1a0d00'; ctx.font = `800 ${Math.max(8, g.s * (m >= 100 ? .26 : .3))}px Syne, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m + (m >= 100 ? '' : '×'), 0, 1);
    ctx.restore();
  }
  // kulki
  pk.flying = pk.flying.filter(b => {
    const p = (now - b.t0) / b.dur;
    const steps = b.rows + 1;
    const f = Math.min(p * steps, steps);
    const seg = Math.floor(f), fr = f - seg;
    // pozycje: przed rzędem 0 (start), po kolejnych rzędach
    const posAt = k => { let pos = 0; for (let i = 0; i < k; i++) if (b.path[i] === 'R') pos++; return pos; };
    let x, y;
    if (seg === 0) { x = g.C + b.jitter * g.s * .2; y = g.top - g.s * .9 + fr * g.s * .9 - g.s * .15; }
    else {
      const r0 = seg - 1, r1 = Math.min(seg, b.rows);
      const x0 = pkPosX(g, r0, posAt(r0)), x1 = r1 === b.rows ? g.C + (posAt(b.rows) - b.rows / 2) * g.s : pkPosX(g, r1, posAt(r1));
      const y0 = g.rowY(r0) - g.s * .15, y1 = r1 === b.rows ? g.binY + g.s * .2 : g.rowY(r1) - g.s * .15;
      x = x0 + (x1 - x0) * fr;
      y = y0 + (y1 - y0) * (fr * fr) - Math.sin(fr * Math.PI) * g.s * .35;
    }
    ctx.beginPath(); ctx.arc(x, y, g.s * .16, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, g.s * .16);
    bg.addColorStop(0, '#fff6d5'); bg.addColorStop(1, '#f5a623');
    ctx.fillStyle = bg; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
    if (p >= 1) { pkLanded(b); return false; }
    return true;
  });
  pk.raf = requestAnimationFrame(pkLoop);
}
document.addEventListener('cx-leave', e => { if (e.detail.game === 'pachinko' && pk) { cancelAnimationFrame(pk.raf); pk = null; } });
