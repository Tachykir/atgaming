/**
 * JACKPOT FRENZY — AT Gaming Casino
 * Siatka 5×10, Cluster Pays (min. 5 sąsiadujących), Dublet rozszerza do 10×10.
 *
 * Kociołki (napełniane coinami z bębnów):
 *  - Zielony  (MNOŻNIKI): 8 FS + srebrne monety (sticky wild) z wartością ×stawka — wypłacane na koniec
 *  - Czerwony (JACKPOTY): 8 FS + złote monety (sticky wild) — każda wypłaca jackpot
 *  - Niebieski (DUBLET):  8 FS na planszy 10×10 + srebrne monety
 * Pełny kociołek uruchamia mini-grę (+20% szansy na dołączenie pozostałych).
 * Jackpoty są mnożnikami stawki bonusu i rosną progresywnie z każdym płatnym spinem.
 * Stawka mini-gry = średnia stawka, za którą napełniono kociołki.
 */
'use strict';
const E = require('./slot_engine');

const CAULDRON_MAX   = 2000;
const CAULDRON_CHAIN = 0.20;
const MINI_FREE_SPINS = 8;
const CLUSTER_MIN = 5;
const ROWS = 10, COLS_NORMAL = 5, COLS_DUBLET = 10;
const PAY_SCALE = 0.80;

const raw = [
  { id:'seven',  n:'7',           img:'/images/jf/seven.png',  w:3,  p:[0,0,0,0,0,10,15,25,50,100,250] },
  { id:'bar3',   n:'BAR BAR BAR', img:'/images/jf/bar3.png',   w:5,  p:[0,0,0,0,0,6,10,15,30,60,150] },
  { id:'bar2',   n:'BAR BAR',     img:'/images/jf/bar2.png',   w:7,  p:[0,0,0,0,0,4,6,10,20,40,80] },
  { id:'bar',    n:'BAR',         img:'/images/jf/bar.png',    w:9,  p:[0,0,0,0,0,3,4,6,12,25,50] },
  { id:'bell',   n:'Dzwonek',     img:'/images/jf/bell.png',   w:11, p:[0,0,0,0,0,2,3,5,8,15,30] },
  { id:'grape',  n:'Winogrona',   img:'/images/jf/grape.png',  w:12, p:[0,0,0,0,0,1.5,2,4,6,10,20] },
  { id:'orange', n:'Pomarańcza',  img:'/images/jf/orange.png', w:13, p:[0,0,0,0,0,1,1.5,3,5,8,15] },
  { id:'cherry', n:'Wiśnia',      img:'/images/jf/cherry.png', w:14, p:[0,0,0,0,0,1,1.5,2,4,6,12] },
  { id:'coin_g', n:'Zielony Coin',   img:'/images/jf/coin_g.png',  w:3, coin:'green' },
  { id:'coin_r', n:'Czerwony Coin',  img:'/images/jf/coin_r.png',  w:3, coin:'red' },
  { id:'coin_b', n:'Niebieski Coin', img:'/images/jf/coin_b.png',  w:3, coin:'blue' },
  { id:'coin_br',n:'Brązowy Coin',   img:'/images/jf/coin_br.png', w:2, coin:'bronze', wild:true },
  { id:'silver', n:'Srebrna Moneta', img:'/images/jf/silver.png',  w:0, sticky:true, wild:true, silver:true },
  { id:'gold',   n:'Złota Moneta',   img:'/images/jf/gold.png',    w:0, sticky:true, wild:true, gold:true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p ? s.p.map(v => v * PAY_SCALE) : null }));
const IDX = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const COIN_PTS = [2, 3, 4, 5];

function weightsFor(mini) {
  const w = SYMS.map(s => s.w);
  if (mini.multiplier || mini.dublet) w[IDX.silver] = 0.3;
  if (mini.jackpot) w[IDX.gold] = 0.18;
  if (mini.multiplier || mini.jackpot || mini.dublet) { w[IDX.coin_g] = 0; w[IDX.coin_r] = 0; w[IDX.coin_b] = 0; w[IDX.coin_br] = 0; }
  return w;
}

