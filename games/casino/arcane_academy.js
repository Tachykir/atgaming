/**
 * ARCANE ACADEMY — AT Gaming Casino
 * Siatka 7×7, Cluster Pays (min 5), Cascading Reels + Multiplier Trail.
 *
 *  - Wygrane klastry znikają, nowe symbole spadają z góry (kaskada)
 *  - Każda kolejna kaskada w spinie zwiększa mnożnik: ×1 → ×2 → ×3 … (max ×10)
 *  - 💫 Orb (Wild) dołącza do każdego klastra
 *  - 📚 Tome (Scatter): 3+ w spinie → Bonus Pick: 12 ksiąg, odkrywaj nagrody
 *    (AT$ lub Free Spiny), 3 bomby kończą bonus.
 *  - Free Spiny: mnożnik NIE resetuje się między spinami (rośnie przez cały bonus)
 */
'use strict';
const E = require('./slot_engine');

const COLS = 7, ROWS = 7, CLUSTER_MIN = 5, MAX_MULT = 10;
const PAY_SCALE = 0.545;

const raw = [
  { id: 'arcane',  e: '🔮', n: 'Kryształ Arcane', w: 5,  p: [0,0,0,0,0,5,8,12,20,40,100] },
  { id: 'phoenix', e: '🦅', n: 'Feniks',          w: 6,  p: [0,0,0,0,0,3,5,8,12,25,60] },
  { id: 'wand',    e: '🪄', n: 'Różdżka',         w: 7,  p: [0,0,0,0,0,2,3,5,8,15,40] },
  { id: 'hat',     e: '🎩', n: 'Kapelusz',        w: 8,  p: [0,0,0,0,0,1.5,2,3,5,10,25] },
  { id: 'potion',  e: '⚗️', n: 'Eliksir',         w: 8,  p: [0,0,0,0,0,1,1.5,2,4,8,20] },
  { id: 'star',    e: '⭐', n: 'Gwiazda',         w: 9,  p: [0,0,0,0,0,0.8,1,1.5,3,6,15] },
  { id: 'leaf',    e: '🍃', n: 'Liść',            w: 9, p: [0,0,0,0,0,0.5,0.8,1,2,5,12] },
  { id: 'orb',     e: '💫', n: 'Orb (Wild)',      w: 0.8, wild: true },
  { id: 'tome',    e: '📚', n: 'Tome (Scatter)',  w: 0.4, scatter: true },
];
const SYMS = raw.map(s => ({ ...s, p: s.p ? s.p.map(v => v * PAY_SCALE) : null }));
const I = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const pick = E.makePicker(SYMS.map(s => s.w));
const pickNoScatter = E.makePicker(SYMS.map((s, i) => i === I.tome ? 0 : s.w));

function findClusters(grid) {
  const visited = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
  const clusters = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (visited[c][r]) continue;
    const si = grid[c][r];
    if (!SYMS[si].p) continue;
    const used = new Set([c + ',' + r]);
    const queue = [[c, r]], cells = [];
    visited[c][r] = true;
    while (queue.length) {
      const [cc, rr] = queue.shift();
      cells.push([cc, rr]);
      for (const [nc, nr] of [[cc-1,rr],[cc+1,rr],[cc,rr-1],[cc,rr+1]]) {
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || used.has(nc + ',' + nr)) continue;
        const ni = grid[nc][nr];
        if (ni === si) { used.add(nc + ',' + nr); visited[nc][nr] = true; queue.push([nc, nr]); }
        else if (SYMS[ni].wild) { used.add(nc + ',' + nr); queue.push([nc, nr]); }
      }
    }
    if (cells.length >= CLUSTER_MIN) {
      const p = SYMS[si].p;
      clusters.push({ symIdx: si, cells, size: cells.length, pay: p[Math.min(cells.length, p.length - 1)] });
    }
  }
  return clusters;
}

function cascade(grid, clusters, inFree) {
  const remove = new Set();
  clusters.forEach(cl => cl.cells.forEach(([c, r]) => remove.add(c + ',' + r)));
  const fill = inFree ? pickNoScatter : pick;
  const falling = [];
  const g = grid.map((col, c) => {
    const kept = col.filter((_, r) => !remove.has(c + ',' + r));
    const added = Array.from({ length: ROWS - kept.length }, () => fill());
    for (let r = 0; r < added.length; r++) falling.push([c, r]);
    return [...added, ...kept];
  });
  return { grid: g, falling };
}

// ── Bonus Pick ────────────────────────────────────────────────────
function makePickBoard() {
  const items = [
    { type: 'cash', value: 1 }, { type: 'cash', value: 1 }, { type: 'cash', value: 2 }, { type: 'cash', value: 2 },
    { type: 'cash', value: 3 }, { type: 'cash', value: 5 }, { type: 'cash', value: 10 }, { type: 'cash', value: 25 },
    { type: 'fs', value: 5 },
    { type: 'bomb' }, { type: 'bomb' }, { type: 'bomb' },
  ];
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}
function resolvePick(state, index) {
  const pk = state.pick;
  if (!pk || pk.done || index < 0 || index >= pk.items.length || pk.revealed[index]) return null;
  const item = pk.items[index];
  pk.revealed[index] = true;
  let cash = 0;
  if (item.type === 'cash') { cash = item.value * pk.bet; pk.total += cash; }
  else if (item.type === 'fs') { pk.fs += item.value; }
  else if (item.type === 'bomb') { pk.bombs++; }
  if (pk.bombs >= 3 || pk.items.every((it, i) => pk.revealed[i] || it.type === 'bomb')) pk.done = true;
  let fsAwarded = 0;
  if (pk.done && pk.fs > 0) {
    fsAwarded = pk.fs;
    state.freeSpins += pk.fs; state.freeBet = pk.bet; state.fsMult = 1; state.fsTotal = pk.fs; state.fsWin = 0;
  }
  return { item, cash, fsAwarded };
}
function publicPick(pk, reveal) {
  return { bet: pk.bet, total: pk.total, fs: pk.fs, bombs: pk.bombs, done: pk.done,
    board: pk.items.map((it, i) => (pk.revealed[i] || reveal) ? { ...it, revealed: !!pk.revealed[i] } : null) };
}

