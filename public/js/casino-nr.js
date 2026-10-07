// ══════════════════════════════════════════════════════════════
//  NEON RACER — 5×3, 20 linii w obie strony, Speed Meter → Turbo ×3
// ══════════════════════════════════════════════════════════════
const NR_SYMS = ['🏎️', '🏆', '⛑️', '🛞', '⛽', '🏁', '🪙', '💡', '💨'];
const NR = { LIGHTS: 7, NITRO: 8 };
const NR_COLORS = ['#ff4d6d', '#ffd36b', '#4fc3ff', '#9fb3c8', '#ff9f43', '#e8e8f0', '#ffb300', '#34f5c5', '#7aa7ff'];
const NR_POOL = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 8];
const NR_LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,0,2,0],
];
let nrKit = null;

function nrSpeedHTML(v = 0) {
  return `<div class="sk-meter"><div class="sk-meter-top"><span>🏁 Speed Meter — 100% = TURBO: 6 darmowych spinów ×3</span><b data-nr="spv">${v}%</b></div><div class="cx-bar green"><i data-nr="spbar" style="width:${v}%"></i></div></div>`;
}
function nrSetSpeed(v) {
  const t = nrKit?.root.querySelector('[data-nr="spv"]');
  if (!t) return;
  t.textContent = v + '%';
  nrKit.root.querySelector('[data-nr="spbar"]').style.width = v + '%';
}

function initNRUI(table) {
  nrKit = new SlotKit({
    screenId: 'casino-nr', game: 'neon_racer', title: 'Neon Racer', icon: '🏎️', subtitle: '5×3 · 20 linii w obie strony · Turbo ×3',
    theme: { a: '#34f5c5', b: '#f472b6' },
    scatter: { is: i => i === NR.NITRO, fx: 'neon', icon: '💨' },
    cols: 5, rows: 3, event: 'casinoNRSpin', lineCount: 20, boardMaxWidth: '640px',
    randomSym: () => NR_POOL[Math.floor(Math.random() * NR_POOL.length)],
    symHTML: i => ({ color: NR_COLORS[i], html: `<span class="sk-emo">${NR_SYMS[i]}</span>`, cls: i === NR.LIGHTS ? 'wild' : i === NR.NITRO ? 'scatter' : '' }),
    features: () => nrSpeedHTML(0),
    onStats: s => { if (s.pitMeter > 0) nrSetSpeed(Math.min(100, s.pitMeter)); },
    anticipate: grid => {
      let n = 0;
      for (let c = 0; c < 5; c++) { if (n >= 2) return c; if (grid[c].includes(NR.NITRO)) n++; }
      return null;
    },
    rules: [
      '20 linii, wygrane liczone OD LEWEJ i OD PRAWEJ (min. 3 symbole).',
      '💡 Reflektory (Wild, bębny 2–4) rozszerzają się na cały bęben.',
      '💨 Nitro: każde +2% do Speed Meter. 3 / 4 / 5 Nitro = 8 / 12 / 20 Free Spinów z wygranymi ×2.',
      'Speed Meter rośnie z każdym płatnym spinem. Przy 100% startuje TURBO: 6 darmowych spinów z mnożnikiem ×3 (stawka = średnia z nabijania licznika).',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      await kit.stop(res.rawGrid);
      for (const c of res.expandedCols) { kit.expandCol(c, NR.LIGHTS); cxSound.play('chip'); await kit.wait(kit.turbo ? 50 : 160); }
      kit.showLineWins(res.winLines, NR_LINES);
      nrSetSpeed(res.speedMeter);
      if (res.spinMult > 1 && res.payout > 0) { res._msgSet = true; kit.msg(`${res.spinMode === 'turbo' ? '🚀 TURBO' : '💨 FREE'} ×${res.spinMult}: <span class="amt">+${cxFmt(res.payout)} AT$</span>`, 'big'); }
      if (res.turboTriggered) {
        cxSound.play('feature');
        nrSetSpeed(100);
        await kit.wait(500);
        await kit.splash('TURBO!', '6 darmowych spinów · mnożnik ×3', '🚀', '#34f5c5');
        kit.msg('🚀 <b>TURBO!</b> 6 darmowych spinów z mnożnikiem ×3', 'feature');
        res._msgSet = res.payout === 0 || res._msgSet;
        nrSetSpeed(0);
      } else if (res.freeSpinsAwarded) {
        await kit.scatterWin(res.scatter);
        await kit.splash(`${res.freeSpinsAwarded} FREE SPINS`, 'Nitro! Wygrane ×2', '💨', '#34f5c5');
        kit.msg(`💨 NITRO! <b>+${res.freeSpinsAwarded} Free Spinów</b> (×2)`, 'feature');
        res._msgSet = res.payout === 0 || res._msgSet;
      }
      const mode = res.freeMode;
      kit.banner(res.freeSpinsRemaining > 0 ? (mode === 'turbo' ? `🚀 TURBO — pozostało <b>${res.freeSpinsRemaining}</b> · ×3` : `💨 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · ×2`) : '', mode === 'turbo' ? 'red' : '');
      if (res.fsSummary) res.fsSummary.title = res.fsSummary.mode === 'turbo' ? '🚀 Koniec Turbo' : '💨 Koniec Free Spinów';
    },
    freeBetOf: res => res.bet,
  });
  nrKit.mount(table);
}
skBindResult('casinoNRResult', () => nrKit);
