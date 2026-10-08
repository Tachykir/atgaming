/**
 * OLYMPUS WAYS — AT Gaming Casino
 * 6 bębnów Megaways: każdy bęben ma przy każdym spinie losowo 2–7 symboli
 * (liczba sposobów = iloczyn wysokości, max 7^6 = 117 649).
 *
 *  - Wygrane „ways”: ten sam symbol na kolejnych bębnach od lewej (min. 3).
 *    Wygrana = wypłata × liczba kombinacji (iloczyn wystąpień na bębnach) × stawka / WAYS_NORM.
 *  - ⚡ Piorun (Wild) — tylko na bębnach 2–5, zastępuje wszystko poza scatterem.
 *  - Kaskady: wygrywające symbole znikają, nowe spadają z góry (wysokość bębna bez zmian).
 *  - 🏛️ Świątynia (Scatter): 4/5/6+ = 10/15/20 Free Spinów; w FS 3+ = +5 za każdy ponad 2.
 *  - Free Spiny: GLOBALNY mnożnik ×1, +1 po każdej kaskadzie, nie resetuje się między spinami.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 6, MIN_H = 2, MAX_H = 7, MIN_REELS = 3;
const WAYS_NORM = 20;          // stała normalizacyjna: p = wypłata za 1 sposób × WAYS_NORM
const PAY_SCALE = 4.55;
const MAX_WIN = 10000;         // limit wygranej (× stawki) na spin / cały bonus

// p[3..6] — wypłata (× stawki × WAYS_NORM) za 1 kombinację na 3/4/5/6 bębnach
const raw = [
  { id: 'crown',   e: '👑', n: 'Korona Zeusa',   w: 3,   p: [0,0,0,4,10,25,60] },
  { id: 'trident', e: '🔱', n: 'Trójząb',        w: 3.6, p: [0,0,0,3,7,16,40] },
  { id: 'eagle',   e: '🦅', n: 'Orzeł Olimpu',   w: 4.2, p: [0,0,0,2,5,12,25] },
  { id: 'amphora', e: '🏺', n: 'Amfora',         w: 5,   p: [0,0,0,1.5,3,8,16] },
  { id: 'chalice', e: '🍷', n: 'Kielich Ambrozji', w: 5.6, p: [0,0,0,1,2,5,10] },
  { id: 'ring',    e: '💍', n: 'Pierścień',      w: 6.2, p: [0,0,0,0.8,1.6,3,6] },
  { id: 'grape',   e: '🍇', n: 'Winogrona',      w: 7,   p: [0,0,0,0.5,1,2,4] },
  { id: 'olive',   e: '🫒', n: 'Oliwka',         w: 7.6, p: [0,0,0,0.4,0.8,1.6,3] },
  { id: 'laurel',  e: '🌿', n: 'Wieniec Laurowy', w: 7.6, p: [0,0,0,0.4,0.8,1.6,3] },
  { id: 'coin',    e: '🪙', n: 'Drachma',        w: 7.6, p: [0,0,0,0.4,0.8,1.6,3] },
  { id: 'bolt',    e: '⚡', n: 'Piorun (Wild)',   w: 0.6, wild: true },
  { id: 'temple',  e: '🏛️', n: 'Świątynia (Scatter)', w: 1.3, scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p ? s.p.map(v => v * PAY_SCALE) : null }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const W_BASE = SYMS.map(s => s.w);
const noWild = w => w.map((v, i) => i === I.bolt ? 0 : v);
// Wild tylko na bębnach 2–5 (indeksy 1–4)
const pickWild = E.symPicker(W_BASE), pickNoWild = E.symPicker(noWild(W_BASE));
const W_FREE = W_BASE.slice(); W_FREE[I.temple] = 0.55;
const pickWildF = E.symPicker(W_FREE), pickNoWildF = E.symPicker(noWild(W_FREE));
const HEIGHTS = [[2, 1.5], [3, 2.2], [4, 2.4], [5, 2], [6, 1.4], [7, 1]];
const pickH = E.makePicker(HEIGHTS.map(h => h[1]));

function picker(c, inFree) { const wildOk = c >= 1 && c <= 4; return inFree ? (wildOk ? pickWildF : pickNoWildF) : (wildOk ? pickWild : pickNoWild); }
function ways(grid) { return grid.reduce((a, col) => a * col.length, 1); }

function evalWays(grid, bet) {
  const wins = [];
  for (let si = 0; si < SYMS.length; si++) {
    const s = SYMS[si];
    if (!s.p) continue;
    const counts = [];
    for (let c = 0; c < COLS; c++) {
      const n = grid[c].filter(x => x === si || SYMS[x].wild).length;
      if (!n) break;
      counts.push(n);
    }
    const L = counts.length;
    if (L < MIN_REELS) continue;
    // wymagany co najmniej jeden prawdziwy symbol (wild na bębnie 1 nie występuje, więc zawsze jest)
    const combos = counts.reduce((a, b) => a * b, 1);
    const pay = s.p[L] || 0;
    if (!pay) continue;
    const cells = [];
    for (let c = 0; c < L; c++) grid[c].forEach((x, r) => { if (x === si || SYMS[x].wild) cells.push([c, r]); });
    wins.push({ symIdx: si, reels: L, ways: combos, cells, win: pay * combos * bet / WAYS_NORM });
  }
  return wins;
}

const FS_AWARD = n => n >= 4 ? 10 + 5 * Math.min(2, n - 4) + 5 * Math.max(0, n - 6) : 0;
const FS_RETRIGGER = n => n >= 3 ? 5 * (n - 2) : 0;

const def = {
  game: 'olympus_ways', statsId: 'olympus_ways', event: 'casinoOWSpin', resultEvent: 'casinoOWResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0, fsMult: 1 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const heights = Array.from({ length: COLS }, () => HEIGHTS[pickH()][0]);
    let grid = heights.map((h, c) => { const p = picker(c, inFree); return Array.from({ length: h }, () => p()); });
    const startGrid = grid.map(c => [...c]);
    let mult = inFree ? (state.fsMult || 1) : 1;
    const startMult = mult;
    const steps = [];
    let payout = 0;
    for (let guard = 0; guard < 60; guard++) {
      const wins = evalWays(grid, bet);
      if (!wins.length) break;
      const m = inFree ? mult : 1;
      wins.forEach(w => { w.win *= m; });
      const stepWin = wins.reduce((a, w) => a + w.win, 0);
      payout += stepWin;
      const remove = new Set(wins.flatMap(w => w.cells.map(([c, r]) => c + ',' + r)));
      const falling = [];
      grid = grid.map((col, c) => {
        const kept = col.filter((_, r) => !remove.has(c + ',' + r));
        const p = picker(c, inFree);
        const added = Array.from({ length: col.length - kept.length }, () => p());
        added.forEach((_, r) => falling.push([c, r]));
        return [...added, ...kept];
      });
      steps.push({ wins, win: stepWin, x: m, grid: grid.map(c => [...c]), falling });
      if (inFree) mult++;
    }
    // Scattery nie znikają w kaskadach — liczymy na planszy końcowej
    const sc = E.countSym(grid, i => i === I.temple);
    let capped = false;
    const limit = MAX_WIN * bet - (inFree ? state.fsWin : 0);
    if (payout > limit) { payout = Math.max(0, limit); capped = true; }

    let freeSpinsAwarded = 0;
    if (!capped) {
      if (!inFree && sc.n >= 4) {
        freeSpinsAwarded = FS_AWARD(sc.n);
        state.freeBet = bet; state.freeSpins = freeSpinsAwarded; state.fsTotal = freeSpinsAwarded; state.fsWin = 0; state.fsMult = 1;
      } else if (inFree && sc.n >= 3) {
        freeSpinsAwarded = FS_RETRIGGER(sc.n);
        state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
      }
    }
    if (inFree) {
      state.fsMult = mult; state.fsWin += payout;
      if (capped) state.freeSpins = 0;
    }
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin, x: state.fsMult } : null;
    if (fsSummary) state.fsMult = 1;
    return {
      heights, ways: ways(startGrid), startGrid, steps, finalGrid: grid, payout, capped,
      startMult, fsMult: inFree ? mult : 1,
      scatter: { count: sc.n, cells: sc.cells },
      isFree: inFree, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, fsSummary,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p ? s.p.map(v => v / WAYS_NORM) : null, wild: !!s.wild, scatter: !!s.scatter })),
  cols: COLS, minH: MIN_H, maxH: MAX_H, maxWays: Math.pow(MAX_H, COLS), waysNorm: WAYS_NORM, maxWin: MAX_WIN,
};
const BASE_RTP = 0.953;

module.exports = { registerHandlers, def, meta, SYMS, BASE_RTP };
