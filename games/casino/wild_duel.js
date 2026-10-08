/**
 * WILD DUEL — AT Gaming Casino
 * 5 bębnów × 4 rzędy, 20 linii, Multiplier Wilds (Dziki Zachód).
 *
 *  - 🤠 Rewolwerowiec (Wild) ląduje z mnożnikiem ×2/×3/×5/×10/×25/×100.
 *    Na linii wygrywającej mnożniki wszystkich wildów MNOŻĄ SIĘ ze sobą (×5 · ×10 = ×50).
 *  - POJEDYNEK (gra podstawowa): gdy wildy są na bębnie 1 i 5, dwóch rewolwerowców
 *    staje do pojedynku — zwycięzca podwaja swój mnożnik.
 *  - ⭐ Gwiazda Szeryfa (Scatter): 3/4/5 = 10/12/15 Free Spinów. W FS każdy wild jest
 *    LEPKI (zostaje do końca serii), a jego mnożnik rośnie o +1 z każdym kolejnym spinem.
 *    Retrigger: 3+ gwiazdy = +5 spinów.
 */
'use strict';
const E = require('./slot_engine');

const COLS = 5, ROWS = 4;
const PAY_SCALE = 0.98;
const MAX_WIN = 10000;          // limit wygranej (× stawki) na spin / na całą serię FS
const DUEL_P = 0.022;            // dodatkowa szansa na „wezwanie do pojedynku” (wildy na 1. i 5. bębnie)

