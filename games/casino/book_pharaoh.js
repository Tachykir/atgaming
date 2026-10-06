/**
 * KSIĘGA FARAONA — AT Gaming Casino
 * 5×3, 10 linii. 📖 Księga = Wild i Scatter jednocześnie.
 *  - 3/4/5 Ksiąg: 2×/20×/200× stawki + 10 Free Spinów (retrigger +10).
 *  - Na start Free Spinów losowany jest SYMBOL SPECJALNY. Gdy w free spinie pojawi się
 *    na wystarczającej liczbie bębnów (2 dla wysokich, 3 dla liter), rozszerza się na całe
 *    bębny i płaci na wszystkich 10 liniach — także na bębnach niesąsiadujących.
 */
'use strict';
const E = require('./slot_engine');

const PAY_SCALE = 0.89;
// p: wypłata × stawka-na-linię za 2/3/4/5 symboli
const raw = [
  { id: 'explorer', e: '🧭', n: 'Odkrywca',  w: 3,  p: [0,0,10,100,1000,5000], color: '#ffd36b' },
  { id: 'pharaoh',  e: '👑', n: 'Faraon',    w: 4,  p: [0,0,5,40,400,2000],    color: '#4fc3ff' },
  { id: 'statue',   e: '🗿', n: 'Posąg',     w: 5,  p: [0,0,5,30,100,750],     color: '#c9a36b' },
  { id: 'scarab',   e: '🪲', n: 'Skarabeusz', w: 5, p: [0,0,5,30,100,750],     color: '#3ff2a3' },
  { id: 'A',  e: 'A',  n: 'As',     w: 8,  p: [0,0,0,15,40,150], letter: true, color: '#ff6f8a' },
  { id: 'K',  e: 'K',  n: 'Król',   w: 8,  p: [0,0,0,15,40,150], letter: true, color: '#c084fc' },
  { id: 'Q',  e: 'Q',  n: 'Dama',   w: 9,  p: [0,0,0,5,25,100],  letter: true, color: '#4fc3ff' },
  { id: 'J',  e: 'J',  n: 'Walet',  w: 9,  p: [0,0,0,5,25,100],  letter: true, color: '#3ff2a3' },
  { id: 'T',  e: '10', n: 'Dziesiątka', w: 10, p: [0,0,0,5,25,100], letter: true, color: '#ff9f43' },
  { id: 'book', e: '📖', n: 'Księga (Wild + Scatter)', w: 1.8, p: [0,0,0,0,0,0], wild: true, scatter: true, color: '#ffd36b' },
];
// Wild + scatter: przy liniach traktuj jak wild (bez własnej wypłaty liniowej)
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE), scatter: false }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const pick = E.makePicker(SYMS.map(s => s.w));
const LINES = [[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[1,2,2,2,1],[1,0,0,0,1],[2,2,1,0,0],[0,0,1,2,2],[2,1,1,1,0]];
const BOOK_PAY = { 3: 2, 4: 20, 5: 200 };
const FS_COUNT = 10;
const pickSpecial = E.makePicker([0.6, 1, 1.4, 1.4, 2, 2, 2.4, 2.4, 2.6]);

const def = {
  game: 'book_pharaoh', statsId: 'book_pharaoh', event: 'casinoBPSpin', resultEvent: 'casinoBPResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, special: null, fsTotal: 0, fsWin: 0 }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    const grid = Array.from({ length: 5 }, () => {
      const col = [];
      for (let r = 0; r < 3; r++) { let s = pick(); while (s === I.book && col.includes(I.book)) s = pick(); col.push(s); }
      return col;
    });
    const lineBet = bet / LINES.length;
    const wins = E.evalLines(grid, LINES, SYMS, lineBet);
    let payout = wins.reduce((s, w) => s + w.win, 0);
    const books = E.countSym(grid, i => i === I.book);
    const bookWin = (BOOK_PAY[Math.min(5, books.n)] || 0) * bet;
    payout += bookWin;

    // Rozszerzający się symbol specjalny
    let expand = null;
    if (inFree && state.special !== null) {
      const sp = state.special;
      const reels = [];
      grid.forEach((col, c) => { if (col.includes(sp)) reels.push(c); });
      const min = SYMS[sp].letter ? 3 : 2;
      const pay = SYMS[sp].p[reels.length] || 0;
      if (reels.length >= min && pay > 0) {
        const win = pay * lineBet * LINES.length;
        expand = { symIdx: sp, reels, win };
        payout += win;
      }
    }

    let freeSpinsAwarded = 0, specialChosen = null;
    if (books.n >= 3) {
      freeSpinsAwarded = FS_COUNT;
      if (!inFree) { state.freeBet = bet; state.special = pickSpecial(); state.fsTotal = 0; state.fsWin = 0; specialChosen = state.special; }
      state.freeSpins += FS_COUNT; state.fsTotal += FS_COUNT;
    }
    if (inFree) state.fsWin += payout;
    const special = state.special;
    let fsSummary = null;
    if (inFree && state.freeSpins === 0) { fsSummary = { total: state.fsTotal, win: state.fsWin }; state.special = null; }
    return { grid, winLines: wins, books: { count: books.n, cells: books.cells, win: bookWin }, expand, payout,
      isFree: inFree, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, special, specialChosen, fsSummary };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = { syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, letter: !!s.letter, color: s.color })), lines: LINES, bookPay: BOOK_PAY };
module.exports = { registerHandlers, def, meta, SYMS, LINES };
