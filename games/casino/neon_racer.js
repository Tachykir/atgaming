/**
 * NEON RACER — AT Gaming Casino
 * 5 bębnów × 3 rzędy, Both Ways (od lewej i prawej), Speed Meter + Turbo Round
 *
 * Mechanika:
 *  - Wygrane liczone od lewej ORAZ od prawej jednocześnie
 *  - Speed Meter: rośnie 5-15% losowo co spin → po 100% = Turbo Round
 *  - Turbo Round: 5 spinów z mnożnikiem x3 + Expanding Wilds (cały bęben)
 *  - Symbol "Nitro" (Scatter) = natychmiastowo +35% do Speed Meter
 *  - 3+ Nitro = 8/12/20 Free Spins (w Turbo Round jeśli aktywny)
 *  - Symbol "Headlights" (Wild) = expanding (zajmuje cały bęben)
 *  - Hasło dostępu: 12345
 */
'use strict';

const ACCESS_PASSWORD = '12345';
const COLS = 5;
const ROWS = 3;
const TURBO_SPINS = 5;
const TURBO_MULT  = 3;
const SPEED_PER_SPIN_MIN = 5;
const SPEED_PER_SPIN_MAX = 15;

const SYMS = [
  { id: 'car',     e: '🏎️', n: 'Samochód',         w: 2,  p: [0,0,5,20,80,250]  },
  { id: 'trophy',  e: '🏆', n: 'Trofeum',           w: 3,  p: [0,0,3,12,50,160]  },
  { id: 'helmet',  e: '⛑️',  n: 'Kask',              w: 5,  p: [0,0,2, 8,30,100]  },
  { id: 'wheel',   e: '🎡', n: 'Kierownica',        w: 7,  p: [0,0,2, 5,18, 60]  },
  { id: 'fuel',    e: '⛽', n: 'Paliwo',            w: 9,  p: [0,0,1, 3,12, 40]  },
  { id: 'flag',    e: '🏁', n: 'Flaga',             w: 11, p: [0,0,1, 2, 8, 25]  },
  { id: 'coin',    e: '🪙', n: 'Moneta',            w: 12, p: [0,0,1, 2, 5, 15]  },
  { id: 'lights',  e: '💡', n: 'Reflektory (Wild)', w: 2,  p: [0,0,8,30,120,400], wild: true, expanding: true },
  { id: 'nitro',   e: '💨', n: 'Nitro (Scatter)',   w: 4,  p: [0,0,0, 0,  0,  0], scatter: true, nitro: true },
];

const IDX = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const DRUM_W   = SYMS.map(s => s.w);
const DRUM_TOT = DRUM_W.reduce((a, b) => a + b, 0);

const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],
  [0,1,2,1,0],[2,1,0,1,2],[0,0,1,0,0],[2,2,1,2,2],
  [0,0,0,0,1],[1,0,0,0,0],[2,2,2,2,1],[1,2,2,2,2],
  [0,1,0,1,0],[1,0,1,0,1],[1,2,1,2,1],[2,1,2,1,2],
  [0,1,1,1,0],[2,1,1,1,2],[1,1,0,1,1],[1,1,2,1,1],
  [0,2,0,2,0],[2,0,2,0,2],
];

const WIN_TIERS = [
  { min: 0,   max: 1.5,      tier: 'win',   label: 'Win'                },
  { min: 1.5, max: 5,        tier: 'big',   label: 'Big Win'            },
  { min: 5,   max: 20,       tier: 'mega',  label: 'Mega Win'           },
  { min: 20,  max: 50,       tier: 'huge',  label: 'Huge Win'           },
  { min: 50,  max: 500,      tier: 'giga',  label: 'Giga Win'           },
  { min: 500, max: Infinity, tier: 'frito', label: '🏎️ Neon Jackpot!'  },
];
function getTier(m) { return WIN_TIERS.find(t => m >= t.min && m < t.max) || WIN_TIERS[0]; }

