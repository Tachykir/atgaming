/**
 * HOT 777 — AT Gaming Casino
 * Klasyczny automat 3×3, 5 linii. 🃏 Joker = Wild.
 *  - FIRE RESPIN: gdy dwa bębny są w całości jednym symbolem (lub Jokerem), a spin nic nie wygrał,
 *    pozostały bęben kręci się jeszcze raz za darmo.
 *  - KOŁO MNOŻNIKÓW: pełny ekran jednego symbolu (z Jokerami) → koło ×2…×10 mnoży wygraną.
 */
'use strict';
const E = require('./slot_engine');

const PAY_SCALE = 1.47;
// p[3] = wypłata × stawka-na-linię za 3 symbole na linii
const raw = [
  { id: 'seven',  e: '7',   n: 'Siódemka',  w: 3,  p: [0,0,0,60], color: '#ff3b3b' },
  { id: 'bar',    e: 'BAR', n: 'BAR',       w: 4,  p: [0,0,0,30], color: '#ffd36b' },
  { id: 'bell',   e: '🔔',  n: 'Dzwonek',   w: 5,  p: [0,0,0,20], color: '#ffb300' },
  { id: 'melon',  e: '🍉',  n: 'Arbuz',     w: 6,  p: [0,0,0,12], color: '#3ff2a3' },
  { id: 'grape',  e: '🍇',  n: 'Winogrona', w: 6,  p: [0,0,0,10], color: '#a855f7' },
  { id: 'lemon',  e: '🍋',  n: 'Cytryna',   w: 7,  p: [0,0,0,6],  color: '#e8d84a' },
  { id: 'cherry', e: '🍒',  n: 'Wiśnia',    w: 7,  p: [0,0,0,6],  color: '#ff5c7a' },
  { id: 'joker',  e: '🃏',  n: 'Joker (Wild)', w: 1.6, p: [0,0,0,100], wild: true, color: '#c084fc' },
];
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const pick = E.makePicker(SYMS.map(s => s.w));
const STACK = 0.24; // szansa, że bęben jest w całości jednym symbolem
function reel() { if (Math.random() < STACK) { const s = pick(); return [s, s, s]; } return [pick(), pick(), pick()]; }
const LINES = [[1,1,1],[0,0,0],[2,2,2],[0,1,2],[2,1,0]];
const WHEEL = [[2, 40], [3, 25], [4, 15], [5, 12], [10, 8]];
const pickWheel = E.makePicker(WHEEL.map(w => w[1]));

function stackedSym(col) {
  const nonWild = col.filter(s => s !== I.joker);
  if (!nonWild.length) return I.joker;
  return nonWild.every(s => s === nonWild[0]) ? nonWild[0] : -1;
}
function fullScreen(grid) {
  const all = grid.flat().filter(s => s !== I.joker);
  return all.length === 0 || all.every(s => s === all[0]);
}

const def = {
  game: 'hot_777', statsId: 'hot_777', event: 'casinoH7Spin', resultEvent: 'casinoH7Result',
  newState: () => ({}),
  isFree: () => false,
  spin(state, { bet }) {
    const lineBet = bet / LINES.length;
    let grid = Array.from({ length: 3 }, () => reel());
    const first = grid.map(c => [...c]);
    let wins = E.evalLines(grid, LINES, SYMS, lineBet);
    let respin = null;
    if (!wins.length) {
      const st = grid.map(stackedSym);
      const stackedCols = st.map((s, c) => s >= 0 ? c : -1).filter(c => c >= 0);
      if (stackedCols.length === 2) {
        const syms = stackedCols.map(c => st[c]).filter(s => s !== I.joker);
        if (syms.length < 2 || syms[0] === syms[1]) {
          const rc = [0, 1, 2].find(c => !stackedCols.includes(c));
          grid[rc] = reel();
          respin = { col: rc };
          wins = E.evalLines(grid, LINES, SYMS, lineBet);
        }
      }
    }
    let payout = wins.reduce((s, w) => s + w.win, 0);
    let wheel = null;
    if (payout > 0 && fullScreen(grid)) {
      const idx = pickWheel();
      wheel = { mult: WHEEL[idx][0], index: idx, options: WHEEL.map(w => w[0]) };
      payout *= wheel.mult;
    }
    return { firstGrid: first, grid, winLines: wins.map(w => ({ ...w, win: w.win * (wheel ? wheel.mult : 1) })), respin, wheel, payout, isFree: false, freeSpinsRemaining: 0 };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = { syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, color: s.color })), lines: LINES, wheel: WHEEL.map(w => w[0]) };
module.exports = { registerHandlers, def, meta, SYMS, LINES };
