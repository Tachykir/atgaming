/**
 * AUTOMATY 5-BĘBNOWE — AT Gaming Casino
 * 5 bębnów × 3 rzędy, 50 linii wygrywających
 * RTP ~75% (bez Frito), Frito Win rate 2.5%
 */
'use strict';

const SYMS = [
  { e: '💎', n: 'Diament',    w: 2,  p: [0, 0, 8,  20, 60,  200] },
  { e: '7️⃣',  n: 'Siódemka',  w: 3,  p: [0, 0, 5,  12, 40,  120] },
  { e: '🍀', n: 'Koniczyna',  w: 4,  p: [0, 0, 4,  8,  25,  80]  },
  { e: '🔔', n: 'Dzwonek',    w: 6,  p: [0, 0, 3,  6,  18,  55]  },
  { e: '🍇', n: 'Winogrona',  w: 8,  p: [0, 0, 2,  4,  12,  35]  },
  { e: '🍊', n: 'Pomarańcza', w: 9,  p: [0, 0, 2,  3,  8,   22]  },
  { e: '🍋', n: 'Cytryna',    w: 11, p: [0, 0, 1,  2,  6,   16]  },
  { e: '🍒', n: 'Wiśnia',     w: 13, p: [0, 1, 1,  2,  4,   10]  },
  { e: '⭐', n: 'Wild',       w: 3,  p: [0, 0, 10, 30, 100, 300], wild: true    },
  { e: '💫', n: 'Scatter',    w: 4,  p: [0, 0, 0,  0,  0,   0],  scatter: true },
];
const DRUM_W   = SYMS.map(s => s.w);
const DRUM_TOT = DRUM_W.reduce((a, b) => a + b, 0);

const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],
  [0,1,2,1,0],[2,1,0,1,2],[0,0,1,0,0],[2,2,1,2,2],
  [0,0,0,0,1],[1,0,0,0,0],[2,2,2,2,1],[1,2,2,2,2],
  [0,1,0,1,0],[1,0,1,0,1],[1,2,1,2,1],[2,1,2,1,2],
  [0,1,1,1,0],[2,1,1,1,2],[1,1,0,1,1],[1,1,2,1,1],
  [0,2,0,2,0],[2,0,2,0,2],[0,2,1,2,0],[2,0,1,0,2],
  [0,1,2,2,2],[2,1,0,0,0],[0,0,0,1,2],[2,2,2,1,0],
  [1,0,0,0,1],[1,2,2,2,1],
  [1,0,1,0,1],[1,2,1,2,1],[0,0,1,2,2],[2,2,1,0,0],
  [0,1,2,2,1],[2,1,0,0,1],
  [0,1,0,1,2],[2,1,2,1,0],[1,0,1,2,1],[1,2,1,0,1],
  [0,0,1,2,1],[2,2,1,0,1],
  [0,0,0,0,2],[2,2,2,2,0],[0,2,1,0,2],[2,0,1,2,0],
  [0,1,1,2,1],[2,1,1,0,1],
  [1,1,0,1,1],[1,1,2,1,1],[0,1,1,1,2],
];

const WIN_TIERS = [
  { min: 0,    max: 1.5,      tier: 'win',   label: 'Win'                  },
  { min: 1.5,  max: 5,        tier: 'big',   label: 'Big Win'              },
  { min: 5,    max: 20,       tier: 'mega',  label: 'Mega Win'             },
  { min: 20,   max: 50,       tier: 'huge',  label: 'Huge Win'             },
  { min: 50,   max: 500,      tier: 'giga',  label: 'Giga Win'             },
  { min: 500,  max: Infinity, tier: 'frito', label: 'Mega Giga Frito Win'  },
];

function getTier(mult) {
  return WIN_TIERS.find(t => mult >= t.min && mult < t.max) || WIN_TIERS[0];
}

function drumRnd() {
  let r = Math.random() * DRUM_TOT;
  for (let i = 0; i < SYMS.length; i++) { r -= DRUM_W[i]; if (r <= 0) return i; }
  return 0;
}

