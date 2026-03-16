/**
 * DRAGON HOARD — AT Gaming Casino
 * Siatka 4 bębny × 5 rzędów, Hold & Respin
 *
 * Mechanika:
 *  - Gdy w normalnym spinie wylądują 3+ Dragon Gems → Respin Mode
 *  - Podczas Respin Mode: gemy zostają zablokowane (Hold), reszta kręci 3 razy
 *  - Każdy nowy gem przedłuża respin o +3
 *  - Gemy mają wartości: Mini/Minor/Major/Grand Jackpot
 *  - Symbol Smoka (Wild) = wild na wszystkich rzędach swojego bębna (Expanding Wild)
 *  - Symbol Ognia (Scatter) = 3+ → 8/12/20 Free Spins
 *  - Hasło dostępu: 12345
 */
'use strict';

const ACCESS_PASSWORD = '12345';

const COLS = 4;
const ROWS = 5;

const SYMS = [
  { id: 'crown',   e: '👑', n: 'Korona',         w: 2,  p: [0,0,0,8,30,120,500] },
  { id: 'sword',   e: '⚔️',  n: 'Miecz',          w: 3,  p: [0,0,0,5,18, 70,250] },
  { id: 'shield',  e: '🛡️',  n: 'Tarcza',         w: 5,  p: [0,0,0,3,10, 40,150] },
  { id: 'potion',  e: '🧪',  n: 'Mikstura',       w: 7,  p: [0,0,0,2, 6, 22, 80] },
  { id: 'scroll',  e: '📜',  n: 'Zwój',           w: 9,  p: [0,0,0,1, 4, 14, 50] },
  { id: 'coin',    e: '🪙',  n: 'Złota Moneta',   w: 10, p: [0,0,1,1, 3,  9, 30] },
  { id: 'dragon',  e: '🐉',  n: 'Smok (Wild)',    w: 2,  p: [0,0,0,10,50,200,800], wild: true, expanding: true },
  { id: 'fire',    e: '🔥',  n: 'Ogień (Scatter)',w: 3,  p: [0,0,0, 0, 0,  0,  0], scatter: true },
  // Gemy — Hold & Respin
  { id: 'gem_mini',  e: '💠', n: 'Gem Mini',    w: 4,  gem: true, gemTier: 'mini'  },
  { id: 'gem_minor', e: '🔷', n: 'Gem Minor',   w: 3,  gem: true, gemTier: 'minor' },
  { id: 'gem_major', e: '💎', n: 'Gem Major',   w: 2,  gem: true, gemTier: 'major' },
  { id: 'gem_grand', e: '🌟', n: 'Gem Grand',   w: 1,  gem: true, gemTier: 'grand' },
];

const IDX = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const DRUM_W   = SYMS.map(s => s.w);
const DRUM_TOT = DRUM_W.reduce((a, b) => a + b, 0);

// Podczas Respin gemy mają wyższą wagę
const RESPIN_W   = [...DRUM_W];
RESPIN_W[IDX.gem_mini]  = 10;
RESPIN_W[IDX.gem_minor] = 7;
RESPIN_W[IDX.gem_major] = 4;
RESPIN_W[IDX.gem_grand] = 2;
const RESPIN_TOT = RESPIN_W.reduce((a, b) => a + b, 0);

const JACKPOTS = {
  low:    { mini: 200,    minor: 1000,    major: 5000,    grand: 25000    },
  medium: { mini: 2000,   minor: 10000,   major: 50000,   grand: 250000   },
  high:   { mini: 20000,  minor: 100000,  major: 500000,  grand: 2500000  },
};

const LINES = [
  [2,2,2,2],[0,0,0,0],[4,4,4,4],[1,1,1,1],[3,3,3,3],
  [0,1,2,1],[4,3,2,3],[0,1,2,3],[4,3,2,1],
  [1,0,1,0],[3,4,3,4],[0,2,4,2],[4,2,0,2],
  [0,0,1,2],[2,2,1,0],[0,1,1,1],[4,3,3,3],
  [2,1,0,1],[2,3,4,3],[1,2,3,2],[3,2,1,2],
];

