/**
 * PATH OF GAMBLING — AT Gaming Casino
 * 5 bębnów × 5 rzędów, 50 linii wygrywających
 * Symbole: waluty z Path of Exile (obrazki PNG)
 *
 * Mechaniki specjalne:
 *  - Fracturing Orb  → WILD  (zastępuje wszystkie zwykłe symbole)
 *  - Reflecting Mist → SCATTER (3+ = free spiny: 3→8, 4→12, 5→20)
 *  - Free spiny NIE pobierają z portfela gracza
 *  - Pit Meter: każdy spin bez wygranej +1 pkt, wygrana resetuje.
 *    Po zapełnieniu (PIT_THRESHOLD spinów) → 8 free spinów w trybie Pit
 *    W trybie Pit do puli wchodzi Hinekora's Lock (sticky wild):
 *      wylosowana Lock zostaje na bębnie przez całe free spiny
 */
'use strict';

// ─── KONFIGURACJA ─────────────────────────────────────────────────────────────
const PIT_THRESHOLD  = 30;  // ile niewygrywających spinów napełnia Pit Meter
const PIT_FREE_SPINS = 8;   // free spiny przyznawane przez Pit

// ─── SYMBOLE ─────────────────────────────────────────────────────────────────
// img: ścieżka serwowana przez express static z katalogu public/images/slots/
// p[k] = wypłata za k symboli na linii (k=0..5; k<2 zawsze 0)
const SYMS = [
  {
    id: 'mirror',
    n: 'Mirror of Kalandra',
    img: '/images/slots/mirror.png',
    w: 1,
    p: [0, 0, 50, 150, 500, 2000],
    color: '#a8d8ff',
    rarity: 'mirror',
  },
  {
    id: 'divine',
    n: 'Divine Orb',
    img: '/images/slots/Divine.png',
    w: 2,
    p: [0, 0, 20, 60, 200, 800],
    color: '#ffe066',
    rarity: 'divine',
  },
  {
    id: 'exalted',
    n: 'Exalted Orb',
    img: '/images/slots/exalted.png',
    w: 3,
    p: [0, 0, 10, 30, 100, 400],
    color: '#ffd700',
    rarity: 'exalted',
  },
  {
    id: 'chaos',
    n: 'Chaos Orb',
    img: '/images/slots/chaos.png',
    w: 5,
    p: [0, 0, 5, 15, 50, 150],
    color: '#e05050',
    rarity: 'rare',
  },
  {
    id: 'annul',
    n: 'Orb of Annulment',
    img: '/images/slots/annul.png',
    w: 6,
    p: [0, 0, 3, 8, 25, 80],
    color: '#c0c0d0',
    rarity: 'uncommon',
  },
  {
    id: 'alteration',
    n: 'Orb of Alteration',
    img: '/images/slots/alteration.png',
    w: 9,
    p: [0, 0, 2, 5, 15, 45],
    color: '#4488ff',
    rarity: 'uncommon',
  },
  {
    id: 'transmutation',
    n: 'Orb of Transmutation',
    img: '/images/slots/Transmutation.png',
    w: 12,
    p: [0, 0, 1, 3, 8, 25],
    color: '#2266cc',
    rarity: 'common',
  },
  {
    id: 'scroll',
    n: 'Scroll of Wisdom',
    img: '/images/slots/scroll.png',
    w: 16,
    p: [0, 0, 1, 2, 5, 15],
    color: '#aaaaaa',
    rarity: 'common',
  },
  // WILD — Fracturing Orb
  {
    id: 'fracture',
    n: "Fracturing Orb",
    img: '/images/slots/fracture.png',
    w: 3,
    p: [0, 0, 15, 45, 150, 600],
    color: '#ff9944',
    rarity: 'wild',
    wild: true,
  },
  // SCATTER — Reflecting Mist
  {
    id: 'mist',
    n: 'Reflecting Mist',
    img: '/images/slots/mist.png',
    w: 4,
    p: [0, 0, 0, 0, 0, 0],
    color: '#aa44ff',
    rarity: 'scatter',
    scatter: true,
  },
  // STICKY WILD — Hinekora's Lock (tylko w trybie Pit free spinów, w=0 normalnie)
  {
    id: 'lock',
    n: "Hinekora's Lock",
    img: '/images/slots/lock.png',
    w: 0,
    p: [0, 0, 25, 75, 250, 1000],
    color: '#cc44aa',
    rarity: 'sticky_wild',
    wild: true,
    sticky: true,
  },
];

