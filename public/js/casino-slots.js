// ══════════════════════════════════════════════════════════════
//  LUCKY FRUITS — 5×3, 20 linii, Wild ⭐, Scatter 💫 → Free Spiny ×3
// ══════════════════════════════════════════════════════════════
const LF_SYMS = ['💎', '7️⃣', '🍀', '🔔', '🍇', '🍊', '🍋', '🍒', '⭐', '💫'];
const LF_WILD = 8, LF_SCATTER = 9;
const LF_COLORS = ['#4fc3ff', '#ff4d6d', '#3ff2a3', '#ffc94d', '#a855f7', '#ff9f43', '#e8d84a', '#ff5c7a', '#ffd36b', '#c084fc'];
const LF_SPIN_POOL = [0, 1, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 9];
let lfKit = null;

const LF_LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,0,2,0],
];

function initSlotsUI(table) {
  lfKit = new SlotKit({
    screenId: 'casino-slots', game: 'slots', title: 'Lucky Fruits', icon: '🍀', subtitle: '5×3 · 20 linii · Free Spiny ×3',
    theme: { a: '#ff7ad9', b: '#ffd36b' },
    scatter: { is: i => i === LF_SCATTER, fx: 'cosmic', icon: '💫' },
    cols: 5, rows: 3, event: 'casinoSlotsSpin', lineCount: 20,
    boardMaxWidth: '640px',
    randomSym: () => LF_SPIN_POOL[Math.floor(Math.random() * LF_SPIN_POOL.length)],
    symHTML: i => ({ html: `<span class="sk-emo">${LF_SYMS[i]}</span>`, color: LF_COLORS[i], cls: i === LF_WILD ? 'wild' : i === LF_SCATTER ? 'scatter' : '' }),
    anticipate: grid => {
      let n = 0;
      for (let c = 0; c < 5; c++) { if (n >= 2) return c; if (grid[c].includes(LF_SCATTER)) n++; }
      return null;
    },
    rules: [
      'Wygrane liczone od lewej do prawej na 20 liniach, min. 3 symbole (Wiśnia: od 3).',
      '⭐ Wild zastępuje każdy symbol poza 💫 i sam płaci najwięcej.',
      '💫 Scatter płaci w dowolnym miejscu: 3× = 2×, 4× = 10×, 5× = 50× stawki.',
      '3 / 4 / 5 Scatterów = 10 / 15 / 25 Free Spinów. Wszystkie wygrane w Free Spinach ×3. Możliwy retrigger.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      await kit.stop(res.grid);
      kit.showLineWins(res.winLines, LF_LINES);
      if (res.scatter?.count >= 3) await kit.scatterWin(res.scatter.cells);
      if (res.freeSpinsAwarded) {
        await kit.splash(res.isFree ? `+${res.freeSpinsAwarded} FREE SPINS` : `${res.freeSpinsAwarded} FREE SPINS`, 'Wszystkie wygrane ×3', '💫', '#ff7ad9');
        kit.msg(`💫 ${res.scatter.count} Scattery! <b>+${res.freeSpinsAwarded} Free Spinów</b> z mnożnikiem ×3`, 'feature');
        res._msgSet = res.payout === 0;
      }
      kit.banner(res.freeSpinsRemaining > 0 ? `🎁 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · wygrane ×3` : '', '');
    },
    freeBetOf: res => res.bet,
  });
  lfKit.mount(table);
}
skBindResult('casinoSlotsResult', () => lfKit);