const WIN_TIERS = [
  { min: 0,    max: 1.5,  tier: 'win',   label: 'Win'               },
  { min: 1.5,  max: 5,    tier: 'big',   label: 'Big Win'           },
  { min: 5,    max: 20,   tier: 'mega',  label: 'Mega Win'          },
  { min: 20,   max: 50,   tier: 'huge',  label: 'Huge Win'          },
  { min: 50,   max: 500,  tier: 'giga',  label: 'Giga Win'          },
  { min: 500,  max: Infinity, tier: 'frito', label: 'Dragon Jackpot! 🐉' },
];

function getTier(mult) {
  return WIN_TIERS.find(t => mult >= t.min && mult < t.max) || WIN_TIERS[0];
}

// ── Stan per gracz ─────────────────────────────────────────────────────────
const playerStates = {};
function getState(id) {
  if (!playerStates[id]) {
    playerStates[id] = {
      freeSpins:    0,
      betPerLine:   10,
      activeLines:  20,
      respinMode:   false,
      respinsLeft:  0,
      lockedGems:   [], // [{col, row, symIdx}]
    };
  }
  return playerStates[id];
}

// ── Roll symbolu ────────────────────────────────────────────────────────────
function rollSym(isRespin = false) {
  const w = isRespin ? RESPIN_W : DRUM_W;
  const t = isRespin ? RESPIN_TOT : DRUM_TOT;
  let r = Math.random() * t;
  for (let i = 0; i < SYMS.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return SYMS.length - 1;
}

// ── Buduj siatkę ────────────────────────────────────────────────────────────
function buildGrid(isRespin = false, lockedGems = []) {
  const grid = [];
  for (let c = 0; c < COLS; c++) {
    grid.push([]);
    for (let r = 0; r < ROWS; r++) {
      const locked = lockedGems.find(g => g.col === c && g.row === r);
      if (locked) {
        grid[c].push(locked.symIdx);
      } else {
        grid[c].push(rollSym(isRespin));
      }
    }
  }
  return grid;
}

// ── Licz linie wygrywające ──────────────────────────────────────────────────
function calcLines(grid, betPerLine, activeLines) {
  const wins = [];
  for (let li = 0; li < Math.min(activeLines, LINES.length); li++) {
    const line = LINES[li];
    const firstSym = SYMS[grid[0][line[0]]];
    if (firstSym.gem || firstSym.scatter) continue;

    let count = 1;
    const matchId = firstSym.wild ? null : firstSym.id;
    for (let c = 1; c < COLS; c++) {
      const s = SYMS[grid[c][line[c]]];
      if (s.wild || (!matchId && !s.gem && !s.scatter) || s.id === matchId) count++;
      else break;
    }
    if (count < 3) continue;
    const sym = matchId ? SYMS[IDX[matchId]] : SYMS.find(s => s.wild);
    const pay = sym.p[count] || 0;
    if (pay > 0) wins.push({ line: li, count, symId: sym.id, pay, payout: pay * betPerLine });
  }
  return wins;
}

// ── Expanding Wild — zajmuje cały bęben ────────────────────────────────────
function applyExpandingWilds(grid) {
  const expanded = grid.map(col => [...col]);
  for (let c = 0; c < COLS; c++) {
    if (grid[c].some(r => SYMS[r].expanding)) {
      for (let r = 0; r < ROWS; r++) expanded[c][r] = IDX.dragon;
    }
  }
  return expanded;
}

// ── registerHandlers ────────────────────────────────────────────────────────
function registerHandlers(socket, io, casino) {
  socket.on('casinoDHSpin', async (data) => {
    const { tableId, bet, lines = 20, password } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'dragon_hoard')
      return socket.emit('casinoError', { message: 'Zły stół' });

    if (password !== ACCESS_PASSWORD)
      return socket.emit('casinoError', { message: 'Nieprawidłowe hasło dostępu!' });

    const discordUser = socket.getDiscordUser(data);
    if (!discordUser)
      return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord!' });

    const state  = getState(discordUser.id);
    const cfg    = table.config;
    const isFree = state.freeSpins > 0;
    const isRespin = state.respinMode;
    const level  = cfg.level || 'low';

    // ── Stawka ──────────────────────────────────────────────────────────────
    let betPerLine, activeLines, totBet;
    if (isFree || isRespin) {
      betPerLine  = state.betPerLine;
      activeLines = state.activeLines;
      totBet      = 0;
    } else {
      const reqTot = Math.round(Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(bet) || cfg.minBet)));
      activeLines  = Math.max(1, Math.min(LINES.length, Number(lines) || 20));
      betPerLine   = Math.round(reqTot / activeLines);
      totBet       = betPerLine * activeLines;

      const wallet = await casino.ensureWallet(discordUser);
      if (wallet.balance < totBet)
        return socket.emit('casinoError', { message: `Za mało AT$! Masz ${wallet.balance}, potrzebujesz ${totBet}` });
      await casino.updateBalance(discordUser.id, -totBet);
      state.betPerLine  = betPerLine;
      state.activeLines = activeLines;
    }

    // ── Siatka ──────────────────────────────────────────────────────────────
    let rawGrid = buildGrid(isRespin, state.lockedGems);
    const expandedGrid = applyExpandingWilds(rawGrid);

    // ── Zlicz Scattery i gemy ───────────────────────────────────────────────
    let scatterCount = 0;
    let newGems = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const s = SYMS[rawGrid[c][r]];
      if (s.scatter) scatterCount++;
      if (s.gem && !state.lockedGems.find(g => g.col === c && g.row === r)) {
        newGems.push({ col: c, row: r, symIdx: rawGrid[c][r], tier: s.gemTier });
        state.lockedGems.push({ col: c, row: r, symIdx: rawGrid[c][r] });
      }
    }

    // ── Free spiny ze scatter ───────────────────────────────────────────────
    let freeSpinsAwarded = 0;
    if (!isFree && !isRespin && scatterCount >= 3) {
      freeSpinsAwarded = scatterCount === 3 ? 8 : scatterCount === 4 ? 12 : 20;
      state.freeSpins  = freeSpinsAwarded;
    }

    // ── Trigger Respin Mode ─────────────────────────────────────────────────
    let respinTriggered = false;
    if (!isRespin && state.lockedGems.length >= 3 && !isFree) {
      state.respinMode = true;
      state.respinsLeft = 3;
      respinTriggered = true;
    } else if (isRespin) {
      if (newGems.length > 0) {
        state.respinsLeft = Math.min(state.respinsLeft + 3, 15); // każdy nowy gem +3 respiny
      }
      state.respinsLeft--;
    }

    // ── Wygrane liniowe ─────────────────────────────────────────────────────
    const winLines = calcLines(expandedGrid, betPerLine, activeLines);
    let payout = winLines.reduce((s, l) => s + l.payout, 0);

    // ── Koniec Respin Mode — wypłać jackpoty ────────────────────────────────
    let respinEnded = false;
    let jackpotWins = [];
    if (isRespin && state.respinsLeft <= 0) {
      respinEnded = true;
      const jps = JACKPOTS[level];
      for (const g of state.lockedGems) {
        const sym = SYMS[g.symIdx];
        if (sym.gemTier) {
          const amt = jps[sym.gemTier];
          jackpotWins.push({ tier: sym.gemTier, amount: amt, col: g.col, row: g.row });
          payout += amt;
        }
      }
      state.respinMode  = false;
      state.respinsLeft = 0;
      state.lockedGems  = [];
    }

    // ── Odlicz free spin ────────────────────────────────────────────────────
    let freeSpinsRemaining = 0;
    if (isFree) { state.freeSpins--; freeSpinsRemaining = state.freeSpins; }

    if (payout > 0) await casino.updateBalance(discordUser.id, payout);
    await casino.recordGame(discordUser.id);
    await casino.updateSlotStats(discordUser.id, 'dragon_hoard', {
      spins: 1, spent: totBet, won: payout, bestWin: payout,
    });

    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
    const mult = totBet > 0 ? payout / totBet : payout > 0 ? 10 : 0;
    const tierObj = getTier(mult);

    socket.emit('casinoDHResult', {
      grid:               expandedGrid,
      rawGrid,
      winLines,
      payout,
      balance:            newBalance,
      totBet,
      isFree,
      freeSpinsAwarded,
      freeSpinsRemaining,
      isRespin:           state.respinMode,
      respinsLeft:        state.respinsLeft,
      respinTriggered,
      respinEnded,
      jackpotWins,
      lockedGems:         [...state.lockedGems],
      newGems,
      scatterCount,
      mult,
      tier:               tierObj.tier,
      label:              tierObj.label,
      syms:               SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, wild: !!s.wild, scatter: !!s.scatter, gem: !!s.gem, gemTier: s.gemTier || null, expanding: !!s.expanding })),
      lines:              LINES,
      jackpots:           JACKPOTS[level],
      activeLines,
    });
  });
}

module.exports = { registerHandlers, SYMS, LINES };