const IDX_FRACTURE = SYMS.findIndex(s => s.id === 'fracture');
const IDX_MIST     = SYMS.findIndex(s => s.id === 'mist');
const IDX_LOCK     = SYMS.findIndex(s => s.id === 'lock');

const DRUM_W   = SYMS.map(s => s.w);
const DRUM_TOT = DRUM_W.reduce((a, b) => a + b, 0);

// Lock pojawia się w trybie Pit z wagą 2
const PIT_LOCK_WEIGHT = 2;
const PIT_DRUM_TOT    = DRUM_TOT + PIT_LOCK_WEIGHT;

// ─── LINIE ────────────────────────────────────────────────────────────────────
const LINES = [
  [2,2,2,2,2],[0,0,0,0,0],[4,4,4,4,4],[1,1,1,1,1],[3,3,3,3,3],
  [0,1,2,1,0],[4,3,2,3,4],[0,1,2,3,4],[4,3,2,1,0],
  [1,0,1,0,1],[3,4,3,4,3],[2,1,0,1,2],[2,3,4,3,2],
  [0,2,4,2,0],[4,2,0,2,4],[1,3,4,3,1],[3,1,0,1,3],
  [0,0,1,2,2],[2,2,1,0,0],[4,4,3,2,2],[2,2,3,4,4],
  [0,1,1,1,0],[4,3,3,3,4],[1,1,2,1,1],[3,3,2,3,3],
  [0,1,2,3,4],[4,3,2,1,0],[1,2,3,4,4],[0,1,2,1,2],
  [2,3,4,3,2],[2,1,0,1,0],[3,2,1,2,3],[1,0,0,0,1],
  [0,0,0,1,2],[0,0,1,2,3],[0,1,2,3,4],[1,2,3,4,4],
  [4,4,4,3,2],[4,4,3,2,1],[4,3,2,1,0],[3,2,1,0,0],
  [0,2,0,2,0],[4,2,4,2,4],[1,3,1,3,1],[3,1,3,1,3],
  [0,1,0,1,0],[4,3,4,3,4],[2,0,2,4,2],[2,4,2,0,2],
  [0,0,2,4,4],[4,4,2,0,0],
];

const WIN_TIERS = [
  { min: 0,    max: 1.5,      tier: 'win',   label: 'Win'                 },
  { min: 1.5,  max: 5,        tier: 'big',   label: 'Big Win'             },
  { min: 5,    max: 20,       tier: 'mega',  label: 'Mega Win'            },
  { min: 20,   max: 50,       tier: 'huge',  label: 'Huge Win'            },
  { min: 50,   max: 500,      tier: 'giga',  label: 'Giga Win'            },
  { min: 500,  max: Infinity, tier: 'frito', label: 'Mega Giga Frito Win' },
];

function getTier(mult) {
  return WIN_TIERS.find(t => mult >= t.min && mult < t.max) || WIN_TIERS[0];
}

// ─── LOSOWANIE ────────────────────────────────────────────────────────────────
function drumRnd() {
  let r = Math.random() * DRUM_TOT;
  for (let i = 0; i < SYMS.length; i++) { r -= DRUM_W[i]; if (r <= 0) return i; }
  return 0;
}

function drumRndPit() {
  let r = Math.random() * PIT_DRUM_TOT;
  for (let i = 0; i < SYMS.length; i++) { r -= DRUM_W[i]; if (r <= 0) return i; }
  return IDX_LOCK;
}

function drawOutcome(totBet) {
  const r = Math.random();
  // 73.9% — brak wygranej
  if (r < 0.739)  return { type: 'none',  payout: 0, mult: 0 };
  // 20% — Win: 0.3x-1.5x
  if (r < 0.939)  { const m = 0.3 + Math.random() * 1.2;  return { type: 'win',   payout: Math.round(m * totBet), mult: m }; }
  // 3% — Big Win: 1.5x-4x
  if (r < 0.969)  { const m = 1.5 + Math.random() * 2.5;  return { type: 'big',   payout: Math.round(m * totBet), mult: m }; }
  // 1.5% — Mega Win: 5x-15x
  if (r < 0.984)  { const m = 5   + Math.random() * 10;   return { type: 'mega',  payout: Math.round(m * totBet), mult: m }; }
  // 1% — Huge Win: 20x-40x
  if (r < 0.994)  { const m = 20  + Math.random() * 20;   return { type: 'huge',  payout: Math.round(m * totBet), mult: m }; }
  // 0.5% — Giga Win: 50x-100x
  if (r < 0.999)  { const m = 50  + Math.random() * 50;   return { type: 'giga',  payout: Math.round(m * totBet), mult: m }; }
  // 0.1% — Mega Giga Frito Win: 500x-1500x
  const m = 500 + Math.random() * 1000;
  return { type: 'frito', payout: Math.round(m * totBet), mult: m };
}

