// ══════════════════════════════════════════════════════════════
//  COSMIC INFINITY — Infinity Reels: 3×3 → do 12 bębnów, mnożnik do ×25
// ══════════════════════════════════════════════════════════════
const CI_SYMS = ['🌌', '🕳️', '🛸', '☄️', '👽', '🌙', '🚀', '🛰️', '🌟', '🪐'];
const CI_COLORS = ['#b48cff', '#ff4fd8', '#4fe3ff', '#ff9f43', '#3ff2a3', '#ffd36b', '#ff6f8a', '#7aa7ff', '#fff3c4', '#c084fc'];
const CI_NAMES = ['Galaktyka', 'Czarna Dziura', 'UFO', 'Kometa', 'Kosmita', 'Księżyc', 'Rakieta', 'Satelita', 'Supernowa', 'Planeta'];
const CI = { NOVA: 8, PLANET: 9, ROWS: 3, START: 3, MAX: 12 };
const CI_MULT = [0, 0, 0, 1, 1, 2, 3, 4, 6, 8, 12, 18, 25];
const CI_POOL = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 9];
let ciKit = null;
let ciSt = { lit: [], stopFrom: 0, fsMult: 0, offset: 0, cols: 3 };

function ciInjectCss() {
  if (document.getElementById('casino-ci-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-ci-css';
  st.textContent = `
#screen-casino-ci .sk-machine { isolation: isolate; background: radial-gradient(ellipse at 70% 40%, rgba(255,79,216,.18), transparent 55%), radial-gradient(ellipse at 20% 70%, rgba(79,227,255,.14), transparent 55%), linear-gradient(160deg, #150a34, #05030f); }
#screen-casino-ci .ci-space { position: absolute; inset: 0; z-index: -1; overflow: hidden; border-radius: inherit; pointer-events: none; }
#screen-casino-ci .ci-layer { position: absolute; top: 0; bottom: 0; left: 0; width: calc(100% + 400px); will-change: transform; }
#screen-casino-ci .ci-layer i { position: absolute; inset: 0; display: block; animation: ciDrift linear infinite; }
#screen-casino-ci .ci-layer.l1 i { background-image: radial-gradient(1px 1px at 20px 30px, #fff, transparent), radial-gradient(1px 1px at 70px 80px, #cfe7ff, transparent), radial-gradient(1px 1px at 50px 10px, #fff, transparent); background-size: 100px 100px; opacity: .55; animation-duration: 60s; }
#screen-casino-ci .ci-layer.l2 i { background-image: radial-gradient(1.5px 1.5px at 40px 120px, #ffd6fb, transparent), radial-gradient(1.5px 1.5px at 150px 60px, #bff4ff, transparent), radial-gradient(2px 2px at 110px 170px, #fff, transparent); background-size: 200px 200px; opacity: .75; animation-duration: 40s; }
#screen-casino-ci .ci-layer.l3 i { background-image: radial-gradient(2.5px 2.5px at 90px 220px, #fff, transparent), radial-gradient(2px 2px at 300px 90px, #ff9ff0, transparent), radial-gradient(3px 3px at 220px 330px, #9ff4ff, transparent); background-size: 400px 400px; animation-duration: 25s; }
#screen-casino-ci .ci-nebula { position: absolute; inset: -20%; background: conic-gradient(from 0deg at 75% 45%, transparent, rgba(180,140,255,.12), transparent 30%, rgba(79,227,255,.1), transparent 60%, rgba(255,79,216,.12), transparent); animation: ciSpin 80s linear infinite; }
@keyframes ciDrift { to { transform: translateX(-400px); } }
@keyframes ciSpin { to { transform: rotate(360deg); } }
#screen-casino-ci [data-sk="boards"] { display: flex; justify-content: center; }
#screen-casino-ci [data-sk="boards"] > .sk-reels { max-width: none !important; flex: none; transition: width .45s cubic-bezier(.3,1.2,.5,1), height .45s; background: rgba(4,2,16,.55); border-color: rgba(180,140,255,.25); box-shadow: 0 0 30px rgba(180,140,255,.15), inset 0 0 30px rgba(79,227,255,.08); }
#screen-casino-ci .sk-col { background: linear-gradient(180deg, rgba(180,140,255,.05), rgba(79,227,255,.10) 50%, rgba(180,140,255,.05)); }
#screen-casino-ci .sk-col.ci-new { box-shadow: inset 0 0 0 1px rgba(79,227,255,.35); }
#screen-casino-ci .sk-col.ci-ext { box-shadow: inset 0 0 0 2px #4fe3ff, 0 0 18px rgba(79,227,255,.6); }
#screen-casino-ci .ci-mpill { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); z-index: 6; font: 800 calc(var(--ci-cell, 80px) * .17) 'DM Mono', monospace; padding: 1px 6px; border-radius: 999px; background: rgba(10,4,30,.85); color: #9aa3c7; border: 1px solid rgba(180,140,255,.4); pointer-events: none; white-space: nowrap; }
#screen-casino-ci .ci-mpill.on { color: #fff; background: linear-gradient(90deg, #8b5cf6, #ec4899); border-color: #fff3; box-shadow: 0 0 12px #ec4899; animation: ciPill .5s cubic-bezier(.3,1.8,.5,1); }
#screen-casino-ci .ci-mpill.off { opacity: .55; }
@keyframes ciPill { from { transform: translateX(-50%) scale(2.2); } to { transform: translateX(-50%) scale(1); } }
#screen-casino-ci .ci-hole { position: absolute; z-index: -1; width: 120px; height: 120px; border-radius: 50%; pointer-events: none; transform: translate(-50%, -50%); transition: left .45s, top .45s, opacity .4s;
  background: radial-gradient(circle, #000 0 28%, rgba(0,0,0,.85) 33%, transparent 36%), conic-gradient(from 0deg, #4fe3ff, #8b5cf6, #ff4fd8, #ffd36b, #4fe3ff); -webkit-mask: radial-gradient(circle, #000 34%, rgba(0,0,0,.8) 45%, transparent 70%); mask: radial-gradient(circle, #000 34%, rgba(0,0,0,.8) 45%, transparent 70%); animation: ciSpin 3s linear infinite; filter: blur(.5px) drop-shadow(0 0 18px #8b5cf6); opacity: .9; }
#screen-casino-ci .ci-hole.pulse { animation: ciSpin .5s linear infinite; filter: blur(.5px) drop-shadow(0 0 30px #ff4fd8) brightness(1.5); }
#screen-casino-ci .ci-hole.hide { opacity: .25; }
.ci-track { display: flex; gap: 4px; flex-wrap: nowrap; }
.ci-track span { flex: 1; text-align: center; font: 800 11px 'DM Mono', monospace; padding: 3px 0; border-radius: 7px; background: rgba(180,140,255,.08); border: 1px solid rgba(180,140,255,.2); color: #8c86ad; transition: all .25s; }
.ci-track span.on { background: linear-gradient(180deg, #8b5cf6, #ec4899); color: #fff; border-color: #fff4; box-shadow: 0 0 10px rgba(236,72,153,.6); }
.ci-track span.fs { border-color: #4fe3ff; color: #bff4ff; }
#screen-casino-ci .sk-cell.wild .sk-tile { border-color: #fff3c4; box-shadow: inset 0 0 18px rgba(255,243,196,.45), 0 0 16px rgba(255,243,196,.5); }
@media (orientation: landscape) and (max-height: 540px) {
  #screen-casino-ci .ci-track span { font-size: 9px; padding: 1px 0; }
  #screen-casino-ci .ci-hole { width: 70px; height: 70px; }
  #screen-casino-ci .ci-meter-top-extra { display: none; }
}`;
  document.head.appendChild(st);
}

function ciFeatures() {
  return `<div class="sk-meter" style="flex:3"><div class="sk-meter-top"><span>🌌 Infinity Reels — każda wygrana dokłada bęben</span><span>Bębny: <b data-ci="cols">3</b>/12 · Mnożnik: <b data-ci="mult">×1</b></span></div>
    <div class="ci-track" data-ci="track">${CI_MULT.slice(4).map((m, i) => `<span data-n="${i + 4}">×${m}</span>`).join('')}</div></div>`;
}
function ciUpdateMeter(kit, cols, mult) {
  const r = kit.root; if (!r) return;
  const c = r.querySelector('[data-ci="cols"]'), m = r.querySelector('[data-ci="mult"]');
  if (c) c.textContent = cols;
  if (m) m.textContent = '×' + mult;
  r.querySelectorAll('[data-ci="track"] span').forEach(s => {
    const n = +s.dataset.n;
    s.classList.toggle('on', n <= cols && ciSt.lit[n - 1]);
    s.classList.toggle('fs', ciSt.fsMult > 0 && CI_MULT[n] <= ciSt.fsMult);
  });
}

function ciSymHTML(i) {
  return { html: `<span class="sk-emo">${CI_SYMS[i]}</span>`, color: CI_COLORS[i], cls: i === CI.NOVA ? 'wild' : i === CI.PLANET ? 'scatter' : '' };
}
function ciRand() { return CI_POOL[Math.floor(Math.random() * CI_POOL.length)]; }
function ciIsMobile() { return matchMedia('(orientation: landscape) and (max-height: 540px)').matches; }

// Rozmiar komórek — plansza musi zmieścić 12 bębnów w automacie (i na telefonie w poziomie)
function ciLayout(kit) {
  const b = kit.board('main'); if (!b?.el) return;
  const wrap = kit.$('boards'), m = kit.$('machine');
  const n = b.cols, gap = ciIsMobile() ? 4 : 6, pad = ciIsMobile() ? 5 : 8;
  const avail = Math.max(120, (wrap.clientWidth || m.clientWidth) - 4);
  let cell = Math.min(ciIsMobile() ? 999 : 112, (avail - pad * 2 - (n - 1) * gap) / Math.max(n, 3.6));
  if (ciIsMobile()) {
    const h = wrap.clientHeight || 200;
    cell = Math.min(cell, (h - pad * 2) / 3);
  }
  cell = Math.max(20, Math.floor(cell));
  const el = b.el;
  el.style.gap = gap + 'px'; el.style.padding = pad + 'px';
  el.style.width = (n * cell + (n - 1) * gap + pad * 2) + 'px';
  el.style.height = (3 * cell + pad * 2) + 'px';
  el.style.aspectRatio = 'auto';
  el.style.margin = '0 auto';
  el.style.setProperty('--sk-fs', Math.round(cell * .52) + 'px');
  el.style.setProperty('--ci-cell', cell + 'px');
  ciPlaceHole(kit);
}
function ciPlaceHole(kit) {
  const m = kit.$('machine'), hole = m?.querySelector('.ci-hole'), b = kit.board('main');
  if (!hole || !b?.el) return;
  const mr = m.getBoundingClientRect(), br = b.el.getBoundingClientRect();
  if (!mr.width) return;
  const x = Math.min(mr.width - 30, br.right - mr.left + 40);
  hole.style.left = x + 'px';
  hole.style.top = (br.top - mr.top + br.height / 2) + 'px';
  hole.classList.toggle('hide', b.cols >= CI.MAX);
}
function ciPills(kit) {
  const b = kit.board('main');
  for (let c = CI.START; c < b.cols; c++) {
    const col = kit.colEl(c); if (!col) continue;
    col.classList.add('ci-new');
    if (ciSt.lit[c]) col.classList.add('ci-ext');
    if (!col.querySelector('.ci-mpill')) col.insertAdjacentHTML('beforeend', `<div class="ci-mpill ${ciSt.lit[c] ? 'on' : ciSt.lit[c] === false ? 'off' : ''}">×${CI_MULT[c + 1]}</div>`);
  }
}
function ciSetCols(kit, n, grid) {
  kit.boards = [{ key: 'main', cols: n, rows: CI.ROWS }];
  kit.buildBoards();
  if (grid) kit.setGrid(grid);
  ciSt.cols = n;
  ciLayout(kit);
  ciPills(kit);
}
// Paralaksa gwiazd: przesunięcie tła przy każdym nowym bębnie
function ciWarp(kit, amount = 90) {
  const m = kit.$('machine'); if (!m) return;
  const from = ciSt.offset; ciSt.offset += amount;
  [['l1', .35], ['l2', .7], ['l3', 1.3]].forEach(([k, f]) => {
    const el = m.querySelector('.ci-layer.' + k); if (!el) return;
    const a = -((from * f) % 400), b = a - amount * f;
    el.animate([{ transform: `translateX(${a}px)` }, { transform: `translateX(${b}px)` }], { duration: kit.turbo ? 300 : 750, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
  });
}
function ciHighlight(kit, wins, upTo) {
  const cells = [];
  for (const w of wins || []) for (const [c, r] of w.cells) if (c <= upTo) cells.push([c, r]);
  if (cells.length) kit.highlight(cells, 'main', true, false);
}

// Nowy bęben wjeżdża z czarnej dziury
async function ciAddReel(kit, cur, st, wins) {
  const n = cur.length, nc = n - 1;
  const tmp = cur.map((c, i) => i === nc ? [ciRand(), ciRand(), ciRand()] : c);
  const m = kit.$('machine');
  const hole = m.querySelector('.ci-hole');
  const holeR = hole?.getBoundingClientRect();
  ciSetCols(kit, n, tmp);
  ciHighlight(kit, wins, nc - 1);
  const col = kit.colEl(nc);
  const cr = col.getBoundingClientRect(), mr = m.getBoundingClientRect();
  const hx = holeR && holeR.width ? holeR.left + holeR.width / 2 : cr.right + 60;
  const hy = holeR && holeR.width ? holeR.top + holeR.height / 2 : cr.top + cr.height / 2;
  const dx = hx - (cr.left + cr.width / 2), dy = hy - (cr.top + cr.height / 2);
  hole?.classList.add('pulse');
  ciWarp(kit);
  cxSound.play('feature');
  const dur = kit.turbo ? 260 : 620;
  col.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(.05) rotate(220deg)`, opacity: 0, filter: 'blur(6px) brightness(3)' },
    { transform: `translate(${dx * .3}px, ${dy * .3}px) scale(.6) rotate(60deg)`, opacity: .8, filter: 'blur(2px) brightness(1.8)', offset: .55 },
    { transform: 'none', opacity: 1, filter: 'none' },
  ], { duration: dur, easing: 'cubic-bezier(.25,.9,.35,1.05)' });
  const px = cr.left - mr.left + cr.width / 2, py = cr.top - mr.top + cr.height / 2;
  kit.emit(hx - mr.left, hy - mr.top, 'smoke', 6, { spread: 20, colors: ['#8b5cf6', '#ff4fd8', '#4fe3ff'] });
  kit.emit(hx - mr.left, hy - mr.top, 'ring', 2, { scale: 1.2, colors: ['#ff4fd8', '#4fe3ff'] });
  kit.startSpin(null, [nc]);
  ciSt.stopFrom = nc;
  await kit.wait(dur);
  hole?.classList.remove('pulse');
  kit.emit(px, py, 'star', 16, { spread: cr.width / 2, scale: cr.width / 90, colors: ['#fff', '#4fe3ff', '#ff7ad9', '#b48cff'] });
  await kit.stop(cur, 'main', { only: [nc], extraDelay: kit.turbo ? -80 : -180 });
  // Mnożnik nad nowym bębnem
  ciSt.lit[nc] = st.extends;
  const pill = col.querySelector('.ci-mpill');
  if (pill) { pill.classList.add(st.extends ? 'on' : 'off'); }
  if (st.extends) {
    col.classList.add('ci-ext');
    kit.clearWins();
    ciHighlight(kit, wins, nc);
    for (const [c, r] of st.cells) { const p = kit.cellCenter(c, r); if (p) { kit.emit(p.x, p.y, 'star', 10, { spread: p.w / 3, scale: p.w / 80 }); kit.emit(p.x, p.y, 'ring', 1, { scale: p.w / 70 }); } }
    cxSound.play('win');
    kit.msg(`🌌 Bęben ${n} przedłuża wygraną! Mnożnik <b>×${Math.max(CI_MULT[n], ciSt.fsMult)}</b>${n < CI.MAX ? ' — kolejny bęben…' : ' — MAKSIMUM 12 BĘBNÓW!'}`, 'feature');
    if (CI_MULT[n] >= 6 && !kit.turbo) kit.bigMult(CI_MULT[n], { c: nc, r: 1, label: 'BĘBEN ' + n });
  } else {
    kit.msg(`Bęben ${n} nie przedłużył wygranej`, '');
  }
  ciUpdateMeter(kit, n, Math.max(st.extends ? CI_MULT[n] : CI_MULT[n - 1] || 1, ciSt.fsMult));
  await kit.wait(kit.turbo ? 180 : 520);
}

function initCIUI(table) {
  ciInjectCss();
  ciSt = { lit: [], stopFrom: 0, fsMult: 0, offset: 0, cols: 3 };
  ciKit = new SlotKit({
    screenId: 'casino-ci', game: 'cosmic_infinity', title: 'Cosmic Infinity', icon: '🌌', subtitle: 'Infinity Reels · 3→12 bębnów · mnożnik do ×25',
    theme: { a: '#b48cff', b: '#4fe3ff' },
    cols: 3, rows: 3, event: 'casinoCISpin',
    randomSym: ciRand,
    symHTML: ciSymHTML,
    scatter: {
      is: i => i === CI.PLANET, icon: '🪐', need: 3, fx: 'cosmic',
      theme: { colors: ['#b48cff', '#4fe3ff', '#ff7ad9', '#ffffff'], land: [['star', 14], ['ring', 1]], ant: 'star', win: [['star', 34], ['ring', 3], ['smoke', 10]] },
    },
    anticipate: grid => {
      let n = 0;
      for (let c = 0; c < grid.length; c++) { if (n >= 2 && c >= ciSt.stopFrom) return c; n += grid[c].filter(s => s === CI.PLANET).length; }
      return null;
    },
    features: ciFeatures,
    payDivisor: () => 1,
    payLabels: ['', '', '', '3 bębny', '4 bębny', '5 bębnów', '6 bębnów', '7 bębnów', '8 bębnów', '9 bębnów', '10 bębnów', '11 bębnów', '12 bębnów'],
    rules: [
      'Start: 3 rzędy × 3 bębny. Wygrane „ways” od lewej — symbol musi wystąpić na kolejnych bębnach (min. 3), sposoby się mnożą.',
      'INFINITY REELS: każda wygrana dokłada NOWY BĘBEN po prawej (kręci się tylko on). Gdy nowy bęben przedłuża wygraną, pojawia się następny — aż do 12 bębnów.',
      'Mnożnik całej wygranej spinu zależy od najdalszego bębna z wygraną: 4 → ×1, 5 → ×2, 6 → ×3, 7 → ×4, 8 → ×6, 9 → ×8, 10 → ×12, 11 → ×18, 12 → ×25.',
      '🌟 Supernowa (Wild) pojawia się od bębna 2 i zastępuje wszystkie symbole poza Planetą.',
      '🪐 Planeta (Scatter): 3 lub więcej w jednym spinie (na wszystkich bębnach, także dołożonych) = 10 Free Spinów. W Free Spinach 3+ Planety = +10.',
      'Free Spiny: mnożnik startuje od ×3 (jak dla 6 bębnów) i nigdy nie spada — zostaje najwyższy osiągnięty. Więcej Supernowych na bębnach.',
      'Wypłaty w tabeli: × stawki łącznej za 1 sposób. Maksymalna wygrana: 10 000× stawki.',
      'RTP ≈ 95%.',
    ],
    onMount(kit) {
      const m = kit.$('machine');
      m.insertAdjacentHTML('afterbegin', `<div class="ci-space"><div class="ci-nebula"></div><div class="ci-layer l1"><i></i></div><div class="ci-layer l2"><i></i></div><div class="ci-layer l3"><i></i></div></div><div class="ci-hole"></div>`);
      ciLayout(kit);
      setTimeout(() => ciLayout(kit), 60);
      if (!window._ciResize) { window._ciResize = true; addEventListener('resize', () => { if (skActive && skActive === ciKit) ciLayout(ciKit); }); }
      if (window.ResizeObserver) new ResizeObserver(() => ciPlaceHole(kit)).observe(kit.$('machine'));
      ciUpdateMeter(kit, 3, 1);
    },
    onSpinStart(kit) {
      ciSt.stopFrom = 0;
      ciSt.lit = [];
      if (kit.board('main').cols !== CI.START) {
        const g = kit.grids.main || [];
        ciSetCols(kit, CI.START, g.slice(0, CI.START).length === CI.START ? g.slice(0, CI.START) : null);
        ciWarp(kit, -60);
      }
      ciUpdateMeter(kit, 3, Math.max(1, ciSt.fsMult));
      kit.startSpin();
    },
    async present(res, kit) {
      if (res.isFree && !ciSt.fsMult) ciSt.fsMult = 3;
      const wins = res.wins || [];
      if (kit.board('main').cols !== CI.START) ciSetCols(kit, CI.START, res.startGrid);
      await kit.stop(res.startGrid);
      const cur = res.startGrid.map(c => [...c]);
      if (res.steps.length) {
        ciHighlight(kit, wins, CI.START - 1);
        for (const [c, r] of wins.flatMap(w => w.cells).filter(([c]) => c < 3)) { const p = kit.cellCenter(c, r); if (p) kit.emit(p.x, p.y, 'spark', 5, { spread: p.w / 3 }); }
        cxSound.play('win');
        kit.msg('✨ Wygrana! Nadlatuje nowy bęben…', 'win');
        await kit.wait(kit.turbo ? 200 : 600);
        for (const st of res.steps) {
          cur.push(st.symbols);
          await ciAddReel(kit, cur, st, wins);
        }
      }
      kit.clearWins();
      if (wins.length) {
        ciHighlight(kit, wins, 99);
        const sum = wins.flatMap(w => w.cells);
        const seen = new Set();
        for (const [c, r] of sum) { const k = c + ',' + r; if (seen.has(k) || seen.size > 24) continue; seen.add(k); kit.burstCell(c, r, 'main', 6); }
        kit.cycleWins(wins.map(w => ({ ...w, win: w.win * res.reelMult })));
      }
      ciSt.fsMult = res.fsMult || (res.isFree && res.freeSpinsRemaining > 0 ? ciSt.fsMult : 0);
      if (res.payout > 0 && res.reelMult > 1) {
        res._msgSet = true;
        kit.msg(`🌌 ${cxFmt(res.baseWin)} × <b>${res.reelMult}</b> = <span class="amt">${cxFmt(res.payout)} AT$</span>${res.capped ? ' (maks.)' : ''}`, 'big');
        await kit.bigMult(res.reelMult, { label: res.isFree ? 'MNOŻNIK FS' : 'MNOŻNIK' });
      }
      ciUpdateMeter(kit, res.reelCount, Math.max(res.reelMult, ciSt.fsMult || 0));
      if (res.freeSpinsAwarded) {
        await kit.scatterWin(res.scatter);
        await kit.splash(res.isFree ? `+${res.freeSpinsAwarded} FREE SPINS` : `${res.freeSpinsAwarded} FREE SPINS`, 'Mnożnik startuje od ×3 i nigdy nie spada!', '🪐');
        if (!res.isFree) ciSt.fsMult = 3;
        if (!res._msgSet) { kit.msg(`🪐 Planety! <b>+${res.freeSpinsAwarded} Free Spinów</b> · mnożnik od ×3`, 'feature'); res._msgSet = res.payout === 0; }
      } else if (res.scatter?.length >= 2) kit.highlight(res.scatter, 'main', false, false);
      kit.banner(res.freeSpinsRemaining > 0 ? `🪐 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · mnożnik min. <b>×${ciSt.fsMult || 3}</b>` : '');
      if (!res.freeSpinsRemaining) ciSt.fsMult = 0;
    },
    freeBetOf: res => res.bet,
  });
  ciKit.mount(table);
}
skBindResult('casinoCIResult', () => ciKit);
