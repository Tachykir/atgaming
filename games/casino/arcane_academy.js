/**
 * ARCANE ACADEMY — AT Gaming Casino
 * Siatka 10×10, Cluster Pays (min 5 sąsiadów), Cascading Reels + Multiplier Trail
 *
 * Mechanika:
 *  - Wygrane symbole znikają → nowe "spadają" z góry (gravity cascade)
 *  - Każda kaskada w jednym spinie +1 do mnożnika (x1 → x2 → x3 … max x15)
 *  - Symbol "Tome" (Scatter) = 3+ → Bonus Pick (5 ksiąg, 3 próby, unikaj bomb)
 *  - Symbol "Orb" (Wild) = zastępuje wszystkie z wyjątkiem Scatter/Tome
 *  - RTP ~78%
 *  - Hasło dostępu: 12345
 */
'use strict';

const ACCESS_PASSWORD = '12345';
const COLS = 10;
const ROWS = 10;
const CLUSTER_MIN = 5;
const MAX_MULT = 20;

const SYMS = [
  { id: 'arcane',  e: '🔮', n: 'Kryształ Arcane', w: 2,  p: [0,0,0,0,0,8,16,30,60,120,250]  },
  { id: 'phoenix', e: '🦅', n: 'Feniks',           w: 3,  p: [0,0,0,0,0,5,10,18,40, 80,160]  },
  { id: 'wand',    e: '🪄', n: 'Różdżka',          w: 5,  p: [0,0,0,0,0,3, 6,12,24, 50,100]  },
  { id: 'hat',     e: '🎩', n: 'Kapelusz',         w: 7,  p: [0,0,0,0,0,2, 4, 8,16, 32, 65]  },
  { id: 'potion',  e: '⚗️',  n: 'Eliksir',          w: 9,  p: [0,0,0,0,0,1, 3, 5,10, 20, 40]  },
  { id: 'star',    e: '⭐', n: 'Gwiazda',          w: 11, p: [0,0,0,0,0,1, 2, 3, 6, 12, 22]  },
  { id: 'leaf',    e: '🍃', n: 'Liść',             w: 13, p: [0,0,0,0,0,1, 2, 3, 5,  9, 16]  },
  { id: 'orb',     e: '💫', n: 'Orb (Wild)',       w: 3,  p: [0,0,0,0,0,10,20,40,80,160,400], wild: true },
  { id: 'tome',    e: '📚', n: 'Tome (Scatter)',   w: 3,  p: [0,0,0,0,0,0, 0, 0, 0,  0,  0], scatter: true },
];

const IDX = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const DRUM_W   = SYMS.map(s => s.w);
const DRUM_TOT = DRUM_W.reduce((a, b) => a + b, 0);

const WIN_TIERS = [
  { min: 0,   max: 1.5,      tier: 'win',   label: 'Win'                  },
  { min: 1.5, max: 5,        tier: 'big',   label: 'Big Win'              },
  { min: 5,   max: 20,       tier: 'mega',  label: 'Mega Win'             },
  { min: 20,  max: 50,       tier: 'huge',  label: 'Huge Win'             },
  { min: 50,  max: 500,      tier: 'giga',  label: 'Giga Win'             },
  { min: 500, max: Infinity, tier: 'frito', label: '✨ Arcane Jackpot!'   },
];
function getTier(m) { return WIN_TIERS.find(t => m >= t.min && m < t.max) || WIN_TIERS[0]; }

const playerStates = {};
function getState(id) {
  if (!playerStates[id]) playerStates[id] = { freeSpins: 0, betPerLine: 10, activeLines: 1 };
  return playerStates[id];
}

function rollSym() {
  let r = Math.random() * DRUM_TOT;
  for (let i = 0; i < SYMS.length; i++) { r -= DRUM_W[i]; if (r <= 0) return i; }
  return SYMS.length - 1;
}

function buildGrid() {
  const g = [];
  for (let c = 0; c < COLS; c++) { g.push([]); for (let r = 0; r < ROWS; r++) g[c].push(rollSym()); }
  return g;
}

// BFS cluster finder
function findClusters(grid) {
  const visited = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
  const clusters = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (visited[c][r]) continue;
    const sym = SYMS[grid[c][r]];
    if (sym.scatter || sym.gem) continue;
    const matchId = sym.wild ? null : sym.id;
    const queue = [[c, r]];
    const cells = [];
    visited[c][r] = true;
    while (queue.length) {
      const [cc, rr] = queue.shift();
      const s = SYMS[grid[cc][rr]];
      if (s.wild || s.id === matchId) {
        cells.push([cc, rr]);
        for (const [nc, nr] of [[cc-1,rr],[cc+1,rr],[cc,rr-1],[cc,rr+1]]) {
          if (nc>=0&&nc<COLS&&nr>=0&&nr<ROWS&&!visited[nc][nr]) {
            const ns = SYMS[grid[nc][nr]];
            if (ns.wild || ns.id === matchId) { visited[nc][nr] = true; queue.push([nc, nr]); }
          }
        }
      }
    }
    if (cells.length >= CLUSTER_MIN) {
      const pay = sym.p[Math.min(cells.length, sym.p.length - 1)] || sym.p[sym.p.length - 1];
      clusters.push({ symId: sym.id, cells, size: cells.length, pay });
    }
  }
  return clusters;
}

