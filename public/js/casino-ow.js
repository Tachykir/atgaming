// ══════════════════════════════════════════════════════════════
//  OLYMPUS WAYS — Megaways 6 bębnów (2–7 symboli), kaskady,
//  ⚡ Wild na bębnach 2–5, 🏛️ Scatter → Free Spiny z nieograniczonym mnożnikiem
// ══════════════════════════════════════════════════════════════
const OW_SYMS = ['👑', '🔱', '🦅', '🏺', '🍷', '💍', '🍇', '🫒', '🌿', '🪙', '⚡', '🏛️'];
const OW_NAMES = ['Korona Zeusa', 'Trójząb', 'Orzeł', 'Amfora', 'Kielich', 'Pierścień', 'Winogrona', 'Oliwka', 'Laur', 'Drachma', 'Piorun', 'Świątynia'];
const OW_COLORS = ['#ffd36b', '#4fc3ff', '#e7c58a', '#ff9f43', '#c084fc', '#7cc4ff', '#a78bfa', '#8bd36b', '#5fd39a', '#f5c542', '#fff36b', '#e0ecff'];
const OW = { WILD: 10, TEMPLE: 11, ROWS: 7, TALL: 5.4 }; // TALL: wysokość bębna w szerokościach komórki
const OW_POOL = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 11];
let owKit = null, owMult = 1, owWays = 0, owWaysAnim = null;

