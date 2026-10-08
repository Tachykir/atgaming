// ══════════════════════════════════════════════════════════════
//  DEEP SEA FORTUNE — 5×3, 10 linii, Money Collect (ryby + rybak)
// ══════════════════════════════════════════════════════════════
const DS_SYMS = ['🐚', '🦀', '🐙', '⚓', '🧰', '🦈', '🐟', '🧑‍✈️', '🛟'];
const DS_NAMES = ['Muszla', 'Krab', 'Ośmiornica', 'Kotwica', 'Skrzynia', 'Rekin', 'Ryba', 'Rybak', 'Koło'];
const DS_COLORS = ['#ff9fc4', '#ff6b4a', '#c084fc', '#7aa7ff', '#d9a35c', '#4fc3ff', '#ffd36b', '#3ff2a3', '#ff5c5c'];
const DS = { FISH: 6, CAPTAIN: 7, BUOY: 8 };
const DS_FISH_EMO = ['🐟', '🐠', '🐡'];
const DS_POOL_BASE = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6, 6, 6, 8];
const DS_POOL_FREE = [0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 6, 6, 6, 7, 7];
const DS_LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,0,1,2,1],
];
const DS_LEVELS = [1, 2, 3, 10];
const DS_FISH_X = [2, 5, 10, 15, 20, 25, 50, 250, 2000];
let dsKit = null;
let dsFish = {};          // 'c,r' → { amount, x, kind }
let dsMeter = { fishers: 0, level: 0, free: false };

