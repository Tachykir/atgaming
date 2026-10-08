/**
 * PATH OF GAMBLING — AT Gaming Casino
 * 5 bębnów × 5 rzędów, 30 linii.
 *
 *  - Fracturing Orb   → WILD
 *  - Reflecting Mist  → SCATTER: 3/4/5+ → 8/12/20 Free Spinów (wygrane ×2)
 *  - Sacred Orb       → 3+ → 8/10/12 spinów w trybie Pit
 *  - Pit Meter        → co 300 płatnych spinów → 8 spinów Pit
 *  - Tryb Pit: Hinekora's Lock (sticky wild) + Valdo's Box (sticky wild z mnożnikiem;
 *    mnożniki wszystkich Valdo na planszy sumują się i mnożą wygraną spinu)
 *  Stawka bonusu z Pit Meter = średnia stawka z nabijania licznika.
 *  Wypłata = dokładnie to, co widać na planszy. RTP ≈ 95%.
 */
'use strict';
const E = require('./slot_engine');

const PIT_THRESHOLD  = 300;
const PIT_FREE_SPINS = 8;
const PAY_SCALE = 1.28;

const raw = [
  { id:'mirror',        n:'Mirror of Kalandra',  img:'/images/slots/mirror.png',        w:2,   p:[0,0,0,50,250,1000], color:'#a8d8ff' },
  { id:'divine',        n:'Divine Orb',          img:'/images/slots/Divine.png',        w:3,   p:[0,0,0,25,100,400],  color:'#ffe066' },
  { id:'exalted',       n:'Exalted Orb',         img:'/images/slots/exalted.png',       w:4,   p:[0,0,0,15,60,200],   color:'#ffd700' },
  { id:'chaos',         n:'Chaos Orb',           img:'/images/slots/chaos.png',         w:5,   p:[0,0,0,10,30,100],   color:'#e05050' },
  { id:'annul',         n:'Orb of Annulment',    img:'/images/slots/annul.png',         w:6,   p:[0,0,0,6,20,60],     color:'#c0c0d0' },
  { id:'alteration',    n:'Orb of Alteration',   img:'/images/slots/alteration.png',    w:6,   p:[0,0,0,5,15,40],     color:'#4488ff' },
  { id:'transmutation', n:'Orb of Transmutation',img:'/images/slots/Transmutation.png', w:7,   p:[0,0,0,4,10,30],     color:'#2266cc' },
  { id:'scroll',        n:'Scroll of Wisdom',    img:'/images/slots/scroll.png',        w:7,   p:[0,0,0,3,8,25],      color:'#aaaaaa' },
  { id:'fracture',      n:'Fracturing Orb',      img:'/images/slots/fracture.png',      w:1.5, p:[0,0,0,40,200,1500], color:'#ff9944', wild:true },
  { id:'mist',          n:'Reflecting Mist',     img:'/images/slots/mist.png',          w:0.6, p:[0,0,0,0,0,0],       color:'#aa44ff', scatter:true },
  { id:'sacred',        n:'Sacred Orb',          img:'/images/slots/Sacred.png',        w:0.45, p:[0,0,0,0,0,0],       color:'#ffdd44', sacred:true, blank:true },
  { id:'lock',          n:"Hinekora's Lock",     img:'/images/slots/lock.png',          w:0,   p:[0,0,0,0,0,0],       color:'#cc44aa', wild:true, sticky:true },
  { id:'valdo',         n:"Valdo's Box",         img:'/images/slots/valdo.png',         w:0,   p:[0,0,0,0,0,0],       color:'#c0a060', wild:true, sticky:true, valdo:true },
];
// Wild Lock/Valdo nie mają własnej wypłaty — p fracture traktujemy jako wypłatę "samych wildów"
const SYMS = raw.map(s => ({ ...s, p: s.p.map(v => v * PAY_SCALE) }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));

const baseW = SYMS.map(s => s.w);
const pitW  = baseW.slice(); pitW[I.lock] = 1.0; pitW[I.valdo] = 0.12; pitW[I.mist] = 0; pitW[I.sacred] = 0.4;
const pickBase = E.symPicker(baseW);
const pickPit  = E.symPicker(pitW);

const LINES = [
  [2,2,2,2,2],[0,0,0,0,0],[4,4,4,4,4],[1,1,1,1,1],[3,3,3,3,3],
  [0,1,2,1,0],[4,3,2,3,4],[0,1,2,3,4],[4,3,2,1,0],[1,0,1,0,1],
  [3,4,3,4,3],[2,1,0,1,2],[2,3,4,3,2],[0,2,4,2,0],[4,2,0,2,4],
  [1,3,4,3,1],[3,1,0,1,3],[0,0,1,2,2],[2,2,1,0,0],[4,4,3,2,2],
  [2,2,3,4,4],[0,1,1,1,0],[4,3,3,3,4],[1,1,2,1,1],[3,3,2,3,3],
  [1,2,3,2,1],[3,2,1,2,3],[1,0,0,0,1],[3,4,4,4,3],[2,1,2,3,2],
];

const VALDO_MULTS = [[2, 70], [3, 18], [5, 7], [10, 3], [25, 1.5], [100, 0.5]];
const pickValdo = E.makePicker(VALDO_MULTS.map(v => v[1]));
const MIST_FS = { 3: 8, 4: 12, 5: 20 };
const SACRED_FS = { 3: 8, 4: 10, 5: 12 };
const SCATTER_FS_MULT = 2;

