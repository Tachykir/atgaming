/**
 * TITAN COLOSSUS — AT Gaming Casino
 * 5 bębnów × 4 rzędy, 1024 sposoby (ways od lewej, min. 3 bębny).
 *  - KOLOSY: na bębnach 2–4 może wylądować symbol 2×2 albo 3×3. Liczy się jako ten symbol
 *    na każdym zajętym polu, więc mnoży liczbę sposobów.
 *  - 🗿 Posąg (Wild) — 1×1 na bębnach 2–5, zastępuje wszystko poza scatterem.
 *  - ⚡ Piorun (Scatter) tylko na bębnach 1, 3, 5: 3 = 10 Free Spinów (w FS: +10).
 *  - Free Spiny: w ~1/3 spinów na bębny 2–4 spada KOLOS-WILD 3×3 z mnożnikiem ×2/×3/×5,
 *    który mnoży całą wygraną spinu.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 5, ROWS = 4;
const PAY_SCALE = 0.892;
const MAX_WIN = 10000; // × stawki
const FS_AWARD = 10;
const P_COLO2 = 0.17, P_COLO3 = 0.06;      // gra podstawowa: szansa na kolosa 2×2 / 3×3
const P_COLO2_FS = 0.35, P_COLO3_FS = 0.15; // FS (gdy brak Kolosa-Wild)
const P_FS_WILD = 1 / 3;                    // FS: szansa na Kolosa-Wild 3×3
const SCATTER_P = 0.17;                     // szansa na scatter na bębnie 1 / 3 / 5
const FS_WILD_MULTS = [[2, 45], [3, 35], [5, 20]];

// p[n] = wypłata × stawka łączna za 1 sposób przy n bębnach
const raw = [
  { id: 'trident', e: '🔱', n: 'Trójząb Posejdona', w: 3,  p: [0,0,0,0.5, 1.5, 10], color: '#4fc3ff' },
  { id: 'eagle',   e: '🦅', n: 'Orzeł Zeusa',       w: 4,  p: [0,0,0,0.4, 1.0, 6], color: '#e8c37a' },
  { id: 'helmet',  e: '🪖', n: 'Hełm Tytana',       w: 5,  p: [0,0,0,0.3, 0.75, 2.5], color: '#c0c7d1' },
  { id: 'amphora', e: '🏺', n: 'Amfora',            w: 6,  p: [0,0,0,0.25, 0.6, 2],  color: '#ff9f43' },
  { id: 'a',       e: 'A',  n: 'A',                 w: 8,  p: [0,0,0,0.15, 0.4, 1.2], color: '#ffd36b', letter: true },
  { id: 'k',       e: 'K',  n: 'K',                 w: 9,  p: [0,0,0,0.12, 0.3, 1.0], color: '#7aa7ff', letter: true },
  { id: 'q',       e: 'Q',  n: 'Q',                 w: 10, p: [0,0,0,0.1, 0.25, 0.8], color: '#3ff2a3', letter: true },
  { id: 'j',       e: 'J',  n: 'J',                 w: 11, p: [0,0,0,0.08, 0.2, 0.6], color: '#ff6f8a', letter: true },
  { id: 'ten',     e: '10', n: '10',                w: 12, p: [0,0,0,0.06, 0.15, 0.5], color: '#c084fc', letter: true },
  { id: 'nine',    e: '9',  n: '9',                 w: 12, p: [0,0,0,0.05, 0.12, 0.4], color: '#9fb3c8', letter: true },
  { id: 'statue',  e: '🗿', n: 'Posąg (Wild)',      w: 0.8, p: [0,0,0,0,0,0], color: '#ffd36b', wild: true },
  { id: 'bolt',    e: '⚡', n: 'Piorun (Scatter)',  w: 0,  p: [0,0,0,0,0,0], color: '#4fc3ff', scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => +(v * PAY_SCALE).toFixed(4)) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const W_FIRST = SYMS.map(s => (s.wild || s.scatter) ? 0 : s.w);
const W_REST = SYMS.map(s => s.scatter ? 0 : s.w);
const pickFirst = E.symPicker(W_FIRST), pickRest = E.symPicker(W_REST);
// Symbol kolosa: tylko symbole płatne (częściej niskie)
const COLO_W = SYMS.map(s => (s.wild || s.scatter) ? 0 : s.w);
const pickColo = E.symPicker(COLO_W);
const pickFsMult = E.makePicker(FS_WILD_MULTS.map(m => m[1]));
const rnd = n => Math.floor(Math.random() * n);

function placeColossus(grid, size, sym, extra = {}) {
  // bębny 2–4 (indeksy 1..3)
  const c = 1 + rnd(3 - size + 1);
  const r = rnd(ROWS - size + 1);
  for (let dc = 0; dc < size; dc++) for (let dr = 0; dr < size; dr++) grid[c + dc][r + dr] = sym;
  return { c, r, size, sym, ...extra };
}

// Kolos-Wild (FS) liczy się jako JEDEN gigantyczny Wild na każdym zajętym bębnie
function evalWays(grid, bet, giant = null) {
  const inGiant = (c, r) => giant && c >= giant.c && c < giant.c + giant.size && r >= giant.r && r < giant.r + giant.size;
  const wins = [];
  const seen = new Set();
  for (const s of grid[0]) {
    if (seen.has(s) || SYMS[s].scatter || SYMS[s].wild) continue;
    seen.add(s);
    let ways = 1, len = 0;
    const cells = [];
    for (let c = 0; c < COLS; c++) {
      let k = 0, g = false;
      grid[c].forEach((x, r) => {
        if (x !== s && !SYMS[x].wild) return;
        cells.push([c, r]);
        if (inGiant(c, r)) { if (!g) { g = true; k++; } } else k++;
      });
      if (!k) break;
      ways *= k; len++;
    }
    if (len < 3) continue;
    const win = (SYMS[s].p[len] || 0) * ways * bet;
    if (win > 0) wins.push({ symIdx: s, count: len, ways, cells: cells.filter(([c]) => c < len), win });
  }
  return wins;
}

const def = {
  game: 'titan_colossus', statsId: 'titan_colossus', event: 'casinoTCSpin', resultEvent: 'casinoTCResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid && state.freeSpins > 0;
    if (inFree) state.freeSpins--;

    const grid = Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, () => (c === 0 ? pickFirst() : pickRest())));
    // Scattery tylko na bębnach 1, 3, 5 (max 1 na bęben)
    for (const c of [0, 2, 4]) if (Math.random() < SCATTER_P) grid[c][rnd(ROWS)] = I.bolt;

    const colossi = [];
    let colMult = 1;
    const roll = Math.random();
    if (inFree && roll < P_FS_WILD) {
      const m = FS_WILD_MULTS[pickFsMult()][0];
      colossi.push(placeColossus(grid, 3, I.statue, { wild: true, m }));
      colMult = m;
    } else {
      const r2 = inFree ? Math.random() : roll;
      const p3 = inFree ? P_COLO3_FS : P_COLO3, p2 = inFree ? P_COLO2_FS : P_COLO2;
      if (r2 < p3) colossi.push(placeColossus(grid, 3, pickColo()));
      else if (r2 < p3 + p2) colossi.push(placeColossus(grid, 2, pickColo()));
    }

    const giant = colossi.find(k => k.wild) || null;
    const wins = evalWays(grid, bet, giant);
    const baseWin = wins.reduce((s, w) => s + w.win, 0);
    let payout = baseWin * colMult;
    let capped = false;
    if (payout > MAX_WIN * bet) { payout = MAX_WIN * bet; capped = true; }

    const sc = E.countSym(grid, i => i === I.bolt);
    let freeSpinsAwarded = 0;
    if (sc.n >= 3) {
      freeSpinsAwarded = FS_AWARD;
      if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; }
      state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
    }
    if (inFree) state.fsWin += payout;
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;
    return {
      grid, colossi, wins, baseWin, colMult, payout, capped,
      scatter: sc.cells, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, isFree: inFree, fsSummary,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter, color: s.color, letter: !!s.letter })),
  cols: COLS, rows: ROWS, ways: 1024, fsAward: FS_AWARD, fsWildMults: FS_WILD_MULTS.map(m => m[0]), maxWin: MAX_WIN,
};
const BASE_RTP = 0.953;
module.exports = { registerHandlers, def, meta, SYMS, BASE_RTP };