// Usuń komórki klastra i opuść symbole w dół (gravity)
function cascade(grid, clusters) {
  const remove = new Set();
  clusters.forEach(cl => cl.cells.forEach(([c, r]) => remove.add(`${c},${r}`)));
  const newGrid = grid.map((col, c) => {
    const kept = col.filter((_, r) => !remove.has(`${c},${r}`));
    const added = Array(ROWS - kept.length).fill(null).map(() => rollSym());
    return [...added, ...kept];
  });
  return newGrid;
}

function countScatter(grid) {
  let n = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++)
    if (SYMS[grid[c][r]].scatter) n++;
  return n;
}

// ── Bonus Pick helper ────────────────────────────────────────────────────────
function genBonusItems(bet) {
  const prizes = [
    bet * 5, bet * 10, bet * 20, bet * 50, bet * 100,
    'fs8', 'fs12', bet * 200,
  ];
  const shuffled = prizes.sort(() => Math.random() - 0.5).slice(0, 5);
  return shuffled.map(p => ({ type: typeof p === 'string' ? 'fs' : 'cash', value: p }));
}

function registerHandlers(socket, io, casino) {
  socket.on('casinoAASpin', async (data) => {
    const { tableId, bet, password } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'arcane_academy')
      return socket.emit('casinoError', { message: 'Zły stół' });

    if (password !== ACCESS_PASSWORD)
      return socket.emit('casinoError', { message: 'Nieprawidłowe hasło dostępu!' });

    const discordUser = socket.getDiscordUser(data);
    if (!discordUser)
      return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord!' });

    const state = getState(discordUser.id);
    const cfg   = table.config;
    const isFree = state.freeSpins > 0;

    let totBet;
    if (isFree) {
      totBet = 0;
    } else {
      totBet = Math.round(Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(bet) || cfg.minBet)));
      const wallet = await casino.ensureWallet(discordUser);
      if (wallet.balance < totBet)
        return socket.emit('casinoError', { message: `Za mało AT$! Masz ${wallet.balance}, potrzebujesz ${totBet}` });
      await casino.updateBalance(discordUser.id, -totBet);
      state.betPerLine = totBet;
    }

    // Kaskady
    let grid = buildGrid();
    let totalPayout = 0;
    let cascadeCount = 0;
    let multiplier = 1;
    const cascadeLog = []; // [{clusters, grid, mult, casPayment}]
    let scatterCount = countScatter(grid);

    while (true) {
      const clusters = findClusters(grid);
      if (clusters.length === 0) break;
      const casePay = clusters.reduce((s, cl) => s + cl.pay * state.betPerLine, 0);
      const afterMult = Math.round(casePay * multiplier);
      cascadeLog.push({ clusters: clusters.map(cl => ({ ...cl })), grid: grid.map(c => [...c]), mult: multiplier, casePay, afterMult });
      totalPayout += afterMult;
      cascadeCount++;
      multiplier = Math.min(multiplier + 1, MAX_MULT);
      grid = cascade(grid, clusters);
    }

    // Scatter bonus — tylko poza free spinami
    let bonusItems = null;
    let freeSpinsAwarded = 0;
    if (!isFree && scatterCount >= 3) {
      bonusItems = genBonusItems(state.betPerLine);
      // Gracz wybierze przez osobny event; tutaj przyznajemy od razu losowo
      const picks = bonusItems.sort(() => Math.random() - 0.5).slice(0, 3).filter(p => p.type !== 'bomb');
      for (const p of picks) {
        if (p.type === 'cash') totalPayout += p.value;
        else if (p.type === 'fs') {
          const n = parseInt(String(p.value).replace('fs', '')) || 8;
          freeSpinsAwarded += n;
        }
      }
      if (freeSpinsAwarded > 0) { state.freeSpins = freeSpinsAwarded; state.betPerLine = totBet || state.betPerLine; }
    }

    let freeSpinsRemaining = 0;
    if (isFree) { state.freeSpins--; freeSpinsRemaining = state.freeSpins; }

    if (totalPayout > 0) await casino.updateBalance(discordUser.id, totalPayout);
    await casino.recordGame(discordUser.id);
    await casino.updateSlotStats(discordUser.id, 'arcane_academy', {
      spins: 1, spent: isFree ? 0 : totBet, won: totalPayout, bestWin: totalPayout,
    });

    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
    const multFinal = (totBet || state.betPerLine) > 0 ? totalPayout / (totBet || state.betPerLine) : 0;
    const tierObj = getTier(multFinal);

    socket.emit('casinoAAResult', {
      finalGrid:          grid,
      cascadeLog,
      totalPayout,
      cascadeCount,
      finalMultiplier:    multiplier,
      balance:            newBalance,
      totBet:             isFree ? 0 : totBet,
      isFree,
      freeSpinsAwarded,
      freeSpinsRemaining,
      scatterCount,
      bonusItems,
      mult:               multFinal,
      tier:               tierObj.tier,
      label:              tierObj.label,
      syms:               SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, wild: !!s.wild, scatter: !!s.scatter })),
    });
  });
}

module.exports = { registerHandlers, SYMS };
