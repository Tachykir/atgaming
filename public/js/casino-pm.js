// ══════════════════════════════════════════════════════════════
//  PANDORA'S MYSTERY — 5×4, 40 linii, Mystery Symbols (puszki Pandory)
// ══════════════════════════════════════════════════════════════
const PM_SYMS = ['Φ', 'Ψ', 'Σ', 'Ω', '🏺', '🦉', '🐍', '🔱', '👸', '🗝️', '👁️', '🎁'];
const PM_NAMES = ['Fi', 'Psi', 'Sigma', 'Omega', 'Amfora', 'Sowa Ateny', 'Wąż Meduzy', 'Trójząb', 'Pandora', 'Klucz (Wild)', 'Oko', 'Puszka'];
const PM_COLORS = ['#7aa7ff', '#3ff2a3', '#ff7ad9', '#ffb84d', '#d9a35c', '#c4b5fd', '#4ade80', '#4fe3ff', '#f0abfc', '#ffd36b', '#c084fc', '#a855f7'];
const PM = { WILD: 9, EYE: 10, BOX: 11 };
const PM_POOL_BASE = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10, 11, 11, 11, 11];
const PM_POOL_FREE = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 11, 11, 11];
const PM_LINES = [
  [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],
  [0,1,2,1,0],[1,2,3,2,1],[3,2,1,2,3],[2,1,0,1,2],
  [0,1,0,1,0],[1,0,1,0,1],[1,2,1,2,1],[2,1,2,1,2],[2,3,2,3,2],[3,2,3,2,3],
  [0,0,1,0,0],[1,1,0,1,1],[1,1,2,1,1],[2,2,1,2,2],[2,2,3,2,2],[3,3,2,3,3],
  [0,1,1,1,0],[1,0,0,0,1],[1,2,2,2,1],[2,1,1,1,2],[2,3,3,3,2],[3,2,2,2,3],
  [0,1,2,3,3],[3,2,1,0,0],[0,0,1,2,3],[3,3,2,1,0],
  [0,1,2,2,2],[3,2,1,1,1],[1,2,3,3,3],[2,1,0,0,0],
  [1,1,1,2,3],[2,2,2,1,0],[0,0,0,1,2],[3,3,3,2,1],
  [0,2,0,2,0],[3,1,3,1,3],
];
let pmKit = null;
let pmBoxes = {};          // 'c,r' → { mult, sticky, left, stage: 'box'|'open'|'revealed', shown }
let pmSticky = [];         // lepkie puszki z ostatniego wyniku (na czas kręcenia)
let pmFree = false;

const PM_BOX_HTML = '<div class="pm-box"><div class="pm-lid"><i></i></div><div class="pm-body"><b>?</b></div></div>';

