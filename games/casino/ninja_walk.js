/**
 * NINJA WALK — AT Gaming Casino
 * 5 bębnów × 3 rzędy, 25 linii, Walking Wilds (nocna Japonia).
 *
 *  - 🥷 Ninja (Wild) może wylądować na dowolnym bębnie. Gdy na planszy jest choć jeden ninja,
 *    po wypłacie następuje DARMOWY RESPIN: każdy ninja przeskakuje o bęben W LEWO, a reszta
 *    pozycji losowana jest od nowa. Ninja, który wyjdzie poza 1. bęben, znika.
 *    Respiny trwają, dopóki na planszy jest jakikolwiek ninja (nowe mogą lądować w respinach).
 *  - Każdy ninja ma mnożnik od ×1, rosnący o +1 przy każdym kroku; na linii mnożniki ninja SUMUJĄ się.
 *  - Cały ciąg respinów to jeden wynik spinu: `steps` (plansza, ninja, wygrane), wypłata = suma kroków.
 *  - 🏯 Świątynia (Scatter): 3/4/5 = 8/12/16 Free Spinów. W FS ninja wchodzi od razu z ×2
 *    i chodzi wolniej (krok co drugi respin) — więcej respinów.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 5, ROWS = 3;
const PAY_SCALE = 0.971;
const MAX_WIN = 10000;      // limit wygranej (× stawki) na spin / na całą serię FS
const MAX_STEPS = 60;       // bezpiecznik długości ciągu respinów

const raw = [
  { id: 'tengu',  e: '👺', n: 'Maska Tengu', w: 3,  p: [0,0,0,20,80,300] },
  { id: 'katana', e: '🗡️', n: 'Katana',      w: 4,  p: [0,0,0,15,50,200] },
  { id: 'lamp',   e: '🏮', n: 'Lampion',     w: 5,  p: [0,0,0,10,30,120] },
  { id: 'sakura', e: '🌸', n: 'Sakura',      w: 6,  p: [0,0,0,8,25,80] },
  { id: 'tea',    e: '🍵', n: 'Herbata',     w: 7,  p: [0,0,0,6,18,60] },
  { id: 'ryu',    e: '龍', n: 'Smok (龍)',    w: 8,  p: [0,0,0,5,15,50] },
  { id: 'tsuki',  e: '月', n: 'Księżyc (月)', w: 9,  p: [0,0,0,4,12,40] },
  { id: 'hi',     e: '火', n: 'Ogień (火)',   w: 10, p: [0,0,0,3,10,30] },
  { id: 'mizu',   e: '水', n: 'Woda (水)',    w: 11, p: [0,0,0,2,8,25] },
  { id: 'ninja',  e: '🥷', n: 'Ninja (Wild)', w: 0.6, p: [0,0,0,25,100,400], wild: true },
  { id: 'temple', e: '🏯', n: 'Świątynia (Scatter)', w: 1.65, p: [0,0,0,0,0,0], scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const BASE_W = SYMS.map(s => s.w);
const RESPIN_W = BASE_W.slice(); RESPIN_W[I.temple] = 0;           // w respinach bez scatterów
const FREE_W = BASE_W.slice(); FREE_W[I.ninja] = 0.6; FREE_W[I.temple] = 0.9;
const FREE_RESPIN_W = FREE_W.slice(); FREE_RESPIN_W[I.temple] = 0;
const pickBase = E.symPicker(BASE_W), pickRespin = E.symPicker(RESPIN_W);
const pickFree = E.symPicker(FREE_W), pickFreeRespin = E.symPicker(FREE_RESPIN_W);

const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,1,2,1],[1,2,1,0,1],[1,0,0,0,1],
  [1,2,2,2,1],[0,1,1,1,0],[2,1,1,1,2],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,2,2,0],
  [2,0,0,0,2],[1,0,2,0,1],[1,2,0,2,1],[0,2,0,2,0],[2,0,2,0,2],
];
const FS = { 3: 8, 4: 12, 5: 16 };

function evalStep(grid, ninjaAt, lineBet) {
  return E.evalLines(grid, LINES, SYMS, lineBet).map(w => {
    const ns = w.cells.filter(([c, r]) => ninjaAt[c + ',' + r]).map(([c, r]) => ninjaAt[c + ',' + r].m);
    const mult = ns.length ? ns.reduce((a, b) => a + b, 0) : 1;
    return { li: w.li, count: w.count, symIdx: w.symIdx, cells: w.cells, baseWin: w.win, mult, win: w.win * mult };
  });
}

const def = {
  game: 'ninja_walk', statsId: 'ninja_walk', event: 'casinoNWSpin', resultEvent: 'casinoNWResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const lineBet = bet / LINES.length;
    const startM = inFree ? 2 : 1;
    const pickFirst = inFree ? pickFree : pickBase;
    const pickNext = inFree ? pickFreeRespin : pickRespin;
    let nextId = 1;
    let ninjas = [];      // { id, c, r, m, wait }
    const steps = [];
    let total = 0, maxMult = 1;
    const capAt = inFree ? Math.max(0, MAX_WIN * bet - state.fsWin) : MAX_WIN * bet;
    let capped = false;
    let firstGrid = null;

    for (let s = 0; s < MAX_STEPS; s++) {
      const moves = [], gone = [];
      if (s > 0) {
        // Ninja przeskakują w lewo (w FS — co drugi respin)
        const kept = [];
        for (const n of ninjas) {
          if (inFree && n.wait) { n.wait = false; moves.push({ id: n.id, from: [n.c, n.r], to: [n.c, n.r], stay: true }); kept.push(n); continue; }
          const from = [n.c, n.r];
          n.c -= 1; n.m += 1; n.wait = true;
          if (n.c < 0) { gone.push({ id: n.id, c: from[0], r: from[1] }); continue; }
          moves.push({ id: n.id, from, to: [n.c, n.r] });
          kept.push(n);
        }
        ninjas = kept;
      }
      const occ = {};
      ninjas.forEach(n => { occ[n.c + ',' + n.r] = n; });
      const grid = Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, (_, r) => occ[c + ',' + r] ? I.ninja : (s === 0 ? pickFirst() : pickNext())));
      const landed = [];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
        if (grid[c][r] === I.ninja && !occ[c + ',' + r]) {
          const n = { id: nextId++, c, r, m: startM, wait: true };
          ninjas.push(n); occ[c + ',' + r] = n; landed.push(n.id);
        }
      }
      if (s === 0) firstGrid = grid;
      const wins = evalStep(grid, occ, lineBet);
      let win = wins.reduce((a, w) => a + w.win, 0);
      if (total + win > capAt) { win = capAt - total; capped = true; }
      total += win;
      wins.forEach(w => { if (w.mult > maxMult) maxMult = w.mult; });
      steps.push({
        grid, winLines: wins, win, moves, gone, landed,
        ninjas: ninjas.map(n => ({ id: n.id, c: n.c, r: n.r, m: n.m, wait: inFree ? !!n.wait : false })),
      });
      if (capped || !ninjas.length) break;
    }

    // Scattery (tylko pierwsza plansza)
    const sc = E.countSym(firstGrid, i => i === I.temple);
    let freeSpinsAwarded = 0;
    if (sc.n >= 3 && !capped) {
      freeSpinsAwarded = FS[Math.min(5, sc.n)];
      if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; }
      state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
    }
    if (inFree) { state.fsWin += total; if (capped) state.freeSpins = 0; }
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;
    return {
      mode: inFree ? 'free' : 'base', grid: steps[steps.length - 1].grid, firstGrid, steps, respins: steps.length - 1,
      payout: total, capped, topMult: maxMult, startMult: startM,
      scatter: sc.cells, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, isFree: inFree, fsSummary,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const BASE_RTP = 0.954;
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter })),
  lines: LINES, cols: COLS, rows: ROWS, freeSpins: FS, maxWin: MAX_WIN,
};
module.exports = { registerHandlers, def, meta, SYMS, LINES, BASE_RTP };
