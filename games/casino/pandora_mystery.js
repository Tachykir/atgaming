/**
 * PANDORA'S MYSTERY — AT Gaming Casino
 * 5 bębnów × 4 rzędy, 40 linii, Mystery Symbols.
 *
 *  - 🎁 Puszka Pandory ląduje często, także w stosach. Po zatrzymaniu bębnów WSZYSTKIE puszki
 *    odsłaniają się jednocześnie jako ten sam losowy symbol (także 🗝️ Wild). Potem liczone są linie.
 *  - Mystery Multiplier (gra podstawowa, ~1/12 spinów): każda puszka dostaje mnożnik ×2…×10;
 *    mnożniki puszek na wygrywającej linii sumują się i mnożą wygraną tej linii.
 *  - 👁️ Oko (Scatter): 3 / 4 / 5 = 10 / 14 / 18 Free Spinów.
 *  - Free Spiny: każda puszka ma gwarantowany mnożnik ×2…×50 i jest LEPKA przez 2 kolejne spiny.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 5, ROWS = 4;
const PAY_SCALE = 0.853;
const MAX_WIN = 10000;
const FS = { 3: 10, 4: 14, 5: 18 };
const STICKY_SPINS = 2;

const raw = [
  { id: 'phi',     e: 'Φ',   n: 'Fi',             w: 10, rw: 10, p: [0,0,0,5,10,25] },
  { id: 'psi',     e: 'Ψ',   n: 'Psi',            w: 10, rw: 10, p: [0,0,0,5,10,25] },
  { id: 'sigma',   e: 'Σ',   n: 'Sigma',          w: 9,  rw: 9,  p: [0,0,0,5,12,30] },
  { id: 'omega',   e: 'Ω',   n: 'Omega',          w: 9,  rw: 9,  p: [0,0,0,5,12,30] },
  { id: 'amphora', e: '🏺',  n: 'Amfora',         w: 6,  rw: 7,  p: [0,0,0,10,25,60] },
  { id: 'owl',     e: '🦉',  n: 'Sowa Ateny',     w: 5,  rw: 6,  p: [0,0,0,12,30,80] },
  { id: 'snake',   e: '🐍',  n: 'Wąż Meduzy',     w: 4,  rw: 5,  p: [0,0,0,15,40,100] },
  { id: 'trident', e: '🔱',  n: 'Trójząb',        w: 3,  rw: 4,  p: [0,0,0,20,60,150] },
  { id: 'pandora', e: '👸',  n: 'Pandora',        w: 2,  rw: 3,  p: [0,0,2,30,100,300] },
  { id: 'wild',    e: '🗝️', n: 'Klucz (Wild)',   w: 1.2,rw: 2,  p: [0,0,2,30,100,300], wild: true },
  { id: 'eye',     e: '👁️', n: 'Oko (Scatter)',  w: 1.55,rw: 0,  p: [0,0,0,0,0,0], scatter: true },
  { id: 'box',     e: '🎁',  n: 'Puszka Pandory', w: 4,  rw: 0,  p: [0,0,0,0,0,0], mystery: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const pick = E.makePicker(SYMS.map(s => s.w));
const BOX_FREE_W = 3, STACK_FREE = 0.08;
const pickFreeSym = E.makePicker(SYMS.map((s, i) => i === I.eye ? s.w * 0.5 : i === I.box ? BOX_FREE_W : s.w));
const pickReveal = E.makePicker(SYMS.map(s => s.rw));
const STACK_CHANCE = 0.13;        // szansa na stos puszek w bębnie
const MM_CHANCE = 1 / 11;         // Mystery Multiplier w grze podstawowej (gdy są puszki)

// Mnożniki puszek
const MULT_BASE = [[2, 40], [3, 25], [4, 15], [5, 10], [6, 4], [8, 3], [10, 3]];
const MULT_FREE = [[2, 40], [3, 25], [4, 14], [5, 9], [6, 5], [8, 3], [10, 2], [15, 1], [20, 0.6], [25, 0.35], [50, 0.12]];
const pickMB = E.makePicker(MULT_BASE.map(m => m[1]));
const pickMF = E.makePicker(MULT_FREE.map(m => m[1]));

const LINES = [
  [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],
  [0,1,2,1,0],[1,2,3,2,1],[3,2,1,2,3],[2,1,0,1,2],
  [0,1,0,1,0],[1,0,1,0,1],[1,2,1,2,1],[2,1,2,1,2],[2,3,2,3,2],[3,2,3,2,3],
  [0,0,1,0,0],[1,1,0,1,1],[1,1,2,1,1],[2,2,1,2,2],[2,2,3,2,2],[3,3,2,3,3],
  [0,1,1,1,0],[1,0,0,0,1],[1,2,2,2,1],[2,1,1,1,2],[2,3,3,3,2],[3,2,2,2,3],
  [0,1,2,3,3],[3,2,1,0,0],[0,0,1,2,3],[3,3,2,1,0],
  [0,1,2,2,2],[3,2,1,1,1],[1,2,3,3,3],[2,1,0,0,0],
  [1,1,1,2,3],[2,2,2,1,0],[0,0,0,1,2],[3,3,3,2,1],
  [0,2,0,2,0],[3,1,3,1,3],
];

function genGrid(free) {
  const p = free ? pickFreeSym : pick;
  const grid = [];
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) {
      let s = p();
      while (s === I.eye && col.includes(I.eye)) s = p();
      col.push(s);
    }
    if (Math.random() < (free ? STACK_FREE : STACK_CHANCE)) {
      const len = 2 + Math.floor(Math.random() * 3);        // 2–4
      const start = Math.floor(Math.random() * (ROWS - len + 1));
      for (let r = start; r < start + len; r++) col[r] = I.box;
    }
    grid.push(col);
  }
  return grid;
}

const def = {
  game: 'pandora_mystery', statsId: 'pandora_mystery', event: 'casinoPMSpin', resultEvent: 'casinoPMResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0, sticky: [] }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid && state.freeSpins > 0;
    if (inFree) state.freeSpins--;
    const grid = genGrid(inFree);

    // Puszki: lepkie z poprzednich spinów + nowe
    const boxes = [];
    if (inFree) {
      for (const b of state.sticky || []) {
        grid[b.c][b.r] = I.box;
        boxes.push({ c: b.c, r: b.r, mult: b.mult, left: b.left - 1, sticky: true });
      }
    }
    let mm = false;
    const anyNew = grid.some(col => col.includes(I.box));
    if (!inFree && anyNew && Math.random() < MM_CHANCE) mm = true;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (grid[c][r] !== I.box || boxes.find(b => b.c === c && b.r === r)) continue;
      const mult = inFree ? MULT_FREE[pickMF()][0] : mm ? MULT_BASE[pickMB()][0] : 0;
      boxes.push({ c, r, mult, left: inFree ? STICKY_SPINS : 0, sticky: false });
    }

    // Odsłonięcie: jeden wspólny symbol
    const reveal = boxes.length ? pickReveal() : -1;
    const finalGrid = grid.map(col => col.map(s => s === I.box ? reveal : s));
    const lineBet = bet / LINES.length;
    const multAt = {};
    boxes.forEach(b => { if (b.mult) multAt[b.c + ',' + b.r] = b.mult; });
    const winLines = E.evalLines(finalGrid, LINES, SYMS, lineBet).map(w => {
      const m = w.cells.reduce((s, [c, r]) => s + (multAt[c + ',' + r] || 0), 0);
      return m > 0 ? { ...w, baseWin: w.win, x: m, win: w.win * m } : w;
    });
    let payout = winLines.reduce((s, w) => s + w.win, 0);

    // Scattery
    const sc = E.countSym(grid, i => i === I.eye);
    let freeSpinsAwarded = 0;
    if (sc.n >= 3) {
      freeSpinsAwarded = FS[Math.min(5, sc.n)];
      if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; state.sticky = []; }
      state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
    }

    let capped = false;
    const cap = MAX_WIN * bet;
    if (inFree) {
      if (state.fsWin + payout >= cap) { payout = Math.max(0, cap - state.fsWin); capped = true; state.freeSpins = 0; }
      state.fsWin += payout;
      state.sticky = state.freeSpins > 0 ? boxes.filter(b => b.left > 0).map(b => ({ c: b.c, r: b.r, mult: b.mult, left: b.left })) : [];
    } else if (payout > cap) { payout = cap; capped = true; }

    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;
    return {
      mode: inFree ? 'free' : 'base', grid, finalGrid, reveal, boxes, mysteryMult: mm,
      winLines, scatter: sc.cells, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, isFree: inFree,
      sticky: (state.sticky || []).map(b => ({ ...b })), fsSummary, capped, payout,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const BASE_RTP = 0.951;
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter, mystery: !!s.mystery })),
  lines: LINES, cols: COLS, rows: ROWS, fs: FS, multBase: MULT_BASE.map(m => m[0]), multFree: MULT_FREE.map(m => m[0]), maxWin: MAX_WIN,
};
module.exports = { registerHandlers, def, meta, SYMS, LINES, BASE_RTP };