function buildGrid(pit, locks, valdos) {
  const g = [];
  const pick = pit ? pickPit : pickBase;
  for (let c = 0; c < 5; c++) {
    g.push([]);
    for (let r = 0; r < 5; r++) {
      if (valdos.find(v => v.col === c && v.row === r)) g[c].push(I.valdo);
      else if (locks.find(l => l.col === c && l.row === r)) g[c].push(I.lock);
      else g[c].push(pick());
    }
  }
  return g;
}

const def = {
  game: 'path_of_gambling', statsId: 'path_of_gambling', event: 'casinoPathSpin', resultEvent: 'casinoPathResult',
  newState: () => ({ pit: { points: 0, wager: 0 }, freeSpins: 0, freeBet: 0, freeMode: null, locks: [], valdos: [], fsTotal: 0, fsWin: 0 }),
  isFree: s => s.freeSpins > 0,
  async load(state, casino, userId) {
    const saved = await casino.getSlotStats(userId, 'path_of_gambling');
    if (saved?.pitMeter > 0 && !state.pit.points) { state.pit.points = Math.min(PIT_THRESHOLD - 1, saved.pitMeter); state.pit.restored = true; }
  },
  saveMeter: s => s.pit.points,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    const mode = inFree ? state.freeMode : null;
    const pitMode = mode === 'pit' || mode === 'sacred';
    if (inFree) state.freeSpins--;

    const grid = buildGrid(pitMode, state.locks, state.valdos);
    const lineBet = bet / LINES.length;

    // Nowe sticky w trybie Pit
    const newLocks = [], newValdos = [];
    if (pitMode) {
      for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) {
        if (grid[c][r] === I.lock && !state.locks.find(l => l.col === c && l.row === r)) { const l = { col: c, row: r }; state.locks.push(l); newLocks.push(l); }
        if (grid[c][r] === I.valdo && !state.valdos.find(v => v.col === c && v.row === r)) { const v = { col: c, row: r, mult: VALDO_MULTS[pickValdo()][0] }; state.valdos.push(v); newValdos.push(v); }
      }
    }
    const valdoMult = state.valdos.reduce((s, v) => s + v.mult, 0);
    const spinMult = (mode === 'scatter' ? SCATTER_FS_MULT : 1) * (valdoMult > 0 ? valdoMult : 1);

    const wins = E.evalLines(grid, LINES, SYMS, lineBet).map(w => ({ ...w, win: w.win * spinMult }));
    const payout = wins.reduce((s, w) => s + w.win, 0);

    // Scattery
    const mist = E.countSym(grid, i => i === I.mist);
    const sacred = E.countSym(grid, i => i === I.sacred);
    let freeSpinsAwarded = 0, trigger = null;
    const startBonus = (n, m, b) => {
      state.freeSpins = n; state.freeMode = m; state.freeBet = b;
      state.locks = []; state.valdos = []; state.fsTotal = n; state.fsWin = 0;
      freeSpinsAwarded = n; trigger = m;
    };
    if (!inFree) {
      if (mist.n >= 3) startBonus(MIST_FS[Math.min(5, mist.n)], 'scatter', bet);
      else if (sacred.n >= 3) startBonus(SACRED_FS[Math.min(5, sacred.n)], 'sacred', bet);
    } else if (pitMode && sacred.n >= 2) {
      // Sacred Orb w Pit: +2 spiny
      state.freeSpins += 2; state.fsTotal += 2; freeSpinsAwarded = 2; trigger = 'retrigger';
    } else if (mode === 'scatter' && mist.n >= 3) {
      const add = MIST_FS[Math.min(5, mist.n)]; state.freeSpins += add; state.fsTotal += add; freeSpinsAwarded = add; trigger = 'retrigger';
    }

    // Pit Meter — tylko płatne spiny
    let pitTriggered = false;
    if (!inFree) {
      E.meterAdd(state.pit, bet, 1);
      if (state.pit.points >= PIT_THRESHOLD && !trigger) {
        const pitBet = E.meterBet(state.pit, bet);
        E.meterReset(state.pit);
        startBonus(PIT_FREE_SPINS, 'pit', pitBet);
        pitTriggered = true;
      }
    }

    if (inFree) state.fsWin += payout;
    let fsSummary = null;
    if (inFree && state.freeSpins === 0) {
      fsSummary = { total: state.fsTotal, win: state.fsWin, mode };
      state.freeMode = null; state.locks = []; state.valdos = [];
    }

    return {
      grid, winLines: wins, payout, isFree: inFree, freeMode: state.freeSpins > 0 ? state.freeMode : null, spinMode: mode,
      spinMult, valdoMult, freeSpinsAwarded, freeSpinsRemaining: state.freeSpins, trigger, fsSummary,
      scatter: { mist: mist.cells, sacred: sacred.cells },
      pitMeter: state.pit.points, pitThreshold: PIT_THRESHOLD, pitTriggered,
      stickyLocks: [...state.locks], newLocks, stickyValdos: [...state.valdos], newValdos,
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }
const meta = { syms: SYMS.map(s => ({ id: s.id, n: s.n, img: s.img, color: s.color, p: s.p, wild: !!s.wild, scatter: !!s.scatter, sacred: !!s.sacred, sticky: !!s.sticky, valdo: !!s.valdo })), lines: LINES, rows: 5, cols: 5, pitThreshold: PIT_THRESHOLD, valdoMults: VALDO_MULTS.map(v => v[0]) };

module.exports = { registerHandlers, def, meta, SYMS, LINES, PIT_THRESHOLD };
