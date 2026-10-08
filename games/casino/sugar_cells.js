/**
 * SUGAR CELLS — AT Gaming Casino
 * Plansza 7×7, Cluster Pays: 5+ takich samych symboli stykających się bokami.
 *
 *  - Wygrane klastry wybuchają, nowe symbole spadają z góry (kaskada).
 *  - Pole, na którym wybuchł symbol, zostaje OZNACZONE. Kolejny wybuch na oznaczonym
 *    polu daje mnożnik ×2, każdy następny podwaja go (×4, ×8 … max ×128).
 *  - Wygrana klastra = wypłata × SUMA mnożników pól pod klastrem (brak mnożników → ×1).
 *  - Gra podstawowa: znaczniki znikają po spinie. Free Spiny: zostają na całą serię.
 *  - 🍬 Cukierek-gwiazda (Scatter): 3/4/5/6/7+ = 10/12/15/20/30 Free Spinów (także retrigger w FS).
 *
 *  Pola (spots): tablica 49 liczb, indeks c*7+r — 0 = puste, 1 = oznaczone, 2…128 = mnożnik.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 7, ROWS = 7, CLUSTER_MIN = 5, MAX_SPOT = 128;
const PAY_SCALE = 1.094;
const MAX_WIN = Infinity;  // bez limitu wygranej (kod limitu zostaje — nigdy się nie uruchamia)
const FS_TABLE = { 3: 10, 4: 12, 5: 15, 6: 20, 7: 30 };

// p[5..15] — × stawki łącznej za klaster danej wielkości (15 = 15+)
const raw = [
  { id: 'cake',   e: '🍰', n: 'Tort',       w: 5,  p: [0,0,0,0,0, 2, 3, 4, 6, 8, 12, 18, 25, 40, 60, 150] },
  { id: 'cupcake',e: '🧁', n: 'Babeczka',   w: 6,  p: [0,0,0,0,0, 1.5, 2, 3, 4, 6, 8, 12, 18, 25, 40, 100] },
  { id: 'donut',  e: '🍩', n: 'Pączek',     w: 7,  p: [0,0,0,0,0, 1, 1.5, 2, 3, 4, 6, 8, 12, 18, 25, 60] },
  { id: 'lolly',  e: '🍭', n: 'Lizak',      w: 8,  p: [0,0,0,0,0, 0.8, 1, 1.5, 2, 3, 4, 6, 8, 12, 18, 40] },
  { id: 'choco',  e: '🍫', n: 'Czekolada',  w: 8,  p: [0,0,0,0,0, 0.5, 0.8, 1, 1.5, 2, 3, 4, 6, 8, 12, 25] },
  { id: 'cookie', e: '🍪', n: 'Ciastko',    w: 9,  p: [0,0,0,0,0, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 4, 6, 8, 18] },
  { id: 'jelly',  e: '🍮', n: 'Budyń',      w: 9,  p: [0,0,0,0,0, 0.3, 0.5, 0.6, 0.8, 1, 1.5, 2, 3, 4, 6, 12] },
  { id: 'candy',  e: '🍬', n: 'Cukierek-Gwiazda (Scatter)', w: 0.34, scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p ? s.p.map(v => v * PAY_SCALE) : null }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const W_BASE = SYMS.map(s => s.w);
const W_FREE = [4, 5, 6, 8, 11, 14, 17, 0.25];
const pickBase = E.symPicker(W_BASE), pickFree = E.symPicker(W_FREE);

function findClusters(grid) {
  const seen = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
  const out = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (seen[c][r]) continue;
    const si = grid[c][r];
    seen[c][r] = true;
    if (!SYMS[si].p) continue;
    const cells = [], q = [[c, r]];
    while (q.length) {
      const [cc, rr] = q.pop();
      cells.push([cc, rr]);
      for (const [nc, nr] of [[cc - 1, rr], [cc + 1, rr], [cc, rr - 1], [cc, rr + 1]]) {
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || seen[nc][nr] || grid[nc][nr] !== si) continue;
        seen[nc][nr] = true; q.push([nc, nr]);
      }
    }
    if (cells.length >= CLUSTER_MIN) out.push({ symIdx: si, cells, size: cells.length, pay: SYMS[si].p[Math.min(cells.length, 15)] });
  }
  return out;
}
const blankSpots = () => Array(COLS * ROWS).fill(0);
const bump = v => v === 0 ? 1 : v === 1 ? 2 : Math.min(MAX_SPOT, v * 2);

const def = {
  game: 'sugar_cells', statsId: 'sugar_cells', event: 'casinoSCSpin', resultEvent: 'casinoSCResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0, spots: null }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const pick = inFree ? pickFree : pickBase;
    const spots = inFree && Array.isArray(state.spots) && state.spots.length === COLS * ROWS ? state.spots.slice() : blankSpots();
    const startSpots = spots.slice();
    let grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => pick()));
    const startGrid = grid.map(c => [...c]);
    const steps = [];
    let payout = 0;
    for (let guard = 0; guard < 60; guard++) {
      const clusters = findClusters(grid);
      if (!clusters.length) break;
      // Wybuch: najpierw ulepsz pola pod klastrami, potem policz sumę mnożników
      const upgraded = [];
      const remove = new Set();
      clusters.forEach(cl => cl.cells.forEach(([c, r]) => {
        const k = c * ROWS + r;
        if (remove.has(k)) return;
        remove.add(k);
        const before = spots[k];
        spots[k] = bump(before);
        upgraded.push([c, r, spots[k], before]);
      }));
      const outCl = clusters.map(cl => {
        const sum = cl.cells.reduce((a, [c, r]) => a + (spots[c * ROWS + r] >= 2 ? spots[c * ROWS + r] : 0), 0);
        const m = sum > 0 ? sum : 1;
        return { symIdx: cl.symIdx, cells: cl.cells, size: cl.size, m, base: cl.pay, win: cl.pay * bet * m };
      });
      const stepWin = outCl.reduce((a, cl) => a + cl.win, 0);
      payout += stepWin;
      const falling = [];
      grid = grid.map((col, c) => {
        const kept = col.filter((_, r) => !remove.has(c * ROWS + r));
        const added = Array.from({ length: ROWS - kept.length }, () => pick());
        added.forEach((_, r) => falling.push([c, r]));
        return [...added, ...kept];
      });
      steps.push({ clusters: outCl, win: stepWin, upgraded, spots: spots.slice(), grid: grid.map(c => [...c]), falling });
    }
    const sc = E.countSym(grid, i => i === I.candy);
    let capped = false;
    const limit = MAX_WIN * bet - (inFree ? state.fsWin : 0);
    if (payout > limit) { payout = Math.max(0, limit); capped = true; }

    let freeSpinsAwarded = 0;
    if (!capped && sc.n >= 3) {
      freeSpinsAwarded = FS_TABLE[Math.min(7, sc.n)];
      if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; state.spots = blankSpots(); }
      state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
    }
    if (inFree) {
      state.fsWin += payout;
      state.spots = spots;
      if (capped) state.freeSpins = 0;
    }
    const maxSpot = Math.max(...spots);
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin, x: maxSpot } : null;
    if (fsSummary || (!inFree && !freeSpinsAwarded)) state.spots = null;
    return {
      startGrid, startSpots, steps, finalGrid: grid, spots, payout, capped, maxSpot,
      scatter: { count: sc.n, cells: sc.cells },
      isFree: inFree, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, fsSummary,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, scatter: !!s.scatter })),
  cols: COLS, rows: ROWS, clusterMin: CLUSTER_MIN, maxSpot: MAX_SPOT, fsTable: FS_TABLE, maxWin: MAX_WIN,
};
const BASE_RTP = 0.954;

module.exports = { registerHandlers, def, meta, SYMS, BASE_RTP };
