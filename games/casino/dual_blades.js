/**
 * DUAL BLADES — AT Gaming Casino
 * Dwie niezależne siatki 3×3 (Lewa / Prawa), każda z 9 liniami
 *
 * Mechanika:
 *  - Obydwie siatki kręcą się jednocześnie niezależnie
 *  - Symbol "Shadow Blade" (Wild) = wild na OBYDWU siatkach w tym samym bębnie
 *  - Gdy obie mają wygraną jednocześnie → "Sync Bonus" (mnożnik x2 na obydwie)
 *  - Symbol "Eclipse" (Scatter) = 3+ łącznie na obu siatkach → 10 Free Spins
 *  - Sync Meter: rośnie przy każdym Sync Bonus → co 5 synchronizacji → +5 FS
 *  - Hasło dostępu: 12345
 */
'use strict';

const ACCESS_PASSWORD = '12345';
const COLS = 3;
const ROWS = 3;

const SYMS = [
  { id: 'blade',    e: '🗡️',  n: 'Ostrze',         w: 2,  p: [0,0,3,15,60]  },
  { id: 'katana',   e: '⚔️',  n: 'Katana',          w: 3,  p: [0,0,2,10,40]  },
  { id: 'shuriken', e: '✴️',  n: 'Shuriken',        w: 5,  p: [0,0,2, 7,25]  },
  { id: 'mask',     e: '🎭',  n: 'Maska',           w: 6,  p: [0,0,1, 5,18]  },
  { id: 'smoke',    e: '💨',  n: 'Dym',             w: 8,  p: [0,0,1, 3,12]  },
  { id: 'coin',     e: '🪙',  n: 'Moneta',          w: 10, p: [0,0,1, 2, 7]  },
  { id: 'shadow',   e: '🌑',  n: 'Shadow Blade (Wild)', w: 2, p: [0,0,5,25,100], wild: true, dualWild: true },
  { id: 'eclipse',  e: '🌒',  n: 'Eclipse (Scatter)',   w: 3, p: [0,0,0, 0,  0], scatter: true },
];

const IDX = Object.fromEntries(SYMS.map((s, i) => [s.id, i]));
const DRUM_W   = SYMS.map(s => s.w);
const DRUM_TOT = DRUM_W.reduce((a, b) => a + b, 0);

const LINES = [
  [1,1,1],[0,0,0],[2,2,2],
  [0,1,2],[2,1,0],[0,1,1],[1,1,2],[2,1,1],[1,0,1],
];

const WIN_TIERS = [
  { min: 0,   max: 1.5,      tier: 'win',   label: 'Win'              },
  { min: 1.5, max: 5,        tier: 'big',   label: 'Big Win'          },
  { min: 5,   max: 20,       tier: 'mega',  label: 'Mega Win'         },
  { min: 20,  max: 50,       tier: 'huge',  label: 'Huge Win'         },
  { min: 50,  max: 500,      tier: 'giga',  label: 'Giga Win'         },
  { min: 500, max: Infinity, tier: 'frito', label: '⚔️ Dual Jackpot!' },
];
function getTier(m) { return WIN_TIERS.find(t => m >= t.min && m < t.max) || WIN_TIERS[0]; }

const playerStates = {};
function getState(id) {
  if (!playerStates[id]) playerStates[id] = { freeSpins: 0, bet: 10, syncMeter: 0 };
  return playerStates[id];
}

function rollSym() {
  let r = Math.random() * DRUM_TOT;
  for (let i = 0; i < SYMS.length; i++) { r -= DRUM_W[i]; if (r <= 0) return i; }
  return SYMS.length - 1;
}

function buildSingleGrid(sharedWilds = []) {
  const g = [];
  for (let c = 0; c < COLS; c++) {
    g.push([]);
    for (let r = 0; r < ROWS; r++) {
      // Jeśli Shadow Blade na tej kolumnie w drugiej siatce — też wild tutaj
      if (sharedWilds.includes(c)) {
        g[c].push(IDX.shadow);
      } else {
        g[c].push(rollSym());
      }
    }
  }
  return g;
}

// Wygeneruj obydwie siatki z synchronizowanymi wildami
function buildBothGrids() {
  // Najpierw lewa, potem prawa — sprawdź gdzie są Shadow Blade w lewej
  const left = [];
  const shadowCols = [];
  for (let c = 0; c < COLS; c++) {
    left.push([]);
    let hasWild = false;
    for (let r = 0; r < ROWS; r++) {
      const s = rollSym();
      left[c].push(s);
      if (SYMS[s].dualWild) hasWild = true;
    }
    if (hasWild) shadowCols.push(c);
  }
  const right = buildSingleGrid(shadowCols);
  return { left, right, shadowCols };
}

