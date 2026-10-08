// ══════════════════════════════════════════════════════════════
//  NINJA WALK — 5×3, 25 linii, Walking Wilds: ninja skacze w lewo przy każdym respinie
// ══════════════════════════════════════════════════════════════
const NW_SYMS = ['👺', '🗡️', '🏮', '🌸', '🍵', '龍', '月', '火', '水', '🥷', '🏯'];
const NW_COLORS = ['#ff3b4e', '#c9d4e8', '#ff7a3c', '#ff8fc7', '#7bd96b', '#ff4d5e', '#f5e6a8', '#ff8a3d', '#5fb8ff', '#ff2d55', '#ffb3d1'];
const NW = { NINJA: 9, TEMPLE: 10 };
const NW_POOL = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 10];
const NW_LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,1,2,1],[1,2,1,0,1],[1,0,0,0,1],
  [1,2,2,2,1],[0,1,1,1,0],[2,1,1,1,2],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,2,2,0],
  [2,0,0,0,2],[1,0,2,0,1],[1,2,0,2,1],[0,2,0,2,0],[2,0,2,0,2],
];
const NW_GLYPHS = '忍手裏剣桜夜月影刀風';
let nwKit = null;
let nwNinja = {};   // "c,r" → { id, m, wait }
let nwFree = false;