// ─── JACKPOTY (× stawka) ─────────────────────────────────────────
const JP_TIERS = ['mini', 'minor', 'major', 'mega', 'grand'];
const JP_BASE  = { mini: 3, minor: 10, major: 30, mega: 150, grand: 750 };
const JP_GROW  = { mini: 0.0002, minor: 0.0005, major: 0.0015, mega: 0.005, grand: 0.015 }; // × stawka za płatny spin
const progressive = { low: { ...JP_BASE }, medium: { ...JP_BASE }, high: { ...JP_BASE } };
const pickGoldJP = E.makePicker([62, 25, 10, 2.5, 0.5]);
const SILVER = [[1, 40], [2, 30], [3, 15], [5, 10], [10, 4], [50, 0.8], [200, 0.2]];
const pickSilver = E.makePicker(SILVER.map(s => s[1]));

// ─── CLUSTERY ────────────────────────────────────────────────────
function findClusters(grid, cols) {
  const visited = Array.from({ length: cols }, () => Array(ROWS).fill(false));
  const clusters = [];
  const nb = (c, r) => [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]].filter(([x, y]) => x >= 0 && x < cols && y >= 0 && y < ROWS);
  for (let c = 0; c < cols; c++) for (let r = 0; r < ROWS; r++) {
    if (visited[c][r]) continue;
    const symIdx = grid[c][r], sym = SYMS[symIdx];
    if (!sym.p) continue;
    // BFS po tym samym symbolu; wildy sąsiadujące z klastrem dołączają (bez propagacji przez wild→wild)
    const usedWild = new Set();
    const queue = [[c, r]], cells = [];
    visited[c][r] = true;
    let real = 0;
    while (queue.length) {
      const [cc, rr] = queue.shift();
      cells.push([cc, rr]);
      const isW = SYMS[grid[cc][rr]].wild;
      if (!isW) real++;
      if (isW) continue;
      for (const [nc, nr] of nb(cc, rr)) {
        const ni = grid[nc][nr];
        if (ni === symIdx && !visited[nc][nr]) { visited[nc][nr] = true; queue.push([nc, nr]); }
        else if (SYMS[ni].wild && !usedWild.has(nc + ',' + nr)) { usedWild.add(nc + ',' + nr); queue.push([nc, nr]); }
      }
    }
    if (cells.length >= CLUSTER_MIN) {
      const pay = sym.p[Math.min(cells.length, sym.p.length - 1)] || 0;
      if (pay > 0) clusters.push({ symIdx, cells, size: cells.length, real, pay });
    }
  }
  return clusters;
}