function calcGridLines(grid, betPerLine, activeLines) {
  const wins = [];
  for (let li = 0; li < Math.min(activeLines, LINES.length); li++) {
    const line = LINES[li];
    const firstSym = SYMS[grid[0][line[0]]];
    if (firstSym.scatter) continue;
    let count = 1;
    const matchId = firstSym.wild ? null : firstSym.id;
    for (let c = 1; c < COLS; c++) {
      const s = SYMS[grid[c][line[c]]];
      if (s.wild || s.id === matchId) count++;
      else break;
    }
    if (count < 2) continue;
    const sym = matchId ? SYMS[IDX[matchId]] : SYMS.find(s => s.wild);
    const pay = sym.p[count] || 0;
    if (pay > 0) wins.push({ line: li, count, symId: sym.id, pay, payout: pay * betPerLine });
  }
  return wins;
}

function registerHandlers(socket, io, casino) {
  socket.on('casinoDBSpin', async (data) => {
    const { tableId, bet, lines = 9, password } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'dual_blades')
      return socket.emit('casinoError', { message: 'Zły stół' });

    if (password !== ACCESS_PASSWORD)
      return socket.emit('casinoError', { message: 'Nieprawidłowe hasło dostępu!' });

    const discordUser = socket.getDiscordUser(data);
    if (!discordUser)
      return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord!' });

    const state  = getState(discordUser.id);
    const cfg    = table.config;
    const isFree = state.freeSpins > 0;

    let betPerLine, activeLines, totBet;
    if (isFree) {
      betPerLine  = state.bet;
      activeLines = 9;
      totBet      = 0;
    } else {
      const reqTot = Math.round(Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(bet) || cfg.minBet)));
      activeLines  = Math.max(1, Math.min(9, Number(lines) || 9));
      betPerLine   = Math.round(reqTot / (activeLines * 2)); // x2 bo dwie siatki
      totBet       = betPerLine * activeLines * 2;
      const wallet = await casino.ensureWallet(discordUser);
      if (wallet.balance < totBet)
        return socket.emit('casinoError', { message: `Za mało AT$! Masz ${wallet.balance}, potrzebujesz ${totBet}` });
      await casino.updateBalance(discordUser.id, -totBet);
      state.bet = betPerLine;
    }

    const { left, right, shadowCols } = buildBothGrids();

    const leftWins  = calcGridLines(left, betPerLine, activeLines);
    const rightWins = calcGridLines(right, betPerLine, activeLines);

    const leftPay  = leftWins.reduce((s, l) => s + l.payout, 0);
    const rightPay = rightWins.reduce((s, l) => s + l.payout, 0);

    // Sync Bonus — obie siatki mają wygrane
    let syncBonus = false;
    let syncMult  = 1;
    if (leftPay > 0 && rightPay > 0) {
      syncBonus = true;
      syncMult  = 2;
      state.syncMeter++;
    }

    // Co 5 synchronizacji — bonus free spins
    let syncFSAwarded = 0;
    if (state.syncMeter >= 5 && !isFree) {
      syncFSAwarded    = 5;
      state.freeSpins += syncFSAwarded;
      state.bet        = betPerLine;
      state.syncMeter  = 0;
    }

    // Scatter — zlicz na obydwu siatkach
    let scatterCount = 0;
    const countSc = (g) => { for (let c=0;c<COLS;c++) for (let r=0;r<ROWS;r++) if(SYMS[g[c][r]].scatter) scatterCount++; };
    countSc(left); countSc(right);
    let freeSpinsAwarded = 0;
    if (!isFree && scatterCount >= 3) {
      freeSpinsAwarded = scatterCount === 3 ? 10 : scatterCount >= 5 ? 20 : 15;
      state.freeSpins  = freeSpinsAwarded;
      state.bet        = betPerLine;
    }

    let payout = Math.round((leftPay + rightPay) * syncMult);

    let freeSpinsRemaining = 0;
    if (isFree) { state.freeSpins--; freeSpinsRemaining = state.freeSpins; }

    if (payout > 0) await casino.updateBalance(discordUser.id, payout);
    await casino.recordGame(discordUser.id);
    await casino.updateSlotStats(discordUser.id, 'dual_blades', {
      spins: 1, spent: isFree ? 0 : totBet, won: payout, bestWin: payout,
    });

    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
    const mult = (totBet || betPerLine * 2) > 0 ? payout / (totBet || betPerLine * 2) : 0;
    const tierObj = getTier(mult);

    socket.emit('casinoDBResult', {
      leftGrid:           left,
      rightGrid:          right,
      shadowCols,
      leftWins,
      rightWins,
      leftPay,
      rightPay,
      syncBonus,
      syncMult,
      syncMeter:          state.syncMeter,
      syncFSAwarded,
      payout,
      balance:            newBalance,
      totBet:             isFree ? 0 : totBet,
      isFree,
      freeSpinsAwarded,
      freeSpinsRemaining,
      scatterCount,
      mult,
      tier:               tierObj.tier,
      label:              tierObj.label,
      syms:               SYMS.map(s => ({ id: s.id, e: s.e, n: s.n, wild: !!s.wild, scatter: !!s.scatter, dualWild: !!s.dualWild })),
      lines:              LINES,
      activeLines,
    });
  });
}

module.exports = { registerHandlers, SYMS, LINES };