function buildGrid(outcome, pitMode, stickyLocks) {
  const rndFn = pitMode ? drumRndPit : drumRnd;
  const grid  = Array.from({ length: 5 }, () => Array(5).fill(0));

  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 5; r++) {
      const locked = stickyLocks.find(l => l.col === c && l.row === r);
      grid[c][r] = locked ? IDX_LOCK : rndFn();
    }
  }

  if (outcome.type === 'none') return grid;

  const m = outcome.mult;
  let symIdx, streak, useWild;
  if (outcome.type === 'frito') { symIdx = 0; streak = 5; useWild = true;  }
  else if (m >= 50)             { symIdx = 0; streak = 5; useWild = false; }
  else if (m >= 20)             { symIdx = 1; streak = 5; useWild = true;  }
  else if (m >= 5)              { symIdx = 1; streak = 4; useWild = false; }
  else if (m >= 1.5)            { symIdx = 2; streak = 4; useWild = false; }
  else                          { symIdx = 3 + Math.floor(Math.random() * 4); streak = 3; useWild = false; }

  for (let c = 0; c < streak; c++) {
    if (!stickyLocks.find(l => l.col === c && l.row === LINES[0][c]))
      grid[c][LINES[0][c]] = symIdx;
  }
  if (useWild && streak >= 4) {
    if (!stickyLocks.find(l => l.col === 2 && l.row === LINES[0][2]))
      grid[2][LINES[0][2]] = IDX_FRACTURE;
  }
  if (m >= 5) {
    const line2 = LINES[5];
    const s2    = Math.min(symIdx + 1, 7);
    const str2  = Math.max(3, streak - 1);
    for (let c = 0; c < str2; c++) {
      if (!stickyLocks.find(l => l.col === c && l.row === line2[c]))
        grid[c][line2[c]] = s2;
    }
  }
  return grid;
}

function calcLines(grid, betPerLine, activeLines) {
  const wins = [];
  for (let li = 0; li < Math.min(activeLines, LINES.length); li++) {
    const line = LINES[li];
    let first = -1, streak = 0;
    for (let c = 0; c < 5; c++) {
      const si = grid[c][line[c]]; const s = SYMS[si];
      if (s.scatter) break;
      if (s.wild)    { streak++; continue; }
      if (first === -1)      { first = si; streak++; }
      else if (si === first) { streak++; }
      else break;
    }
    if (first === -1) continue;
    const pay = SYMS[first].p[streak] || 0;
    if (pay > 0) wins.push({ li, line: [...line], streak, symIdx: first, lineWin: pay * betPerLine });
  }
  return wins;
}

// ─── STAN GRACZY ──────────────────────────────────────────────────────────────
// Przeniesienie do Redis zalecane przy multi-instance deploymencie
const playerState = new Map();

function getState(userId) {
  if (!playerState.has(userId)) {
    playerState.set(userId, {
      pitMeter:    0,
      freeSpins:   0,
      freeMode:    null,      // 'scatter' | 'pit' | null
      stickyLocks: [],        // [{col, row}]
      betPerLine:  0,
      activeLines: 50,
    });
  }
  return playerState.get(userId);
}

