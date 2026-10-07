// ══════════════════════════════════════════════════════════════
//  ALCHEMY LAB — 5×4, 30 linii, ⚗️ Mikstury transmutują symbole poziom wyżej
// ══════════════════════════════════════════════════════════════
const AL_SYMS = ['🪨', '🥉', '🥈', '🥇', '💎', '⚗️', '🔮'];
const AL_NAMES = ['Kamień', 'Brąz', 'Srebro', 'Złoto', 'Diament', 'Mikstura', 'Kamień Filozoficzny'];
const AL_COLORS = ['#9aa3ad', '#d08a4a', '#d9e2ec', '#ffd36b', '#4fe3ff', '#5effa9', '#c084fc'];
const AL = { POTION: 5, SC: 6, TOP: 4, FS_START_FLOOR: 1 };
const AL_W = [10, 9, 8, 6, 4];
const AL_LINES = [
  [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[0,1,2,1,0],
  [3,2,1,2,3],[1,2,3,2,1],[2,1,0,1,2],[0,1,0,1,0],[1,0,1,0,1],
  [2,3,2,3,2],[3,2,3,2,3],[1,2,1,2,1],[2,1,2,1,2],[0,0,1,0,0],
  [3,3,2,3,3],[1,1,0,1,1],[2,2,3,2,2],[0,1,1,1,0],[3,2,2,2,3],
  [1,0,0,0,1],[2,3,3,3,2],[0,0,1,2,3],[3,3,2,1,0],[1,2,2,2,1],
  [2,1,1,1,2],[0,2,0,2,0],[3,1,3,1,3],[1,3,1,3,1],[2,0,2,0,2],
];
const AL_FX = ['#5effa9', '#ffd36b', '#b07bff', '#ffffff'];
let alKit = null, alFloor = 0, alInFs = false;

function alCss() {
  if (document.getElementById('casino-al-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-al-css';
  st.textContent = `
#screen-casino-al .sk-machine { background: radial-gradient(ellipse at 50% 110%, rgba(94,255,169,.22), transparent 60%), radial-gradient(ellipse at 10% 0%, rgba(176,123,255,.2), transparent 50%), linear-gradient(160deg, #0b2a1f, #06140f 60%, #040c09); box-shadow: 0 0 0 3px rgba(94,255,169,.4), 0 0 0 6px rgba(255,211,107,.18), 0 0 46px rgba(94,255,169,.25); }
#screen-casino-al .sk-logo { color: #eafff3; text-shadow: 0 0 8px #5effa9, 0 0 22px #2fbf7a; }
.al-meter { flex: 3; min-width: 260px; }
.al-ladder { display: flex; align-items: center; gap: 3px; }
.al-ladder i { color: #5effa9; font-style: normal; opacity: .6; font-size: 11px; }
.al-step { position: relative; flex: 1; text-align: center; padding: 3px 2px; border-radius: 10px; background: rgba(0,0,0,.4); border: 1px solid rgba(94,255,169,.25); transition: transform .25s, box-shadow .25s, border-color .25s; }
.al-step span { display: block; font-size: clamp(15px, 2.4vw, 24px); line-height: 1.15; transition: filter .3s; }
.al-step small { display: block; font: 700 9px 'Syne', sans-serif; color: rgba(255,255,255,.7); white-space: nowrap; }
.al-step.act { border-color: #5effa9; box-shadow: 0 0 16px #5effa9, inset 0 0 10px rgba(94,255,169,.4); transform: scale(1.1); z-index: 1; }
.al-step.gone span { filter: grayscale(1) brightness(.45); }
.al-step.gone small { color: #ff7a93; text-decoration: line-through; }
.al-step.gone::after { content: ''; position: absolute; left: 6%; right: 6%; top: 46%; height: 3px; border-radius: 3px; background: #ff4d6d; transform: rotate(-20deg); box-shadow: 0 0 8px #ff4d6d; animation: alStrike .45s ease-out both; }
@keyframes alStrike { from { transform: rotate(-20deg) scaleX(0); } to { transform: rotate(-20deg) scaleX(1); } }
.sk-cell.al-brew .sk-tile { animation: alBrew .3s ease-in-out infinite alternate !important; box-shadow: 0 0 0 2px #5effa9, 0 0 34px #5effa9, inset 0 0 20px rgba(94,255,169,.6) !important; }
@keyframes alBrew { from { transform: rotate(-7deg) scale(1.02); } to { transform: rotate(7deg) scale(1.14); } }
.sk-cell.al-new .sk-tile { box-shadow: 0 0 0 2px #ffd36b, 0 0 22px rgba(255,211,107,.7) !important; }
.al-beams { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 7; overflow: visible; }
.al-beams path { fill: none; stroke-linecap: round; }
.al-beams path.core { stroke: #f2fff8; stroke-width: 2.5; }
.al-beams path.glow { stroke: #5effa9; stroke-width: 9; opacity: .55; filter: blur(3px); }
.al-fsbadge { font: 800 11px 'Syne', sans-serif; color: #b07bff; }
@media (max-height: 500px), (max-width: 600px) {
  .al-meter { padding: 4px 8px; }
  .al-meter .sk-meter-top { margin-bottom: 2px; font-size: 10px; }
  .al-step { padding: 1px; border-radius: 7px; }
  .al-step small { display: none; }
  .al-step span { font-size: 15px; }
}`;
  document.head.appendChild(st);
}

function alSymHTML(i) {
  return { html: `<span class="sk-emo">${AL_SYMS[i]}</span>`, color: AL_COLORS[i], cls: i === AL.POTION ? 'wild' : i === AL.SC ? 'scatter' : i === AL.TOP ? 'special' : '' };
}
function alRandom() {
  const r = Math.random();
  if (r < .03) return AL.SC;
  if (r < .07) return AL.POTION;
  const pool = []; for (let l = alFloor; l <= AL.TOP; l++) for (let k = 0; k < AL_W[l]; k++) pool.push(l);
  return pool[Math.floor(Math.random() * pool.length)];
}
function alLadderHTML() {
  return `<div class="sk-meter al-meter"><div class="sk-meter-top"><span>⚗️ Drabina transmutacji</span><b data-al="state">Mikstura = poziom wyżej</b></div>
    <div class="al-ladder">${AL_SYMS.slice(0, 5).map((e, i) => `${i ? '<i>➜</i>' : ''}<div class="al-step" data-al-lv="${i}"><span>${e}</span><small>${AL_NAMES[i]}</small></div>`).join('')}</div></div>`;
}
function alLadder(floor, kit = alKit) {
  if (!kit?.root) return;
  kit.root.querySelectorAll('.al-step').forEach(el => { const lv = +el.dataset.alLv; el.classList.toggle('gone', lv < floor); el.classList.remove('act'); });
  const s = kit.root.querySelector('[data-al="state"]');
  if (s) s.innerHTML = floor > 0 ? `<span class="al-fsbadge">FS: pula od ${AL_SYMS[floor]} ${AL_NAMES[floor]}</span>` : 'Mikstura = poziom wyżej';
}
function alLadderAct(levels, kit) {
  kit.root.querySelectorAll('.al-step').forEach(el => el.classList.toggle('act', levels.includes(+el.dataset.alLv)));
}

// Strumień mikstury: świecący łuk od mikstury do celu
function alBeams(kit, from, targets, ms) {
  const m = kit.$('machine');
  const mr = m.getBoundingClientRect();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'al-beams');
  svg.setAttribute('viewBox', `0 0 ${mr.width} ${mr.height}`);
  m.appendChild(svg);
  targets.forEach((t, i) => {
    const dx = t.x - from.x, dy = t.y - from.y, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(90, len * .35) * (i % 2 ? 1 : -1);
    const cx = (from.x + t.x) / 2 - dy / len * bend, cy = (from.y + t.y) / 2 + dx / len * bend - len * .15;
    const d = `M${from.x},${from.y} Q${cx},${cy} ${t.x},${t.y}`;
    for (const cls of ['glow', 'core']) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d); p.setAttribute('class', cls);
      svg.appendChild(p);
      const L = p.getTotalLength();
      p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
      p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: ms, delay: i * 25, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    }
  });
  setTimeout(() => { svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }); setTimeout(() => svg.remove(), 320); }, ms + targets.length * 25 + 250);
}

