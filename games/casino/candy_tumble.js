/**
 * CANDY TUMBLE — AT Gaming Casino
 * Siatka 6×5, "Pay Anywhere": 8+ takich samych symboli w dowolnym miejscu = wygrana.
 *  - Tumble: wygrane symbole znikają, nowe spadają z góry, aż nie będzie wygranej.
 *  - 🍭 Scatter: 4/5/6 = 3×/5×/100× stawki + 10 Free Spinów (w FS: 3+ = +5).
 *  - Free Spiny: spadają 💣 bomby z mnożnikami ×2–×100; jeśli sekwencja tumble
 *    zakończy się wygraną, suma bomb mnoży wygraną całego spinu.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 6, ROWS = 5, MIN = 8;
const PAY_SCALE = 2.24;
// wypłaty × stawka łączna za 8–9 / 10–11 / 12+
const raw = [
  { id: 'heart',  e: '🍬', n: 'Cukierek',  w: 4,  p: [10, 25, 50] },
  { id: 'berry',  e: '🫐', n: 'Jagody',    w: 6,  p: [2.5, 10, 25] },
  { id: 'grape',  e: '🍇', n: 'Winogrona', w: 8,  p: [2, 5, 15] },
  { id: 'apple',  e: '🍏', n: 'Jabłko',    w: 10,  p: [1.5, 2, 12] },
  { id: 'melon',  e: '🍉', n: 'Arbuz',     w: 12, p: [1, 1.5, 10] },
  { id: 'peach',  e: '🍑', n: 'Brzoskwinia', w: 13, p: [0.8, 1.2, 8] },
  { id: 'banana', e: '🍌', n: 'Banan',     w: 15, p: [0.5, 1, 5] },
  { id: 'straw',  e: '🍓', n: 'Truskawka', w: 17, p: [0.4, 0.9, 4] },
  { id: 'cherry', e: '🍒', n: 'Wiśnia',    w: 19, p: [0.25, 0.75, 2] },
  { id: 'lolly',  e: '🍭', n: 'Lizak (Scatter)', w: 2.1, scatter: true },
  { id: 'bomb',   e: '💣', n: 'Bomba',     w: 0,  bomb: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p ? s.p.map(v => v * PAY_SCALE) : null }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const BASE_W = SYMS.map(s => s.w);
const FREE_W = BASE_W.slice(); FREE_W[I.bomb] = 5.5; FREE_W[I.lolly] = 1.0;
const pickBase = E.symPicker(BASE_W), pickFree = E.symPicker(FREE_W);
const BOMBS = [[2, 40], [3, 20], [4, 12], [5, 10], [8, 6], [10, 5], [15, 3], [25, 2], [50, 1.2], [100, 0.5]];
const pickBomb = E.makePicker(BOMBS.map(b => b[1]));
const SCATTER_PAY = { 4: 3, 5: 5, 6: 100 };

function payFor(sym, n) { if (!sym.p || n < MIN) return 0; return n >= 12 ? sym.p[2] : n >= 10 ? sym.p[1] : sym.p[0]; }

const def = {
  game: 'candy_tumble', statsId: 'candy_tumble', event: 'casinoCTSpin', resultEvent: 'casinoCTResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const pick = inFree ? pickFree : pickBase;
    const bombs = {}; // "c,r" -> mult
    const roll = (c, r) => { const s = pick(); if (s === I.bomb) bombs[c + ',' + r] = BOMBS[pickBomb()][0]; return s; };
    let grid = Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, (_, r) => roll(c, r)));
    const startGrid = grid.map(c => [...c]);
    const startBombs = { ...bombs };
    const steps = [];
    let base = 0;
    for (let guard = 0; guard < 40; guard++) {
      const counts = {};
      grid.forEach((col, c) => col.forEach((s, r) => { (counts[s] = counts[s] || []).push([c, r]); }));
      const wins = [];
      for (const [si, cells] of Object.entries(counts)) {
        const pay = payFor(SYMS[si], cells.length);
        if (pay > 0) wins.push({ symIdx: Number(si), cells, count: cells.length, win: pay * bet });
      }
      if (!wins.length) break;
      const stepWin = wins.reduce((s, w) => s + w.win, 0);
      base += stepWin;
      // usuń wygrane, przesuń bomby razem z symbolami
      const remove = new Set(wins.flatMap(w => w.cells.map(([c, r]) => c + ',' + r)));
      const falling = [];
      const newBombs = {};
      grid = grid.map((col, c) => {
        const kept = [];
        col.forEach((s, r) => { if (!remove.has(c + ',' + r)) kept.push({ s, b: bombs[c + ',' + r] }); });
        const add = ROWS - kept.length;
        const added = Array.from({ length: add }, (_, r) => { falling.push([c, r]); const s = pick(); return { s, b: s === I.bomb ? BOMBS[pickBomb()][0] : undefined }; });
        const all = [...added, ...kept];
        all.forEach((x, r) => { if (x.b) newBombs[c + ',' + r] = x.b; });
        return all.map(x => x.s);
      });
      Object.keys(bombs).forEach(k => delete bombs[k]);
      Object.assign(bombs, newBombs);
      steps.push({ wins, win: stepWin, grid: grid.map(c => [...c]), falling, bombs: { ...bombs } });
    }
    const sc = E.countSym(grid, i => i === I.lolly);
    const scStart = E.countSym(startGrid, i => i === I.lolly);
    const scN = Math.max(sc.n, scStart.n);
    const scatterWin = (SCATTER_PAY[Math.min(6, scN)] || 0) * bet;
    let bombMult = 0;
    if (inFree && base > 0) bombMult = Object.values(bombs).reduce((s, m) => s + m, 0);
    const payout = base * (bombMult > 0 ? bombMult : 1) + scatterWin;

    let freeSpinsAwarded = 0;
    if (!inFree && scN >= 4) { freeSpinsAwarded = 10; state.freeBet = bet; state.fsTotal = 10; state.fsWin = 0; state.freeSpins = 10; }
    else if (inFree && scN >= 3) { freeSpinsAwarded = 5; state.freeSpins += 5; state.fsTotal += 5; }
    if (inFree) state.fsWin += payout;
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;
    return { startGrid, startBombs, steps, finalGrid: grid, bombs: { ...bombs }, bombMult, baseWin: base, scatter: { count: scN, cells: sc.n >= scStart.n ? sc.cells : scStart.cells, win: scatterWin },
      payout, isFree: inFree, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, fsSummary };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = { syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, scatter: !!s.scatter })), cols: COLS, rows: ROWS, minCount: MIN, scatterPay: SCATTER_PAY };
module.exports = { registerHandlers, def, meta, SYMS };