function dsInjectCSS() {
  if (document.getElementById('casino-ds-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-ds-css';
  st.textContent = `
#screen-casino-ds .sk-machine { background:
  radial-gradient(120% 60% at 50% -10%, rgba(63,208,255,.28), transparent 60%),
  repeating-linear-gradient(100deg, rgba(160,240,255,.045) 0 22px, transparent 22px 70px),
  linear-gradient(180deg, #06405c 0%, #042a3e 45%, #020f18 100%); }
#screen-casino-ds .sk-machine::after { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0; opacity: .5;
  background: radial-gradient(3px 3px at 12% 80%, rgba(255,255,255,.5), transparent), radial-gradient(2px 2px at 30% 60%, rgba(255,255,255,.4), transparent),
  radial-gradient(3px 3px at 72% 75%, rgba(255,255,255,.45), transparent), radial-gradient(2px 2px at 88% 40%, rgba(255,255,255,.4), transparent),
  radial-gradient(2px 2px at 55% 90%, rgba(255,255,255,.4), transparent);
  background-size: 100% 100%; animation: dsBubbles 9s linear infinite; }
@keyframes dsBubbles { from { background-position: 0 0, 0 0, 0 0, 0 0, 0 0; } to { background-position: 0 -400px, 0 -300px, 0 -520px, 0 -360px, 0 -460px; } }
#screen-casino-ds .sk-reels { background: linear-gradient(180deg, rgba(2,30,46,.75), rgba(1,12,20,.85)); border-color: rgba(63,208,255,.25); box-shadow: inset 0 0 40px rgba(63,208,255,.12); }
#screen-casino-ds .sk-col { background: linear-gradient(180deg, rgba(63,208,255,.04), rgba(63,208,255,.10) 50%, rgba(63,208,255,.04)); }
.ds-amt { position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); z-index: 4; white-space: nowrap; pointer-events: none;
  font: 800 clamp(9px, 1.5vw, 13px)/1 'DM Mono', monospace; padding: 3px 6px; border-radius: 8px; color: #2a1600;
  background: linear-gradient(180deg, #fff3c4, #ffd36b 55%, #f5a623); border: 1px solid #a35f00; box-shadow: 0 2px 6px rgba(0,0,0,.5), 0 0 10px rgba(255,211,107,.5); }
.ds-amt.k1 { background: linear-gradient(180deg, #e0fbff, #4fe3ff 55%, #1c9ad6); border-color: #0b5f8a; color: #021a2a; }
.ds-amt.k2 { background: linear-gradient(180deg, #ffe0f4, #ff7ad9 55%, #c026d3); border-color: #6b0f73; color: #fff; text-shadow: 0 1px 0 #6b0f73; box-shadow: 0 0 16px rgba(255,122,217,.8); animation: dsGlow 1s ease-in-out infinite alternate; }
@keyframes dsGlow { to { filter: brightness(1.3); } }
.sk-cell.ds-fishcell .sk-emo { animation: dsSwim 1.8s ease-in-out infinite; display: inline-block; }
@keyframes dsSwim { 0%,100% { transform: translateX(-3%) rotate(-4deg); } 50% { transform: translateX(3%) rotate(4deg); } }
.sk-cell.ds-captain-on .sk-tile { box-shadow: 0 0 0 3px #3ff2a3, 0 0 30px #3ff2a3, inset 0 0 20px rgba(63,242,163,.5) !important; animation: dsCapPulse .5s ease-in-out infinite alternate; }
@keyframes dsCapPulse { to { transform: scale(1.08); } }
.sk-cell.ds-hooked .sk-tile { animation: dsHooked .35s ease-in-out 2; }
@keyframes dsHooked { 50% { transform: translateY(-10%) scale(.9); filter: brightness(1.6); } }
.ds-pot { position: absolute; top: 4%; left: 50%; transform: translateX(-50%); z-index: 5; white-space: nowrap; pointer-events: none;
  font: 800 clamp(10px, 1.7vw, 15px)/1 'DM Mono', monospace; padding: 4px 8px; border-radius: 9px; background: rgba(2,20,30,.92); color: #3ff2a3; border: 1.5px solid #3ff2a3; box-shadow: 0 0 14px rgba(63,242,163,.7); }
.ds-pot.bump { animation: dsPotBump .25s ease-out; }
@keyframes dsPotBump { 50% { transform: translateX(-50%) scale(1.3); } }
.ds-fly { position: absolute; z-index: 9; pointer-events: none; left: 0; top: 0; display: flex; align-items: center; gap: 4px; white-space: nowrap;
  font: 800 13px/1 'DM Mono', monospace; color: #2a1600; padding: 4px 8px 4px 4px; border-radius: 99px;
  background: linear-gradient(180deg, #fff3c4, #ffd36b 60%, #f5a623); border: 1.5px solid #a35f00; box-shadow: 0 0 18px rgba(255,211,107,.9), 0 4px 10px rgba(0,0,0,.5); }
.ds-fly i { font-style: normal; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 35% 30%, #fff, #ffd36b 50%, #b87400); font-size: 11px; }
.sk-machine[data-scfx="deep"] .sk-cell.scatter::before { inset: -4%; background: radial-gradient(circle, rgba(63,208,255,.55), rgba(255,211,107,.18) 55%, transparent 72%); animation: scBreath 1.8s ease-in-out infinite; }
.ds-meter { flex: 2; }
.ds-track { display: flex; gap: 6px; align-items: center; }
.ds-grp { flex: 1; display: flex; gap: 3px; align-items: center; padding: 3px 5px; border-radius: 9px; background: rgba(63,208,255,.07); border: 1px solid rgba(63,208,255,.2); transition: background .3s, border-color .3s; }
.ds-grp.done { background: rgba(63,242,163,.16); border-color: rgba(63,242,163,.6); }
.ds-pip { flex: 1; height: 12px; border-radius: 4px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); display: grid; place-items: center; font-size: 9px; transition: background .25s; }
.ds-pip.on { background: linear-gradient(180deg, #8affd0, #3ff2a3); border-color: #3ff2a3; box-shadow: 0 0 8px rgba(63,242,163,.8); }
.ds-pip.pop { animation: dsPip .45s cubic-bezier(.3,1.8,.5,1); }
@keyframes dsPip { 0% { transform: scale(.3); } 60% { transform: scale(1.6); } }
.ds-step { font: 800 11px 'DM Mono', monospace; color: #ffd36b; padding-left: 3px; }
.ds-grp.done .ds-step { color: #3ff2a3; }
.ds-meter.off { opacity: .55; }
.ds-lvl { font: 800 13px 'DM Mono', monospace; color: #3ff2a3 !important; }
.ds-lvl.bump { animation: dsPotBump .4s ease-out; display: inline-block; }
@media (orientation: landscape) and (max-height: 540px) {
  .ds-pip { height: 7px; } .ds-step { font-size: 9px; } .ds-amt { font-size: 9px; padding: 2px 4px; } .ds-pot { font-size: 10px; padding: 2px 5px; }
  .ds-fishinfo { display: none; }
}`;
  document.head.appendChild(st);
}

function dsMeterHTML() {
  const grp = g => `<div class="ds-grp" data-ds-grp="${g}">${[0, 1, 2, 3].map(k => `<i class="ds-pip" data-ds-pip="${g * 4 + k}"></i>`).join('')}<span class="ds-step">×${DS_LEVELS[g + 1]}</span></div>`;
  return `<div class="sk-meter ds-meter off" data-ds="meter"><div class="sk-meter-top"><span data-ds="mlabel">🧑‍✈️ Rybacy (Free Spiny) · co 4 → +10 FS i wyższy mnożnik</span><b class="ds-lvl" data-ds="lvl">×1</b></div>
    <div class="ds-track">${[0, 1, 2].map(grp).join('')}</div></div>
    <div class="sk-meter ds-fishinfo"><div class="sk-meter-top"><span>🐟 Ryby niosą kwoty</span><b data-ds="maxfish">—</b></div><div style="font-size:11px;color:rgba(255,255,255,.7)">×2 – ×2000 stawki</div></div>`;
}
function dsRenderMeter(pop) {
  const root = dsKit?.root; if (!root) return;
  const n = dsMeter.fishers;
  root.querySelectorAll('[data-ds-pip]').forEach(p => {
    const i = +p.dataset.dsPip;
    const on = i < n;
    if (on && !p.classList.contains('on') && pop) { p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
    p.classList.toggle('on', on);
  });
  root.querySelectorAll('[data-ds-grp]').forEach(g => g.classList.toggle('done', +g.dataset.dsGrp < dsMeter.level));
  const lvl = root.querySelector('[data-ds="lvl"]');
  if (lvl) lvl.textContent = '×' + DS_LEVELS[dsMeter.level];
  root.querySelector('[data-ds="meter"]')?.classList.toggle('off', !dsMeter.free);
  const ml = root.querySelector('[data-ds="mlabel"]');
  if (ml) ml.textContent = dsMeter.free ? `🧑‍✈️ Rybacy: ${n} · mnożnik zbierania` : '🧑‍✈️ Rybacy (Free Spiny) · co 4 → +10 FS i wyższy mnożnik';
}

// Lot elementu DOM po krzywej Béziera (z bąbelkami za sobą)
function dsFly(kit, from, to, html, dur) {
  return new Promise(resolve => {
    const m = kit.$('machine'); if (!m) return resolve();
    const el = document.createElement('div');
    el.className = 'ds-fly';
    el.innerHTML = html;
    m.appendChild(el);
    const cx = (from.x + to.x) / 2 + (Math.random() - .5) * 60, cy = Math.min(from.y, to.y) - 70 - Math.random() * 50;
    const at = t => ({ x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x, y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y });
    const frames = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, p = at(t);
      frames.push({ transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${.6 + Math.sin(Math.PI * t) * .55}) rotate(${(t - .5) * 30}deg)`, opacity: i === 16 ? .4 : 1 });
    }
    el.animate(frames, { duration: dur, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
    const t0 = performance.now();
    const trail = setInterval(() => {
      const t = Math.min(1, (performance.now() - t0) / dur), p = at(t);
      kit.emit(p.x, p.y, Math.random() < .6 ? 'bubble' : 'spark', 2, { spread: 6, scale: .7, colors: ['#bff4ff', '#ffd36b', '#ffffff'] });
    }, 45);
    setTimeout(() => { clearInterval(trail); el.remove(); resolve(); }, dur);
  });
}

async function dsCollect(res, kit) {
  const fishList = res.fish.slice().sort((a, b) => a.c - b.c || a.r - b.r);
  let counted = res.fishers - res.collects.length;
  let total = 0;
  for (const col of res.collects) {
    const cap = kit.cell(col.c, col.r);
    const cp = kit.cellCenter(col.c, col.r);
    cap?.classList.add('ds-captain-on');
    cxSound.play('feature');
    if (cp) { kit.emit(cp.x, cp.y, 'ring', 2, { scale: 1.4, colors: ['#3ff2a3', '#bff4ff'] }); kit.emit(cp.x, cp.y, 'bubble', 18, { spread: cp.w / 2.5, scale: cp.w / 70 }); }
    let pot = 0;
    const potEl = document.createElement('span');
    potEl.className = 'ds-pot';
    potEl.textContent = fishList.length ? '0' : 'pusta sieć';
    cap?.appendChild(potEl);
    await kit.wait(kit.turbo ? 120 : 380);
    if (fishList.length) {
      const step = kit.turbo ? 50 : Math.max(90, 260 - fishList.length * 20);
      const dur = kit.turbo ? 300 : 650;
      await Promise.all(fishList.map((f, i) => new Promise(done => setTimeout(async () => {
        const fp = kit.cellCenter(f.c, f.r);
        const fe = kit.cell(f.c, f.r);
        if (fe) { fe.classList.remove('ds-hooked'); void fe.offsetWidth; fe.classList.add('ds-hooked'); }
        if (fp && cp) {
          kit.emit(fp.x, fp.y, 'coin', 6, { spread: fp.w / 4, scale: .8 });
          cxSound.play('chip');
          await dsFly(kit, fp, cp, `<i>🪙</i>${cxShort(f.amount)}`, dur);
          pot += f.amount;
          potEl.textContent = cxShort(pot);
          potEl.classList.remove('bump'); void potEl.offsetWidth; potEl.classList.add('bump');
          kit.emit(cp.x, cp.y, 'coin', 8, { spread: cp.w / 4, scale: .9 });
          kit.emit(cp.x, cp.y, 'bubble', 4, { spread: cp.w / 3 });
          cxSound.play('tick');
        }
        done();
      }, i * step))));
      if (col.mult > 1) {
        await kit.bigMult(col.mult, { c: col.c, r: col.r, label: 'MNOŻNIK POŁOWU' });
        potEl.textContent = cxShort(col.win);
        potEl.classList.remove('bump'); void potEl.offsetWidth; potEl.classList.add('bump');
      }
      total += col.win;
      if (cp) { kit.emit(cp.x, cp.y, 'coin', 26, { spread: cp.w / 2, speed: 1.4 }); kit.emit(cp.x, cp.y, 'ring', 2, { scale: 1.8, colors: ['#ffd36b'] }); }
      cxSound.play(col.win >= res.bet * 20 ? 'bigwin' : 'win');
      kit.msg(`🎣 Rybak zebrał <span class="amt">+${cxFmt(col.win)} AT$</span>${col.mult > 1 ? ` (×${col.mult})` : ''}`, 'win');
    }
    // Licznik rybaków
    counted++;
    dsMeter.fishers = counted;
    const lu = res.levelUps.find(l => l.at === counted);
    dsRenderMeter(true);
    cxSound.play('chip');
    await kit.wait(kit.turbo ? 150 : 450);
    if (lu) await dsLevelUp(kit, lu);
    cap?.classList.remove('ds-captain-on');
  }
  return total;
}

async function dsLevelUp(kit, lu) {
  dsMeter.level = DS_LEVELS.indexOf(lu.mult);
  dsRenderMeter(false);
  const lvl = kit.root.querySelector('[data-ds="lvl"]');
  if (lvl) { lvl.classList.remove('bump'); void lvl.offsetWidth; lvl.classList.add('bump'); }
  cxSound.play('scwin');
  if (lu.mult >= 10) cxMultFlash(lu.mult, ['#3ff2a3', '#ffd36b', '#fff']);
  await kit.bonusIntro({ title: `MNOŻNIK ×${lu.mult}`, sub: `${lu.at} rybaków! +10 FREE SPINS · każdy połów ×${lu.mult}`, icon: '🎣', cells: [] });
  kit.msg(`🎣 <b>Awans!</b> Mnożnik zbierania ×${lu.mult} · +10 Free Spinów`, 'feature');
}

function dsBanner(res, kit) {
  if (res.freeSpinsRemaining > 0) kit.banner(`🎣 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · 🧑‍✈️ rybacy: <b>${res.fishers}</b> · mnożnik połowu <b>×${res.levelMult}</b>`, 'gold');
  else kit.banner('');
}

function initDSUI(table) {
  dsInjectCSS();
  dsFish = {};
  dsMeter = { fishers: 0, level: 0, free: false };
  dsKit = new SlotKit({
    screenId: 'casino-ds', game: 'deep_sea', title: 'Deep Sea Fortune', icon: '🎣', subtitle: '5×3 · 10 linii · Money Collect · ryby do ×2000',
    theme: { a: '#3fd0ff', b: '#ffd36b' },
    cols: 5, rows: 3, event: 'casinoDSSpin', lineCount: 10, boardMaxWidth: '640px',
    randomSym: () => {
      const pool = dsKit && dsKit.free > 0 ? DS_POOL_FREE : DS_POOL_BASE;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    symHTML: i => ({
      html: `<span class="sk-emo">${DS_SYMS[i]}</span>`, color: DS_COLORS[i],
      cls: i === DS.CAPTAIN ? 'wild' : i === DS.BUOY ? 'scatter' : i === DS.FISH ? 'special ds-fishcell' : '',
    }),
    decorate(el, c, r, si) {
      if (si !== DS.FISH) return;
      const f = dsFish[c + ',' + r];
      if (!f || el.querySelector('.ds-amt')) return;
      const emo = el.querySelector('.sk-emo'); if (emo) emo.textContent = DS_FISH_EMO[f.kind] || '🐟';
      el.insertAdjacentHTML('beforeend', `<span class="ds-amt k${f.kind}">${cxShort(f.amount)}</span>`);
    },
    scatter: {
      is: i => i === DS.BUOY, icon: '🛟', need: 3, fx: 'deep',
      theme: { colors: ['#3fd0ff', '#bff4ff', '#ffd36b', '#1c6ea4', '#ffffff'], land: [['bubble', 16], ['ring', 1]], ant: 'bubble', win: [['bubble', 34], ['coin', 18], ['ring', 2]] },
    },
    features: dsMeterHTML,
    onMount: () => dsRenderMeter(false),
    onBetChange: bet => { const el = dsKit?.root?.querySelector('[data-ds="maxfish"]'); if (el) el.textContent = 'do ' + cxShort(2000 * bet * cxK('deep_sea')) + ' AT$'; },
    rules: [
      '10 linii, wygrane od lewej do prawej, min. 3 symbole (🦈 Rekin już od 2).',
      '🐟 Ryby niosą kwoty: ×2, ×5, ×10, ×15, ×20, ×25, ×50, ×250 lub ×2000 stawki (kwota widoczna na rybie). W grze podstawowej ryba płaci tylko jako symbol linii.',
      '🛟 3 / 4 / 5 Kół ratunkowych (Scatter) = 10 / 15 / 20 Free Spinów.',
      '🧑‍✈️ W Free Spinach pojawia się Rybak (Wild). Każdy rybak, który wyląduje, ZBIERA kwoty wszystkich ryb na planszy.',
      'Każdy rybak trafia na licznik: co 4 rybaków → +10 Free Spinów, a mnożnik zbierania rośnie ×2 → ×3 → ×10 (maks. 3 progi).',
      'Bez limitu wygranej.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      dsFish = {};
      (res.fish || []).forEach(f => { dsFish[f.c + ',' + f.r] = f; });
      if (res.mode === 'free') { dsMeter.free = true; dsMeter.fishers = res.fishers - res.collects.length; dsMeter.level = DS_LEVELS.indexOf(res.collectMult); dsRenderMeter(false); }
      await kit.stop(res.grid);
      // Ryby na planszy — chlupot
      for (const f of res.fish || []) {
        const p = kit.cellCenter(f.c, f.r);
        if (p) kit.emit(p.x, p.y, f.kind === 2 ? 'star' : 'bubble', f.kind === 2 ? 14 : 6, { spread: p.w / 3, scale: p.w / 80 });
      }
      if (res.fish?.some(f => f.kind === 2)) cxSound.play('feature');
      let collected = 0;
      if (res.collects?.length) {
        await kit.wait(kit.turbo ? 80 : 250);
        collected = await dsCollect(res, kit);
      } else if (res.mode === 'free' && res.fish?.length) {
        kit.msg(`🐟 ${res.fish.length} ${res.fish.length === 1 ? 'ryba' : 'ryb'} na planszy — brak rybaka, który by je zebrał…`);
      }
      kit.showLineWins(res.winLines, DS_LINES);
      if (collected > 0) { res._msgSet = true; kit.countMsg(res.lineWin > 0 ? `🎣 Połów + linie:` : `🎣 Połów:`, res.payout, 'big'); }
      if (res.fsTriggered) {
        await kit.scatterWin(res.scatter);
        await kit.splash(`${res.freeSpinsAwarded} FREE SPINS`, 'Rybak zbiera kwoty wszystkich ryb!', '🎣', '#3fd0ff');
        dsMeter = { fishers: 0, level: 0, free: true };
        dsRenderMeter(false);
        kit.msg(`🛟 ${res.scatter.length} Koła! <b>+${res.freeSpinsAwarded} Free Spinów</b>`, 'feature');
        res._msgSet = res.payout === 0;
      }
      if (res.capped) { kit.msg(`🏆 Osiągnięto maksymalną wygraną <span class="amt">10 000× stawki</span>!`, 'big'); res._msgSet = true; }
      dsBanner(res, kit);
      if (res.fsSummary) { dsMeter = { fishers: 0, level: 0, free: false }; dsRenderMeter(false); }
    },
    freeBetOf: res => res.bet,
  });
  dsKit.mount(table);
}
skBindResult('casinoDSResult', () => dsKit);