// ─── SOCKET HANDLER ───────────────────────────────────────────────────────────
function registerHandlers(socket, io, casino) {
  socket.on('casinoPathSpin', async (data) => {
    const { tableId, bet, lines = 50 } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'path_of_gambling')
      return socket.emit('casinoError', { message: 'Zły stół' });

    const discordUser = socket.getDiscordUser(data);
    if (!discordUser)
      return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord!' });

    const state  = getState(discordUser.id);
    const isFree = state.freeSpins > 0;
    const cfg    = table.config;

    // ── Stawka i pobranie AT$ ─────────────────────────────────────────────────
    let betPerLine, activeLines, totBet;
    if (isFree) {
      // FREE SPIN — zachowana stawka, brak pobrania z portfela
      betPerLine  = state.betPerLine;
      activeLines = state.activeLines;
      totBet      = betPerLine * activeLines;
    } else {
      betPerLine  = Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(bet)   || cfg.minBet));
      activeLines = Math.max(1,          Math.min(50,          Number(lines) || 50));
      totBet      = betPerLine * activeLines;

      const wallet = await casino.ensureWallet(discordUser);
      if (wallet.balance < totBet)
        return socket.emit('casinoError', {
          message: `Za mało AT$! Masz ${wallet.balance} AT$, potrzebujesz ${totBet} AT$`,
        });
      await casino.updateBalance(discordUser.id, -totBet);
    }

    // ── Spin ─────────────────────────────────────────────────────────────────
    const pitMode  = (state.freeMode === 'pit');
    const outcome  = drawOutcome(totBet);
    const grid     = buildGrid(outcome, pitMode, state.stickyLocks);
    const winLines = calcLines(grid, betPerLine, activeLines);

    // ── Scatter — Reflecting Mist (tylko poza free spinami) ──────────────────
    let freeSpinsAwarded = 0;
    let scatterCount = 0;
    for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++)
      if (SYMS[grid[c][r]].scatter) scatterCount++;

    if (!isFree && scatterCount >= 3) {
      freeSpinsAwarded  = scatterCount === 3 ? 8 : scatterCount === 4 ? 12 : 20;
      state.freeSpins   = freeSpinsAwarded;
      state.freeMode    = 'scatter';
      state.betPerLine  = betPerLine;
      state.activeLines = activeLines;
      state.stickyLocks = [];
    }

    // ── Sticky Lock — nowe Lock'i pojawiające się w trybie Pit ───────────────
    const newLocks = [];
    if (pitMode) {
      for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) {
        if (grid[c][r] === IDX_LOCK && !state.stickyLocks.find(l => l.col === c && l.row === r)) {
          state.stickyLocks.push({ col: c, row: r });
          newLocks.push({ col: c, row: r });
        }
      }
    }

    // ── Wypłata ───────────────────────────────────────────────────────────────
    const payout = outcome.payout;
    if (payout > 0) await casino.updateBalance(discordUser.id, payout);
    await casino.recordGame(discordUser.id);

    // ── Pit Meter (aktualizuj tylko w normalnych spinach) ─────────────────────
    let pitTriggered = false;
    if (!isFree) {
      if (payout > 0) {
        state.pitMeter = 0; // wygrana resetuje licznik
      } else {
        state.pitMeter++;
        if (state.pitMeter >= PIT_THRESHOLD) {
          state.pitMeter    = 0;
          pitTriggered      = true;
          state.freeSpins   = PIT_FREE_SPINS;
          state.freeMode    = 'pit';
          state.betPerLine  = betPerLine;
          state.activeLines = activeLines;
          state.stickyLocks = [];
          freeSpinsAwarded  = PIT_FREE_SPINS;
        }
      }
    }

    // ── Odliczanie free spinów ────────────────────────────────────────────────
    let freeSpinsRemaining = 0;
    if (isFree) {
      state.freeSpins--;
      if (state.freeSpins <= 0) {
        state.freeSpins   = 0;
        state.freeMode    = null;
        state.stickyLocks = [];
      }
      freeSpinsRemaining = state.freeSpins;
    }

    // ── Emit ──────────────────────────────────────────────────────────────────
    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
    const mult       = totBet > 0 ? payout / totBet : 0;
    const tier       = getTier(mult);

    socket.emit('casinoPathResult', {
      grid,
      winLines,
      payout,
      net:               payout - (isFree ? 0 : totBet),
      balance:           newBalance,
      bet:               betPerLine,
      activeLines,
      totBet:            isFree ? 0 : totBet,
      mult,
      tier:              tier.tier,
      label:             tier.label,
      // Free spiny
      isFree,
      freeSpinsAwarded,
      freeSpinsRemaining,
      freeMode:          state.freeMode,
      // Pit Meter
      pitMeter:          state.pitMeter,
      pitThreshold:      PIT_THRESHOLD,
      pitTriggered,
      // Sticky Lock
      stickyLocks:       [...state.stickyLocks],
      newLocks,
      // Meta dla frontendu
      syms: SYMS.map(s => ({
        img:     s.img,
        n:       s.n,
        id:      s.id,
        color:   s.color,
        rarity:  s.rarity,
        wild:    !!s.wild,
        sticky:  !!s.sticky,
        scatter: !!s.scatter,
      })),
      lines: LINES,
      rows:  5,
    });
  });
}

module.exports = { registerHandlers, SYMS, LINES, WIN_TIERS, PIT_THRESHOLD, PIT_FREE_SPINS };
