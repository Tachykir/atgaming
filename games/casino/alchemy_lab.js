/**
 * ALCHEMY LAB — AT Gaming Casino
 * 5 bębnów × 4 rzędy, 30 linii. TRANSMUTACJA symboli.
 *
 *  - Symbole mają 5 poziomów: 🪨 Kamień → 🥉 Brąz → 🥈 Srebro → 🥇 Złoto → 💎 Diament.
 *    Kamień i Brąz płacą od 4 na linii, wyższe poziomy od 3.
 *  - ⚗️ Mikstura (Wild) po wylądowaniu TRANSMUTUJE: wszystkie symbole najniższego obecnego
 *    poziomu na planszy zamieniają się w symbol poziom wyżej (każda mikstura = jedna transmutacja).
 *    Dopiero potem liczone są linie.
 *  - 🔮 Kamień Filozoficzny (Scatter): 3/4/5 = 10/12/15 Free Spinów.
 *  - W Free Spinach transmutacje są TRWAŁE: każda mikstura usuwa najniższy poziom z puli symboli
 *    do końca serii (maksymalnie do Srebra — zostają tylko 🥈 🥇 💎).
 */
'use strict';
const E = require('./slot_engine');

const COLS = 5, ROWS = 4;
const PAY_SCALE = 0.733;
const MAX_WIN = 10000;
const MAX_FLOOR = 2; // w FS najniższy możliwy poziom puli: Srebro
const BASE_RTP = 0.953;
const TOP = 4;

const raw = [
  { id: 'stone',   e: '🪨', n: 'Kamień',  lv: 0, w: 10, p: [0,0,0,0,3,8],     color: '#9aa3ad' },
  { id: 'bronze',  e: '🥉', n: 'Brąz',    lv: 1, w: 9,  p: [0,0,0,0,5,15],    color: '#d08a4a' },
  { id: 'silver',  e: '🥈', n: 'Srebro',  lv: 2, w: 8,  p: [0,0,0,0,8,25],   color: '#d9e2ec' },
  { id: 'gold',    e: '🥇', n: 'Złoto',   lv: 3, w: 6,  p: [0,0,0,5,20,100],  color: '#ffd36b' },
  { id: 'diamond', e: '💎', n: 'Diament', lv: 4, w: 4,  p: [0,0,0,10,50,500], color: '#4fe3ff' },
  { id: 'potion',  e: '⚗️', n: 'Mikstura (Wild)', w: 1.0, p: [0,0,0,0,0,0], wild: true, color: '#5effa9' },
  { id: 'stone_p', e: '🔮', n: 'Kamień Filozoficzny (Scatter)', w: 0, p: [0,0,0,0,0,0], scatter: true, color: '#c084fc' },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const POTION = I.potion, SCATTER = I.stone_p;
const POTION_W = 0.5, POTION_W_FS = 0.25;
const SC_CHANCE = 0.085, SC_CHANCE_FS = 0.06; // szansa na scatter na bębnie
const FS = { 3: 10, 4: 12, 5: 15 };
const FS_START_FLOOR = 1; // Kamień Filozoficzny na start Free Spinów usuwa 🪨 z puli

// Pickery dla każdego „dna” puli (0 = pełna pula, 3 = tylko Złoto i Diament)
const pickers = [0, 1, 2, 3].map(floor => {
  const base = E.symPicker(SYMS.map((s, i) => i === SCATTER ? 0 : i === POTION ? POTION_W : s.lv >= floor ? s.w : 0));
  const free = E.symPicker(SYMS.map((s, i) => i === SCATTER ? 0 : i === POTION ? POTION_W_FS : s.lv >= floor ? s.w : 0));
  return { base, free };
});

const LINES = [
  [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[0,1,2,1,0],
  [3,2,1,2,3],[1,2,3,2,1],[2,1,0,1,2],[0,1,0,1,0],[1,0,1,0,1],
  [2,3,2,3,2],[3,2,3,2,3],[1,2,1,2,1],[2,1,2,1,2],[0,0,1,0,0],
  [3,3,2,3,3],[1,1,0,1,1],[2,2,3,2,2],[0,1,1,1,0],[3,2,2,2,3],
  [1,0,0,0,1],[2,3,3,3,2],[0,0,1,2,3],[3,3,2,1,0],[1,2,2,2,1],
  [2,1,1,1,2],[0,2,0,2,0],[3,1,3,1,3],[1,3,1,3,1],[2,0,2,0,2],
];

function genGrid(floor, free) {
  const pick = free ? pickers[floor].free : pickers[floor].base;
  const grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => pick()));
  const ch = free ? SC_CHANCE_FS : SC_CHANCE;
  for (let c = 0; c < COLS; c++) if (Math.random() < ch) grid[c][Math.floor(Math.random() * ROWS)] = SCATTER;
  return grid;
}
const lvOf = si => SYMS[si].lv;