function pmInjectCSS() {
  if (document.getElementById('casino-pm-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-pm-css';
  st.textContent = `
#screen-casino-pm .sk-machine { background:
  radial-gradient(90% 55% at 50% 0%, rgba(168,85,247,.32), transparent 65%),
  radial-gradient(60% 40% at 50% 100%, rgba(255,211,107,.12), transparent 70%),
  linear-gradient(180deg, #1f0a2e 0%, #12061c 55%, #07030b 100%); }
#screen-casino-pm .sk-marquee { background-image: repeating-linear-gradient(90deg, rgba(255,211,107,.18) 0 4px, transparent 4px 12px, rgba(255,211,107,.18) 12px 16px, transparent 16px 24px); }
#screen-casino-pm .sk-reels { background: linear-gradient(180deg, rgba(30,8,44,.8), rgba(6,2,10,.9)); border: 1px solid rgba(255,211,107,.28); box-shadow: inset 0 0 40px rgba(168,85,247,.18); }
#screen-casino-pm .sk-col { background: linear-gradient(180deg, rgba(168,85,247,.04), rgba(168,85,247,.11) 50%, rgba(168,85,247,.04)); }
.pm-let { font-family: 'Times New Roman', serif; font-weight: 700; font-size: 1.05em; }
.pm-box { position: relative; width: 1.1em; height: 1.02em; filter: drop-shadow(0 .06em .1em rgba(0,0,0,.7)); }
.pm-body { position: absolute; left: 5%; right: 5%; bottom: 0; height: 66%; border-radius: .07em; display: grid; place-items: center;
  background: linear-gradient(180deg, #6d28a8, #2e0b4a 80%); border: .045em solid #ffd36b;
  box-shadow: inset 0 0 .18em rgba(240,171,252,.7), 0 0 .25em rgba(233,168,255,.55); overflow: hidden; }
.pm-body::before { content: ''; position: absolute; inset: 18% 10%; border: .025em solid rgba(255,211,107,.55); border-radius: .04em; }
.pm-body::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,.35) 48%, transparent 60%); background-size: 260% 100%; animation: pmShine 2.6s linear infinite; }
.pm-body b { position: relative; z-index: 1; font: 800 .5em/1 'Syne', serif; color: #ffd36b; text-shadow: 0 0 .2em #ff7ad9, 0 0 .4em #a855f7; }
.pm-lid { position: absolute; left: 0; right: 0; top: 10%; height: 27%; border-radius: .08em .08em .03em .03em; transform-origin: 8% 100%; z-index: 2;
  background: linear-gradient(180deg, #8b3fd0, #43126b); border: .045em solid #ffd36b; box-shadow: 0 .03em .06em rgba(0,0,0,.6); }
.pm-lid i { position: absolute; top: -.13em; left: 50%; width: .2em; height: .13em; transform: translateX(-50%); border-radius: .08em .08em 0 0; background: linear-gradient(180deg, #fff3c4, #f5a623); }
@keyframes pmShine { to { background-position: -160% 0; } }
.sk-cell.pm-boxcell .sk-tile { background: radial-gradient(circle, rgba(168,85,247,.35), rgba(20,4,30,.6) 70%) !important; border-color: #ffd36b !important; animation: pmIdle 1.6s ease-in-out infinite alternate; }
@keyframes pmIdle { to { box-shadow: inset 0 0 22px rgba(240,171,252,.45), 0 0 18px rgba(233,168,255,.55); } }
.sk-cell.pm-charge .pm-box { animation: pmShake .09s linear infinite; }
.sk-cell.pm-charge .sk-tile { animation: pmCharge .5s ease-in infinite alternate !important; }
@keyframes pmShake { 0% { transform: translate(0,0) rotate(0); } 25% { transform: translate(-3%,1%) rotate(-3deg); } 50% { transform: translate(2%,-2%) rotate(2deg); } 75% { transform: translate(3%,1%) rotate(3deg); } }
@keyframes pmCharge { from { box-shadow: 0 0 10px rgba(233,168,255,.5); } to { box-shadow: 0 0 0 3px #ffd36b, 0 0 36px #f0abfc, inset 0 0 26px rgba(255,255,255,.4); filter: brightness(1.35); } }
.sk-cell.pm-open .pm-lid { animation: pmLid .5s cubic-bezier(.2,1.4,.4,1) forwards; }
.sk-cell.pm-open .pm-body b { animation: pmQ .4s ease-out forwards; }
@keyframes pmLid { 0% { transform: none; } 40% { transform: translateY(-75%) rotate(-28deg); } 100% { transform: translate(-30%, -140%) rotate(-70deg); opacity: 0; } }
@keyframes pmQ { to { transform: scale(2.6); opacity: 0; } }
.sk-cell.pm-revealed .sk-tile { animation: pmEmerge .55s cubic-bezier(.2,1.6,.4,1); box-shadow: 0 0 0 2px rgba(255,211,107,.85), 0 0 20px rgba(240,171,252,.65), inset 0 0 16px rgba(240,171,252,.35); }
@keyframes pmEmerge { 0% { transform: scale(.2) rotate(-12deg); filter: blur(4px) brightness(3); opacity: 0; } 70% { transform: scale(1.12); filter: brightness(1.6); opacity: 1; } 100% { transform: none; } }
.sk-cell.pm-revealed::before { display: block !important; content: ''; position: absolute; inset: 2%; border-radius: 20%; pointer-events: none; z-index: 0;
  background: radial-gradient(circle, rgba(255,211,107,.35), transparent 70%); }
.pm-mult { font-size: 12px !important; color: #fff !important; background: linear-gradient(180deg, #c026d3, #6b21a8) !important; border-color: #ffd36b !important; box-shadow: 0 0 10px rgba(240,171,252,.8); }
.pm-mult.hi { background: linear-gradient(180deg, #ffd36b, #f5a623) !important; color: #2a1600 !important; }
.pm-mult.pop { animation: pmBadge .45s cubic-bezier(.3,1.8,.5,1); }
@keyframes pmBadge { 0% { transform: scale(.2); } 60% { transform: scale(1.6); } }
.pm-lock { position: absolute; top: 4px; left: 4px; z-index: 3; font: 800 10px 'DM Mono', monospace; padding: 2px 5px; border-radius: 7px; background: rgba(0,0,0,.75); color: #f0abfc; border: 1px solid rgba(240,171,252,.6); }
.sk-cell.pm-stuck .sk-tile { box-shadow: 0 0 0 2px #f0abfc, 0 0 22px rgba(240,171,252,.85) !important; }
.pm-ov { position: absolute; z-index: 7; display: grid; place-items: center; pointer-events: none; border-radius: 18%;
  background: radial-gradient(circle, rgba(168,85,247,.45), rgba(20,4,30,.85) 72%); box-shadow: 0 0 0 2px #f0abfc, 0 0 26px rgba(240,171,252,.8); animation: pmOvPulse .6s ease-in-out infinite alternate; }
.pm-ov .sk-badge { font-size: 11px; }
@keyframes pmOvPulse { to { box-shadow: 0 0 0 3px #ffd36b, 0 0 36px rgba(240,171,252,1); } }
.pm-flash { position: absolute; inset: 0; z-index: 8; pointer-events: none; background: radial-gradient(circle at 50% 50%, rgba(255,255,255,.85), rgba(240,171,252,.45) 35%, transparent 70%); animation: pmFlash .7s ease-out forwards; }
@keyframes pmFlash { from { opacity: 1; } to { opacity: 0; } }
.pm-mm { position: absolute; left: 50%; top: 50%; z-index: 9; pointer-events: none; transform: translate(-50%,-50%); text-align: center; white-space: nowrap;
  font: 800 clamp(22px, 4.5vw, 46px)/1.05 'Syne', sans-serif; letter-spacing: .04em; color: #fff;
  background: linear-gradient(180deg, #fff, #f0abfc 45%, #a855f7); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 4px 0 #3b0764) drop-shadow(0 0 22px rgba(240,171,252,.95)); animation: pmMM 1.5s cubic-bezier(.2,1.3,.4,1) forwards; }
.pm-mm small { display: block; font-size: .38em; letter-spacing: .14em; -webkit-text-fill-color: #ffd36b; }
@keyframes pmMM { 0% { transform: translate(-50%,-50%) scale(.2); opacity: 0; } 25% { transform: translate(-50%,-50%) scale(1.1); opacity: 1; } 80% { transform: translate(-50%,-50%) scale(1); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.4); opacity: 0; } }
.sk-machine[data-scfx="pandora"] .sk-cell.scatter::before { inset: -6%; background: radial-gradient(circle, rgba(240,171,252,.55), rgba(168,85,247,.25) 50%, transparent 72%); filter: blur(4px); animation: scBreath 1.6s ease-in-out infinite; }
.pm-meter b { color: #f0abfc !important; }
.pm-meter.on { border-color: rgba(240,171,252,.6); box-shadow: 0 0 14px rgba(240,171,252,.3); }
@media (orientation: landscape) and (max-height: 540px) {
  .pm-mult { font-size: 9px !important; padding: 1px 4px !important; } .pm-lock { font-size: 8px; padding: 1px 3px; }
  .pm-info2 { display: none; }
}`;
  document.head.appendChild(st);
}

function pmFeatHTML() {
  return `<div class="sk-meter pm-meter" data-pm="meter"><div class="sk-meter-top"><span data-pm="lbl">🎁 Puszki odsłaniają wspólny symbol</span><b data-pm="val">×2–×10</b></div>
    <div style="font-size:11px;color:rgba(255,255,255,.72)" data-pm="sub">✨ Mystery Multiplier: ~1 na 12 spinów każda puszka dostaje ×2–×10</div></div>
    <div class="sk-meter pm-info2"><div class="sk-meter-top"><span>👁️ 3 / 4 / 5 Oczu</span><b>10 / 14 / 18 FS</b></div><div style="font-size:11px;color:rgba(255,255,255,.72)">W FS puszki ×2–×50 i lepkie przez 2 spiny</div></div>`;
}
function pmRenderMeter(res) {
  const root = pmKit?.root; if (!root) return;
  const m = root.querySelector('[data-pm="meter"]'); if (!m) return;
  m.classList.toggle('on', pmFree);
  root.querySelector('[data-pm="lbl"]').textContent = pmFree ? `🔒 Lepkie puszki: ${res?.sticky?.length || 0}` : '🎁 Puszki odsłaniają wspólny symbol';
  root.querySelector('[data-pm="val"]').textContent = pmFree ? '×2–×50' : '×2–×10';
  root.querySelector('[data-pm="sub"]').textContent = pmFree ? '🎁 Każda puszka ma gwarantowany mnożnik i zostaje na 2 kolejne spiny' : '✨ Mystery Multiplier: ~1 na 12 spinów każda puszka dostaje ×2–×10';
}

function pmMultBadge(m, pop) { return `<span class="sk-badge pm-mult${m >= 10 ? ' hi' : ''}${pop ? ' pop' : ''}">×${m}</span>`; }

// Nakładki lepkich puszek widoczne podczas kręcenia
function pmShowStickyOverlay(kit) {
  kit.root.querySelectorAll('.pm-ov').forEach(e => e.remove());
  const m = kit.$('machine'); if (!m || !pmSticky.length) return;
  for (const b of pmSticky) {
    const p = kit.cellCenter(b.c, b.r); const cell = kit.cell(b.c, b.r);
    if (!p || !cell) continue;
    const ov = document.createElement('div');
    ov.className = 'pm-ov';
    const sz = p.w * 0.88;
    ov.style.cssText = `left:${p.x - sz / 2}px;top:${p.y - sz / 2}px;width:${sz}px;height:${sz}px;font-size:${getComputedStyle(cell).fontSize}`;
    ov.innerHTML = `${PM_BOX_HTML}${pmMultBadge(b.mult)}<span class="pm-lock">🔒${b.left}</span>`;
    m.appendChild(ov);
  }
}

async function pmOpenBoxes(res, kit) {
  const boxes = res.boxes || [];
  if (!boxes.length) return;
  const cells = boxes.map(b => [b.c, b.r]);
  const th = kit.scTheme;
  // 1) Drżenie i świecenie
  cells.forEach(([c, r]) => kit.cell(c, r)?.classList.add('pm-charge'));
  cxSound.play('heartbeat');
  const chargeT = setInterval(() => cells.forEach(([c, r]) => { const p = kit.cellCenter(c, r); if (p && Math.random() < .5) kit.emit(p.x, p.y, Math.random() < .5 ? 'glyph' : 'smoke', 1, { spread: p.w / 3, scale: p.w / 110, colors: th.colors }); }), 90);
  if (res.mysteryMult) {
    const m = kit.$('machine');
    const el = document.createElement('div');
    el.className = 'pm-mm';
    el.innerHTML = '✨ MYSTERY MULTIPLIER ✨<small>KAŻDA PUSZKA DOSTAJE MNOŻNIK</small>';
    m.appendChild(el);
    cxSound.play('scwin');
    setTimeout(() => el.remove(), 1600);
    await kit.wait(kit.turbo ? 700 : 1300);
  } else await kit.wait(kit.turbo ? 260 : 750);
  clearInterval(chargeT);
  // 2) Otwarcie — wieczka podskakują, dym i światło
  cells.forEach(([c, r]) => { const e = kit.cell(c, r); if (e) { e.classList.remove('pm-charge'); e.classList.add('pm-open'); } });
  const m = kit.$('machine');
  const fl = document.createElement('div'); fl.className = 'pm-flash'; m.appendChild(fl); setTimeout(() => fl.remove(), 800);
  cxSound.play('feature'); cxSound.play('scatter', 3);
  cells.forEach(([c, r]) => {
    const p = kit.cellCenter(c, r); if (!p) return;
    const s = p.w / 70;
    kit.emit(p.x, p.y - p.w * .2, 'smoke', 6, { spread: p.w / 3, scale: s, colors: ['#c4b5fd', '#a855f7', '#f0abfc'] });
    kit.emit(p.x, p.y, 'star', 7, { spread: p.w / 3, scale: s * .8, speed: 1.3, colors: ['#fff', '#ffd36b', '#f0abfc'] });
    kit.emit(p.x, p.y, 'glyph', 3, { spread: p.w / 3, scale: s, colors: th.colors });
    kit.emit(p.x, p.y, 'ring', 1, { scale: s });
  });
  await kit.wait(kit.turbo ? 160 : 380);
  // 3) Symbol wyłania się — wszystkie naraz
  Object.values(pmBoxes).forEach(b => { b.stage = 'revealed'; });
  await kit.revealCells(res.finalGrid, cells, 'main', 0);
  cxSound.play('win');
  kit.msg(`🎁 Puszki Pandory odsłoniły: <b>${PM_SYMS[res.reveal]} ${PM_NAMES[res.reveal]}</b>`, 'feature');
  // 4) Mnożniki
  const withMult = boxes.filter(b => b.mult > 0);
  if (withMult.length) {
    const top = withMult.slice().sort((a, b) => b.mult - a.mult);
    const pops = new Set(top.slice(0, kit.turbo ? 2 : 5).map(b => b.c + ',' + b.r));
    const tasks = [];
    withMult.forEach((b, i) => {
      const k = b.c + ',' + b.r;
      tasks.push(new Promise(done => setTimeout(async () => {
        const el = kit.cell(b.c, b.r);
        if (el && !el.querySelector('.pm-mult')) el.insertAdjacentHTML('beforeend', pmMultBadge(b.mult, true));
        if (pmBoxes[k]) pmBoxes[k].shown = true;
        if (pops.has(k)) await kit.bigMult(b.mult, { c: b.c, r: b.r, label: 'MNOŻNIK' });
        else { const p = kit.cellCenter(b.c, b.r); if (p) kit.emit(p.x, p.y, 'star', 6, { spread: p.w / 3 }); cxSound.play('tick'); }
        done();
      }, i * (kit.turbo ? 40 : 110))));
    });
    await Promise.all(tasks);
  }
}

function initPMUI(table) {
  pmInjectCSS();
  pmBoxes = {}; pmSticky = []; pmFree = false;
  pmKit = new SlotKit({
    screenId: 'casino-pm', game: 'pandora_mystery', title: "Pandora's Mystery", icon: '🎁', subtitle: '5×4 · 40 linii · Mystery Symbols · mnożniki do ×50',
    theme: { a: '#e9a8ff', b: '#ffd36b' },
    cols: 5, rows: 4, event: 'casinoPMSpin', lineCount: 40, boardMaxWidth: '480px',
    randomSym: () => {
      const pool = pmKit && pmKit.free > 0 ? PM_POOL_FREE : PM_POOL_BASE;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    symHTML: i => {
      if (i === PM.BOX) return { html: PM_BOX_HTML, color: PM_COLORS[i], cls: 'special pm-boxcell' };
      if (i < 4) return { html: `<span class="pm-let">${PM_SYMS[i]}</span>`, tile: 'letter', color: PM_COLORS[i] };
      return { html: `<span class="sk-emo">${PM_SYMS[i]}</span>`, color: PM_COLORS[i], cls: i === PM.WILD ? 'wild' : i === PM.EYE ? 'scatter' : '' };
    },
    decorate(el, c, r, si) {
      const b = pmBoxes[c + ',' + r];
      if (!b) return;
      if (si === PM.BOX && b.sticky) {
        el.classList.add('pm-stuck');
        if (!el.querySelector('.pm-mult')) el.insertAdjacentHTML('beforeend', pmMultBadge(b.mult) + '<span class="pm-lock">🔒</span>');
      } else if (si !== PM.BOX && b.stage === 'revealed') {
        el.classList.add('pm-revealed');
        if (b.sticky) el.classList.add('pm-stuck');
        if (b.shown && b.mult && !el.querySelector('.pm-mult')) el.insertAdjacentHTML('beforeend', pmMultBadge(b.mult));
        if (pmFree && b.left > 0 && !el.querySelector('.pm-lock')) el.insertAdjacentHTML('beforeend', `<span class="pm-lock">🔒${b.left}</span>`);
      }
    },
    scatter: {
      is: i => i === PM.EYE, icon: '👁️', need: 3, fx: 'pandora',
      theme: { colors: ['#c084fc', '#ffd36b', '#f0abfc', '#ffffff'], glyphs: 'ΑΒΓΔΘΛΞΠΣΦΨΩ', land: [['glyph', 8], ['smoke', 5], ['ring', 1]], ant: 'smoke', win: [['glyph', 26], ['smoke', 12], ['star', 20], ['ring', 3]] },
    },
    features: pmFeatHTML,
    onSpinStart(kit) {
      // Pozycje lepkich puszek liczone przed startem bębnów
      if (pmFree && pmSticky.length) pmShowStickyOverlay(kit);
      kit.startSpin();
    },
    rules: [
      '40 linii, wygrane od lewej do prawej, min. 3 symbole (👸 Pandora i 🗝️ Klucz już od 2). 🗝️ Klucz (Wild) zastępuje każdy symbol poza 👁️ Okiem.',
      '🎁 Puszki Pandory lądują często, także w stosach. Po zatrzymaniu bębnów WSZYSTKIE puszki odsłaniają się jednocześnie jako ten sam losowy symbol (może to być też 🗝️ Wild). Dopiero potem liczone są linie.',
      '✨ Mystery Multiplier (gra podstawowa, ok. 1 na 12 spinów): każda odsłonięta puszka dostaje mnożnik ×2–×10. Mnożniki puszek na wygrywającej linii SUMUJĄ się i mnożą wygraną tej linii.',
      '👁️ 3 / 4 / 5 Oczu (Scatter) = 10 / 14 / 18 Free Spinów (także ponownie w trakcie bonusu).',
      '🎁 W Free Spinach każda puszka ma gwarantowany mnożnik ×2–×50 i jest LEPKA — zostaje na planszy przez 2 kolejne spiny (z tym samym mnożnikiem), odsłaniając się za każdym razem razem z resztą puszek.',
      'Maksymalna wygrana: 10 000× stawki.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      pmFree = res.mode === 'free';
      pmBoxes = {};
      (res.boxes || []).forEach(b => { pmBoxes[b.c + ',' + b.r] = { ...b, stage: 'box' }; });
      pmRenderMeter(res);
      await kit.stop(res.grid);
      kit.root.querySelectorAll('.pm-ov').forEach(e => e.remove());
      if (res.boxes?.length) await pmOpenBoxes(res, kit);
      else kit.grids.main = res.finalGrid;
      kit.showLineWins(res.winLines, PM_LINES);
      const multLines = res.winLines.filter(w => w.x);
      if (multLines.length && res.payout > 0) {
        res._msgSet = true;
        const best = Math.max(...multLines.map(w => w.x));
        kit.countMsg(`🎁 Mnożniki puszek (do ×${best}):`, res.payout, 'big');
      }
      if (res.freeSpinsAwarded) {
        await kit.scatterWin(res.scatter);
        await kit.splash(res.isFree ? `+${res.freeSpinsAwarded} FREE SPINS` : `${res.freeSpinsAwarded} FREE SPINS`, 'Puszki z mnożnikami ×2–×50 · lepkie przez 2 spiny', '👁️', '#e9a8ff');
        if (!res._msgSet) { kit.msg(`👁️ ${res.scatter.length} Oczy! <b>+${res.freeSpinsAwarded} Free Spinów</b>`, 'feature'); res._msgSet = res.payout === 0; }
        pmFree = true;
      }
      if (res.capped) { kit.msg(`🏆 Osiągnięto maksymalną wygraną <span class="amt">10 000× stawki</span>!`, 'big'); res._msgSet = true; }
      pmSticky = res.sticky || [];
      if (res.fsSummary) { pmFree = false; pmSticky = []; }
      pmRenderMeter(res);
      kit.banner(res.freeSpinsRemaining > 0 ? `👁️ FREE SPINS: <b>${res.freeSpinsRemaining}</b> · 🔒 lepkie puszki: <b>${pmSticky.length}</b>` : '', 'purple');
    },
    freeBetOf: res => res.bet,
  });
  pmKit.mount(table);
}
skBindResult('casinoPMResult', () => pmKit);
