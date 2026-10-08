/**
 * DRAGON HOARD — AT Gaming Casino
 * 4 bębny × 5 rzędów, 20 linii, Hold & Win.
 *
 *  - 🐉 Smok (Wild) rozszerza się na cały bęben
 *  - 🔥 Ogień (Scatter): 3/4/5+ → 8/12/15 Free Spinów (wygrane ×2)
 *  - 💎 Gem: każdy niesie wartość (×stawka) lub jackpot. 6+ gemów → Hold & Win:
 *    gemy zostają, reszta kręci; każdy nowy gem resetuje licznik do 3 respinów.
 *    Zapełnienie wszystkich 20 pól = GRAND. Na koniec wypłacana jest suma gemów.
 *  Jackpoty są mnożnikami stawki: Mini ×10, Minor ×25, Major ×100, Grand ×1000.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 4, ROWS = 5;
const PAY_SCALE = 0.91;
const HOLD_TRIGGER = 6;
const RESPINS = 3;
const JACKPOTS = { mini: 10, minor: 25, major: 100, grand: 1000 };

const raw = [
  { id: 'crown',  e: '👑', n: 'Korona',          w: 3,  p: [0,0,0,20,100,0] },
  { id: 'sword',  e: '⚔️', n: 'Miecz',           w: 4,  p: [0,0,0,15,60,0] },
  { id: 'shield', e: '🛡️', n: 'Tarcza',          w: 6,  p: [0,0,0,10,40,0] },
  { id: 'potion', e: '🧪', n: 'Mikstura',        w: 8,  p: [0,0,0,6,25,0] },
  { id: 'scroll', e: '📜', n: 'Zwój',            w: 9,  p: [0,0,0,4,15,0] },
  { id: 'coin',   e: '🪙', n: 'Złota Moneta',    w: 10, p: [0,0,0,3,10,0] },
  { id: 'dragon', e: '🐉', n: 'Smok (Wild)',     w: 0.8,p: [0,0,0,0,0,0], wild: true, expanding: true },
  { id: 'fire',   e: '🔥', n: 'Ogień (Scatter)', w: 0.85,p: [0,0,0,0,0,0], scatter: true },
  { id: 'gem',    e: '💎', n: 'Smoczy Gem',      w: 3.5,p: [0,0,0,0,0,0], gem: true, blank: true },
  { id: 'empty',  e: '',   n: 'Pusto',           w: 0,  p: [0,0,0,0,0,0], blank: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const pick = E.symPicker(SYMS.map(s => s.w));

const LINES = [
  [2,2,2,2],[0,0,0,0],[4,4,4,4],[1,1,1,1],[3,3,3,3],
  [0,1,2,1],[4,3,2,3],[0,1,2,3],[4,3,2,1],[1,0,1,0],
  [3,4,3,4],[0,2,4,2],[4,2,0,2],[0,0,1,2],[2,2,1,0],
  [0,1,1,1],[4,3,3,3],[2,1,0,1],[2,3,4,3],[1,2,3,2],
];

// Wartości gemów (× stawka)
const GEM_VALUES = [
  [{ v: 1 }, 30], [{ v: 2 }, 25], [{ v: 3 }, 15], [{ v: 5 }, 10], [{ v: 8 }, 5], [{ v: 15 }, 2],
  [{ jp: 'mini' }, 4], [{ jp: 'minor' }, 1.5], [{ jp: 'major' }, 0.25],
];
const pickGem = E.makePicker(GEM_VALUES.map(g => g[1]));
function rollGem() { return { ...GEM_VALUES[pickGem()][0] }; }
const RESPIN_GEM_CHANCE = 0.07; // szansa na gem w pustym polu podczas respinu
const FS = { 3: 8, 4: 12, 5: 15 };
const FS_MULT = 2;

function expand(grid) {
  return grid.map(col => col.some(s => SYMS[s].expanding) ? col.map(() => I.dragon) : [...col]);
}
function gemValue(g, bet) { return g.jp ? JACKPOTS[g.jp] * bet : g.v * bet; }

const def = {
  game: 'dragon_hoard', statsId: 'dragon_hoard', event: 'casinoDHSpin', resultEvent: 'casinoDHResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, respins: 0, gems: [], holdBet: 0, fsTotal: 0, fsWin: 0 }),
  isFree: s => s.respins > 0 || s.freeSpins > 0,
  spin(state, { bet, paid }) {
    // ── HOLD & WIN ───────────────────────────────────────────
    if (state.respins > 0) {
      const grid = [];
      const newGems = [];
      for (let c = 0; c < COLS; c++) {
        grid.push([]);
        for (let r = 0; r < ROWS; r++) {
          if (state.gems.find(g => g.col === c && g.row === r)) { grid[c].push(I.gem); continue; }
          if (Math.random() < RESPIN_GEM_CHANCE) {
            const g = { col: c, row: r, ...rollGem() };
            state.gems.push(g); newGems.push(g); grid[c].push(I.gem);
          } else grid[c].push(I.empty);
        }
      }
      state.respins = newGems.length ? RESPINS : state.respins - 1;
      const full = state.gems.length >= COLS * ROWS;
      let payout = 0, jackpotWins = [], ended = false;
      if (full || state.respins <= 0) {
        ended = true;
        if (full) jackpotWins.push({ jp: 'grand', amount: JACKPOTS.grand * bet });
        state.gems.filter(g => g.jp).forEach(g => jackpotWins.push({ jp: g.jp, amount: JACKPOTS[g.jp] * bet, col: g.col, row: g.row }));
        payout = state.gems.reduce((s, g) => s + gemValue(g, bet), 0) + (full ? JACKPOTS.grand * bet : 0);
        state.respins = 0;
      }
      const res = { mode: 'hold', grid, displayGrid: grid, winLines: [], gems: state.gems.map(g => ({ ...g })), newGems, respinsLeft: state.respins, holdEnded: ended, jackpotWins, payout, freeSpinsRemaining: state.freeSpins };
      if (ended) state.gems = [];
      return res;
    }

    // ── SPIN NORMALNY / FREE SPIN ────────────────────────────
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => pick()));
    const displayGrid = expand(grid);
    const mult = inFree ? FS_MULT : 1;
    const wins = E.evalLines(displayGrid, LINES, SYMS, bet / LINES.length).map(w => ({ ...w, win: w.win * mult }));
    let payout = wins.reduce((s, w) => s + w.win, 0);

    const sc = E.countSym(grid, i => i === I.fire);
    let freeSpinsAwarded = 0;
    if (sc.n >= 3) {
      freeSpinsAwarded = FS[Math.min(5, sc.n)];
      if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; }
      state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
    }

    // Gemy
    const gemCells = E.countSym(grid, i => i === I.gem).cells;
    const gems = gemCells.map(([c, r]) => ({ col: c, row: r, ...rollGem() }));
    let holdTriggered = false;
    if (gems.length >= HOLD_TRIGGER) {
      holdTriggered = true;
      state.gems = gems;
      state.respins = RESPINS;
      // Hold & Win podczas free spinów gra za stawkę free spinów
      if (!inFree) state.freeBet = bet;
    }

    if (inFree) state.fsWin += payout;
    const fsSummary = inFree && state.freeSpins === 0 && !holdTriggered ? { total: state.fsTotal, win: state.fsWin } : null;
    return {
      mode: inFree ? 'free' : 'base', grid, displayGrid, winLines: wins, payout, freeMult: mult,
      scatter: sc.cells, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, fsSummary,
      gems, holdTriggered, respinsLeft: state.respins,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = { syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter, gem: !!s.gem })), lines: LINES, cols: COLS, rows: ROWS, jackpots: JACKPOTS, holdTrigger: HOLD_TRIGGER };

module.exports = { registerHandlers, def, meta, SYMS, LINES };