function alFlip(kit, c, r, si) {
  const el = kit.cell(c, r);
  kit.grids.main[c][r] = si;
  if (!el) return;
  const t = kit.turbo ? .6 : 1;
  el.animate([{ transform: 'rotateY(0) scale(1)' }, { transform: 'rotateY(90deg) scale(1.15)' }], { duration: 150 * t, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
    const s = kit.cellHTML(si);
    el.className = 'sk-cell al-new ' + (s.cls || '');
    el.innerHTML = kit.cellInner(s);
    el.getAnimations().forEach(a => a.cancel());
    el.animate([{ transform: 'rotateY(-90deg) scale(1.3)', filter: 'brightness(3)' }, { transform: 'rotateY(0) scale(1)', filter: 'brightness(1)' }], { duration: 260 * t, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    const p = kit.cellCenter(c, r);
    if (p) {
      kit.emit(p.x, p.y, 'bubble', 3, { spread: p.w / 3, scale: p.w / 80, colors: ['#5effa9', '#bfffe0'] });
      kit.emit(p.x, p.y, 'spark', 4, { spread: p.w / 4, colors: [AL_COLORS[si], '#fff'] });
      if (Math.random() < .3) kit.emit(p.x, p.y, 'glyph', 1, { spread: 4, scale: p.w / 90 });
    }
  };
}

async function alStep(st, kit) {
  const [pc, pr] = st.p;
  const pel = kit.cell(pc, pr);
  const from = kit.cellCenter(pc, pr);
  const T = kit.turbo ? .45 : 1;
  pel?.classList.add('al-brew');
  cxSound.play('feature');
  const bub = setInterval(() => { if (from) { kit.emit(from.x, from.y - from.w * .2, 'bubble', 2, { spread: from.w / 5, scale: from.w / 90, colors: ['#5effa9', '#d6ffe9', '#b07bff'] }); if (Math.random() < .4) kit.emit(from.x, from.y - from.w * .3, 'smoke', 1, { spread: 6, scale: from.w / 110, colors: ['#5effa9', '#b07bff'] }); } }, 70);
  await kit.wait(550 * T);
  if (st.fizzle) {
    clearInterval(bub);
    kit.msg('⚗️ Mikstura nie ma już czego przemienić — wszystko lśni jak 💎!', 'feature');
    pel?.classList.remove('al-brew');
    await kit.wait(400 * T);
    return;
  }
  alLadderAct([st.from, st.to], kit);
  kit.msg(`⚗️ Transmutacja: ${AL_SYMS[st.from]} ${AL_NAMES[st.from]} ➜ ${AL_SYMS[st.to]} ${AL_NAMES[st.to]}${st.cells.length ? ` <b>(${st.cells.length})</b>` : ''}${st.perm ? ' · <b>NA STAŁE!</b>' : ''}`, 'feature');
  const targets = st.cells.map(([c, r]) => ({ c, r, ...kit.cellCenter(c, r) })).filter(t => t.x !== undefined)
    .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y));
  let ladderT = null;
  if (st.perm) {
    const le = kit.root.querySelector(`.al-step[data-al-lv="${st.from}"]`), mr = kit.$('machine').getBoundingClientRect();
    if (le) { const r = le.getBoundingClientRect(); ladderT = { x: r.left - mr.left + r.width / 2, y: r.top - mr.top + r.height / 2 }; }
  }
  const beamMs = 380 * T;
  if (from) alBeams(kit, from, ladderT ? targets.concat([ladderT]) : targets, beamMs);
  cxSound.play('scatter', 2);
  targets.forEach((t, i) => setTimeout(() => { alFlip(kit, t.c, t.r, st.to); if (i % 3 === 0) cxSound.play('chip'); }, beamMs + i * 25));
  if (ladderT) setTimeout(() => {
    alFloor = st.floor; alLadder(alFloor, kit); alLadderAct([st.to], kit);
    kit.emit(ladderT.x, ladderT.y, 'glyph', 8, { spread: 14, scale: .9 });
    kit.emit(ladderT.x, ladderT.y, 'smoke', 4, { spread: 10, colors: ['#ff4d6d', '#b07bff'] });
  }, beamMs + targets.length * 25);
  await kit.wait(beamMs + targets.length * 25 + 520 * T);
  clearInterval(bub);
  pel?.classList.remove('al-brew');
  if (targets.length) cxSound.play('win');
  if (st.perm) { kit.msg(`🔮 ${AL_SYMS[st.from]} ${AL_NAMES[st.from]} usunięty z puli do końca Free Spinów!`, 'feature'); await kit.wait(500 * T); }
}

function initALUI(table) {
  alCss();
  alFloor = 0; alInFs = false;
  alKit = new SlotKit({
    screenId: 'casino-al', game: 'alchemy_lab', title: 'Alchemy Lab', icon: '⚗️', subtitle: '5×4 · 30 linii · Transmutacja symboli · trwałe ulepszenia w FS',
    theme: { a: '#5effa9', b: '#b07bff' },
    cols: 5, rows: 4, event: 'casinoALSpin', lineCount: 30, boardMaxWidth: '480px',
    randomSym: alRandom,
    symHTML: alSymHTML,
    scatter: {
      is: i => i === AL.SC, icon: '🔮', need: 3, fx: 'magic',
      theme: { colors: AL_FX, glyphs: '🜁🜂🜃🜄☿♄', land: [['glyph', 8], ['bubble', 8], ['ring', 1]], ant: 'bubble', win: [['glyph', 26], ['bubble', 22], ['smoke', 8], ['ring', 2]] },
    },
    features: () => alLadderHTML(),
    onMount: kit => alLadder(0, kit),
    rules: [
      '30 linii, wygrane od lewej. Symbole mają 5 poziomów: 🪨 Kamień → 🥉 Brąz → 🥈 Srebro → 🥇 Złoto → 💎 Diament. Kamień, Brąz i Srebro płacą od 4 na linii, Złoto i Diament od 3.',
      '⚗️ Mikstura jest Wildem. Po wylądowaniu TRANSMUTUJE: wszystkie symbole najniższego obecnego poziomu na planszy zamieniają się w symbol o poziom wyżej. Każda mikstura = jedna transmutacja; dopiero potem liczone są linie.',
      '🔮 Kamień Filozoficzny (Scatter): 3 / 4 / 5 = 10 / 12 / 15 Free Spinów. Na start serii 🪨 Kamień znika z puli.',
      'W Free Spinach transmutacje są TRWAŁE: każda mikstura usuwa najniższy poziom z puli symboli do końca serii (aż zostaną tylko 🥈 🥇 💎). Drabina nad planszą pokazuje usunięte poziomy.',
      'Maksymalna wygrana: 10 000× stawki na spin.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      alInFs = res.mode === 'free';
      alFloor = res.floorBefore || 0;
      alLadder(alFloor, kit);
      await kit.stop(res.grid);
      for (const st of res.steps) await alStep(st, kit);
      kit.root.querySelectorAll('.sk-cell.al-new').forEach(e => e.classList.remove('al-new'));
      kit.grids.main = res.finalGrid.map(c => [...c]);
      alLadderAct([], kit);
      if (res.winLines.length) {
        kit.showLineWins(res.winLines, AL_LINES);
        if (res.steps.length && res.payout > 0) { res._msgSet = true; kit.countMsg('⚗️ Transmutacja się opłaciła!', res.payout, res.mult >= 2 ? 'big' : 'win'); }
      }
      if (res.freeSpinsAwarded) {
        await kit.scatterWin(res.scatter);
        await kit.splash(alInFs ? `+${res.freeSpinsAwarded} FREE SPINS` : `${res.freeSpinsAwarded} FREE SPINS`, 'Transmutacje są TRWAŁE — najsłabsze poziomy znikają z puli!', '🔮');
        if (!alInFs) {
          alFloor = AL.FS_START_FLOOR;
          alLadder(alFloor, kit);
          const le = kit.root.querySelector('.al-step[data-al-lv="0"]'), mr = kit.$('machine').getBoundingClientRect();
          if (le) { const r = le.getBoundingClientRect(); kit.emit(r.left - mr.left + r.width / 2, r.top - mr.top + r.height / 2, 'glyph', 12, { spread: 16 }); }
          cxSound.play('feature');
        }
        kit.msg(`🔮 <b>+${res.freeSpinsAwarded} Free Spinów</b> · 🪨 Kamień usunięty z puli`, 'feature');
        res._msgSet = res.payout === 0 || res._msgSet;
      } else if (res.scatter?.length === 2) kit.highlight(res.scatter, 'main', false, false);
      if (res.capped) { res._msgSet = true; kit.msg(`🏆 Maksymalna wygrana! <span class="amt">+${cxFmt(res.payout)} AT$</span>`, 'big'); }
      if (res.fsSummary) { alInFs = false; }
      if (res.freeSpinsRemaining > 0) {
        alInFs = true;
        alFloor = res.floor ?? alFloor;
        kit.banner(`🔮 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · trwałe transmutacje · pula od ${AL_SYMS[alFloor]} ${AL_NAMES[alFloor]}`, 'gold');
      } else { kit.banner(''); alFloor = 0; if (res.fsSummary) setTimeout(() => { if (!kit.spinning) alLadder(0, kit); }, 600); }
    },
    freeBetOf: res => res.bet,
  });
  alKit.mount(table);
}
skBindResult('casinoALResult', () => alKit);