// Transmutacja: każda mikstura podnosi o poziom wszystkie symbole najniższego obecnego poziomu.
// permanent (FS): mikstura usuwa najniższy poziom z puli — wszystkie symbole poniżej nowego dna awansują.
function transmute(grid, floor, permanent) {
  const g = grid.map(c => [...c]);
  const potions = E.countSym(g, i => i === POTION).cells;
  const steps = [];
  for (const p of potions) {
    if (permanent && floor < MAX_FLOOR) {
      floor++;
      const cells = [];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
        const lv = lvOf(g[c][r]);
        if (lv !== undefined && lv < floor) { g[c][r] = floor; cells.push([c, r]); }
      }
      steps.push({ p, from: floor - 1, to: floor, cells, perm: true, floor });
      continue;
    }
    let low = Infinity;
    for (const col of g) for (const si of col) { const lv = lvOf(si); if (lv !== undefined && lv < low) low = lv; }
    if (low === Infinity || low >= TOP) { steps.push({ p, from: TOP, to: TOP, cells: [], fizzle: true }); continue; }
    const cells = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (lvOf(g[c][r]) === low) { g[c][r] = low + 1; cells.push([c, r]); }
    steps.push({ p, from: low, to: low + 1, cells });
  }
  return { grid: g, steps, floor };
}

const def = {
  game: 'alchemy_lab', statsId: 'alchemy_lab', event: 'casinoALSpin', resultEvent: 'casinoALResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0, floor: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const floorBefore = inFree ? (state.floor || 0) : 0;
    const grid = genGrid(floorBefore, inFree);
    const t = transmute(grid, floorBefore, inFree);
    if (inFree) state.floor = t.floor;
    const winLines = E.evalLines(t.grid, LINES, SYMS, bet / LINES.length);
    let payout = winLines.reduce((s, w) => s + w.win, 0);
    let capped = false;
    if (payout > MAX_WIN * bet) { payout = MAX_WIN * bet; capped = true; }

    const sc = E.countSym(grid, i => i === SCATTER);
    let freeSpinsAwarded = 0;
    if (sc.n >= 3) {
      freeSpinsAwarded = FS[Math.min(5, sc.n)];
      if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; state.floor = FS_START_FLOOR; }
      state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
    }
    if (inFree) state.fsWin += payout;
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;
    if (fsSummary) state.floor = 0;
    return {
      mode: inFree ? 'free' : 'base', grid, finalGrid: t.grid, steps: t.steps,
      floorBefore, floor: state.freeSpins > 0 ? state.floor : (inFree ? t.floor : 0),
      winLines, payout, capped, scatter: sc.cells,
      isFree: inFree, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, fsSummary,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, lv: s.lv, wild: !!s.wild, scatter: !!s.scatter, color: s.color })),
  lines: LINES, cols: COLS, rows: ROWS, fs: FS, maxFloor: MAX_FLOOR,
};
module.exports = { registerHandlers, def, meta, SYMS, LINES, BASE_RTP };