const playerStates = {};
function getState(id) {
  if (!playerStates[id]) playerStates[id] = { freeSpins: 0, betPerLine: 10, activeLines: 20, speedMeter: 0, turboSpins: 0 };
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

// Applying expanding wilds — bęben z wild = cały bęben to wild
function applyExpanding(grid) {
  const g = grid.map(col => [...col]);
  for (let c = 0; c < COLS; c++) {
    if (grid[c].some(r => SYMS[r].expanding)) {
      for (let r = 0; r < ROWS; r++) g[c][r] = IDX.lights;
    }
  }
  return g;
}

// Both Ways: licz od lewej i od prawej
function calcBothWays(grid, betPerLine, activeLines) {
  const wins = [];

  const calcDir = (fromRight) => {
    for (let li = 0; li < Math.min(activeLines, LINES.length); li++) {
      const rawLine = LINES[li];
      const line = fromRight ? [...rawLine].reverse() : rawLine;

      const firstSym = SYMS[grid[fromRight ? COLS-1 : 0][line[0]]];
      if (firstSym.scatter) continue;

      let count = 1;
      const matchId = firstSym.wild ? null : firstSym.id;
      for (let ci = 1; ci < COLS; ci++) {
        const colIdx = fromRight ? COLS - 1 - ci : ci;
        const s = SYMS[grid[colIdx][line[ci]]];
        if (s.wild || s.id === matchId) count++;
        else break;
      }
      if (count < 3) continue;
      const sym = matchId ? SYMS[IDX[matchId]] : SYMS.find(s => s.wild);
      const pay = sym.p[count] || 0;
      if (pay > 0) wins.push({ line: li, count, symId: sym.id, pay, payout: pay * betPerLine, dir: fromRight ? 'right' : 'left' });
    }
  };

  calcDir(false);
  calcDir(true);
  return wins;
}

function registerHandlers(socket, io, casino) {
  socket.on('casinoNRSpin', async (data) => {
    const { tableId, bet, lines = 20, password } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'neon_racer')
      return socket.emit('casinoError', { message: 'Zły stół' });

    if (password !== ACCESS_PASSWORD)
      return socket.emit('casinoError', { message: 'Nieprawidłowe hasło dostępu!' });

    const discordUser = socket.getDiscordUser(data);
    if (!discordUser)
      return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord!' });

    const state  = getState(discordUser.id);
    const cfg    = table.config;
    const isFree = state.freeSpins > 0;
    const isTurbo = state.turboSpins > 0;

    let betPerLine, activeLines, totBet;
    if (isFree) {
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

    // Speed Meter
    const speedGain = Math.floor(Math.random() * (SPEED_PER_SPIN_MAX - SPEED_PER_SPIN_MIN + 1)) + SPEED_PER_SPIN_MIN;
    let turboTriggered = false;
    let previousSpeed = state.speedMeter;

    if (!isTurbo) {
      state.speedMeter = Math.min(100, state.speedMeter + speedGain);
      if (state.speedMeter >= 100) {
        state.speedMeter = 0;
        state.turboSpins = TURBO_SPINS;
        turboTriggered   = true;
      }
    }

    const rawGrid  = buildGrid();
    const grid     = applyExpanding(rawGrid);

    // Scatter (Nitro) — speed boost
    let scatterCount = 0;
    let nitroSpeedBoost = 0;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (SYMS[rawGrid[c][r]].nitro) { scatterCount++; }
    }
    if (scatterCount > 0 && !isTurbo) {
      nitroSpeedBoost = scatterCount * 35;
      state.speedMeter = Math.min(100, state.speedMeter + nitroSpeedBoost);
      if (state.speedMeter >= 100 && !turboTriggered) {
        state.speedMeter = 0;
        state.turboSpins = TURBO_SPINS;
        turboTriggered   = true;
      }
    }

    let freeSpinsAwarded = 0;
    if (!isFree && !isTurbo && scatterCount >= 3) {
      freeSpinsAwarded = scatterCount === 3 ? 8 : scatterCount === 4 ? 12 : 20;
      state.freeSpins  = freeSpinsAwarded;
      state.betPerLine = betPerLine;
      state.activeLines = activeLines;
    }

    const winLines  = calcBothWays(grid, betPerLine, activeLines);
    let rawPayout   = winLines.reduce((s, l) => s + l.payout, 0);

    // Turbo mnożnik
    const activeMult = (isTurbo || turboTriggered) ? TURBO_MULT : 1;
    let payout = Math.round(rawPayout * activeMult);

    if (isTurbo) { state.turboSpins--; }

    let freeSpinsRemaining = 0;
    if (isFree) { state.freeSpins--; freeSpinsRemaining = state.freeSpins; }

    if (payout > 0) await casino.updateBalance(discordUser.id, payout);
    await casino.recordGame(discordUser.id);
    await casino.updateSlotStats(discordUser.id, 'neon_racer', {
      spins: 1, spent: isFree ? 0 : totBet, won: payout, bestWin: payout,
    });

    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
    const mult = totBet > 0 ? payout / totBet : payout > 0 ? 10 : 0;
    const tierObj = getTier(mult);

    socket.emit('casinoNRResult', {
      grid,
      rawGrid,
      winLines,
      rawPayout,
      payout,
      balance:            newBalance,
      totBet:             isFree ? 0 : totBet,
      isFree,
      freeSpinsAwarded,
      freeSpinsRemaining,
      isTurbo:            isTurbo || turboTriggered,
      turboSpinsLeft:     state.turboSpins,
      turboTriggered,
      turboMult:          activeMult,
      speedMeter:         state.speedMeter,
      previousSpeed,
      speedGain:          turboTriggered ? 0 : speedGain,
      nitroSpeedBoost,
      scatterCount,
      mult,
      tier:               tierObj.tier,
      label:              tierObj.label,
      syms:               SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, wild: !!s.wild, scatter: !!s.scatter, expanding: !!s.expanding, nitro: !!s.nitro })),
      lines:              LINES,
      activeLines,
    });
  });
}

module.exports = { registerHandlers, SYMS, LINES };