// p[n] = wypłata × stawka-na-linię za n symboli
const raw = [
  { id: 'gold',    e: '💰', n: 'Sakwa złota',      w: 3,   p: [0,0,0,20,60,250] },
  { id: 'horse',   e: '🐎', n: 'Mustang',          w: 4,   p: [0,0,0,15,40,150] },
  { id: 'whisky',  e: '🥃', n: 'Whisky',           w: 5,   p: [0,0,0,10,30,100] },
  { id: 'cactus',  e: '🌵', n: 'Kaktus',           w: 6,   p: [0,0,0,8,20,80] },
  { id: 'a',       e: 'A',  n: 'As',               w: 8,   p: [0,0,0,5,15,50] },
  { id: 'k',       e: 'K',  n: 'Król',             w: 9,   p: [0,0,0,4,12,40] },
  { id: 'q',       e: 'Q',  n: 'Dama',             w: 10,  p: [0,0,0,3,10,30] },
  { id: 'j',       e: 'J',  n: 'Walet',            w: 11,  p: [0,0,0,2,8,25] },
  { id: 'wild',    e: '🤠', n: 'Rewolwerowiec (Wild)', w: 0.75, p: [0,0,0,25,100,500], wild: true },
  { id: 'star',    e: '⭐', n: 'Gwiazda Szeryfa (Scatter)', w: 1.0, p: [0,0,0,0,0,0], scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const BASE_W = SYMS.map(s => s.w);
const FREE_W = BASE_W.slice(); FREE_W[I.wild] = 0.4; FREE_W[I.star] = 0.6;
const pickBase = E.symPicker(BASE_W), pickFree = E.symPicker(FREE_W);
const NON_SC = BASE_W.slice(); NON_SC[I.star] = 0; NON_SC[I.wild] = 0;
const pickPlain = E.symPicker(NON_SC);

// Mnożniki wildów (rzadsze wyższe)
const MULTS = [[2, 52], [3, 25], [5, 13], [10, 6.5], [25, 2], [100, 0.3]];
const MULTS_FS = [[2, 60], [3, 26], [5, 10], [10, 4], [25, 0.9], [100, 0.12]];
const pickMult = E.makePicker(MULTS.map(m => m[1])), pickMultFS = E.makePicker(MULTS_FS.map(m => m[1]));

const LINES = [
  [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],
  [0,1,2,1,0],[3,2,1,2,3],[1,2,3,2,1],[2,1,0,1,2],
  [0,1,0,1,0],[1,0,1,0,1],[2,3,2,3,2],[3,2,3,2,3],
  [1,2,1,2,1],[2,1,2,1,2],[0,0,1,2,3],[3,3,2,1,0],
  [1,0,0,0,1],[2,3,3,3,2],[0,1,1,1,0],[3,2,2,2,3],
];
const FS = { 3: 10, 4: 12, 5: 15 };
const FS_RETRIGGER = 5;

function evalWins(grid, wildAt, lineBet) {
  return E.evalLines(grid, LINES, SYMS, lineBet).map(w => {
    const ws = w.cells.filter(([c, r]) => grid[c][r] === I.wild).map(([c, r]) => ({ c, r, m: wildAt[c + ',' + r] || 1 }));
    const mult = ws.reduce((p, x) => p * x.m, 1);
    return { li: w.li, count: w.count, symIdx: w.symIdx, cells: w.cells, baseWin: w.win, mult, wilds: ws, win: w.win * mult };
  });
}

const def = {
  game: 'wild_duel', statsId: 'wild_duel', event: 'casinoWDSpin', resultEvent: 'casinoWDResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsTotal: 0, fsWin: 0, sticky: [] }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const lineBet = bet / LINES.length;
    const pick = inFree ? pickFree : pickBase;
    const grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => pick()));

    // Lepkie wildy (FS): rosną o +1 i zostają na swoich miejscach
    const grown = [];
    if (inFree) {
      if (!Array.isArray(state.sticky)) state.sticky = [];
      for (const s of state.sticky) { s.from = s.m; s.m += 1; grown.push({ c: s.c, r: s.r, from: s.from, m: s.m }); delete s.from; grid[s.c][s.r] = I.wild; }
    }

    // Pojedynek: dodatkowe „wezwanie” — wildy na 1. i 5. bębnie
    if (!inFree && Math.random() < DUEL_P) {
      for (const c of [0, COLS - 1]) {
        if (grid[c].includes(I.wild)) continue;
        const rows = [0, 1, 2, 3].filter(r => grid[c][r] !== I.star);
        grid[c][rows[Math.floor(Math.random() * rows.length)]] = I.wild;
      }
    }

    // Mnożniki wildów
    const wildAt = {};
    const wilds = [];
    const newWilds = [];
    if (inFree) state.sticky.forEach(s => { wildAt[s.c + ',' + s.r] = s.m; });
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (grid[c][r] !== I.wild) continue;
      const k = c + ',' + r;
      if (wildAt[k] === undefined) {
        wildAt[k] = inFree ? MULTS_FS[pickMultFS()][0] : MULTS[pickMult()][0];
        newWilds.push({ c, r, m: wildAt[k] });
        if (inFree) state.sticky.push({ c, r, m: wildAt[k] });
      }
    }

    // Pojedynek (tylko gra podstawowa)
    let duel = null;
    if (!inFree) {
      const left = [0, 1, 2, 3].filter(r => grid[0][r] === I.wild);
      const right = [0, 1, 2, 3].filter(r => grid[COLS - 1][r] === I.wild);
      if (left.length && right.length) {
        const a = { c: 0, r: left[Math.floor(Math.random() * left.length)] };
        const b = { c: COLS - 1, r: right[Math.floor(Math.random() * right.length)] };
        a.m = wildAt[a.c + ',' + a.r]; b.m = wildAt[b.c + ',' + b.r];
        const winner = Math.random() < 0.5 ? 'a' : 'b';
        const w = winner === 'a' ? a : b;
        const before = w.m;
        w.m = before * 2;
        wildAt[w.c + ',' + w.r] = w.m;
        duel = { a: { c: a.c, r: a.r, m: winner === 'a' ? before : a.m }, b: { c: b.c, r: b.r, m: winner === 'b' ? before : b.m }, winner, before, after: w.m };
      }
    }
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r] === I.wild) wilds.push({ c, r, m: wildAt[c + ',' + r], sticky: inFree });

    const wins = evalWins(grid, wildAt, lineBet);
    let payout = wins.reduce((s, w) => s + w.win, 0);
    let capped = false;
    const capLeft = inFree ? Math.max(0, MAX_WIN * bet - state.fsWin) : MAX_WIN * bet;
    if (payout > capLeft) { payout = capLeft; capped = true; }

    // Scattery
    const sc = E.countSym(grid, i => i === I.star);
    let freeSpinsAwarded = 0;
    if (sc.n >= 3 && !(inFree && capped)) {
      freeSpinsAwarded = inFree ? FS_RETRIGGER : FS[Math.min(5, sc.n)];
      if (!inFree) { state.freeBet = bet; state.fsTotal = 0; state.fsWin = 0; state.sticky = []; }
      state.freeSpins += freeSpinsAwarded; state.fsTotal += freeSpinsAwarded;
    }
    if (inFree) {
      state.fsWin += payout;
      if (capped) state.freeSpins = 0; // limit wygranej osiągnięty — koniec serii
    }
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin } : null;
    if (fsSummary) state.sticky = [];
    const topMult = wins.reduce((m, w) => Math.max(m, w.mult), 1);
    return {
      mode: inFree ? 'free' : 'base', grid, wilds, newWilds, grown, duel, winLines: wins, payout, capped, topMult,
      scatter: sc.cells, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, isFree: inFree, fsSummary,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const BASE_RTP = 0.954;
const meta = {
  syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter })),
  lines: LINES, cols: COLS, rows: ROWS, wildMults: MULTS.map(m => m[0]), freeSpins: FS, maxWin: MAX_WIN,
};
module.exports = { registerHandlers, def, meta, SYMS, LINES, BASE_RTP };
