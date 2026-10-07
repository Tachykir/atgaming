// ══════════════════════════════════════════════════════════════
//  TITAN COLOSSUS — 5×4, 1024 sposoby, Kolosy 2×2 i 3×3, Kolos-Wild w FS
// ══════════════════════════════════════════════════════════════
const TC_SYMS = ['🔱', '🦅', '🪖', '🏺', 'A', 'K', 'Q', 'J', '10', '9', '🗿', '⚡', ''];
const TC_COLORS = ['#4fc3ff', '#e8c37a', '#c0c7d1', '#ff9f43', '#ffd36b', '#7aa7ff', '#3ff2a3', '#ff6f8a', '#c084fc', '#9fb3c8', '#ffd36b', '#4fc3ff', '#333'];
const TC = { WILD: 10, BOLT: 11, EMPTY: 12, COLS: 5, ROWS: 4 };
const TC_POOL = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 11];
let tcKit = null;
let tcColossi = [];

function tcInjectCss() {
  if (document.getElementById('casino-tc-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-tc-css';
  st.textContent = `
#screen-casino-tc .sk-machine { background: radial-gradient(ellipse at 50% -10%, rgba(79,195,255,.22), transparent 55%), repeating-linear-gradient(115deg, rgba(255,255,255,.025) 0 2px, transparent 2px 9px), linear-gradient(170deg, #3a3830, #1a1915 60%, #0f0e0b); }
#screen-casino-tc .sk-reels { background: linear-gradient(180deg, rgba(0,0,0,.55), rgba(20,18,12,.6)); border: 2px solid rgba(232,195,122,.35); box-shadow: inset 0 0 26px rgba(0,0,0,.7), 0 0 22px rgba(232,195,122,.12); }
#screen-casino-tc .sk-col { background: linear-gradient(180deg, rgba(232,195,122,.04), rgba(192,199,209,.09) 50%, rgba(232,195,122,.04)); }
#screen-casino-tc .sk-tile { background: radial-gradient(circle at 35% 25%, rgba(255,255,255,.14), transparent 55%), linear-gradient(160deg, color-mix(in srgb, var(--c) 28%, #55524a), #24221c); border: 1px solid rgba(232,195,122,.25); }
#screen-casino-tc .sk-cell.tc-under .sk-tile { display: none; }
.tc-colo { position: absolute; z-index: 4; pointer-events: none; border-radius: 16px; transition: opacity .2s, filter .2s; }
.tc-colo .tc-face { position: absolute; inset: 3%; border-radius: 14%; display: grid; place-items: center; overflow: hidden;
  background: radial-gradient(circle at 35% 22%, rgba(255,255,255,.22), transparent 50%), repeating-linear-gradient(135deg, rgba(0,0,0,.08) 0 3px, transparent 3px 10px), linear-gradient(160deg, color-mix(in srgb, var(--c) 40%, #6b665a), #2a271f);
  border: 3px solid #e8c37a; box-shadow: inset 0 0 30px rgba(0,0,0,.6), inset 0 0 0 2px rgba(255,243,196,.25), 0 10px 30px rgba(0,0,0,.6), 0 0 26px rgba(232,195,122,.45); }
.tc-colo .tc-face span { font-size: 1em; line-height: 1; filter: drop-shadow(0 8px 10px rgba(0,0,0,.7)); }
.tc-colo .tc-face span.l { font-family: 'Syne', sans-serif; font-weight: 800; color: #fff; text-shadow: 0 5px 0 color-mix(in srgb, var(--c) 50%, #000), 0 0 22px var(--c); }
.tc-colo .tc-tag { position: absolute; top: 6%; left: 50%; transform: translateX(-50%); font: 800 calc(var(--tcw) * .065) 'DM Mono', monospace; letter-spacing: .12em; padding: 2px 10px; border-radius: 999px; background: rgba(0,0,0,.7); color: #e8c37a; border: 1px solid rgba(232,195,122,.6); white-space: nowrap; z-index: 2; }
.tc-colo .tc-mult { position: absolute; bottom: 6%; right: 6%; font: 800 calc(var(--tcw) * .13) 'Syne', sans-serif; color: #fff; padding: 2px 12px; border-radius: 12px; background: linear-gradient(180deg, #4fc3ff, #1e5fa8); border: 2px solid #e0f2ff; box-shadow: 0 0 20px #4fc3ff; z-index: 2; }
.tc-colo.wild .tc-face { border-color: #4fc3ff; box-shadow: inset 0 0 40px rgba(79,195,255,.45), 0 0 34px rgba(79,195,255,.65), 0 10px 30px rgba(0,0,0,.6); }
.tc-colo.wild .tc-face::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(224,242,255,.45) 48%, transparent 60%); animation: skShine 1.8s linear infinite; }
.tc-colo.dim { opacity: .35; filter: grayscale(.6); }
.tc-colo.hit .tc-face { animation: tcHit .7s ease-in-out infinite alternate; border-color: #fff3c4; box-shadow: 0 0 0 3px #ffd36b, 0 0 40px #ffd36b, inset 0 0 30px rgba(255,211,107,.4); }
@keyframes tcHit { from { transform: scale(1); } to { transform: scale(1.035); } }
.tc-track { display: flex; gap: 6px; align-items: center; font-size: 11px; color: #cfc6ad; }
.tc-track b { font-family: 'DM Mono', monospace; color: #e8c37a; }
@media (orientation: landscape) and (max-height: 540px) { .tc-colo .tc-face { border-width: 2px; } .tc-track { font-size: 9px; } }`;
  document.head.appendChild(st);
}

function tcSymHTML(i) {
  if (i === TC.EMPTY) return { html: '', noTile: true };
  const letter = i >= 4 && i <= 9;
  if (letter) return { html: `<span style="font-size:${TC_SYMS[i].length > 1 ? '.72' : '.92'}em">${TC_SYMS[i]}</span>`, tile: 'letter', color: TC_COLORS[i] };
  return { html: `<span class="sk-emo">${TC_SYMS[i]}</span>`, color: TC_COLORS[i], cls: i === TC.WILD ? 'wild' : i === TC.BOLT ? 'scatter' : '' };
}
function tcRand() { return TC_POOL[Math.floor(Math.random() * TC_POOL.length)]; }
function tcCovers(k, c, r) { return c >= k.c && c < k.c + k.size && r >= k.r && r < k.r + k.size; }

// Geometria kolosa — jeden kafelek nad obszarem 2×2 / 3×3
function tcGeom(kit, k) {
  const m = kit.$('machine'), a = kit.cell(k.c, k.r), b = kit.cell(k.c + k.size - 1, k.r + k.size - 1);
  if (!m || !a || !b) return null;
  const mr = m.getBoundingClientRect(), ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
  return { left: ar.left - mr.left, top: ar.top - mr.top, w: br.right - ar.left, h: br.bottom - ar.top };
}
function tcPlace(kit) {
  for (const k of tcColossi) {
    if (!k.el) continue;
    const g = tcGeom(kit, k); if (!g) continue;
    Object.assign(k.el.style, { left: g.left + 'px', top: g.top + 'px', width: g.w + 'px', height: g.h + 'px', fontSize: Math.round(g.w * (k.size === 3 ? .42 : .48)) + 'px' });
    k.el.style.setProperty('--tcw', g.w + 'px');
  }
}
function tcClear() { tcColossi.forEach(k => k.el?.remove()); tcColossi = []; }
// Podświetlenie wygranych obejmuje kolosa (synchronizacja z klasami komórek)
function tcSync(kit) {
  const b = kit.board('main'); if (!b?.el) return;
  const dim = b.el.classList.contains('dim');
  for (const k of tcColossi) {
    if (!k.el) continue;
    let hit = false;
    for (let dc = 0; dc < k.size && !hit; dc++) for (let dr = 0; dr < k.size; dr++) if (kit.cell(k.c + dc, k.r + dr)?.classList.contains('hit')) { hit = true; break; }
    k.el.classList.toggle('hit', hit);
    k.el.classList.toggle('dim', dim && !hit);
  }
}

async function tcDrop(kit, k) {
  const m = kit.$('machine');
  const el = document.createElement('div');
  const letter = k.sym >= 4 && k.sym <= 9;
  el.className = 'tc-colo' + (k.wild ? ' wild' : '');
  el.style.setProperty('--c', TC_COLORS[k.sym]);
  el.innerHTML = `<div class="tc-face"><span class="${letter ? 'l' : ''}">${TC_SYMS[k.sym]}</span></div><div class="tc-tag">${k.wild ? 'KOLOS-WILD' : 'KOLOS ' + k.size + '×' + k.size}</div>${k.wild ? `<div class="tc-mult">×${k.m}</div>` : ''}`;
  m.appendChild(el);
  k.el = el;
  tcPlace(kit);
  const g = tcGeom(kit, k);
  const dur = kit.turbo ? 260 : 520;
  // cień na planszy przed uderzeniem
  el.animate([
    { transform: `translateY(${-(g.top + g.h + 40)}px) scale(1.35) rotate(-4deg)`, opacity: .4, filter: 'blur(3px)' },
    { transform: 'translateY(0) scale(1.06) rotate(0)', opacity: 1, filter: 'none', offset: .75 },
    { transform: 'translateY(0) scale(.97)', offset: .88 },
    { transform: 'none', opacity: 1 },
  ], { duration: dur, easing: 'cubic-bezier(.55,0,.9,.4)' });
  cxSound.play('feature');
  await kit.wait(dur * .75);
  // Uderzenie: wstrząs, pył, pierścień (+ pioruny dla Kolosa-Wild)
  m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake');
  cxSound.play(k.size === 3 ? 'bigwin' : 'stop');
  const cx = g.left + g.w / 2, by = g.top + g.h;
  kit.emit(cx, by - 6, 'sand', 50, { spread: g.w / 2, scale: 1.6, speed: 1.6, colors: ['#e8c37a', '#c9b48a', '#fff3c4', '#8a7f68'] });
  kit.emit(cx, g.top + g.h / 2, 'smoke', 10, { spread: g.w / 2.5, scale: 1.5, colors: ['#a39b86', '#6b665a', '#d6ccb1'] });
  kit.emit(cx, g.top + g.h / 2, 'ring', 3, { scale: g.w / 90, colors: k.wild ? ['#4fc3ff', '#e0f2ff'] : ['#e8c37a', '#fff3c4'] });
  if (k.wild) kit.emit(cx, g.top + g.h / 2, 'bolt', 8, { scale: g.w / 120, colors: ['#4fc3ff', '#e0f2ff', '#fff'] });
  await kit.wait(dur * .3 + (kit.turbo ? 60 : 260));
  if (k.wild) await kit.bigMult(k.m, { c: k.c + 1, r: k.r + 1, label: 'KOLOS-WILD' });
}

function initTCUI(table) {
  tcInjectCss();
  tcClear();
  tcKit = new SlotKit({
    screenId: 'casino-tc', game: 'titan_colossus', title: 'Titan Colossus', icon: '🗿', subtitle: '5×4 · 1024 sposoby · Kolosy 2×2 i 3×3',
    theme: { a: '#e8c37a', b: '#4fc3ff' },
    cols: TC.COLS, rows: TC.ROWS, event: 'casinoTCSpin', boardMaxWidth: '480px',
    randomSym: tcRand,
    symHTML: tcSymHTML,
    decorate(el, c, r, si) { el.classList.toggle('tc-under', si === TC.EMPTY); },
    scatter: {
      is: i => i === TC.BOLT, icon: '⚡', need: 3, fx: 'neon',
      theme: { colors: ['#4fc3ff', '#ffd36b', '#e0f2ff', '#c0c7d1'], land: [['bolt', 4], ['sand', 14], ['ring', 1]], ant: 'bolt', win: [['bolt', 12], ['sand', 30], ['ring', 3]] },
    },
    features: () => `<div class="sk-meter" style="flex:3"><div class="sk-meter-top"><span>🗿 Kolosy 2×2 i 3×3 na bębnach 2–4</span><span>⚡ ×3 (bębny 1·3·5) = <b>10 FS</b></span></div>
      <div class="tc-track"><span>Free Spiny: <b>KOLOS-WILD 3×3</b> z mnożnikiem</span><b>×2</b><b>×3</b><b>×5</b></div></div>`,
    payDivisor: () => 1,
    rules: [
      '5 bębnów × 4 rzędy, 1024 sposoby: wygrane od lewej, symbol na kolejnych bębnach (min. 3). Liczba sposobów = iloczyn trafień na bębnach.',
      'KOLOSY: na bębnach 2–4 mogą wylądować gigantyczne symbole 2×2 albo 3×3. Kolos liczy się jako ten symbol na KAŻDYM zajętym polu — sposoby się mnożą.',
      '🗿 Posąg (Wild) pojawia się na bębnach 2–5 i zastępuje wszystkie symbole poza Piorunem.',
      '⚡ Piorun (Scatter) tylko na bębnach 1, 3 i 5: 3 Pioruny = 10 Free Spinów (w Free Spinach +10).',
      'Free Spiny: w około 1/3 spinów na bębny 2–4 spada KOLOS-WILD 3×3 z mnożnikiem ×2 / ×3 / ×5, który mnoży całą wygraną spinu (na każdym bębnie liczy się jako jeden Wild). Częstsze zwykłe Kolosy.',
      'Wypłaty w tabeli: × stawki łącznej za 1 sposób. Maksymalna wygrana: 10 000× stawki.',
      'RTP ≈ 95%.',
    ],
    onMount(kit) {
      const b = kit.board('main').el;
      new MutationObserver(() => tcSync(kit)).observe(b, { subtree: true, attributes: true, attributeFilter: ['class'] });
      // Baner / zmiana rozmiaru przesuwa planszę — kolosy muszą podążać za komórkami
      if (window.ResizeObserver) new ResizeObserver(() => tcPlace(kit)).observe(kit.$('machine'));
      if (!window._tcResize) { window._tcResize = true; addEventListener('resize', () => { if (skActive && skActive === tcKit) tcPlace(tcKit); }); }
    },
    onSpinStart(kit) {
      tcColossi.forEach(k => k.el?.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-30px) scale(1.1)' }], { duration: 200, fill: 'forwards' }));
      setTimeout(tcClear, 200);
      kit.startSpin();
    },
    async present(res, kit) {
      tcClear();
      const disp = res.grid.map((col, c) => col.map((s, r) => res.colossi.some(k => tcCovers(k, c, r)) ? TC.EMPTY : s));
      await kit.stop(disp);
      tcColossi = res.colossi.map(k => ({ ...k }));
      kit.grids.main = disp;
      for (const k of tcColossi) await tcDrop(kit, k);
      const wins = res.wins || [];
      if (wins.length) {
        const cells = wins.flatMap(w => w.cells);
        kit.highlight(cells, 'main', true, true);
        tcSync(kit);
        for (const k of tcColossi) if (k.el?.classList.contains('hit')) { const g = tcGeom(kit, k); if (g) kit.emit(g.left + g.w / 2, g.top + g.h / 2, 'sand', 30, { spread: g.w / 2, colors: ['#ffd36b', '#fff3c4'] }); }
        kit.cycleWins(wins.map(w => ({ ...w, win: w.win * (res.colMult || 1) })));
        const best = wins.slice().sort((a, b) => b.win - a.win)[0];
        if (res.payout > 0) {
          res._msgSet = true;
          const txt = wins.slice(0, 3).map(w => `${TC_SYMS[w.symIdx]}×${w.count} · ${w.ways} spos.`).join(' | ');
          kit.countMsg(`${res.label || 'Wygrana'}: ${txt}${res.colMult > 1 ? ` · <b>×${res.colMult}</b>` : ''}`, res.payout, CX_TIER_ORDER.indexOf(res.tier) >= 2 ? 'big' : 'win');
        }
        if (best && best.ways >= 27 && !kit.turbo) await kit.wait(500);
      }
      if (res.freeSpinsAwarded) {
        await kit.scatterWin(res.scatter);
        await kit.splash(res.isFree ? `+${res.freeSpinsAwarded} FREE SPINS` : `${res.freeSpinsAwarded} FREE SPINS`, 'Kolos-Wild 3×3 z mnożnikiem ×2 / ×3 / ×5!', '⚡');
        if (!res._msgSet) { kit.msg(`⚡ Gniew Tytanów! <b>+${res.freeSpinsAwarded} Free Spinów</b>`, 'feature'); res._msgSet = res.payout === 0; }
      }
      kit.banner(res.freeSpinsRemaining > 0 ? `⚡ FREE SPINS: <b>${res.freeSpinsRemaining}</b> · 🗿 Kolos-Wild 3×3 z mnożnikiem` : '');
      tcPlace(kit);
    },
    freeBetOf: res => res.bet,
  });
  tcKit.mount(table);
}
skBindResult('casinoTCResult', () => tcKit);
