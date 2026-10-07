// ══════════════════════════════════════════════════════════════
//  PATH OF GAMBLING — 5×5, 30 linii, Pit Meter, sticky Lock/Valdo
// ══════════════════════════════════════════════════════════════
const PG_IMG = ['mirror', 'Divine', 'exalted', 'chaos', 'annul', 'alteration', 'Transmutation', 'scroll', 'fracture', 'mist', 'Sacred', 'lock', 'valdo'];
const PG_NAMES = ['Mirror of Kalandra', 'Divine Orb', 'Exalted Orb', 'Chaos Orb', 'Orb of Annulment', 'Orb of Alteration', 'Orb of Transmutation', 'Scroll of Wisdom', 'Fracturing Orb', 'Reflecting Mist', 'Sacred Orb', "Hinekora's Lock", "Valdo's Box"];
const PG_COLORS = ['#a8d8ff', '#ffe066', '#ffd700', '#e05050', '#c0c0d0', '#4488ff', '#2266cc', '#aaaaaa', '#ff9944', '#aa44ff', '#ffdd44', '#cc44aa', '#c0a060'];
const PG = { WILD: 8, MIST: 9, SACRED: 10, LOCK: 11, VALDO: 12 };
const PG_POOL = [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 9, 10];
const PG_LINES = [
  [2,2,2,2,2],[0,0,0,0,0],[4,4,4,4,4],[1,1,1,1,1],[3,3,3,3,3],
  [0,1,2,1,0],[4,3,2,3,4],[0,1,2,3,4],[4,3,2,1,0],[1,0,1,0,1],
  [3,4,3,4,3],[2,1,0,1,2],[2,3,4,3,2],[0,2,4,2,0],[4,2,0,2,4],
  [1,3,4,3,1],[3,1,0,1,3],[0,0,1,2,2],[2,2,1,0,0],[4,4,3,2,2],
  [2,2,3,4,4],[0,1,1,1,0],[4,3,3,3,4],[1,1,2,1,1],[3,3,2,3,3],
  [1,2,3,2,1],[3,2,1,2,3],[1,0,0,0,1],[3,4,4,4,3],[2,1,2,3,2],
];
let pgKit = null;
let pgState = { locks: [], valdos: [], pit: 0, pitMax: 300, mode: null };

function pgMeterHTML() {
  const pct = Math.min(100, pgState.pit / pgState.pitMax * 100);
  return `<div class="sk-meter"><div class="sk-meter-top"><span>🕳️ Pit Meter — 8 spinów Pit z Lockami i Valdo</span><b data-pg="pit">${pgState.pit} / ${pgState.pitMax}</b></div><div class="cx-bar purple"><i data-pg="pitbar" style="width:${pct}%"></i></div></div>`;
}
function pgUpdateMeter() {
  const el = pgKit?.root.querySelector('[data-pg="pit"]');
  if (el) { el.textContent = `${pgState.pit} / ${pgState.pitMax}`; pgKit.root.querySelector('[data-pg="pitbar"]').style.width = Math.min(100, pgState.pit / pgState.pitMax * 100) + '%'; }
}
function pgBanner(left) {
  if (!pgKit) return;
  if (left > 0 && pgState.mode) {
    const lbl = pgState.mode === 'pit' ? '🕳️ PIT' : pgState.mode === 'sacred' ? '✨ SACRED' : '🌫️ REFLECTING MIST · wygrane ×2';
    const vm = pgState.valdos.reduce((s, v) => s + v.mult, 0);
    pgKit.banner(`${lbl} — pozostało <b>${left}</b> spinów${pgState.locks.length ? ` · 🔒 ${pgState.locks.length}` : ''}${vm ? ` · 📦 ×${vm}` : ''}`, pgState.mode === 'scatter' ? '' : 'purple');
  } else pgKit.banner('');
}

