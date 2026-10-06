/**
 * NEON RACER — AT Gaming Casino
 * 5 bębnów × 3 rzędy, 20 linii, wygrane w OBIE strony (od lewej i od prawej).
 *
 *  - 💡 Reflektory (Wild) na bębnach 2–4 rozszerzają się na cały bęben
 *  - 💨 Nitro (Scatter): każde Nitro +2% do Speed Meter; 3/4/5 → 8/12/20 Free Spinów
 *  - Speed Meter: każdy płatny spin +0–1%; przy 100% → TURBO: 6 darmowych spinów ×3
 *    (stawka Turbo = średnia stawka z nabijania licznika)
 */
'use strict';
const E = require('./slot_engine');

const COLS = 5, ROWS = 3;
const PAY_SCALE = 1.52;
const TURBO_SPINS = 6, TURBO_MULT = 3, NITRO_SPEED = 2;

const raw = [
  { id: 'car',    e: '🏎️', n: 'Bolid',      w: 3,  p: [0,0,0,15,60,300] },
  { id: 'trophy', e: '🏆', n: 'Puchar',     w: 4,  p: [0,0,0,10,40,150] },
  { id: 'helmet', e: '⛑️', n: 'Kask',       w: 6,  p: [0,0,0,8,25,80] },
  { id: 'wheel',  e: '🛞', n: 'Koło',       w: 8,  p: [0,0,0,5,15,50] },
  { id: 'fuel',   e: '⛽', n: 'Paliwo',     w: 10, p: [0,0,0,4,10,30] },
  { id: 'flag',   e: '🏁', n: 'Flaga',      w: 12, p: [0,0,0,3,8,20] },
  { id: 'coin',   e: '🪙', n: 'Moneta',     w: 13, p: [0,0,0,2,5,15] },
  { id: 'lights', e: '💡', n: 'Reflektory', w: 1.0,p: [0,0,0,20,80,500], wild: true, expanding: true },
  { id: 'nitro',  e: '💨', n: 'Nitro',      w: 1.6,p: [0,0,0,0,0,0], scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const pickAll = E.makePicker(SYMS.map(s => s.w));
const pickNoWild = E.makePicker(SYMS.map((s, i) => i === I.lights ? 0 : s.w));

const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,0,2,0],
];
const FS = { 3: 8, 4: 12, 5: 20 };

const def = {
  game: 'neon_racer', statsId: 'neon_racer', event: 'casinoNRSpin', resultEvent: 'casinoNRResult',
  newState: () => ({ speed: { points: 0, wager: 0 }, freeSpins: 0, freeBet: 0, mode: null, fsTotal: 0, fsWin: 0 }),
  isFree: s => s.freeSpins > 0,
  saveMeter: s => Math.floor(s.speed.points),
  spin(state, { bet, paid }) {
    const inFree = !paid;
    const mode = inFree ? state.mode : null;
    if (inFree) state.freeSpins--;
    const raw = Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, () => (c === 0 || c === 4) ? pickNoWild() : pickAll()));
    const expandedCols = [];
    const grid = raw.map((col, c) => { if (col.includes(I.lights)) { expandedCols.push(c); return col.map(() => I.lights); } return [...col]; });
    const mult = mode === 'turbo' ? TURBO_MULT : mode === 'free' ? 2 : 1;
    const wins = E.evalLines(grid, LINES, SYMS, bet / LINES.length, { bothWays: true }).map(w => ({ ...w, win: w.win * mult }));
    const payout = wins.reduce((s, w) => s + w.win, 0);

    const sc = E.countSym(raw, i => i === I.nitro);
    let speedGain = 0, turboTriggered = false, freeSpinsAwarded = 0;
    const previousSpeed = Math.floor(state.speed.points);
    if (paid) {
      speedGain = (Math.random() < 0.5 ? 1 : 0) + sc.n * NITRO_SPEED;
      E.meterAdd(state.speed, bet, speedGain);
    }
    if (sc.n >= 3) {
      freeSpinsAwarded = FS[Math.min(5, sc.n)];
      if (!inFree) { state.freeBet = bet; state.mode = 'free'; state.fsTotal = 0; state.fsWin = 0; }
      state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
    } else if (paid && state.speed.points >= 100) {
      turboTriggered = true;
      state.freeBet = E.meterBet(state.speed, bet);
      E.meterReset(state.speed);
      state.mode = 'turbo'; state.freeSpins = TURBO_SPINS; state.fsTotal = TURBO_SPINS; state.fsWin = 0;
      freeSpinsAwarded = TURBO_SPINS;
    }
    if (inFree) state.fsWin += payout;
    let fsSummary = null;
    if (inFree && state.freeSpins === 0) { fsSummary = { total: state.fsTotal, win: state.fsWin, mode }; state.mode = null; }

    return {
      rawGrid: raw, grid, expandedCols, winLines: wins, payout, isFree: inFree, spinMode: mode, spinMult: mult,
      freeMode: state.freeSpins > 0 ? state.mode : null, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, turboTriggered, fsSummary,
      speedMeter: Math.min(100, Math.floor(state.speed.points)), previousSpeed, speedGain, scatter: sc.cells,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = { syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter })), lines: LINES, turboSpins: TURBO_SPINS, turboMult: TURBO_MULT };
module.exports = { registerHandlers, def, meta, SYMS, LINES };