function owCSS() {
  if (document.getElementById('casino-ow-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-ow-css';
  st.textContent = `
  #screen-casino-ow .sk-machine { background: radial-gradient(ellipse at 50% -10%, rgba(124,196,255,.28), transparent 60%), linear-gradient(180deg, #13214a, #070c1e 70%); }
  #screen-casino-ow .sk-reels { background: linear-gradient(180deg, rgba(10,20,50,.85), rgba(4,8,22,.9)); border-color: rgba(124,196,255,.25); box-shadow: inset 0 0 40px rgba(124,196,255,.12); }
  #screen-casino-ow .sk-col { aspect-ratio: 1 / ${OW.TALL} !important; container-type: inline-size; background: linear-gradient(180deg, rgba(124,196,255,.05), rgba(255,211,107,.06) 50%, rgba(124,196,255,.05)); border: 1px solid rgba(124,196,255,.12); }
  #screen-casino-ow .sk-col .sk-cell { aspect-ratio: var(--owh, 7) / ${OW.TALL}; font-size: clamp(12px, 54cqw, 58px); }
  #screen-casino-ow .sk-col .sk-tile { inset: 3px 4px; border-radius: 12px; }
  #screen-casino-ow .sk-col.ow-tall .sk-tile { background-image: linear-gradient(180deg, rgba(255,255,255,.12), transparent 30%, transparent 70%, rgba(255,255,255,.06)); }
  #screen-casino-ow .sk-col .ow-h { position: absolute; left: 50%; bottom: 2px; transform: translateX(-50%); z-index: 4; font: 800 10px 'DM Mono', monospace; color: #cfe6ff; background: rgba(4,10,30,.8); border: 1px solid rgba(124,196,255,.45); padding: 0 5px; border-radius: 6px; pointer-events: none; }
  #screen-casino-ow .sk-cell.wild .sk-tile { border-color: #fff36b; box-shadow: inset 0 0 18px rgba(255,243,107,.45), 0 0 16px rgba(255,243,107,.5); animation: owWild 1.4s ease-in-out infinite alternate; }
  @keyframes owWild { to { box-shadow: inset 0 0 26px rgba(255,255,255,.6), 0 0 26px rgba(124,196,255,.8); } }
  .ow-meters { display: flex; gap: 10px; width: 100%; }
  .ow-meter { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 12px; border-radius: 12px; background: rgba(4,10,30,.6); border: 1px solid rgba(124,196,255,.3); }
  .ow-meter span { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #9fc8ff; }
  .ow-meter b { font: 800 22px/1 'DM Mono', monospace; color: #fff; text-shadow: 0 0 14px rgba(124,196,255,.8); }
  .ow-meter b.bump { animation: owBump .45s cubic-bezier(.3,1.8,.5,1); }
  @keyframes owBump { 40% { transform: scale(1.35); color: #ffd36b; } }
  .ow-meter.mult b { font-size: 26px; color: #ffd36b; text-shadow: 0 0 16px rgba(255,211,107,.9), 0 2px 0 #7a4b00; }
  .ow-meter.mult.off { opacity: .45; filter: grayscale(.4); }
  .ow-meter.mult.live { border-color: #ffd36b; box-shadow: 0 0 20px rgba(255,211,107,.35), inset 0 0 18px rgba(255,211,107,.15); animation: owPulse 1.2s ease-in-out infinite; }
  .ow-meter.mult.hot b { animation: owHot .6s ease-in-out infinite alternate; }
  @keyframes owPulse { 50% { box-shadow: 0 0 34px rgba(255,211,107,.6), inset 0 0 22px rgba(255,211,107,.25); } }
  @keyframes owHot { to { transform: scale(1.12); text-shadow: 0 0 30px #fff, 0 0 18px #ffd36b; } }
  .ow-strike { position: absolute; inset: 0; z-index: 8; pointer-events: none; }
  .ow-strike svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .ow-strike path { fill: none; stroke: #fff; stroke-width: 4; filter: drop-shadow(0 0 6px #7cc4ff) drop-shadow(0 0 16px #4fa3ff); stroke-linecap: round; stroke-linejoin: round; }
  .ow-strike .fl { position: absolute; inset: 0; background: radial-gradient(circle at var(--x) var(--y), rgba(255,255,255,.75), rgba(124,196,255,.25) 35%, transparent 65%); animation: owFlash .45s ease-out forwards; }
  @keyframes owFlash { from { opacity: 1; } to { opacity: 0; } }
  @media (max-height: 500px) and (orientation: landscape) {
    .ow-meter { padding: 2px 8px; } .ow-meter span { font-size: 9px; } .ow-meter b { font-size: 15px !important; }
    #screen-casino-ow .sk-col .ow-h { font-size: 8px; }
  }`;
  document.head.appendChild(st);
}

function owFeatures() {
  return `<div class="ow-meters">
    <div class="ow-meter ways"><span>⚡ Sposoby</span><b data-ow="ways">—</b></div>
    <div class="ow-meter mult off" data-ow="multbox"><span>🌩️ Mnożnik Zeusa</span><b data-ow="mult">×1</b></div>
  </div>`;
}
function owSetWays(n, animate = true) {
  const el = owKit?.root.querySelector('[data-ow="ways"]');
  if (!el) return;
  cancelAnimationFrame(owWaysAnim);
  const from = owWays || 0, t0 = performance.now(), dur = animate ? (owKit.turbo ? 250 : 650) : 0;
  owWays = n;
  const step = now => {
    const p = dur ? Math.min(1, (now - t0) / dur) : 1;
    el.textContent = Math.round(from + (n - from) * (1 - Math.pow(1 - p, 3))).toLocaleString('pl-PL');
    if (p < 1) owWaysAnim = requestAnimationFrame(step);
    else { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  };
  owWaysAnim = requestAnimationFrame(step);
}
function owSetMult(m, live) {
  owMult = m;
  if (!owKit) return;
  const box = owKit.root.querySelector('[data-ow="multbox"]'), el = owKit.root.querySelector('[data-ow="mult"]');
  if (!box) return;
  el.textContent = '×' + m;
  box.classList.toggle('off', !live);
  box.classList.toggle('live', !!live);
  box.classList.toggle('hot', !!live && m >= 10);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
function owSetHeights(kit, heights) {
  heights.forEach((h, c) => {
    const col = kit.colEl(c);
    if (!col) return;
    col.style.setProperty('--owh', h);
    col.classList.toggle('ow-tall', h <= 3);
    let tag = col.querySelector('.ow-h');
    if (!tag) { tag = document.createElement('div'); tag.className = 'ow-h'; col.appendChild(tag); }
    tag.textContent = h;
  });
}
// Piorun Zeusa: błyskawica z góry automatu w punkt (x, y)
function owStrike(kit, x, y) {
  const m = kit.$('machine'); if (!m) return;
  const mr = m.getBoundingClientRect();
  const sx = mr.width * (.35 + Math.random() * .3), sy = 0;
  let d = `M${sx},${sy}`;
  const n = 9;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const px = sx + (x - sx) * t + (i < n ? (Math.random() - .5) * 46 : 0), py = sy + (y - sy) * t;
    d += ` L${px.toFixed(1)},${py.toFixed(1)}`;
  }
  const el = document.createElement('div');
  el.className = 'ow-strike';
  el.style.setProperty('--x', x + 'px'); el.style.setProperty('--y', y + 'px');
  el.innerHTML = `<div class="fl"></div><svg viewBox="0 0 ${mr.width} ${mr.height}"><path d="${d}"/></svg>`;
  m.appendChild(el);
  const path = el.querySelector('path');
  const len = path.getTotalLength ? path.getTotalLength() : 600;
  path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
  path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 140, fill: 'forwards' });
  el.animate([{ opacity: 1 }, { opacity: 1, offset: .6 }, { opacity: 0 }], { duration: 520, fill: 'forwards' });
  setTimeout(() => el.remove(), 560);
  kit.emit(x, y, 'bolt', 6, { scale: 1.3, colors: ['#ffffff', '#7cc4ff', '#ffd36b'] });
  kit.emit(x, y, 'star', 16, { spread: 24, speed: 1.6, colors: ['#ffffff', '#ffd36b', '#7cc4ff'] });
  kit.emit(x, y, 'ring', 2, { scale: 1.4, colors: ['#ffffff', '#7cc4ff'] });
  m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake');
}

function initOWUI(table) {
  owCSS();
  owMult = 1; owWays = 0;
  owKit = new SlotKit({
    screenId: 'casino-ow', game: 'olympus_ways', title: 'Olympus Ways', icon: '⚡', subtitle: 'Megaways · do 117 649 sposobów · kaskady · mnożnik ∞',
    theme: { a: '#7cc4ff', b: '#ffd36b' },
    cols: 6, rows: OW.ROWS, event: 'casinoOWSpin', boardMaxWidth: '540px', stagger: 110,
    randomSym: () => OW_POOL[Math.floor(Math.random() * OW_POOL.length)],
    symHTML: i => ({ html: `<span class="sk-emo">${OW_SYMS[i]}</span>`, color: OW_COLORS[i], cls: i === OW.WILD ? 'wild' : i === OW.TEMPLE ? 'scatter' : '' }),
    scatter: {
      is: i => i === OW.TEMPLE, icon: '🏛️', need: 4, fx: 'eclipse',
      theme: { colors: ['#7cc4ff', '#ffd36b', '#ffffff', '#4f8cff'], land: [['bolt', 3], ['star', 12], ['ring', 1]], ant: 'bolt', win: [['bolt', 10], ['star', 34], ['ring', 3]] },
    },
    features: owFeatures,
    payDivisor: () => 1,
    payLabels: ['', '', '', '3 bębny', '4 bębny', '5 bębnów', '6 bębnów'],
    rules: [
      'MEGAWAYS: 6 bębnów, na każdym przy każdym spinie losowo 2–7 symboli. Liczba sposobów wygranej to iloczyn wysokości bębnów — maksymalnie 117 649.',
      'Wygrana: ten sam symbol na kolejnych bębnach od lewej (min. 3 bębny). Wypłata = wartość z tabeli × liczba kombinacji (iloczyn liczby takich symboli na każdym bębnie).',
      '⚡ Piorun (Wild) pojawia się tylko na bębnach 2–5 i zastępuje każdy symbol poza Świątynią.',
      'KASKADY: wygrywające symbole znikają, a z góry spadają nowe (wysokość bębna się nie zmienia) — aż do braku wygranej.',
      '🏛️ Świątynia (Scatter): 4 / 5 / 6 = 10 / 15 / 20 Free Spinów (+5 za każdą kolejną). W Free Spinach 3+ Świątynie = +5 spinów za każdą ponad dwie.',
      '🌩️ FREE SPINY — MNOŻNIK ZEUSA: startuje od ×1, rośnie o +1 po każdej kaskadzie i NIE resetuje się między spinami. Każda wygrana jest mnożona przez bieżący mnożnik.',
      'Maksymalna wygrana: 10 000× stawki (na spin / cały bonus).',
      'Wypłaty w tabeli to × stawki łącznej za JEDNĄ kombinację (sposób).',
      'RTP ≈ 95%.',
    ],
    onMount(kit) {
      // proporcje planszy dla widoku telefonu (bębny niższe niż 7 kwadratów)
      kit.board().el.style.setProperty('--sk-ar', `${6 * 100 + 5 * 6 + 16} / ${OW.TALL * 100 + 16}`);
      // plansza startowa bez wildów na bębnach 1 i 6
      kit.setGrid(Array.from({ length: 6 }, (_, c) => Array.from({ length: OW.ROWS }, () => { let s; do { s = OW_POOL[Math.floor(Math.random() * OW_POOL.length)]; } while ((c === 0 || c === 5) && s === OW.WILD); return s; })));
      owSetWays(117649, false); owSetMult(1, false);
    },
    async present(res, kit) {
      const fs = res.isFree;
      owSetMult(fs ? res.startMult : 1, fs || res.freeSpinsRemaining > 0);
      owSetHeights(kit, res.heights);
      owSetWays(res.ways);
      await kit.stop(res.startGrid);
      let total = 0;
      for (let si = 0; si < res.steps.length; si++) {
        const st = res.steps[si];
        const cells = st.wins.flatMap(w => w.cells);
        kit.highlight(cells);
        // wildy w wygranej — iskry pioruna
        cells.forEach(([c, r]) => { if (kit.grids.main[c][r] === OW.WILD) { const p = kit.cellCenter(c, r); if (p) kit.emit(p.x, p.y, 'bolt', 2, { scale: p.w / 70, colors: ['#fff', '#7cc4ff'] }); } });
        cxSound.play(st.win >= res.bet * 5 ? 'bigwin' : 'win');
        total += st.win;
        const desc = st.wins.slice(0, 4).map(w => `${OW_SYMS[w.symIdx]}×${w.reels} <small style="opacity:.7">(${w.ways.toLocaleString('pl-PL')} spos.)</small>`).join(' · ') + (st.wins.length > 4 ? ' …' : '');
        kit.msg(`${si ? `Kaskada ${si + 1}: ` : ''}${desc}${fs && st.x > 1 ? ` <b style="color:#ffd36b">×${st.x}</b>` : ''} <span class="amt">+${cxFmt(st.win)} AT$</span>`, st.win >= res.bet * 5 ? 'big' : 'win');
        if (fs && st.x >= 2) {
          const [c, r] = cells[Math.floor(cells.length / 2)];
          const p = kit.cellCenter(c, r);
          if (p) owStrike(kit, p.x, p.y);
          await kit.bigMult(st.x, { c, r, label: 'MNOŻNIK ZEUSA' });
        } else await kit.wait(kit.turbo ? 350 : 800);
        kit.clearWins();
        await kit.cascade(cells, st.grid, st.falling);
        if (fs) {
          // +1 do mnożnika po każdej kaskadzie — piorun w licznik
          const box = kit.root.querySelector('[data-ow="multbox"]'), mr = kit.$('machine').getBoundingClientRect();
          if (box) { const br = box.getBoundingClientRect(); owStrike(kit, br.left - mr.left + br.width / 2, br.top - mr.top + br.height / 2); }
          owSetMult(st.x + 1, true);
          cxSound.play('feature');
          await kit.wait(kit.turbo ? 120 : 260);
        }
      }
      if (res.steps.length > 1) { res._msgSet = true; kit.countMsg(`⚡ ${res.steps.length} kaskad${fs ? ` · mnożnik ×${res.fsMult}` : ''}!`, res.payout, 'big'); }
      if (res.capped) { res._msgSet = true; kit.msg(`🏛️ Osiągnięto maksymalną wygraną 10 000× — <span class="amt">${cxFmt(res.payout)} AT$</span>`, 'big'); }
      if (res.freeSpinsAwarded) {
        await kit.scatterWin(res.scatter.cells);
        await kit.splash(fs ? `+${res.freeSpinsAwarded} FREE SPINS` : `${res.freeSpinsAwarded} FREE SPINS`, fs ? `Mnożnik zostaje: ×${res.fsMult}` : 'Mnożnik Zeusa rośnie z każdą kaskadą i nie spada!', '⚡', '#7cc4ff');
        if (!res._msgSet || res.payout === 0) { kit.msg(`🏛️ ${res.scatter.count} Świątynie! <b>+${res.freeSpinsAwarded} Free Spinów</b>`, 'feature'); res._msgSet = res.payout === 0; }
        owSetMult(fs ? res.fsMult : 1, true);
      } else if (res.scatter.count >= 3) kit.highlight(res.scatter.cells, 'main', false, false);
      kit.banner(res.freeSpinsRemaining > 0 ? `⚡ FREE SPINS: <b>${res.freeSpinsRemaining}</b> · 🌩️ mnożnik <b>×${res.freeSpinsAwarded && !fs ? 1 : res.fsMult}</b> nie spada!` : '', 'gold');
      if (res.fsSummary) {
        res.fsSummary.title = `⚡ Free Spiny — mnożnik ×${res.fsSummary.x}`;
        setTimeout(() => { if (owKit === kit && !kit.spinning) owSetMult(1, false); }, 1200);
      }
    },
    freeBetOf: res => res.bet,
  });
  owKit.mount(table);
}
skBindResult('casinoOWResult', () => owKit);
