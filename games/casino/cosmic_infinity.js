/**
 * COSMIC INFINITY — AT Gaming Casino
 * Infinity Reels: start 3 rzędy × 3 bębny, wygrane „ways” od lewej (min. 3 bębny z rzędu).
 *  - Każda wygrana dokłada NOWY BĘBEN po prawej (kręci się tylko nowy bęben). Proces trwa,
 *    dopóki nowy bęben przedłuża którąkolwiek wygraną — maksymalnie 12 bębnów.
 *  - Mnożnik zależy od najdalszego bębna, do którego sięga wygrana:
 *    4→×1, 5→×2, 6→×3, 7→×4, 8→×6, 9→×8, 10→×12, 11→×18, 12→×25 — mnoży całą wygraną spinu.
 *  - 🌟 Supernowa (Wild) od bębna 2, zastępuje wszystko poza scatterem.
 *  - 🪐 Planeta (Scatter): 3+ w jednym spinie (na wszystkich bębnach) = 10 Free Spinów.
 *    W Free Spinach mnożnik startuje od ×3 (wartość dla 6 bębnów) i nigdy nie spada.
 */
'use strict';
const E = require('./slot_engine');

const ROWS = 3, START_COLS = 3, MAX_COLS = 12;
const PAY_SCALE = 0.9735;
const MAX_WIN = 10000; // × stawki
// Mnożnik wg liczby bębnów, do których sięga wygrana
const MULT = [0, 0, 0, 1, 1, 2, 3, 4, 6, 8, 12, 18, 25];
const FS_START_MULT = MULT[6];
const FS_AWARD = 10;
const FS_WILD_W = 4.6;
// Wzrost wypłaty z długością wygranej (3…12 bębnów)
const GROWTH = [0, 0, 0, 1, 1.4, 1.8, 2.2, 2.6, 3, 3.4, 3.8, 4.2, 4.6];

