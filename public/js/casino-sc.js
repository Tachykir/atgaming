// ══════════════════════════════════════════════════════════════
//  SUGAR CELLS — 7×7 Cluster Pays, pola-mnożniki (×2 … ×128),
//  w Free Spinach pola zostają na całą serię
// ══════════════════════════════════════════════════════════════
const SC_SYMS = ['🍰', '🧁', '🍩', '🍭', '🍫', '🍪', '🍮', '🍬'];
const SC_COLORS = ['#ff8fd0', '#c4a7ff', '#ffb38a', '#7ff5d0', '#c08a5a', '#f5d08a', '#ffe08a', '#ff5fb8'];
const SC = { CANDY: 7, N: 7 };
const SC_POOL = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7];
let scKit = null, scSpots = Array(49).fill(0);

function scCSS() {
  if (document.getElementById('casino-sc-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-sc-css';
  st.textContent = `
  #screen-casino-sc .sk-machine { background: radial-gradient(ellipse at 20% 0%, rgba(255,143,208,.28), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(127,245,208,.18), transparent 55%), linear-gradient(180deg, #3a1530, #1a0a1d 75%); }
  #screen-casino-sc .sk-reels { isolation: isolate; background: linear-gradient(180deg, rgba(60,20,55,.75), rgba(25,10,30,.85)); border-color: rgba(255,143,208,.3); box-shadow: inset 0 0 40px rgba(255,143,208,.12); }
  #screen-casino-sc .sk-col { background: rgba(255,255,255,.03); isolation: isolate; }
  #screen-casino-sc .sk-tile { box-shadow: inset 0 -4px 0 rgba(0,0,0,.18), inset 0 3px 0 rgba(255,255,255,.25); }
  .scl-layer { position: absolute; inset: 0; display: grid; grid-template-rows: repeat(7, 1fr); pointer-events: none; }
  .scl-layer.bg { z-index: -1; }
  .scl-layer.fg { z-index: 4; }
  .scl-layer > div { position: relative; border-radius: 12px; margin: 1px; container-type: inline-size; }
  .scl-layer.bg > div { background: rgba(255,255,255,.035); }
  .scl-layer.bg > .mk { background: radial-gradient(circle, rgba(255,143,208,.55), rgba(196,167,255,.35) 60%, rgba(127,245,208,.25)); box-shadow: 0 0 14px rgba(255,143,208,.45); }
  .scl-layer.bg > .mx { background: radial-gradient(circle, rgba(255,240,150,.7), rgba(255,143,208,.55) 55%, rgba(196,167,255,.4)); box-shadow: 0 0 20px rgba(255,211,107,.6); }
  .scl-layer.fg > .mk::after { content: ''; position: absolute; inset: 2px; border-radius: 11px; border: 2px dashed rgba(255,190,230,.75); }
  .scl-layer.fg > .mx::after { border-style: solid; border-color: rgba(255,240,170,.95); box-shadow: inset 0 0 10px rgba(255,211,107,.5); }
  .scl-badge { position: absolute; right: 3%; bottom: 3%; min-width: 46cqw; padding: 2cqw 5cqw; border-radius: 30cqw; font: 900 26cqw/1 'Syne', sans-serif; text-align: center; color: #fff; background: var(--bc); border: 2px solid rgba(255,255,255,.85); box-shadow: 0 3px 0 rgba(0,0,0,.35), 0 0 14px var(--bc); text-shadow: 0 2px 0 rgba(0,0,0,.35); white-space: nowrap; }
  .scl-badge.v128 { background: linear-gradient(90deg, #ff8fd0, #ffd36b, #7ff5d0, #c4a7ff); background-size: 300% 100%; animation: sclRainbow 1.4s linear infinite; }
  .scl-badge.pop { animation: sclPop .7s cubic-bezier(.2,1.8,.4,1); }
  .scl-badge.v128.pop { animation: sclPop .7s cubic-bezier(.2,1.8,.4,1), sclRainbow 1.4s linear infinite; }
  @keyframes sclPop { 0% { transform: scale(.2) rotate(-20deg); } 55% { transform: scale(1.9) rotate(8deg); } 100% { transform: scale(1); } }
  @keyframes sclRainbow { to { background-position: 300% 0; } }
  .scl-layer.fg > .flash::before { content: ''; position: absolute; inset: -10%; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.95), rgba(255,143,208,.5) 45%, transparent 70%); animation: sclFlash .6s ease-out forwards; }
  @keyframes sclFlash { from { opacity: 1; transform: scale(.5); } to { opacity: 0; transform: scale(1.6); } }
  .scl-meters { display: flex; gap: 10px; width: 100%; }
  .scl-meter { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px; border-radius: 12px; background: rgba(40,10,40,.6); border: 1px solid rgba(255,143,208,.35); }
  .scl-meter span { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #ffc4e8; }
  .scl-meter b { font: 800 20px/1 'DM Mono', monospace; color: #fff; text-shadow: 0 0 12px rgba(255,143,208,.9); }
  .scl-meter.keep { border-color: rgba(127,245,208,.6); box-shadow: 0 0 18px rgba(127,245,208,.25); }
  .scl-meter b.bump { animation: sclBump .45s cubic-bezier(.3,1.8,.5,1); }
  @keyframes sclBump { 40% { transform: scale(1.35); color: #ffd36b; } }
  @media (max-height: 500px) and (orientation: landscape) {
    .scl-meter { padding: 2px 8px; } .scl-meter span { font-size: 9px; } .scl-meter b { font-size: 14px; }
    .scl-badge { border-width: 1px; }
  }`;
  document.head.appendChild(st);
}

const SC_BADGE = { 2: '#3fd6a8', 4: '#9b7bff', 8: '#ff5fb8', 16: '#ffb020', 32: '#ff7a3d', 64: '#ff3b6b', 128: '#ff3b6b' };
// Warstwy pól w każdym bębnie (pod symbolami: tło oznaczenia; nad symbolami: ramka + plakietka mnożnika)
function scLayers(kit) {
  const out = { bg: [], fg: [] };
  for (let c = 0; c < SC.N; c++) {
    const col = kit.colEl(c);
    if (!col.querySelector('.scl-layer')) {
      const cells = '<div></div>'.repeat(SC.N);
      col.insertAdjacentHTML('beforeend', `<div class="scl-layer bg">${cells}</div><div class="scl-layer fg">${cells}</div>`);
    }
    out.bg.push(col.querySelector('.scl-layer.bg')); out.fg.push(col.querySelector('.scl-layer.fg'));
  }
  return out;
}
function scRenderSpot(kit, k, v, pop) {
  const { bg, fg } = scLayers(kit);
  const c = Math.floor(k / SC.N), r = k % SC.N;
  const a = bg[c].children[r], f = fg[c].children[r];
  const cls = v >= 2 ? 'mk mx' : v === 1 ? 'mk' : '';
  a.className = cls; f.className = cls;
  f.innerHTML = v >= 2 ? `<div class="scl-badge v${v}${pop ? ' pop' : ''}" style="--bc:${SC_BADGE[v] || '#ff5fb8'}">×${v}</div>` : '';
  if (pop) { f.classList.add('flash'); setTimeout(() => f.classList.remove('flash'), 650); }
}
function scSetSpots(kit, spots) {
  scSpots = spots.slice();
  spots.forEach((v, k) => scRenderSpot(kit, k, v, false));
  scMeters(kit);
}
function scMeters(kit, keep) {
  const marked = scSpots.filter(v => v > 0).length, best = Math.max(0, ...scSpots), sum = scSpots.reduce((a, v) => a + (v >= 2 ? v : 0), 0);
  const set = (k, t) => { const el = kit.root.querySelector(`[data-sc="${k}"]`); if (el && el.textContent !== t) { el.textContent = t; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } };
  set('marked', marked + '/49'); set('best', best >= 2 ? '×' + best : '—'); set('sum', sum ? '×' + sum : '—');
  if (keep !== undefined) kit.root.querySelector('[data-sc="keepbox"]')?.classList.toggle('keep', keep);
}
function scFeatures() {
  return `<div class="scl-meters">
    <div class="scl-meter" data-sc="keepbox"><span>🍬 Oznaczone pola</span><b data-sc="marked">0/49</b></div>
    <div class="scl-meter"><span>✨ Najwyższe pole</span><b data-sc="best">—</b></div>
    <div class="scl-meter"><span>Σ mnożników</span><b data-sc="sum">—</b></div>
  </div>`;
}

function initSCUI(table) {
  scCSS();
  scSpots = Array(49).fill(0);
  scKit = new SlotKit({
    screenId: 'casino-sc', game: 'sugar_cells', title: 'Sugar Cells', icon: '🧁', subtitle: '7×7 · klastry 5+ · pola-mnożniki do ×128',
    theme: { a: '#ff8fd0', b: '#7ff5d0' },
    cols: 7, rows: 7, event: 'casinoSCSpin', boardMaxWidth: '560px', stagger: 70,
    randomSym: () => SC_POOL[Math.floor(Math.random() * SC_POOL.length)],
    symHTML: i => ({ html: `<span class="sk-emo">${SC_SYMS[i]}</span>`, color: SC_COLORS[i], cls: i === SC.CANDY ? 'scatter' : '' }),
    scatter: {
      is: i => i === SC.CANDY, icon: '🍬', need: 3, fx: 'candy',
      theme: { colors: ['#ff8fd0', '#7ff5d0', '#c4a7ff', '#fff3c4', '#ffd36b'], land: [['confetti', 16], ['bubble', 6], ['star', 6]], ant: 'bubble', win: [['confetti', 60], ['bubble', 16], ['star', 24], ['ring', 2]] },
    },
    features: scFeatures,
    payDivisor: () => 1,
    payLabels: ['', '', '', '', '', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15+'],
    rules: [
      'CLUSTER PAYS: 5 lub więcej takich samych słodyczy stykających się bokami (poziomo/pionowo) = wygrana. Wypłata zależy od wielkości klastra (5 … 15+).',
      'Wygrane klastry wybuchają, a z góry spadają nowe słodycze — kaskady trwają, dopóki powstają nowe klastry.',
      'POLA-MNOŻNIKI: każde pole, na którym wybuchł symbol, zostaje OZNACZONE. Kolejny wybuch na oznaczonym polu daje mnożnik ×2, a każdy następny go podwaja: ×4, ×8, ×16, ×32, ×64, aż do ×128.',
      'Wygrana klastra = wypłata × SUMA mnożników pól pod klastrem (jeśli pod klastrem nie ma mnożników — ×1).',
      'W grze podstawowej oznaczenia znikają po spinie. W FREE SPINACH zostają na całą serię!',
      '🍬 Cukierek-Gwiazda (Scatter): 3 / 4 / 5 / 6 / 7+ = 10 / 12 / 15 / 20 / 30 Free Spinów. Ponowne wyzwolenie w trakcie Free Spinów dodaje spiny.',
      'Maksymalna wygrana: 10 000× stawki (na spin / cały bonus).',
      'Wypłaty w tabeli to × stawki łącznej za klaster danej wielkości.',
      'RTP ≈ 95%.',
    ],
    onMount(kit) { scLayers(kit); scSetSpots(kit, scSpots); },
    async present(res, kit) {
      const fs = res.isFree;
      scSetSpots(kit, res.startSpots);
      scMeters(kit, fs);
      await kit.stop(res.startGrid);
      for (let si = 0; si < res.steps.length; si++) {
        const st = res.steps[si];
        const cells = st.clusters.flatMap(cl => cl.cells);
        kit.highlight(cells);
        cxSound.play('win');
        await kit.wait(kit.turbo ? 200 : 450);
        // Ulepszanie pól pod wybuchającymi klastrami
        let doubled = 0;
        st.upgraded.forEach(([c, r, v, before], i) => {
          const k = c * 7 + r;
          scSpots[k] = v;
          const pop = v >= 2 && v !== before;
          scRenderSpot(kit, k, v, pop);
          const p = kit.cellCenter(c, r);
          if (!p) return;
          if (pop) {
            doubled++;
            setTimeout(() => {
              kit.emit(p.x, p.y, 'confetti', v >= 16 ? 22 : 12, { spread: p.w / 3, scale: p.w / 80, colors: ['#ff8fd0', '#7ff5d0', '#c4a7ff', '#ffd36b'] });
              kit.emit(p.x, p.y, 'star', v >= 16 ? 10 : 5, { spread: p.w / 3, scale: p.w / 70, colors: ['#fff', '#ffd36b'] });
              if (v >= 32) kit.emit(p.x, p.y, 'ring', 1, { scale: p.w / 60, colors: ['#ffd36b'] });
            }, Math.min(i, 12) * 25);
          } else if (before === 0) kit.emit(p.x, p.y, 'bubble', 2, { spread: p.w / 3, scale: p.w / 90, colors: ['#ff8fd0', '#c4a7ff', '#7ff5d0'] });
        });
        if (doubled) cxSound.play('chip');
        scMeters(kit);
        // Suma mnożników pod klastrami
        const multCl = st.clusters.filter(cl => cl.m > 1).sort((a, b) => b.m - a.m);
        const desc = st.clusters.slice(0, 3).map(cl => `${SC_SYMS[cl.symIdx]}×${cl.size}${cl.m > 1 ? ` <b style="color:#ffd36b">×${cl.m}</b>` : ''}`).join(' · ') + (st.clusters.length > 3 ? ' …' : '');
        kit.msg(`${si ? `Kaskada ${si + 1}: ` : ''}${desc} <span class="amt">+${cxFmt(st.win)} AT$</span>`, multCl.length || st.win >= res.bet * 5 ? 'big' : 'win');
        if (multCl.length) {
          await kit.wait(kit.turbo ? 150 : 380);
          for (const cl of multCl.slice(0, 2)) {
            const mid = cl.cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])[Math.floor(cl.cells.length / 2)];
            await kit.bigMult(cl.m, { c: mid[0], r: mid[1], label: 'SUMA MNOŻNIKÓW' });
          }
        } else await kit.wait(kit.turbo ? 250 : doubled ? 650 : 450);
        kit.clearWins();
        await kit.cascade(cells, st.grid, st.falling);
      }
      if (res.steps.length > 1) { res._msgSet = true; kit.countMsg(`🍬 ${res.steps.length} kaskad!`, res.payout, 'big'); }
      if (res.capped) { res._msgSet = true; kit.msg(`🍬 Maksymalna wygrana 10 000× — <span class="amt">${cxFmt(res.payout)} AT$</span>`, 'big'); }
      if (res.freeSpinsAwarded) {
        await kit.scatterWin(res.scatter.cells);
        await kit.splash(fs ? `+${res.freeSpinsAwarded} FREE SPINS` : `${res.freeSpinsAwarded} FREE SPINS`, 'Pola-mnożniki zostają na całą serię!', '🍬', '#ff8fd0');
        if (!res._msgSet || res.payout === 0) { kit.msg(`🍬 ${res.scatter.count} Cukierki-Gwiazdy! <b>+${res.freeSpinsAwarded} Free Spinów</b>`, 'feature'); res._msgSet = res.payout === 0; }
      }
      const inSeries = res.freeSpinsRemaining > 0;
      kit.banner(inSeries ? `🍬 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · pola zostają · najwyższe: <b>${res.maxSpot >= 2 && !(res.freeSpinsAwarded && !fs) ? '×' + res.maxSpot : '—'}</b>` : '', 'purple');
      if (res.fsSummary) res.fsSummary.title = `🍬 Free Spiny — najwyższe pole ×${Math.max(1, res.fsSummary.x)}`;
      // Gra podstawowa: znaczniki znikają po spinie; start Free Spinów — czysta plansza
      if ((!fs && !res.freeSpinsAwarded) || res.fsSummary || (!fs && res.freeSpinsAwarded)) {
        const clear = () => { if (scKit === kit) { scSetSpots(kit, Array(49).fill(0)); scMeters(kit, inSeries); } };
        if (res.fsSummary || res.freeSpinsAwarded) clear(); else setTimeout(() => { if (!kit.spinning) clear(); }, 1400);
      } else scMeters(kit, true);
    },
    freeBetOf: res => res.bet,
  });
  scKit.mount(table);
}
skBindResult('casinoSCResult', () => scKit);
