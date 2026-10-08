/**
 * DEEP SEA FORTUNE — AT Gaming Casino
 * 5 bębnów × 3 rzędy, 10 linii, Money Collect.
 *
 *  - 🐟 Ryba niesie kwotę (×2 … ×2000 stawki). W grze podstawowej płaci tylko jako symbol linii.
 *  - 🛟 Koło ratunkowe (Scatter): 3 / 4 / 5 = 10 / 15 / 20 Free Spinów.
 *  - W Free Spinach pojawia się 🧑‍✈️ Rybak (Wild): każdy rybak ZBIERA kwoty wszystkich ryb na planszy.
 *  - Licznik rybaków: co 4 rybaków → +10 Free Spinów, a mnożnik zbierania rośnie ×1 → ×2 → ×3 → ×10.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 5, ROWS = 3;
const PAY_SCALE = 1.84;
const MAX_WIN = 10000;            // limit wygranej (× stawki) — jednego spinu i całego bonusu
const FS = { 3: 10, 4: 15, 5: 20 };
const LEVELS = [1, 2, 3, 10];     // mnożniki zbierania po kolejnych progach
const PER_LEVEL = 4;              // rybaków na próg
const RETRIGGER = 10;

const raw = [
  { id: 'shell',   e: '🐚', n: 'Muszla',          w: 10, fw: 7,   p: [0,0,0,5,15,40] },
  { id: 'crab',    e: '🦀', n: 'Krab',            w: 9,  fw: 6.5, p: [0,0,0,5,15,40] },
  { id: 'octo',    e: '🐙', n: 'Ośmiornica',      w: 8,  fw: 6,   p: [0,0,0,8,25,60] },
  { id: 'anchor',  e: '⚓', n: 'Kotwica',         w: 6,  fw: 5,   p: [0,0,0,10,40,100] },
  { id: 'chest',   e: '🧰', n: 'Skrzynia',        w: 4.5,fw: 4,   p: [0,0,0,15,60,200] },
  { id: 'shark',   e: '🦈', n: 'Rekin',           w: 3,  fw: 3,   p: [0,0,2,25,100,400] },
  { id: 'fish',    e: '🐟', n: 'Złota Ryba',      w: 7,  fw: 4,   p: [0,0,0,4,10,25], fish: true },
  { id: 'captain', e: '🧑‍✈️', n: 'Rybak (Wild)',   w: 0,  fw: 0.655, p: [0,0,0,0,0,0], wild: true },
  { id: 'buoy',    e: '🛟', n: 'Koło (Scatter)',  w: 1.4, fw: 0, p: [0,0,0,0,0,0], scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const pickBase = E.symPicker(SYMS.map(s => s.w));
const pickFree = E.symPicker(SYMS.map(s => s.fw));

const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,0,1,2,1],
];

// Wartości ryb (× stawki) — rzadsze wyższe
const FISH = [[2, 50], [5, 25], [10, 12], [15, 6], [20, 4], [25, 2.5], [50, 1], [250, 0.1], [2000, 0.005]];
const pickFishBase = E.makePicker(FISH.map(f => f[1]));
const FISH_EMO = ['🐟', '🐠', '🐡'];
function rollFish(c, r, bet) {
  const x = FISH[pickFishBase()][0];
  return { c, r, x, amount: x * bet, kind: x >= 50 ? 2 : x >= 15 ? 1 : 0 };
}

function genGrid(free) {
  const pick = free ? pickFree : pickBase;
  const grid = [];
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) {
      let s = pick();
      // max 1 scatter na bęben
      while (s === I.buoy && col.includes(I.buoy)) s = pick();
      col.push(s);
    }
    grid.push(col);
  }
  return grid;
}

const def = {
  game: 'deep_sea', statsId: 'deep_sea', event: 'casinoDSSpin', resultEvent: 'casinoDSResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0, fishers: 0, level: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid && state.freeSpins > 0;
    if (inFree) state.freeSpins--;
    const grid = genGrid(inFree);
    const lineBet = bet / LINES.length;
    const winLines = E.evalLines(grid, LINES, SYMS, lineBet);
    let lineWin = winLines.reduce((s, w) => s + w.win, 0);

    const fish = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r] === I.fish) fish.push(rollFish(c, r, bet));
    const fishSum = fish.reduce((s, f) => s + f.amount, 0);

    // ── Zbieranie (tylko Free Spiny) ──
    const collects = [];
    let collectWin = 0, levelUps = [], freeSpinsAwarded = 0;
    const multBefore = LEVELS[state.level || 0];
    if (inFree) {
      const fishers = E.countSym(grid, i => i === I.captain).cells;
      for (const [c, r] of fishers) {
        const win = fishSum * multBefore;
        collects.push({ c, r, win, mult: multBefore });
        collectWin += win;
      }
      // Licznik rybaków i progi
      for (let k = 0; k < fishers.length; k++) {
        state.fishers = (state.fishers || 0) + 1;
        if (state.fishers % PER_LEVEL === 0 && state.level < LEVELS.length - 1) {
          state.level++;
          state.freeSpins += RETRIGGER; state.fsTotal += RETRIGGER; freeSpinsAwarded += RETRIGGER;
          levelUps.push({ at: state.fishers, mult: LEVELS[state.level] });
        }
      }
    }

    // ── Scattery (tylko gra podstawowa) ──
    const sc = E.countSym(grid, i => i === I.buoy);
    let fsTriggered = false;
    if (!inFree && sc.n >= 3) {
      const n = FS[Math.min(5, sc.n)];
      fsTriggered = true;
      freeSpinsAwarded += n;
      state.freeBet = bet; state.fsTotal = n; state.fsWin = 0; state.fishers = 0; state.level = 0;
      state.freeSpins += n;
    }

    let payout = lineWin + collectWin;
    let capped = false;
    const cap = MAX_WIN * bet;
    if (inFree) {
      if (state.fsWin + payout >= cap) { payout = Math.max(0, cap - state.fsWin); capped = true; state.freeSpins = 0; }
      state.fsWin += payout;
    } else if (payout > cap) { payout = cap; capped = true; }

    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;
    return {
      mode: inFree ? 'free' : 'base', grid, winLines, lineWin, fish, fishSum,
      collects, collectWin, collectMult: multBefore, levelUps,
      fishers: state.fishers || 0, level: state.level || 0, levelMult: LEVELS[state.level || 0],
      scatter: sc.cells, fsTriggered, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, isFree: inFree,
      fsSummary, capped, payout,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const BASE_RTP = 0.953;
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter, fish: !!s.fish })),
  lines: LINES, cols: COLS, rows: ROWS, fishValues: FISH.map(f => f[0]), levels: LEVELS, perLevel: PER_LEVEL, fs: FS, maxWin: MAX_WIN,
};
module.exports = { registerHandlers, def, meta, SYMS, LINES, BASE_RTP };