const def = {
  game: 'jackpot_frenzy', statsId: 'jackpot_frenzy', event: 'casinoJFSpin', resultEvent: 'casinoJFResult',
  newState: () => ({
    cauldron: { green: 0, red: 0, blue: 0 }, meter: { points: 0, wager: 0 },
    miniGames: { multiplier: false, jackpot: false, dublet: false },
    freeSpins: 0, freeBet: 0, level: 'low', sticky: [], miniWinSum: 0,
  }),
  isFree: s => s.freeSpins > 0,
  spin(state, { bet, paid, level }) {
    const inFree = !paid;
    if (paid) {
      state.level = level;
      const jp = progressive[level];
      JP_TIERS.forEach(t => jp[t] += JP_GROW[t]);
    }
    const lvl = inFree ? state.level : level;
    const cols = inFree && state.miniGames.dublet ? COLS_DUBLET : COLS_NORMAL;
    if (inFree) state.freeSpins--;

    const pick = E.symPicker(weightsFor(inFree ? state.miniGames : {}));
    const grid = Array.from({ length: cols }, (_, c) => Array.from({ length: ROWS }, (_, r) => {
      const st = state.sticky.find(s => s.col === c && s.row === r);
      return st ? (st.type === 'silver' ? IDX.silver : IDX.gold) : pick();
    }));

    // Coiny → kociołki
    const coinEvents = [];
    if (paid) {
      for (let c = 0; c < cols; c++) for (let r = 0; r < ROWS; r++) {
        const s = SYMS[grid[c][r]];
        if (!s.coin) continue;
        const color = s.coin === 'bronze' ? 'blue' : s.coin;
        const pts = COIN_PTS[Math.floor(Math.random() * COIN_PTS.length)];
        state.cauldron[color] = Math.min(CAULDRON_MAX, state.cauldron[color] + pts);
        E.meterAdd(state.meter, bet, pts);
        coinEvents.push({ col: c, row: r, color, pts, total: state.cauldron[color], isBronze: s.coin === 'bronze' });
      }
    }

    // Nowe sticky monety w mini-grze
    const newSticky = [];
    if (inFree) {
      for (let c = 0; c < cols; c++) for (let r = 0; r < ROWS; r++) {
        const s = SYMS[grid[c][r]];
        if ((s.silver || s.gold) && !state.sticky.find(x => x.col === c && x.row === r)) {
          const sc = s.silver ? { col: c, row: r, type: 'silver', mult: SILVER[pickSilver()][0] } : { col: c, row: r, type: 'gold', jp: JP_TIERS[pickGoldJP()] };
          state.sticky.push(sc); newSticky.push(sc);
        }
      }
    }

    const clusters = findClusters(grid, cols).map(cl => ({ ...cl, win: cl.pay * bet }));
    const clusterWin = clusters.reduce((s, cl) => s + cl.win, 0);

    // Kociołki pełne → mini-gra
    const triggeredCauldrons = [], chainTriggered = [];
    if (paid) {
      for (const color of ['green', 'red', 'blue']) if (state.cauldron[color] >= CAULDRON_MAX) { state.cauldron[color] = 0; triggeredCauldrons.push(color); }
      if (triggeredCauldrons.length) for (const color of ['green', 'red', 'blue']) {
        if (!triggeredCauldrons.includes(color) && Math.random() < CAULDRON_CHAIN) { state.cauldron[color] = 0; triggeredCauldrons.push(color); chainTriggered.push(color); }
      }
      if (triggeredCauldrons.length) {
        state.miniGames = { multiplier: triggeredCauldrons.includes('green'), jackpot: triggeredCauldrons.includes('red'), dublet: triggeredCauldrons.includes('blue') };
        state.freeSpins = MINI_FREE_SPINS * triggeredCauldrons.length;
        state.freeBet = E.meterBet(state.meter, bet);
        E.meterReset(state.meter);
        state.sticky = []; state.miniWinSum = 0; state.level = level;
      }
    }

    let payout = paid ? clusterWin : 0;
    let miniEnded = false, multSum = 0, jackpotWins = [], finalPayout = 0;
    if (inFree) {
      state.miniWinSum += clusterWin;
      if (state.freeSpins <= 0) {
        miniEnded = true;
        multSum = state.sticky.filter(s => s.type === 'silver').reduce((s, x) => s + x.mult, 0);
        const jp = progressive[lvl];
        for (const g of state.sticky.filter(s => s.type === 'gold')) {
          const amount = Math.floor(jp[g.jp] * bet);
          jackpotWins.push({ jp: g.jp, amount, col: g.col, row: g.row });
          jp[g.jp] = JP_BASE[g.jp];
        }
        finalPayout = Math.floor(state.miniWinSum + multSum * bet) + jackpotWins.reduce((s, j) => s + j.amount, 0);
        payout = finalPayout;
        state.miniGames = { multiplier: false, jackpot: false, dublet: false };
        state.sticky = []; state.freeSpins = 0;
      }
    }

    const jpView = {};
    const viewBet = inFree || triggeredCauldrons.length ? state.freeBet : bet;
    JP_TIERS.forEach(t => jpView[t] = Math.floor(progressive[lvl][t] * viewBet));

    return {
      grid, clusters, payout, cols, isFree: inFree, totBet: viewBet,
      freeSpinsAwarded: triggeredCauldrons.length ? state.freeSpins : 0,
      miniSpins: state.freeSpins, miniWinSum: miniEnded ? 0 : state.miniWinSum, miniGames: { ...state.miniGames },
      dublet: state.miniGames.dublet,
      cauldron: { ...state.cauldron }, cauldronMax: CAULDRON_MAX, coinEvents, triggeredCauldrons, chainTriggered,
      stickyCoins: [...state.sticky], newSticky, miniEnded, multSum, jackpotWins, finalPayout,
      progressiveJP: jpView,
      syms: SYMS.map(s => ({ id: s.id, n: s.n, e: '', img: s.img, coin: s.coin || null, sticky: !!s.sticky, wild: !!s.wild, silver: !!s.silver, gold: !!s.gold, bronze: s.id === 'coin_br' })),
    };
  },
};

function registerHandlers(socket, io, casino) { E.register(def, socket, io, casino); }

module.exports = { registerHandlers, def, progressive, SYMS };