const def = {
  game: 'arcane_academy', statsId: 'arcane_academy', event: 'casinoAASpin', resultEvent: 'casinoAAResult',
  newState: () => ({ freeSpins: 0, freeBet: 0, fsMult: 1, fsTotal: 0, fsWin: 0, pick: null }),
  isFree: s => s.freeSpins > 0,
  blocked: s => s.pick && !s.pick.done ? 'Najpierw dokończ Bonus Pick!' : null,
  spin(state, { bet, paid }) {
    const inFree = !paid;
    if (inFree) state.freeSpins--;
    let grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => inFree ? pickNoScatter() : pick()));
    const startGrid = grid.map(c => [...c]);
    const scatter = E.countSym(grid, i => i === I.tome);
    let mult = inFree ? state.fsMult : 1;
    const steps = [];
    let payout = 0;
    for (let guard = 0; guard < 50; guard++) {
      const clusters = findClusters(grid);
      if (!clusters.length) break;
      const base = clusters.reduce((s, cl) => s + cl.pay * bet, 0);
      const win = base * mult;
      payout += win;
      const next = cascade(grid, clusters, inFree);
      steps.push({ clusters: clusters.map(cl => ({ ...cl, win: cl.pay * bet * mult })), mult, win, grid: next.grid, falling: next.falling });
      grid = next.grid;
      mult = Math.min(MAX_MULT, mult + 1);
    }
    if (inFree) { state.fsMult = mult; state.fsWin += payout; }

    let bonusPick = null;
    if (!inFree && scatter.n >= 3) {
      state.pick = { items: makePickBoard(), revealed: [], total: 0, fs: 0, bombs: 0, done: false, bet };
      bonusPick = publicPick(state.pick, false);
    }
    const fsSummary = inFree && state.freeSpins === 0 ? { total: state.fsTotal, win: state.fsWin, mult: state.fsMult } : null;
    if (fsSummary) state.fsMult = 1;
    return {
      startGrid, steps, finalGrid: grid, payout, cascadeCount: steps.length, finalMultiplier: mult,
      isFree: inFree, freeSpinsRemaining: state.freeSpins, fsMult: state.fsMult, fsSummary,
      scatter: scatter.cells, bonusPick,
    };
  },
};

// Symulacja bonusu (kalibracja RTP): losowe wybieranie do końca
function autoBonus(state) {
  let won = 0;
  while (state.pick && !state.pick.done) {
    const free = state.pick.items.map((_, i) => i).filter(i => !state.pick.revealed[i]);
    const r = resolvePick(state, free[Math.floor(Math.random() * free.length)]);
    won += r.cash;
  }
  state.pick = null;
  return won;
}

// Kwoty w bonusie (suma i odkryte pola gotówki) w AT$ po skalowaniu RTP — klient pokazuje value × bet × rtpScale
function scalePick(pp, k) { return k === 1 ? pp : { ...pp, total: pp.total * k }; }

function registerHandlers(socket, io, casino) {
  E.register(def, socket, io, casino);
  socket.on('casinoAAPick', async (data) => {
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;
    await casino.exclusive(def.game + ':' + discordUser.id, async () => {
      const state = E.stateFor(def, discordUser.id);
      if (!state.pick || state.pick.done) return;
      const r = resolvePick(state, Number(data.index));
      if (!r) return;
      const k = E.rtpScale(casino, def.game);
      const cash = Math.floor(r.cash * k);
      if (cash > 0) {
        await casino.updateBalance(discordUser.id, cash);
        casino.tracker?.track(def.game, { wagered: 0, returned: cash, rounds: 0 });
        await casino.updateSlotStats(discordUser.id, def.game, { won: cash, bestWin: cash });
      }
      const balance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
      const pk = state.pick;
      socket.emit('casinoAAPickResult', { index: Number(data.index), item: r.item, cash, fsAwarded: r.fsAwarded, pick: scalePick(publicPick(pk, pk.done), k), balance, freeSpins: state.freeSpins, rtpScale: k });
      if (pk.done) state.pick = null;
      E.persistState(def, casino, discordUser.id);
    });
  });
  // Po reconnect klient może zapytać o niedokończony bonus
  socket.on('casinoAAGetState', async (data) => {
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;
    const state = await E.loadState(def, casino, discordUser.id);
    const k = E.rtpScale(casino, def.game);
    socket.emit('casinoAAState', { freeSpins: state.freeSpins, fsMult: state.fsMult, freeBet: state.freeBet, rtpScale: k, pick: state.pick && !state.pick.done ? scalePick(publicPick(state.pick, false), k) : null });
  });
}

const meta = { syms: SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, p: s.p, wild: !!s.wild, scatter: !!s.scatter })), cols: COLS, rows: ROWS, maxMult: MAX_MULT };

module.exports = { registerHandlers, def, meta, autoBonus, SYMS };
