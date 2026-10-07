// ══════════════════════════════════════════════════════════════
//  WILD DUEL — 5×4, 20 linii, Multiplier Wilds (mnożą się), Pojedynek, lepkie wildy w FS
// ══════════════════════════════════════════════════════════════
const WD_SYMS = ['💰', '🐎', '🥃', '🌵', 'A', 'K', 'Q', 'J', '🤠', '⭐'];
const WD_COLORS = ['#ffd36b', '#c97a3d', '#e8a33d', '#5fbf5a', '#ff5a3c', '#ff9f43', '#e8c07a', '#c9a27a', '#ff7a1a', '#ffd84a'];
const WD = { WILD: 8, STAR: 9 };
const WD_POOL = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 9];
const WD_LINES = [
  [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],
  [0,1,2,1,0],[3,2,1,2,3],[1,2,3,2,1],[2,1,0,1,2],
  [0,1,0,1,0],[1,0,1,0,1],[2,3,2,3,2],[3,2,3,2,3],
  [1,2,1,2,1],[2,1,2,1,2],[0,0,1,2,3],[3,3,2,1,0],
  [1,0,0,0,1],[2,3,3,3,2],[0,1,1,1,0],[3,2,2,2,3],
];
let wdKit = null;
let wdMult = {};       // "c,r" → mnożnik wyświetlany na wildzie
let wdSticky = [];     // lepkie wildy (FS): [{c,r,m}]
let wdFree = false;