function nwInjectCss() {
  if (document.getElementById('casino-nw-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-nw-css';
  st.textContent = `
#screen-casino-nw .sk-machine { background: radial-gradient(90% 70% at 80% 0%, rgba(255,240,230,.12) 0 6%, transparent 7%), radial-gradient(120% 90% at 50% 0%, #3a0a14 0%, #17050a 55%, #070205 100%); }
#screen-casino-nw .sk-machine::after { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  background: radial-gradient(circle at 12% 18%, rgba(255,143,199,.10), transparent 30%), radial-gradient(circle at 90% 85%, rgba(255,45,85,.10), transparent 35%); }
#screen-casino-nw .sk-reels { background: linear-gradient(180deg, rgba(30,4,10,.8), rgba(8,1,4,.9)); border-color: rgba(255,90,120,.2); }
#screen-casino-nw .sk-col { background: linear-gradient(180deg, rgba(255,120,160,.03), rgba(255,60,100,.08) 50%, rgba(255,120,160,.03)); }
#screen-casino-nw .sk-tile.letter { font-family: 'Noto Serif JP', 'Hiragino Mincho ProN', serif; font-weight: 900; }
#screen-casino-nw .sk-cell.wild .sk-tile { border-color: #ff2d55; box-shadow: inset 0 0 18px rgba(255,45,85,.45), 0 0 16px rgba(255,45,85,.5); }
.nw-badge { position: absolute; top: 4%; right: 4%; z-index: 4; font: 800 clamp(10px, 1.7vw, 15px)/1 'DM Mono', monospace; padding: 3px 6px; border-radius: 8px;
  color: #fff; background: linear-gradient(180deg, #ff6b86, #c3102f); border: 1px solid #ffc2d1; box-shadow: 0 2px 0 #4a0010, 0 0 12px rgba(255,45,85,.8); }
.nw-badge.hot { background: linear-gradient(180deg, #fff, #ff8fc7 45%, #ff2d55); color: #3a0010; }
.nw-badge.bump { animation: nwBump .5s cubic-bezier(.2,1.8,.4,1); }
@keyframes nwBump { 0% { transform: scale(.3); } 60% { transform: scale(1.7); } 100% { transform: scale(1); } }
.nw-wait { position: absolute; left: 4%; top: 4%; z-index: 4; font: 700 10px/1 'Syne', sans-serif; padding: 2px 5px; border-radius: 6px; background: rgba(0,0,0,.7); color: #ffb3d1; border: 1px solid rgba(255,143,199,.4); }
.nw-fly { position: absolute; z-index: 7; pointer-events: none; }
.nw-fly .sk-cell { width: 100%; height: 100%; }
.nw-shadow { position: absolute; z-index: 6; pointer-events: none; height: 14%; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.75), transparent); }
.nw-slash { position: absolute; z-index: 6; pointer-events: none; height: 3px; transform-origin: 0 50%; border-radius: 3px;
  background: linear-gradient(90deg, transparent, #ff8fc7 40%, #fff); box-shadow: 0 0 10px #ff2d55; }
.nw-counter { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; font-weight: 700; color: rgba(255,220,230,.85); }
.nw-counter b { font-family: 'DM Mono', monospace; color: #ff6b86; font-size: 13px; }
.nw-counter b.on { color: #fff; text-shadow: 0 0 10px #ff2d55; animation: nwPulse .6s ease-in-out infinite alternate; }
@keyframes nwPulse { to { transform: scale(1.18); } }
.nw-respin-pop { position: absolute; left: 50%; top: 10%; z-index: 10; transform: translateX(-50%); pointer-events: none; font: 800 clamp(16px, 3vw, 26px)/1 'Syne', sans-serif;
  color: #fff; padding: 6px 16px; border-radius: 999px; background: linear-gradient(90deg, #c3102f, #ff2d55, #c3102f); border: 1px solid #ffc2d1;
  box-shadow: 0 0 24px rgba(255,45,85,.8); animation: nwPop .9s ease-out forwards; white-space: nowrap; }
@keyframes nwPop { 0% { transform: translateX(-50%) scale(.4); opacity: 0; } 20% { transform: translateX(-50%) scale(1.15); opacity: 1; } 75% { opacity: 1; } 100% { transform: translateX(-50%) translateY(-14px); opacity: 0; } }
`;
  document.head.appendChild(st);
}

function nwSymHTML(i) {
  if (i >= 5 && i <= 8) return { html: `<span>${NW_SYMS[i]}</span>`, tile: 'letter', color: NW_COLORS[i] };
  return { html: `<span class="sk-emo">${NW_SYMS[i]}</span>`, color: NW_COLORS[i], cls: i === NW.NINJA ? 'wild' : i === NW.TEMPLE ? 'scatter' : '' };
}
function nwSetNinjas(list) { nwNinja = {}; (list || []).forEach(n => { nwNinja[n.c + ',' + n.r] = n; }); }
function nwBadge(kit, c, r, bump) {
  const el = kit.cell(c, r), n = nwNinja[c + ',' + r];
  if (!el || !n) return;
  let b = el.querySelector('.nw-badge');
  if (!b) { el.insertAdjacentHTML('beforeend', '<span class="nw-badge"></span>'); b = el.querySelector('.nw-badge'); }
  b.className = 'nw-badge' + (n.m >= 5 ? ' hot' : '');
  b.textContent = '×' + n.m;
  if (bump) { void b.offsetWidth; b.classList.add('bump'); }
  el.querySelector('.nw-wait')?.remove();
  if (n.wait && nwFree) el.insertAdjacentHTML('beforeend', '<span class="nw-wait">czeka</span>');
}

function nwFeatures() {
  return `<div class="sk-meter"><div class="nw-counter"><span>🥷 Ninja skacze w lewo · mnożnik +1 za krok · na linii się SUMUJĄ</span></div></div>
    <div class="sk-meter" style="flex:.55"><div class="nw-counter"><span>RESPINY</span><b data-nw="resp">0</b><span>SUMA</span><b data-nw="sum">0</b></div></div>`;
}
function nwSetCounter(kit, resp, sum, on) {
  const a = kit.root.querySelector('[data-nw="resp"]'), b = kit.root.querySelector('[data-nw="sum"]');
  if (a) { a.textContent = resp; a.classList.toggle('on', !!on); }
  if (b) b.textContent = cxShort(sum);
}

// Pozycja komórki względem planszy
function nwRect(kit, c, r) {
  const b = kit.board('main'), cell = kit.cell(c, r);
  if (!cell) return null;
  const br = b.el.getBoundingClientRect(), cr = cell.getBoundingClientRect();
  return { x: cr.left - br.left, y: cr.top - br.top, w: cr.width, h: cr.height, fs: getComputedStyle(cell).fontSize };
}

// Skok ninja: łuk w powietrzu, cień na ziemi, ślad cząsteczek
function nwJump(kit, n, from, to, { exit = false, stay = false, newM } = {}) {
  const b = kit.board('main');
  const A = nwRect(kit, from[0], from[1]);
  if (!A) return Promise.resolve();
  const B = exit ? { ...A, x: A.x - A.w * 1.2 } : nwRect(kit, to[0], to[1]) || A;
  const fly = document.createElement('div');
  fly.className = 'nw-fly';
  Object.assign(fly.style, { left: A.x + 'px', top: A.y + 'px', width: A.w + 'px', height: A.h + 'px', fontSize: A.fs });
  fly.innerHTML = `<div class="sk-cell wild">${kit.cellInner(nwSymHTML(NW.NINJA))}<span class="nw-badge">×${n.m}</span></div>`;
  const sh = document.createElement('div');
  sh.className = 'nw-shadow';
  Object.assign(sh.style, { left: (A.x + A.w * .15) + 'px', top: (A.y + A.h * .82) + 'px', width: (A.w * .7) + 'px' });
  b.el.appendChild(sh); b.el.appendChild(fly);
  const dur = kit.turbo ? 300 : stay ? 450 : 620;
  const dx = B.x - A.x, dy = B.y - A.y, hgt = stay ? A.h * .18 : A.h * .75;
  const frames = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, y = dy * t - Math.sin(Math.PI * t) * hgt;
    const rot = stay ? 0 : -360 * t;
    const sc = 1 + Math.sin(Math.PI * t) * (stay ? .05 : .22);
    frames.push({ transform: `translate(${dx * t}px, ${y}px) rotate(${rot}deg) scale(${sc})`, opacity: exit && t > .6 ? 1 - (t - .6) / .4 : 1 });
  }
  fly.animate(frames, { duration: dur, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' });
  if (newM && newM !== n.m) setTimeout(() => { const bd = fly.querySelector('.nw-badge'); if (bd) { bd.textContent = '×' + newM; bd.className = 'nw-badge bump' + (newM >= 5 ? ' hot' : ''); } }, dur * .45);
  sh.animate([{ transform: 'translateX(0) scale(1)', opacity: .9 }, { transform: `translateX(${dx / 2}px) scale(.5)`, opacity: .4 }, { transform: `translateX(${dx}px) scale(1)`, opacity: exit ? 0 : .9 }], { duration: dur, fill: 'forwards' });
  // Smuga cięcia + ślad cząsteczek
  if (!stay) {
    const m = kit.$('machine'), mr = m.getBoundingClientRect(), br = b.el.getBoundingClientRect();
    const ox = br.left - mr.left, oy = br.top - mr.top;
    const sl = document.createElement('div'); sl.className = 'nw-slash';
    const len = Math.hypot(dx, dy) || A.w;
    Object.assign(sl.style, { left: (B.x + A.w / 2) + 'px', top: (A.y + A.h / 2 + dy) + 'px', width: len + 'px', transform: `rotate(${Math.atan2(-dy, -dx)}rad) scaleX(0)` });
    b.el.appendChild(sl);
    sl.animate([{ transform: `rotate(${Math.atan2(-dy, -dx)}rad) scaleX(0)`, opacity: 0 }, { transform: `rotate(${Math.atan2(-dy, -dx)}rad) scaleX(1)`, opacity: 1, offset: .6 }, { transform: `rotate(${Math.atan2(-dy, -dx)}rad) scaleX(1)`, opacity: 0 }], { duration: dur * 1.3, fill: 'forwards' });
    setTimeout(() => sl.remove(), dur * 1.4);
    const t0 = performance.now();
    const trail = setInterval(() => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const x = ox + A.x + A.w / 2 + dx * t, y = oy + A.y + A.h / 2 + dy * t - Math.sin(Math.PI * t) * hgt;
      kit.emit(x, y, Math.random() < .5 ? 'glyph' : 'spark', 2, { spread: A.w / 6, scale: A.w / 90, colors: ['#ff2d55', '#ff8fc7', '#fff'] });
      if (Math.random() < .3) kit.emit(x, y, 'ember', 2, { spread: 6, colors: ['#ff6b86', '#ffb3d1'] });
      if (t >= 1) clearInterval(trail);
    }, 40);
    cxSound.play('chip');
  }
  return new Promise(res => setTimeout(() => {
    if (!stay && !exit) {
      const m = kit.$('machine'), mr = m.getBoundingClientRect(), br = b.el.getBoundingClientRect();
      const x = br.left - mr.left + B.x + B.w / 2, y = br.top - mr.top + B.y + B.h * .85;
      kit.emit(x, y, 'smoke', 3, { spread: B.w / 4, colors: ['#ff8fc7', '#5a2030'] });
      kit.emit(x, y, 'spark', 10, { spread: B.w / 3, colors: ['#ff2d55', '#fff'] });
      cxSound.play('stop');
    }
    res({ fly, sh });
  }, dur));
}

async function nwShowStepWins(kit, st, last) {
  if (!st.winLines.length) return;
  kit.showLineWins(st.winLines, NW_LINES);
  const top = st.winLines.reduce((a, w) => w.mult > a.mult ? w : a, st.winLines[0]);
  if (top.mult >= 3) {
    const nc = top.cells.find(([c, r]) => nwNinja[c + ',' + r]) || top.cells[0];
    await kit.bigMult(top.mult, { c: nc[0], r: nc[1], label: 'SUMA NINJA' });
  } else if (!last) await kit.wait(kit.turbo ? 300 : 700);
}

function initNWUI(table) {
  nwInjectCss();
  nwNinja = {}; nwFree = false;
  nwKit = new SlotKit({
    screenId: 'casino-nw', game: 'ninja_walk', title: 'Ninja Walk', icon: '🥷', subtitle: '5×3 · 25 linii · Walking Wilds · respiny',
    theme: { a: '#ff2d55', b: '#ff8fc7' },
    cols: 5, rows: 3, event: 'casinoNWSpin', lineCount: 25, boardMaxWidth: '560px',
    randomSym: () => NW_POOL[Math.floor(Math.random() * NW_POOL.length)],
    symHTML: nwSymHTML,
    scatter: {
      is: i => i === NW.TEMPLE, icon: '🏯', need: 3, fx: 'sakura',
      theme: { colors: ['#ff2d55', '#ff8fc7', '#ffe0ea', '#ffffff'], glyphs: NW_GLYPHS, land: [['glyph', 8], ['spark', 10], ['ring', 1]], ant: 'glyph', win: [['glyph', 30], ['spark', 24], ['ember', 16], ['ring', 2]] },
    },
    decorate(el, c, r, si) {
      if (si !== NW.NINJA) return;
      const n = nwNinja[c + ',' + r];
      if (n && !el.querySelector('.nw-badge')) {
        el.insertAdjacentHTML('beforeend', `<span class="nw-badge${n.m >= 5 ? ' hot' : ''}">×${n.m}</span>`);
        if (n.wait && nwFree) el.insertAdjacentHTML('beforeend', '<span class="nw-wait">czeka</span>');
      }
    },
    features: nwFeatures,
    onSpinStart(kit) { nwNinja = {}; nwSetCounter(kit, 0, 0, false); kit.startSpin(); },
    rules: [
      '25 linii, wygrane od lewej, min. 3 takie same symbole. 🥷 Ninja (Wild) zastępuje każdy symbol poza 🏯.',
      '🥷 WALKING WILDS: gdy na planszy jest choć jeden ninja, po wypłacie następuje DARMOWY RESPIN — każdy ninja przeskakuje o jeden bęben w lewo, a pozostałe pola losowane są od nowa. Ninja, który wyjdzie poza 1. bęben, znika.',
      'Respiny trwają, dopóki na planszy jest jakikolwiek ninja — w respinach mogą lądować nowi ninja.',
      'Każdy ninja zaczyna z mnożnikiem ×1, który rośnie o +1 przy każdym kroku. Na linii mnożniki wszystkich ninja SUMUJĄ się.',
      'Cały ciąg respinów to jeden spin — wypłata to suma wygranych ze wszystkich kroków.',
      '🏯 3 / 4 / 5 Świątyń = 8 / 12 / 16 Free Spinów. W Free Spinach ninja wchodzi od razu z ×2 i chodzi wolniej (skok co drugi respin), więc respinów jest więcej. 3+ 🏯 w trakcie = kolejne spiny.',
      'Bez limitu wygranej.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      nwFree = res.isFree;
      const steps = res.steps;
      let sum = 0;
      // Krok 0 — zwykły spin
      nwSetNinjas(steps[0].ninjas);
      await kit.stop(steps[0].grid);
      if (steps[0].landed.length) {
        cxSound.play('feature');
        steps[0].ninjas.forEach(n => { const p = kit.cellCenter(n.c, n.r); if (p) { kit.emit(p.x, p.y, 'glyph', 6, { spread: p.w / 3, scale: p.w / 80 }); kit.emit(p.x, p.y, 'ring', 1, { scale: p.w / 70 }); } });
      }
      sum += steps[0].win;
      nwSetCounter(kit, 0, sum, steps.length > 1);
      // Scattery przed respinami
      if (res.freeSpinsAwarded) {
        await kit.scatterWin(res.scatter);
        await kit.splash(res.isFree ? `+${res.freeSpinsAwarded} FREE SPINS` : `${res.freeSpinsAwarded} FREE SPINS`, 'Ninja wchodzi z ×2 i chodzi wolniej!', '🏯', '#ff2d55');
        kit.clearWins();
      }
      await nwShowStepWins(kit, steps[0], steps.length === 1);
      if (steps[0].win > 0 && steps.length > 1) kit.msg(`🥷 Krok 1: <span class="amt">+${cxFmt(steps[0].win)} AT$</span>`, 'win');
      // Respiny
      for (let i = 1; i < steps.length; i++) {
        const st = steps[i], prev = steps[i - 1];
        await kit.wait(kit.turbo ? 120 : 380);
        kit.clearWins();
        const m = kit.$('machine');
        const pop = document.createElement('div'); pop.className = 'nw-respin-pop'; pop.textContent = `🥷 RESPIN ${i}`;
        m.appendChild(pop); setTimeout(() => pop.remove(), 950);
        kit.banner(`🥷 DARMOWY RESPIN <b>${i}</b> · ninja na planszy: <b>${prev.ninjas.length}</b>${res.isFree ? ` · FS: ${res.freeSpinsRemaining}` : ''}`, 'gold');
        nwSetCounter(kit, i, sum, true);
        // Skoki
        const byId = Object.fromEntries(prev.ninjas.map(n => [n.id, n]));
        const flyers = [];
        kit.startSpin();
        const jumps = [];
        for (const mv of st.moves) {
          const n = byId[mv.id]; if (!n) continue;
          jumps.push(nwJump(kit, n, mv.from, mv.to, { stay: !!mv.stay, newM: (st.ninjas.find(x => x.id === mv.id) || n).m }).then(f => flyers.push(f)));
        }
        for (const g of st.gone) {
          const n = byId[g.id]; if (!n) continue;
          jumps.push(nwJump(kit, n, [g.c, g.r], null, { exit: true, newM: n.m + 1 }).then(f => flyers.push(f)));
        }
        await Promise.all(jumps);
        nwSetNinjas(st.ninjas);
        await kit.stop(st.grid, 'main', { stagger: kit.turbo ? 30 : 80 });
        flyers.forEach(f => { f.fly.remove(); f.sh.remove(); });
        st.moves.forEach(mv => { if (!mv.stay) nwBadge(kit, mv.to[0], mv.to[1], true); else nwBadge(kit, mv.to[0], mv.to[1], false); });
        if (st.landed.length) {
          cxSound.play('feature');
          st.ninjas.filter(n => st.landed.includes(n.id)).forEach(n => {
            const p = kit.cellCenter(n.c, n.r);
            if (p) { kit.emit(p.x, p.y, 'glyph', 8, { spread: p.w / 3, scale: p.w / 80 }); kit.emit(p.x, p.y, 'ring', 1, { scale: p.w / 70 }); }
          });
          kit.msg(`🥷 Nowy ninja na planszy! (${st.landed.length})`, 'feature');
        }
        sum += st.win;
        nwSetCounter(kit, i, sum, i < steps.length - 1);
        await nwShowStepWins(kit, st, i === steps.length - 1);
        if (st.win > 0) kit.msg(`🥷 Respin ${i}: <span class="amt">+${cxFmt(st.win)} AT$</span> · suma ${cxFmt(sum)} AT$`, 'win');
      }
      nwSetCounter(kit, steps.length - 1, sum, false);
      if (steps.length > 1) {
        // Na koniec: wszystkie wygrane z ostatniego kroku zostają; komunikat o sumie
        if (res.payout > 0) { res._msgSet = true; kit.countMsg(`🥷 ${steps.length - 1} respin${steps.length - 1 === 1 ? '' : steps.length - 1 < 5 ? 'y' : 'ów'} — razem:`, res.payout, 'big'); }
        else { res._msgSet = true; kit.msg(`🥷 ${steps.length - 1} respinów — tym razem bez wygranej`); }
      }
      if (res.capped) kit.msg('🏆 <b>MAKSYMALNA WYGRANA 10 000×</b>', 'big');
      if (res.freeSpinsAwarded && !res._msgSet) { kit.msg(`🏯 <b>+${res.freeSpinsAwarded} Free Spinów</b> · ninja z ×2`, 'feature'); res._msgSet = res.payout === 0; }
      kit.banner(res.freeSpinsRemaining > 0 ? `🏯 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · ninja wchodzi z ×2 · skok co drugi respin` : '', 'gold');
      if (res.fsSummary) nwFree = false;
    },
    freeBetOf: res => res.bet,
  });
  nwKit.mount(table);
}
skBindResult('casinoNWResult', () => nwKit);