function initPathUI(table) {
  pgState = { locks: [], valdos: [], pit: 0, pitMax: 300, mode: null };
  pgKit = new SlotKit({
    screenId: 'casino-path', game: 'path_of_gambling', title: 'Path of Gambling', icon: '<img src="/images/slots/poelogo.png" alt="">', subtitle: '5×5 · 30 linii · Pit Meter',
    theme: { a: '#ffb347', b: '#c084fc' },
    scatter: { is: i => i === PG.MIST, fx: 'mist', icon: '🌫️' },
    cols: 5, rows: 5, event: 'casinoPathSpin', lineCount: 30, boardMaxWidth: '560px',
    randomSym: () => PG_POOL[Math.floor(Math.random() * PG_POOL.length)],
    symHTML: i => ({ color: PG_COLORS[i], html: `<img src="/images/slots/${PG_IMG[i]}.png" alt="${PG_NAMES[i]}" draggable="false">`, cls: i === PG.WILD ? 'wild' : i === PG.MIST ? 'scatter' : i === PG.SACRED ? 'special' : '' }),
    decorate(el, c, r, si) {
      if (si === PG.LOCK || si === PG.VALDO) el.classList.add('sticky');
      if (si === PG.VALDO) {
        const v = pgState.valdos.find(v => v.col === c && v.row === r);
        if (v && !el.querySelector('.sk-badge')) el.insertAdjacentHTML('beforeend', `<span class="sk-badge">×${v.mult}</span>`);
      }
    },
    anticipate: grid => {
      let n = 0;
      for (let c = 0; c < 5; c++) { if (n >= 2) return c; n += grid[c].filter(s => s === PG.MIST).length; }
      return null;
    },
    features: pgMeterHTML,
    onStats: s => { if (s.pitMeter > 0) { pgState.pit = s.pitMeter; pgUpdateMeter(); } },
    rules: [
      '30 linii, wygrane od lewej, min. 3 symbole. 🟠 Fracturing Orb to Wild.',
      '🌫️ 3 / 4 / 5 Reflecting Mist = 8 / 12 / 20 Free Spinów, wszystkie wygrane ×2 (retrigger możliwy).',
      '✨ 3+ Sacred Orb = 8–12 spinów w trybie Pit.',
      "🕳️ Pit Meter: co 300 płatnych spinów → 8 spinów Pit. W trybie Pit pojawiają się Hinekora's Lock (sticky Wild) i Valdo's Box (sticky Wild z mnożnikiem ×2–×100). Mnożniki Valdo sumują się i mnożą każdą wygraną.",
      'Stawka spinów Pit = średnia stawka, z jaką napełniałeś licznik.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      pgState.locks = res.stickyLocks || [];
      pgState.valdos = res.stickyValdos || [];
      await kit.stop(res.grid);
      if (res.newLocks?.length || res.newValdos?.length) {
        kit.highlight([...res.newLocks, ...res.newValdos].map(l => [l.col, l.row]), 'main', false);
        cxSound.play('feature');
        await kit.wait(500);
        kit.clearWins();
      }
      kit.showLineWins(res.winLines, PG_LINES);
      if (res.spinMult > 1 && res.payout > 0) { res._msgSet = true; kit.msg(`Wygrana ×${res.spinMult}: <span class="amt">+${cxFmt(res.payout)} AT$</span>`, 'big'); }
      if (res.scatter?.mist?.length >= 3 && res.trigger && res.trigger !== 'sacred') await kit.scatterWin(res.scatter.mist);
      if (res.scatter?.sacred?.length >= 3 && res.trigger === 'sacred') await kit.scatterWin(res.scatter.sacred);
      pgState.pit = res.pitMeter; pgState.pitMax = res.pitThreshold || 300;
      pgUpdateMeter();
      if (res.freeSpinsAwarded) {
        const names = { pit: '🕳️ PIT MODE', sacred: '✨ SACRED ORB', scatter: '🌫️ REFLECTING MIST', retrigger: '🔁 RETRIGGER' };
        const subs = { pit: "Hinekora's Lock i Valdo's Box w grze!", sacred: 'Tryb Pit z Lockami i Valdo', scatter: 'Wszystkie wygrane ×2', retrigger: 'Dodatkowe spiny!' };
        if (!res.scatter?.mist?.length && !res.scatter?.sacred?.length) { cxSound.play('feature'); await kit.wait(400); }
        await kit.splash(`${names[res.trigger] || 'BONUS'}`, `+${res.freeSpinsAwarded} spinów · ${subs[res.trigger] || ''}`, res.trigger === 'pit' ? '🕳️' : res.trigger === 'sacred' ? '✨' : '🌫️', '#ffb347');
        kit.msg(`${names[res.trigger] || 'BONUS'}! <b>+${res.freeSpinsAwarded} spinów</b>`, 'feature');
        res._msgSet = res.payout === 0;
      }
      pgState.mode = res.freeMode;
      pgBanner(res.freeSpinsRemaining);
      if (res.fsSummary) res.fsSummary.title = res.fsSummary.mode === 'pit' ? '🕳️ Koniec trybu Pit' : res.fsSummary.mode === 'sacred' ? '✨ Koniec Sacred' : '🌫️ Koniec Free Spinów';
    },
    freeBetOf: res => res.bet,
  });
  pgKit.mount(table);
}
skBindResult('casinoPathResult', () => pgKit);