function drawOutcome(totBet) {
  const r = Math.random();

  // 78.95% — brak wygranej
  if (r < 0.7895) return { type: 'none', payout: 0, mult: 0 };

  // 15% — Win: 0.3×–1.5×
  if (r < 0.9395) {
    const m = 0.3 + Math.random() * 1.2;
    return { type: 'win', payout: Math.round(m * totBet), mult: m };
  }

  // 3% — Big Win: 1.5×–4×
  if (r < 0.9695) {
    const m = 1.5 + Math.random() * 2.5;
    return { type: 'big', payout: Math.round(m * totBet), mult: m };
  }

  // 1.5% — Mega Win: 5×–15×
  if (r < 0.9845) {
    const m = 5 + Math.random() * 10;
    return { type: 'mega', payout: Math.round(m * totBet), mult: m };
  }

  // 1% — Huge Win: 20×–40×
  if (r < 0.9945) {
    const m = 20 + Math.random() * 20;
    return { type: 'huge', payout: Math.round(m * totBet), mult: m };
  }

  // 0.5% — Giga Win: 50×–100×
  if (r < 0.9995) {
    const m = 50 + Math.random() * 50;
    return { type: 'giga', payout: Math.round(m * totBet), mult: m };
  }

  // 0.05% — Mega Giga Frito Win: 500×–1500×
  const m = 500 + Math.random() * 1000;
  return { type: 'frito', payout: Math.round(m * totBet), mult: m };
}

function buildGrid(outcome) {
  const grid = Array.from({ length: 5 }, () => Array(3).fill(0));
  for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) grid[c][r] = drumRnd();
  if (outcome.type === 'none') return grid;
  const m = outcome.mult;
  let symIdx, streak, useWild;
  if (outcome.type === 'frito')      { symIdx = 0; streak = 5; useWild = true;  }
  else if (m >= 50)                  { symIdx = 0; streak = 5; useWild = false; }
  else if (m >= 20)                  { symIdx = 1; streak = 5; useWild = true;  }
  else if (m >= 5)                   { symIdx = 1; streak = 4; useWild = false; }
  else if (m >= 1.5)                 { symIdx = 2; streak = 4; useWild = false; }
  else                               { symIdx = 3 + Math.floor(Math.random() * 4); streak = 3; useWild = false; }
  for (let c = 0; c < streak; c++) grid[c][LINES[0][c]] = symIdx;
  if (useWild && streak >= 4) grid[2][LINES[0][2]] = 8;
  if (m >= 5) {
    const line2 = LINES[3];
    const s2 = Math.min(symIdx + 1, 7);
    const str2 = Math.max(3, streak - 1);
    for (let c = 0; c < str2; c++) grid[c][line2[c]] = s2;
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

function registerHandlers(socket, io, casino) {
  socket.on('casinoSlotsSpin', async (data) => {
    const { tableId, bet, lines = 50 } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'slots') return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord!' });

    const cfg = table.config;
    const betPerLine  = Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(bet) || cfg.minBet));
    const activeLines = Math.max(1, Math.min(50, Number(lines) || 50));
    const totBet      = betPerLine * activeLines;

    const wallet = await casino.ensureWallet(discordUser);
    if (wallet.balance < totBet)
      return socket.emit('casinoError', { message: `Za mało AT$! Masz ${wallet.balance} AT$, potrzebujesz ${totBet} AT$` });

    await casino.updateBalance(discordUser.id, -totBet);

    const outcome  = drawOutcome(totBet);
    const grid     = buildGrid(outcome);
    const winLines = calcLines(grid, betPerLine, activeLines);

    let scatterCount = 0;
    for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++)
      if (SYMS[grid[c][r]].scatter) scatterCount++;
    const freeSpinsAwarded = scatterCount >= 3 ? (scatterCount === 3 ? 8 : scatterCount === 4 ? 12 : 20) : 0;

    const payout = outcome.payout;
    if (payout > 0) await casino.updateBalance(discordUser.id, payout);
    await casino.recordGame(discordUser.id);

    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
    const mult       = totBet > 0 ? payout / totBet : 0;
    const tier       = getTier(mult);

    socket.emit('casinoSlotsResult', {
      grid, winLines, payout,
      net:     payout - totBet,
      balance: newBalance,
      bet:     betPerLine,
      activeLines, totBet, mult,
      tier:    tier.tier,
      label:   tier.label,
      freeSpinsAwarded,
      syms:    SYMS.map(s => ({ e: s.e, n: s.n, wild: !!s.wild, scatter: !!s.scatter })),
      lines:   LINES,
    });
  });
}

module.exports = { registerHandlers, SYMS, LINES, WIN_TIERS };