// ── Style gry ─────────────────────────────────────────────────
function wdInjectCss() {
  if (document.getElementById('casino-wd-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-wd-css';
  st.textContent = `
#screen-casino-wd .sk-machine { background: radial-gradient(120% 80% at 50% 0%, #5a2a0e 0%, #2a1406 55%, #120802 100%); }
#screen-casino-wd .sk-machine::after { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  background: repeating-linear-gradient(90deg, rgba(255,190,120,.025) 0 2px, transparent 2px 9px); }
#screen-casino-wd .sk-reels { background: linear-gradient(180deg, rgba(40,18,4,.75), rgba(15,6,1,.85)); border-color: rgba(255,170,90,.18); }
#screen-casino-wd .sk-col { background: linear-gradient(180deg, rgba(255,200,140,.03), rgba(255,170,90,.08) 50%, rgba(255,200,140,.03)); }
#screen-casino-wd .sk-tile.letter { font-family: 'Rye', 'Syne', serif; }
#screen-casino-wd .sk-cell.wild .sk-tile { border-color: #ff9a3c; box-shadow: inset 0 0 18px rgba(255,140,40,.45), 0 0 16px rgba(255,120,30,.45); }
.wd-badge { position: absolute; left: 50%; bottom: 3%; transform: translateX(-50%); z-index: 4; font: 800 clamp(10px, 1.6vw, 15px)/1 'DM Mono', monospace;
  padding: 3px 7px; border-radius: 8px; color: #1a0a00; background: linear-gradient(180deg, #ffe7a3, #ffb347 55%, #e0701a); border: 1px solid #fff3c4;
  box-shadow: 0 2px 0 #6b2c00, 0 0 12px rgba(255,150,40,.7); white-space: nowrap; }
.wd-badge.hot { background: linear-gradient(180deg, #fff, #ff8a5c 50%, #d6261b); color: #fff; text-shadow: 0 1px 0 #600; box-shadow: 0 2px 0 #5a0000, 0 0 16px rgba(255,60,30,.9); }
.wd-badge.mega { background: linear-gradient(180deg, #fff, #ffd36b 40%, #ff3b3b); color: #2a0000; animation: wdBadgeGlow .6s ease-in-out infinite alternate; }
@keyframes wdBadgeGlow { to { box-shadow: 0 2px 0 #5a0000, 0 0 26px rgba(255,211,107,1); } }
.wd-badge.bump { animation: wdBump .5s cubic-bezier(.2,1.8,.4,1); }
@keyframes wdBump { 0% { transform: translateX(-50%) scale(.4); } 60% { transform: translateX(-50%) scale(1.6); } 100% { transform: translateX(-50%) scale(1); } }
.wd-pin { position: absolute; z-index: 5; pointer-events: none; display: grid; place-items: center; }
.wd-pin .sk-cell { width: 100%; height: 100%; }
.wd-shot { position: absolute; z-index: 8; height: 4px; transform-origin: 0 50%; pointer-events: none; border-radius: 4px;
  background: linear-gradient(90deg, rgba(255,240,200,0), #fff3c4 30%, #ffb347 70%, #ff3b1a); box-shadow: 0 0 10px #ffb347, 0 0 22px #ff5a1a; }
.wd-muzzle { position: absolute; z-index: 9; width: 60px; height: 60px; margin: -30px 0 0 -30px; pointer-events: none; border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, #ffe28a 25%, #ff7a1a 55%, transparent 70%); animation: wdMuzzle .28s ease-out forwards; }
@keyframes wdMuzzle { from { transform: scale(.2); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
.wd-duel-title { position: absolute; left: 50%; top: 46%; z-index: 10; transform: translate(-50%, -50%); pointer-events: none; text-align: center;
  font: 800 clamp(30px, 7vw, 70px)/1 'Rye', 'Syne', serif; letter-spacing: .04em; color: #ffe7a3; white-space: nowrap;
  text-shadow: 0 4px 0 #6b2c00, 0 0 24px #ff7a1a, 0 0 60px #ff3b1a; animation: wdDuelIn .5s cubic-bezier(.2,1.6,.4,1); }
.wd-duel-title small { display: block; font: 700 clamp(11px, 1.8vw, 16px)/1.3 'Syne', sans-serif; letter-spacing: .14em; color: #fff; text-shadow: 0 2px 6px #000; margin-top: 6px; white-space: normal; }
.wd-duel-title.out { animation: wdDuelOut .35s ease-in forwards; }
@keyframes wdDuelIn { from { transform: translate(-50%, -50%) scale(2.4); opacity: 0; filter: blur(6px); } }
@keyframes wdDuelOut { to { transform: translate(-50%, -50%) scale(.6); opacity: 0; } }
#screen-casino-wd .sk-cell.wd-duelist .sk-tile { animation: wdAim .18s ease-in-out infinite alternate; box-shadow: 0 0 0 3px #ffb347, 0 0 30px #ff5a1a !important; }
@keyframes wdAim { from { transform: rotate(-4deg) scale(1.04); } to { transform: rotate(4deg) scale(1.1); } }
#screen-casino-wd .sk-cell.wd-hitcell { animation: wdHit .45s ease-out; }
@keyframes wdHit { 0%,100% { transform: none; } 20% { transform: translateX(-8%) rotate(-8deg); filter: brightness(2); } 50% { transform: translateX(6%) rotate(5deg); } 75% { transform: translateX(-3%); } }
.wd-sheriff { display: flex; gap: 8px; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 700; color: rgba(255,230,190,.85); }
.wd-sheriff b { font-family: 'DM Mono', monospace; color: #ffb347; }
.wd-chips { display: flex; gap: 4px; flex-wrap: nowrap; }
.wd-chips span { font: 800 10px/1 'DM Mono', monospace; padding: 3px 5px; border-radius: 6px; background: rgba(255,150,40,.14); border: 1px solid rgba(255,150,40,.35); color: #ffd39a; }
.wd-chips span.r { color: #fff; background: rgba(255,60,30,.3); border-color: rgba(255,90,60,.6); }
@media (max-height: 500px) and (orientation: landscape) { .wd-chips { display: none; } .wd-duel-title { font-size: 34px; } }
`;
  document.head.appendChild(st);
}

// ── Dźwięk wystrzału (WebAudio, szum + niski „bum”) ─────────────
let wdAC = null;
function wdShotSound(vol = 1, delay = 0) {
  if (cxSound.muted) return;
  try {
    wdAC = wdAC || new (window.AudioContext || window.webkitAudioContext)();
    const a = wdAC, t = a.currentTime + delay;
    const len = Math.floor(a.sampleRate * 0.35);
    const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = a.createBufferSource(); src.buffer = buf;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(380, t + .3);
    const g = a.createGain(); g.gain.setValueAtTime(.32 * vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .34);
    src.connect(lp); lp.connect(g); g.connect(a.destination); src.start(t);
    const o = a.createOscillator(), og = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .18);
    og.gain.setValueAtTime(.35 * vol, t); og.gain.exponentialRampToValueAtTime(.0001, t + .2);
    o.connect(og); og.connect(a.destination); o.start(t); o.stop(t + .22);
  } catch (e) {}
}

function wdSymHTML(i) {
  if (i >= 4 && i <= 7) return { html: `<span>${WD_SYMS[i]}</span>`, tile: 'letter', color: WD_COLORS[i] };
  return { html: `<span class="sk-emo">${WD_SYMS[i]}</span>`, color: WD_COLORS[i], cls: i === WD.WILD ? 'wild' : i === WD.STAR ? 'scatter' : '' };
}
function wdBadgeCls(m) { return m >= 25 ? 'mega' : m >= 10 ? 'hot' : ''; }
function wdSetBadge(kit, c, r, m, bump = true) {
  wdMult[c + ',' + r] = m;
  const el = kit.cell(c, r);
  if (!el) return;
  let b = el.querySelector('.wd-badge');
  if (!b) { el.insertAdjacentHTML('beforeend', '<span class="wd-badge"></span>'); b = el.querySelector('.wd-badge'); }
  b.className = 'wd-badge ' + wdBadgeCls(m);
  b.textContent = '×' + m;
  if (bump) { void b.offsetWidth; b.classList.add('bump'); }
}

// Smuga pocisku między dwoma komórkami (współrzędne względem automatu)
function wdShot(kit, from, to, { dur = 220, color } = {}) {
  const m = kit.$('machine');
  const a = kit.cellCenter(from[0], from[1]), b = kit.cellCenter(to[0], to[1]);
  if (!m || !a || !b) return Promise.resolve();
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const s = document.createElement('div');
  s.className = 'wd-shot';
  if (color) s.style.background = color;
  s.style.left = a.x + 'px'; s.style.top = (a.y - 2) + 'px'; s.style.width = len + 'px';
  s.style.transform = `rotate(${Math.atan2(dy, dx)}rad) scaleX(0)`;
  m.appendChild(s);
  const mz = document.createElement('div'); mz.className = 'wd-muzzle'; mz.style.left = a.x + 'px'; mz.style.top = a.y + 'px'; m.appendChild(mz);
  setTimeout(() => mz.remove(), 320);
  kit.emit(a.x, a.y, 'spark', 14, { spread: 8, colors: ['#fff3c4', '#ffb347', '#ff5a1a'], speed: 1.3 });
  kit.emit(a.x, a.y, 'smoke', 4, { spread: 6, colors: ['#d8c3a5', '#8a7560'] });
  wdShotSound(.8);
  const d = kit.turbo ? Math.min(120, dur) : dur;
  s.animate([{ transform: `rotate(${Math.atan2(dy, dx)}rad) scaleX(0)`, opacity: 1 }, { transform: `rotate(${Math.atan2(dy, dx)}rad) scaleX(1)`, opacity: 1 }, { transform: `rotate(${Math.atan2(dy, dx)}rad) scaleX(1)`, opacity: 0 }],
    { duration: d * 2.2, easing: 'ease-out', fill: 'forwards' });
  return new Promise(res => setTimeout(() => {
    kit.emit(b.x, b.y, 'spark', 22, { spread: b.w / 4, colors: ['#fff', '#ffd36b', '#ff7a1a'], speed: 1.6 });
    kit.emit(b.x, b.y, 'ember', 14, { spread: b.w / 3, colors: ['#ff7a1a', '#ffb347', '#ff3b1a'] });
    kit.emit(b.x, b.y, 'ring', 1, { scale: b.w / 60, colors: ['#ffb347'] });
    const el = kit.cell(to[0], to[1]);
    if (el) { el.classList.remove('wd-hitcell'); void el.offsetWidth; el.classList.add('wd-hitcell'); }
    setTimeout(() => s.remove(), d * 1.4);
    res();
  }, d));
}

// Lepkie wildy wyświetlane nad kręcącymi się bębnami
function wdPinSticky(kit) {
  wdUnpin(kit);
  if (!wdSticky.length) return;
  const b = kit.board('main');
  const br = b.el.getBoundingClientRect();
  for (const s of wdSticky) {
    const cell = kit.cell(s.c, s.r); if (!cell) continue;
    const cr = cell.getBoundingClientRect();
    const p = document.createElement('div');
    p.className = 'wd-pin';
    p.style.left = (cr.left - br.left) + 'px'; p.style.top = (cr.top - br.top) + 'px';
    p.style.width = cr.width + 'px'; p.style.height = cr.height + 'px';
    p.style.fontSize = getComputedStyle(cell).fontSize;
    const sh = wdSymHTML(WD.WILD);
    p.innerHTML = `<div class="sk-cell wild sticky">${kit.cellInner(sh)}<span class="wd-badge ${wdBadgeCls(s.m)}">×${s.m}</span></div>`;
    b.el.appendChild(p);
  }
}
function wdUnpin(kit) { kit.board('main').el.querySelectorAll('.wd-pin').forEach(e => e.remove()); }

function wdFeatures() {
  return `<div class="sk-meter"><div class="wd-sheriff"><span>🤠 Wildy z mnożnikiem — na linii <b>MNOŻĄ</b> się</span>
    <span class="wd-chips"><span>×2</span><span>×3</span><span>×5</span><span>×10</span><span class="r">×25</span><span class="r">×100</span></span></div></div>
    <div class="sk-meter" style="flex:.7"><div class="wd-sheriff"><span data-wd="mode">⚔️ Wildy na 1. i 5. bębnie = POJEDYNEK</span><b data-wd="info">×2</b></div></div>`;
}
function wdSetMeter(kit, mode, info) {
  const a = kit.root.querySelector('[data-wd="mode"]'), b = kit.root.querySelector('[data-wd="info"]');
  if (a) a.innerHTML = mode; if (b) b.innerHTML = info;
}
function wdFsBanner(kit, res) {
  if (res.freeSpinsRemaining > 0) {
    const top = wdSticky.reduce((m, s) => Math.max(m, s.m), 0);
    kit.banner(`⭐ FREE SPINS: <b>${res.freeSpinsRemaining}</b> · lepkie wildy: <b>${wdSticky.length}</b>${top ? ` · najwyższy ×${top}` : ''} · +1 co spin`, 'gold');
    wdSetMeter(kit, '📌 Lepkie wildy rosną o +1 co spin', wdSticky.length ? `${wdSticky.length} 🤠` : '—');
  } else {
    kit.banner('');
    wdSetMeter(kit, '⚔️ Wildy na 1. i 5. bębnie = POJEDYNEK', '×2');
  }
}

// ── Pojedynek ─────────────────────────────────────────────────
async function wdDuel(kit, duel) {
  const m = kit.$('machine');
  const A = [duel.a.c, duel.a.r], B = [duel.b.c, duel.b.r];
  const win = duel.winner === 'a' ? A : B, lose = duel.winner === 'a' ? B : A;
  const T = kit.turbo ? .45 : 1;
  kit.board('main').el.classList.add('dim');
  [A, B].forEach(([c, r]) => kit.cell(c, r)?.classList.add('hit', 'wd-duelist'));
  const title = document.createElement('div');
  title.className = 'wd-duel-title';
  title.innerHTML = `⚔️ POJEDYNEK ⚔️<small>×${duel.a.m} kontra ×${duel.b.m} — zwycięzca podwaja mnożnik</small>`;
  m.appendChild(title);
  cxSound.play('feature');
  kit.msg('⚔️ <b>POJEDYNEK!</b> Rewolwerowcy na 1. i 5. bębnie stają naprzeciw siebie…', 'feature');
  // Wiatr pustyni + bicie serca
  const mr = m.getBoundingClientRect();
  const sand = setInterval(() => kit.emit(Math.random() * 30, mr.height * (.3 + Math.random() * .5), 'sand', 6, { spread: 10, colors: ['#e8c07a', '#c9a27a', '#ffd39a'], speed: 1.8 }), 90);
  for (let i = 0; i < 3; i++) { cxSound.play('heartbeat'); await kit.wait(520 * T); }
  clearInterval(sand);
  title.classList.add('out'); setTimeout(() => title.remove(), 360);
  // Pudło przegranego, trafienie zwycięzcy
  await wdShot(kit, lose, [win[0], Math.max(0, Math.min(3, win[1] + (win[1] >= 2 ? -1 : 1)))], { dur: 160, color: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(200,200,200,.6))' });
  await kit.wait(160 * T);
  await wdShot(kit, win, lose, { dur: 200 });
  wdShotSound(1.2, .05);
  const lp = kit.cellCenter(lose[0], lose[1]);
  if (lp) kit.emit(lp.x, lp.y, 'smoke', 10, { spread: lp.w / 3, colors: ['#bfa58a', '#6b5a48'] });
  kit.cell(lose[0], lose[1])?.classList.remove('wd-duelist');
  kit.cell(lose[0], lose[1])?.animate([{ filter: 'grayscale(0)' }, { filter: 'grayscale(1) brightness(.6)' }, { filter: 'grayscale(0)' }], { duration: 1200 * T });
  m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake');
  await kit.wait(250 * T);
  wdSetBadge(kit, win[0], win[1], duel.after);
  kit.cell(win[0], win[1])?.classList.remove('wd-duelist');
  await kit.bigMult(duel.after, { c: win[0], r: win[1], label: 'ZWYCIĘZCA ×2' });
  kit.msg(`⚔️ Pojedynek wygrywa rewolwerowiec z ${win[0] === 0 ? '1.' : '5.'} bębna: <b>×${duel.before} → ×${duel.after}</b>`, 'feature');
  kit.clearWins();
}

// ── Strzelanie wildów na linii: mnożniki się mnożą ────────────
async function wdLineShoot(kit, w) {
  const ws = w.wilds.slice().sort((a, b) => a.c - b.c);
  if (ws.length >= 2) {
    let prod = ws[0].m;
    kit.highlight(w.cells, 'main', true, false);
    kit.drawLine(w.cells.slice().sort((a, b) => a[0] - b[0]), SK_LINE_COLORS[w.li % SK_LINE_COLORS.length]);
    for (let i = 1; i < ws.length; i++) {
      await wdShot(kit, [ws[i - 1].c, ws[i - 1].r], [ws[i].c, ws[i].r], { dur: 200 });
      prod *= ws[i].m;
      const el = kit.cell(ws[i].c, ws[i].r)?.querySelector('.wd-badge');
      if (el) { el.textContent = '×' + prod; el.className = 'wd-badge bump ' + wdBadgeCls(prod); }
      await kit.wait(kit.turbo ? 60 : 160);
    }
    const last = ws[ws.length - 1];
    await kit.bigMult(w.mult, { c: last.c, r: last.r, label: ws.map(x => '×' + x.m).join(' · ') });
    ws.forEach(x => { const el = kit.cell(x.c, x.r)?.querySelector('.wd-badge'); if (el) { el.textContent = '×' + x.m; el.className = 'wd-badge ' + wdBadgeCls(x.m); } });
    kit.clearWins();
  } else if (ws.length === 1 && w.mult >= 10) {
    await kit.bigMult(w.mult, { c: ws[0].c, r: ws[0].r, label: 'MNOŻNIK' });
  }
}

function initWDUI(table) {
  wdInjectCss();
  wdMult = {}; wdSticky = []; wdFree = false;
  wdKit = new SlotKit({
    screenId: 'casino-wd', game: 'wild_duel', title: 'Wild Duel', icon: '🤠', subtitle: '5×4 · 20 linii · wildy ×2–×100 mnożą się · Pojedynek',
    theme: { a: '#ff9a3c', b: '#ff3b1a' },
    cols: 5, rows: 4, event: 'casinoWDSpin', lineCount: 20, boardMaxWidth: '480px',
    randomSym: () => WD_POOL[Math.floor(Math.random() * WD_POOL.length)],
    symHTML: wdSymHTML,
    scatter: {
      is: i => i === WD.STAR, icon: '⭐', need: 3, fx: 'desert',
      theme: { colors: ['#ffd84a', '#ff9a3c', '#ff3b1a', '#fff3c4'], land: [['spark', 16], ['ember', 10], ['ring', 1]], ant: 'ember', win: [['ember', 40], ['spark', 26], ['smoke', 6], ['ring', 2]] },
    },
    decorate(el, c, r, si) {
      if (si !== WD.WILD) return;
      const m = wdMult[c + ',' + r];
      if (m && !el.querySelector('.wd-badge')) el.insertAdjacentHTML('beforeend', `<span class="wd-badge ${wdBadgeCls(m)}">×${m}</span>`);
      if (wdFree && wdSticky.some(s => s.c === c && s.r === r)) el.classList.add('sticky');
    },
    features: wdFeatures,
    onSpinStart(kit) {
      wdMult = {};
      kit.startSpin();
      if (wdFree && wdSticky.length) wdPinSticky(kit);
    },
    rules: [
      '20 linii, wygrane od lewej, min. 3 takie same symbole. 🤠 Rewolwerowiec (Wild) zastępuje każdy symbol poza ⭐.',
      '🤠 Każdy wild ląduje z mnożnikiem ×2, ×3, ×5, ×10, ×25 lub ×100 (wyższe są rzadsze).',
      'Na linii wygrywającej mnożniki wszystkich wildów MNOŻĄ SIĘ ze sobą — np. ×5 i ×10 dają ×50.',
      '⚔️ POJEDYNEK (gra podstawowa): gdy wildy wylądują na 1. i 5. bębnie, rewolwerowcy strzelają się — zwycięzca podwaja swój mnożnik.',
      '⭐ 3 / 4 / 5 Gwiazd Szeryfa = 10 / 12 / 15 Free Spinów. W Free Spinach każdy wild jest LEPKI — zostaje do końca serii, a jego mnożnik rośnie o +1 przy każdym kolejnym spinie. 3+ ⭐ w trakcie = +5 spinów.',
      'Maksymalna wygrana: 10 000× stawki (spin lub cała seria Free Spinów).',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      // Mnożniki przed animacjami (pojedynek pokazuje wartość sprzed podwojenia, lepkie — sprzed wzrostu)
      wdMult = {};
      res.wilds.forEach(w => { wdMult[w.c + ',' + w.r] = w.m; });
      if (res.duel) { const d = res.duel; wdMult[d.a.c + ',' + d.a.r] = d.a.m; wdMult[d.b.c + ',' + d.b.r] = d.b.m; }
      (res.grown || []).forEach(g => { wdMult[g.c + ',' + g.r] = g.from; });
      await kit.stop(res.grid);
      wdUnpin(kit);
      wdFree = res.isFree;
      // Lądowanie nowych wildów: wystrzał w powietrze
      const nw = res.newWilds || [];
      nw.forEach((w, i) => setTimeout(() => {
        const p = kit.cellCenter(w.c, w.r); if (!p) return;
        kit.emit(p.x, p.y - p.w * .3, 'spark', 12, { spread: p.w / 4, colors: ['#fff3c4', '#ffb347'] });
        kit.emit(p.x, p.y, 'smoke', 3, { spread: p.w / 4, colors: ['#d8c3a5', '#8a7560'] });
        wdShotSound(.5);
        wdSetBadge(kit, w.c, w.r, wdMult[w.c + ',' + w.r]);
      }, i * (kit.turbo ? 50 : 140)));
      if (nw.length) await kit.wait(nw.length * (kit.turbo ? 50 : 140) + 200);
      // FS: lepkie wildy rosną o +1
      if (res.grown?.length) {
        cxSound.play('chip');
        res.grown.forEach((g, i) => setTimeout(() => {
          wdSetBadge(kit, g.c, g.r, g.m);
          const p = kit.cellCenter(g.c, g.r);
          if (p) { kit.emit(p.x, p.y, 'ember', 10, { spread: p.w / 3 }); kit.emit(p.x, p.y + p.w * .3, 'star', 4, { spread: 6, colors: ['#ffd36b'] }); }
        }, i * (kit.turbo ? 30 : 90)));
        await kit.wait(res.grown.length * (kit.turbo ? 30 : 90) + 350);
        kit.msg(`📌 Lepkie wildy rosną: <b>+1</b> do mnożnika (${res.grown.length})`, 'feature');
      }
      if (res.isFree) {
        wdSticky = res.wilds.map(w => ({ c: w.c, r: w.r, m: w.m }));
        res.wilds.forEach(w => kit.cell(w.c, w.r)?.classList.add('sticky'));
      }
      if (res.duel) await wdDuel(kit, res.duel);
      // Linie z mnożnikami: wildy strzelają do siebie
      const multi = res.winLines.filter(w => w.wilds?.length >= 2 || w.mult >= 10).sort((a, b) => b.mult - a.mult).slice(0, kit.turbo ? 1 : 3);
      for (const w of multi) await wdLineShoot(kit, w);
      kit.showLineWins(res.winLines, WD_LINES);
      if (res.capped) kit.msg('🏆 <b>MAKSYMALNA WYGRANA 10 000×</b>', 'big');
      if (res.freeSpinsAwarded) {
        await kit.scatterWin(res.scatter);
        if (res.isFree) await kit.splash(`+${res.freeSpinsAwarded} FREE SPINS`, 'Lepkie wildy zostają na planszy!', '⭐', '#ff9a3c');
        else await kit.splash(`${res.freeSpinsAwarded} FREE SPINS`, 'Każdy wild jest LEPKI i rośnie o +1 co spin', '⭐', '#ff9a3c');
        kit.msg(`⭐ <b>+${res.freeSpinsAwarded} Free Spinów</b> · lepkie wildy z rosnącymi mnożnikami`, 'feature');
        res._msgSet = res.payout === 0;
      }
      if (res.fsSummary) { wdSticky = []; wdFree = false; }
      wdFsBanner(kit, res);
    },
    freeBetOf: res => res.bet,
  });
  wdKit.mount(table);
}
skBindResult('casinoWDResult', () => wdKit);
