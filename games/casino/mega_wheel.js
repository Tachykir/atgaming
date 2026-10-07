/**
 * MEGA WHEEL — AT Gaming Casino
 * 5 bębnów × 3 rzędy, 20 linii, klasyczne symbole Las Vegas.
 *
 *  - 🌟 Gwiazda = Wild (bębny 2–5), w Free Spinach pojawia się znacznie częściej.
 *  - 🎡 Scatter tylko na bębnach 1, 3 i 5. Trzy scattery = KOŁO FORTUNY (24 segmenty):
 *      mnożniki stawki ×10…×1000, „+8 FREE SPINS”, „RESPIN KOŁA ×2” (kręci jeszcze raz
 *      i podwaja wynik — można łańcuchem) oraz jackpoty MINI ×50 / MAJOR ×200 / GRAND ×1000.
 *  - Wynik koła liczy serwer: wheel.spins = kolejne trafienia (respiny → wynik końcowy).
 *  - W Free Spinach scattery mogą ponownie uruchomić koło.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 5, ROWS = 3;
const PAY_SCALE = 3.055;
const MAX_WIN = 10000; // × stawki na jeden spin
const BASE_RTP = 0.953;

// p[n] = wypłata × stawka-na-linię za n symboli na linii
const raw = [
  { id: 'seven',   e: '7',   n: 'Siódemka',  w: 3,   p: [0,0,0,20,80,300], color: '#ff3b6b' },
  { id: 'diamond', e: '💎',  n: 'Diament',   w: 4,   p: [0,0,0,15,50,200], color: '#4fe3ff' },
  { id: 'bell',    e: '🔔',  n: 'Dzwonek',   w: 5,   p: [0,0,0,10,30,120], color: '#ffd36b' },
  { id: 'melon',   e: '🍉',  n: 'Arbuz',     w: 7,   p: [0,0,0,6,20,60],   color: '#3ff2a3' },
  { id: 'grape',   e: '🍇',  n: 'Winogrona', w: 7,   p: [0,0,0,5,15,50],   color: '#b06bff' },
  { id: 'lemon',   e: '🍋',  n: 'Cytryna',   w: 9,   p: [0,0,0,3,10,30],   color: '#f2e24a' },
  { id: 'cherry',  e: '🍒',  n: 'Wiśnia',    w: 9,   p: [0,0,0,2,8,25],    color: '#ff5c7a' },
  { id: 'wild',    e: '🌟',  n: 'Gwiazda (Wild)', w: 1.25, p: [0,0,0,30,120,600], wild: true, color: '#ffd36b' },
  { id: 'wheel',   e: '🎡',  n: 'Koło (Scatter)', w: 0, p: [0,0,0,0,0,0], scatter: true, color: '#ff5fb3' },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const W_BASE = SYMS.map(s => s.w);
const W_FREE = SYMS.map((s, i) => i === I.wild ? 5.5 : s.w);
const W_NOWILD = SYMS.map((s, i) => i === I.wild ? 0 : s.w);
const pickBase = E.makePicker(W_BASE), pickFree = E.makePicker(W_FREE), pickNoWild = E.makePicker(W_NOWILD);
const SCATTER_REELS = [0, 2, 4];
const SC_CHANCE = 0.18, SC_CHANCE_FS = 0.17; // szansa na scatter na bębnie 1/3/5

const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,0,2,0,0],
];

// ── Koło fortuny: 24 segmenty (kolejność na kole) ─────────────
// k: m = mnożnik stawki, fs = free spiny, re = respin ×2, jp = jackpot; w = waga losowania
const JACKPOTS = { mini: 50, major: 200, grand: 1000 };
const WHEEL = [
  { k: 'm', m: 10, w: 5 },   { k: 'fs', fs: 8, w: 6 }, { k: 'm', m: 25, w: 4 }, { k: 'jp', jp: 'mini', w: 3 },
  { k: 'm', m: 15, w: 4 },   { k: 'm', m: 100, w: 2 }, { k: 're', w: 3 },         { k: 'm', m: 20, w: 4 },
  { k: 'm', m: 50, w: 3 }, { k: 'jp', jp: 'grand', w: 0.15 }, { k: 'm', m: 10, w: 5 }, { k: 'm', m: 250, w: 0.8 },
  { k: 'fs', fs: 8, w: 6 }, { k: 'm', m: 15, w: 4 },   { k: 'm', m: 75, w: 2.2 }, { k: 'jp', jp: 'major', w: 1.2 },
  { k: 'm', m: 20, w: 4 },   { k: 'm', m: 500, w: 0.3 }, { k: 're', w: 3 },        { k: 'm', m: 10, w: 5 },
  { k: 'm', m: 25, w: 4 }, { k: 'm', m: 1000, w: 0.1 }, { k: 'm', m: 15, w: 4 }, { k: 'm', m: 50, w: 3 },
];
WHEEL.forEach(s => { if (s.k === 'jp') s.m = JACKPOTS[s.jp]; });
const pickSeg = E.makePicker(WHEEL.map(s => s.w));
const pickSegNoRe = E.makePicker(WHEEL.map(s => s.k === 're' ? 0 : s.w));
const MAX_DBL = 8; // max 3 respiny w łańcuchu (×8)

function spinWheel(bet) {
  const spins = [];
  let dbl = 1;
  for (;;) {
    const seg = dbl >= MAX_DBL ? pickSegNoRe() : pickSeg();
    const s = WHEEL[seg];
    if (s.k === 're') { dbl *= 2; spins.push({ seg, k: 're', dbl }); continue; }
    const hit = { seg, k: s.k, dbl };
    if (s.k === 'm') { hit.m = s.m; hit.x = s.m * dbl; hit.amount = s.m * dbl * bet; }
    if (s.k === 'jp') { hit.jp = s.jp; hit.m = s.m; hit.x = s.m * dbl; hit.amount = s.m * dbl * bet; }
    if (s.k === 'fs') { hit.fs = s.fs * dbl; }
    spins.push(hit);
    return { spins, dbl, final: hit, x: hit.x || 0, amount: hit.amount || 0, fs: hit.fs || 0, jp: hit.jp || null };
  }
}

function genGrid(free) {
  const pick = free ? pickFree : pickBase;
  const grid = Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, () => c === 0 ? pickNoWild() : pick()));
  const ch = free ? SC_CHANCE_FS : SC_CHANCE;
  for (const c of SCATTER_REELS) if (Math.random() < ch) grid[c][Math.floor(Math.random() * ROWS)] = I.wheel;
  return grid;
}

const def = {
  game: 'mega_wheel', statsId: 'mega_wheel', event: 'casinoMWSpin', resultEvent: 'casinoMWResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const grid = genGrid(inFree);
    const winLines = E.evalLines(grid, LINES, SYMS, bet / LINES.length);
    const lineWin = winLines.reduce((s, w) => s + w.win, 0);
    const sc = E.countSym(grid, i => i === I.wheel);
    let wheel = null, freeSpinsAwarded = 0;
    if (sc.n >= 3) {
      wheel = spinWheel(bet);
      if (wheel.fs) {
        freeSpinsAwarded = wheel.fs;
        if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; }
        state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
      }
    }
    let payout = lineWin + (wheel ? wheel.amount : 0);
    let capped = false;
    if (payout > MAX_WIN * bet) { payout = MAX_WIN * bet; capped = true; }
    if (inFree) state.fsWin += payout;
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;
    return {
      mode: inFree ? 'free' : 'base', grid, winLines, baseWin: lineWin,
      scatter: sc.cells, wheel, jackpots: Object.entries(JACKPOTS).map(([jp, m]) => ({ jp, m, amount: m * bet })),
      payout, capped, isFree: inFree, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, fsSummary,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter, color: s.color })),
  lines: LINES, cols: COLS, rows: ROWS, jackpots: JACKPOTS,
  wheel: WHEEL.map(s => ({ k: s.k, m: s.m, fs: s.fs, jp: s.jp })),
};
module.exports = { registerHandlers, def, meta, SYMS, LINES, WHEEL, JACKPOTS, BASE_RTP };