const raw = [
  { id: 'galaxy', e: '🌌', n: 'Galaktyka',          w: 3,   b: 1.0,  color: '#b48cff' },
  { id: 'hole',   e: '🕳️', n: 'Czarna Dziura',      w: 4,   b: 0.7,  color: '#ff4fd8' },
  { id: 'ufo',    e: '🛸', n: 'UFO',                w: 5,   b: 0.5,  color: '#4fe3ff' },
  { id: 'comet',  e: '☄️', n: 'Kometa',             w: 6,   b: 0.4,  color: '#ff9f43' },
  { id: 'alien',  e: '👽', n: 'Kosmita',            w: 7,   b: 0.3,  color: '#3ff2a3' },
  { id: 'moon',   e: '🌙', n: 'Księżyc',            w: 8,   b: 0.2,  color: '#ffd36b' },
  { id: 'rocket', e: '🚀', n: 'Rakieta',            w: 9,   b: 0.15, color: '#ff6f8a' },
  { id: 'sat',    e: '🛰️', n: 'Satelita',           w: 10,  b: 0.12, color: '#7aa7ff' },
  { id: 'nova',   e: '🌟', n: 'Supernowa (Wild)',   w: 2.0, b: 0,    color: '#fff3c4', wild: true },
  { id: 'planet', e: '🪐', n: 'Planeta (Scatter)',  w: 1.6, b: 0,    color: '#c084fc', scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: GROWTH.map(g => +(g * s.b * PAY_SCALE).toFixed(4)) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const W_FIRST = SYMS.map(s => s.wild ? 0 : s.w);   // bęben 1 bez Wilda
const W_REST = SYMS.map(s => s.w);
const W_FREE = W_REST.map((w, i) => SYMS[i].wild ? FS_WILD_W : w);   // w Free Spinach więcej Supernowych
const pickFirst = E.symPicker(W_FIRST), pickRest = E.symPicker(W_REST), pickFree = E.symPicker(W_FREE);
function reel(c, free) { return Array.from({ length: ROWS }, () => (c === 0 ? pickFirst() : free ? pickFree() : pickRest())); }

// Wygrane ways od lewej: symbol z bębna 1, kolejne bębny zawierające symbol lub Wild
function evalWays(grid, bet) {
  const wins = [];
  const seen = new Set();
  for (const s of grid[0]) {
    if (seen.has(s) || SYMS[s].scatter || SYMS[s].wild) continue;
    seen.add(s);
    let ways = 1, len = 0;
    const cells = [];
    for (let c = 0; c < grid.length; c++) {
      let k = 0;
      grid[c].forEach((x, r) => { if (x === s || (c > 0 && SYMS[x].wild)) { k++; cells.push([c, r]); } });
      if (!k) break;
      ways *= k; len++;
    }
    if (len < 3) continue;
    const win = (SYMS[s].p[len] || 0) * ways * bet;
    wins.push({ symIdx: s, count: len, ways, cells: cells.filter(([c]) => c < len), win });
  }
  return wins;
}

const def = {
  game: 'cosmic_infinity', statsId: 'cosmic_infinity', event: 'casinoCISpin', resultEvent: 'casinoCIResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0, fsMult: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid && state.freeSpins > 0;
    if (inFree) state.freeSpins--;

    const grid = Array.from({ length: START_COLS }, (_, c) => reel(c, inFree));
    const startGrid = grid.map(col => [...col]);
    let wins = evalWays(grid, bet);
    const steps = [];
    // Infinity Reels: każda wygrana dokłada bęben po prawej
    while (wins.length && grid.length < MAX_COLS) {
      const col = grid.length;
      grid.push(reel(col, inFree));
      const nw = evalWays(grid, bet);
      const ext = nw.filter(w => w.count === grid.length);
      steps.push({ col, symbols: [...grid[col]], extends: ext.length > 0, x: MULT[col + 1], cells: ext.flatMap(w => w.cells.filter(([c]) => c === col)) });
      wins = nw;
      if (!ext.length) break;
    }
    const maxLen = wins.reduce((m, w) => Math.max(m, w.count), 0);
    let reelMult = maxLen ? MULT[maxLen] : 1;
    if (inFree) {
      state.fsMult = Math.max(state.fsMult || FS_START_MULT, maxLen ? MULT[maxLen] : 0);
      reelMult = state.fsMult;
    }
    const baseWin = wins.reduce((s, w) => s + w.win, 0);
    let payout = baseWin * reelMult;
    let capped = false;
    if (payout > MAX_WIN * bet) { payout = MAX_WIN * bet; capped = true; }

    // Scattery — liczone na wszystkich bębnach
    const sc = E.countSym(grid, i => i === I.planet);
    let freeSpinsAwarded = 0;
    if (sc.n >= 3) {
      freeSpinsAwarded = FS_AWARD;
      if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; state.fsMult = FS_START_MULT; }
      state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
    }
    if (inFree) state.fsWin += payout;
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;
    if (fsSummary) state.fsMult = 0;
    return {
      startGrid, grid, steps, wins, baseWin, reelMult, reelCount: grid.length, maxLen, payout, capped,
      scatter: sc.cells, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, isFree: inFree,
      fsMult: state.freeSpins > 0 ? state.fsMult : 0, fsSummary,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
// Tabela wypłat: × stawki łącznej za 1 sposób (pokazujemy wybrane długości)
const SHOW = new Set([3, 4, 5, 6, 8, 10, 12]);
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p.map((v, n) => SHOW.has(n) ? v : 0), wild: !!s.wild, scatter: !!s.scatter, color: s.color })),
  rows: ROWS, startCols: START_COLS, maxCols: MAX_COLS, mult: MULT, fsStartMult: FS_START_MULT, fsAward: FS_AWARD, maxWin: MAX_WIN,
};
const BASE_RTP = 0.955;
module.exports = { registerHandlers, def, meta, SYMS, MULT, BASE_RTP };
