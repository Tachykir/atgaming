/**
 * LUCKY FRUITS — AT Gaming Casino
 * 5 bębnów × 3 rzędy, 20 linii, Wild ⭐ (zastępuje), Scatter 💫 (płaci wszędzie).
 * 3/4/5 scatterów → 10/15/25 Free Spinów z mnożnikiem ×3 (możliwy retrigger).
 * Wypłata = dokładnie to, co widać na bębnach. RTP ≈ 95% (kalibrowane symulacją).
 */
'use strict';
const E = require('./slot_engine');

const PAY_SCALE = 0.94;
const raw = [
  { e: '💎', n: 'Diament',    w: 3,  p: [0,0,0,50,250,1500] },
  { e: '7️⃣',  n: 'Siódemka',  w: 4,  p: [0,0,0,40,150,750] },
  { e: '🍀', n: 'Koniczyna',  w: 6,  p: [0,0,0,25,100,400] },
  { e: '🔔', n: 'Dzwonek',    w: 8,  p: [0,0,0,20,60,200] },
  { e: '🍇', n: 'Winogrona',  w: 10, p: [0,0,0,15,40,120]  },
  { e: '🍊', n: 'Pomarańcza', w: 12, p: [0,0,0,10,25,80]  },
  { e: '🍋', n: 'Cytryna',    w: 13, p: [0,0,0,8,20,60]  },
  { e: '🍒', n: 'Wiśnia',     w: 14, p: [0,0,0,6,15,50]   },
  { e: '⭐', n: 'Wild',       w: 3,  p: [0,0,0,60,300,2500], wild: true },
  { e: '💫', n: 'Scatter',    w: 3,  p: [0,0,0,0,0,0], scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const IDX_SCATTER = SYMS.findIndex(s => s.scatter);
const pick = E.makePicker(SYMS.map(s => s.w));

const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,0,2,0],
];
const SCATTER_PAY = { 3: 2, 4: 10, 5: 50 };      // × stawka łączna
const FREE_SPINS  = { 3: 10, 4: 15, 5: 25 };
const FS_MULT = 3;

function buildGrid() {
  const g = [];
  for (let c = 0; c < 5; c++) {
    g.push([]);
    for (let r = 0; r < 3; r++) {
      let s = pick();
      // max 1 scatter na bęben
      while (s === IDX_SCATTER && g[c].includes(IDX_SCATTER)) s = pick();
      g[c].push(s);
    }
  }
  return g;
}

const def = {
  game: 'slots', statsId: 'slots', event: 'casinoSlotsSpin', resultEvent: 'casinoSlotsResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const grid = buildGrid();
    const lineBet = bet / LINES.length;
    const mult = inFree ? FS_MULT : 1;
    const wins = E.evalLines(grid, LINES, SYMS, lineBet).map(w => ({ ...w, win: w.win * mult }));
    const sc = E.countSym(grid, i => i === IDX_SCATTER);
    const scatterWin = ((SCATTER_PAY[Math.min(sc.n, 5)] || 0) * bet * mult);
    const payout = wins.reduce((s, w) => s + w.win, 0) + scatterWin;

    let freeSpinsAwarded = 0;
    if (sc.n >= 3) {
      freeSpinsAwarded = FREE_SPINS[Math.min(sc.n, 5)];
      if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; }
      state.freeSpins += freeSpinsAwarded;
      state.fsTotal += freeSpinsAwarded;
    }
    if (inFree) state.fsWin += payout;
    const fsEnded = inFree && state.freeSpins === 0;
    const fsSummary = fsEnded ? { total: state.fsTotal, win: state.fsWin } : null;
    return {
      grid, winLines: wins, scatter: { count: sc.n, cells: sc.cells, win: scatterWin },
      payout, isFree: inFree, freeMult: mult, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, fsSummary,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }

const meta = { syms: SYMS.map(s => ({ e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter })), lines: LINES, rows: 3, cols: 5, scatterPay: SCATTER_PAY, freeSpins: FREE_SPINS, fsMult: FS_MULT };

module.exports = { registerHandlers, def, meta, SYMS, LINES };
