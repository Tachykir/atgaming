/**
 * DUAL BLADES — AT Gaming Casino
 * Dwie niezależne siatki 3×3 (Lewa / Prawa), po 5 linii każda.
 *
 *  - 🌑 Shadow Blade (Wild) na lewej siatce zamienia CAŁY ten sam bęben prawej siatki w wildy
 *  - Sync Bonus: gdy obie siatki wygrywają w tym samym spinie → cała wygrana ×2 (×3 w Free Spinach)
 *  - Sync Meter: każde 5 synchronizacji → 5 Free Spinów (stawka = średnia z nabijania)
 *  - 🌒 Eclipse (Scatter): 3/4/5+ łącznie na obu siatkach → 8/10/15 Free Spinów
 */
'use strict';
const E = require('./slot_engine');

const COLS = 3, ROWS = 3;
const PAY_SCALE = 0.475;
const SYNC_GOAL = 5;

const raw = [
  { id: 'blade',    e: '🗡️', n: 'Ostrze',       w: 3,   p: [0,0,0,50] },
  { id: 'katana',   e: '⚔️', n: 'Katana',       w: 4,   p: [0,0,0,25] },
  { id: 'shuriken', e: '✴️', n: 'Shuriken',     w: 5,   p: [0,0,0,15] },
  { id: 'mask',     e: '🎭', n: 'Maska',        w: 6,   p: [0,0,0,10] },
  { id: 'smoke',    e: '💨', n: 'Dym',          w: 7,   p: [0,0,0,6] },
  { id: 'coin',     e: '🪙', n: 'Moneta',       w: 8,   p: [0,0,0,4] },
  { id: 'shadow',   e: '🌑', n: 'Shadow Blade', w: 1.3, p: [0,0,0,100], wild: true },
  { id: 'eclipse',  e: '🌒', n: 'Eclipse',      w: 0.6, p: [0,0,0,0], scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const pick = E.makePicker(SYMS.map(s => s.w));
const LINES = [[1,1,1],[0,0,0],[2,2,2],[0,1,2],[2,1,0]];
const FS = { 3: 8, 4: 10, 5: 15 };

const def = {
  game: 'dual_blades', statsId: 'dual_blades', event: 'casinoDBSpin', resultEvent: 'casinoDBResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, sync: { points: 0, wager: 0 }, fsTotal: 0, fsWin: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const left = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => pick()));
    const shadowCols = [];
    left.forEach((col, c) => { if (col.includes(I.shadow)) shadowCols.push(c); });
    const right = Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, () => shadowCols.includes(c) ? I.shadow : pick()));

    const lineBet = bet / (LINES.length * 2);
    const leftWins = E.evalLines(left, LINES, SYMS, lineBet);
    const rightWins = E.evalLines(right, LINES, SYMS, lineBet);
    const leftPay = leftWins.reduce((s, w) => s + w.win, 0);
    const rightPay = rightWins.reduce((s, w) => s + w.win, 0);
    const syncBonus = leftPay > 0 && rightPay > 0;
    const syncMult = syncBonus ? (inFree ? 3 : 2) : 1;
    const payout = (leftPay + rightPay) * syncMult;

    let syncFSAwarded = 0, freeSpinsAwarded = 0;
    const scL = E.countSym(left, i => i === I.eclipse), scR = E.countSym(right, i => i === I.eclipse);
    const scatterCount = scL.n + scR.n;
    const start = (n, b) => { if (state.freeSpins === 0 || !inFree) { state.freeBet = b; state.fsTotal = 0; state.fsWin = 0; } state.freeSpins += n; state.fsTotal += n; };
    if (scatterCount >= 3) { freeSpinsAwarded = FS[Math.min(5, scatterCount)]; start(freeSpinsAwarded, inFree ? state.freeBet : bet); }
    if (paid && syncBonus) {
      E.meterAdd(state.sync, bet, 1);
      if (state.sync.points >= SYNC_GOAL) {
        syncFSAwarded = 5;
        const b = E.meterBet(state.sync, bet);
        E.meterReset(state.sync);
        if (!freeSpinsAwarded) start(syncFSAwarded, b); else { state.freeSpins += syncFSAwarded; state.fsTotal += syncFSAwarded; }
      }
    }
    if (inFree) state.fsWin += payout;
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;

    return {
      leftGrid: left, rightGrid: right, shadowCols,
      leftWins: leftWins.map(w => ({ ...w, win: w.win * syncMult })), rightWins: rightWins.map(w => ({ ...w, win: w.win * syncMult })),
      leftPay: leftPay * syncMult, rightPay: rightPay * syncMult, syncBonus, syncMult,
      syncMeter: state.sync.points, syncGoal: SYNC_GOAL, syncFSAwarded,
      payout, isFree: inFree, freeSpinsAwarded: freeSpinsAwarded + syncFSAwarded, freeSpinsRemaining: state.freeSpins, fsSummary,
      scatter: { left: scL.cells, right: scR.cells, count: scatterCount },
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = { syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter })), lines: LINES, syncGoal: SYNC_GOAL };
module.exports = { registerHandlers, def, meta, SYMS, LINES };
