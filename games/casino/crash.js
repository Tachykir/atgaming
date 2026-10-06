/**
 * CRASH — AT Gaming Casino
 * Mnożnik rośnie, gracze muszą wypłacić (cash-out) zanim nastąpi crash.
 * Wszyscy gracze przy stole biorą udział w tej samej rundzie.
 * Obsługuje auto cash-out (gracz ustawia docelowy mnożnik przy zakładzie).
 */
'use strict';

const BETTING_SECONDS = 7;
const PAUSE_AFTER_CRASH_MS = 3500;
const TICK_MS = 100;
const GROWTH = 0.07;          // multiplier = e^(GROWTH * t)
const MAX_MULT = 1000;

// P(crash >= x) = RTP / x  (domyślnie RTP 96%, ustawiane w panelu admina)
function generateCrashPoint(rtp = 0.96) {
  const r = Math.random();
  const x = rtp / (1 - r);
  return Math.min(MAX_MULT, Math.max(1, Math.floor(x * 100) / 100));
}

function multAt(elapsedMs) {
  return Math.floor(Math.exp(GROWTH * elapsedMs / 1000) * 100) / 100;
}

function buildPublicState(gs, table) {
  const bets = {};
  for (const [id, b] of Object.entries(gs.bets)) {
    bets[id] = { amount: b.amount, name: b.name, avatar: b.avatar, cashedOut: b.cashedOut, cashOutAt: b.cashOutAt, winAmount: b.winAmount, autoCashout: b.autoCashout || null };
  }
  return {
    tableId: table.id,
    phase: gs.phase,
    currentMultiplier: gs.currentMultiplier,
    crashPoint: gs.phase === 'crashed' ? gs.crashPoint : null,
    bets,
    history: gs.history || [],
    bettingTimeLeft: gs.bettingTimeLeft || 0,
    bettingSeconds: BETTING_SECONDS,
    growth: GROWTH,
    elapsedMs: gs.phase === 'running' ? Date.now() - gs.startTime : 0,
    minBet: table.config.minBet,
    maxBet: table.config.maxBet,
  };
}

function sendState(table, socket) {
  if (table.gameState) socket.emit('casinoCrashState', buildPublicState(table.gameState, table));
}

async function settleCashout(table, io, casino, discordId, mult, socket) {
  const gs = table.gameState;
  const bet = gs.bets[discordId];
  if (!bet || bet.cashedOut) return;
  bet.cashedOut = true;
  bet.cashOutAt = mult;
  bet.winAmount = Math.floor(bet.amount * mult);
  await casino.updateBalance(discordId, bet.winAmount);
  casino.tracker?.track('crash', { wagered: 0, returned: bet.winAmount, rounds: 0 });
  const balance = (await casino.getWallet(discordId))?.balance ?? 0;
  const payload = { tableId: table.id, discordId, multiplier: mult, winAmount: bet.winAmount, net: bet.winAmount - bet.amount, balance };
  if (socket) socket.emit('casinoCrashCashedOut', payload);
  else if (bet.socketId) io.to(bet.socketId).emit('casinoCrashCashedOut', payload);
  io.to('casino:' + table.id).emit('casinoCrashState', buildPublicState(gs, table));
}

function registerHandlers(socket, io, casino) {
  socket.on('casinoCrashBet', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'crash') return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });

    const gs = table.gameState;
    if (!gs || gs.phase !== 'betting') return socket.emit('casinoError', { message: 'Zakłady przyjmowane tylko przed startem rundy!' });

    await casino.exclusive('crash:' + discordUser.id, async () => {
      if (gs.bets[discordUser.id]) return socket.emit('casinoError', { message: 'Już postawiłeś w tej rundzie!' });
      const cfg = table.config;
      const betAmt = Math.floor(Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(data.bet) || cfg.minBet)));
      const auto = Number(data.autoCashout);
      const autoCashout = Number.isFinite(auto) && auto >= 1.01 ? Math.min(MAX_MULT, Math.floor(auto * 100) / 100) : null;

      const balance = await casino.debit(discordUser.id, betAmt);
      if (balance === null) return socket.emit('casinoError', { message: 'Za mało AT$!' });
      if (table.gameState !== gs || gs.phase !== 'betting') {
        await casino.updateBalance(discordUser.id, betAmt);
        return socket.emit('casinoError', { message: 'Runda już wystartowała' });
      }
      await casino.ensureWallet(discordUser);
      casino.tracker?.track('crash', { wagered: betAmt, returned: 0 });
      gs.bets[discordUser.id] = {
        amount: betAmt, autoCashout, socketId: socket.id,
        name: discordUser.globalName || discordUser.username, avatar: discordUser.avatar,
        cashedOut: false, cashOutAt: null, winAmount: 0,
      };
      socket.emit('casinoCrashBetPlaced', { tableId: table.id, amount: betAmt, autoCashout, balance });
      io.to('casino:' + table.id).emit('casinoCrashState', buildPublicState(gs, table));
    });
  });

  socket.on('casinoCrashCashOut', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'crash') return;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;
    const gs = table.gameState;
    if (!gs || gs.phase !== 'running') return socket.emit('casinoError', { message: 'Runda nie trwa!' });
    const bet = gs.bets[discordUser.id];
    if (!bet) return socket.emit('casinoError', { message: 'Nie postawiłeś w tej rundzie!' });
    if (bet.cashedOut) return;
    // Mnożnik liczony dokładnie w momencie żądania (nie z ostatniego ticka)
    const mult = Math.min(multAt(Date.now() - gs.startTime), gs.crashPoint);
    if (mult >= gs.crashPoint) return; // za późno
    await settleCashout(table, io, casino, discordUser.id, mult, socket);
  });
}

function startCrashLoop(table, io, casino) {
  const gs = table.gameState;
  const tableId = table.id;
  const room = 'casino:' + tableId;

  async function runRound() {
    if (!casino.casinoTables[tableId]) return;

    gs.phase = 'betting';
    gs.bets = {};
    gs.currentMultiplier = 1.00;
    gs.crashPoint = generateCrashPoint(casino.rtp ? casino.rtp.target('crash') : 0.96);
    gs.bettingTimeLeft = BETTING_SECONDS;
    table.status = 'betting';
    io.to(room).emit('casinoCrashState', buildPublicState(gs, table));

    for (let i = BETTING_SECONDS - 1; i >= 0; i--) {
      await sleep(1000);
      if (!casino.casinoTables[tableId]) return;
      gs.bettingTimeLeft = i;
      io.to(room).emit('casinoCrashState', buildPublicState(gs, table));
    }

    gs.phase = 'running';
    table.status = 'playing';
    gs.startTime = Date.now();
    gs.currentMultiplier = 1.00;
    io.to(room).emit('casinoCrashState', buildPublicState(gs, table));

    await new Promise(resolve => {
      const tick = async () => {
        if (!casino.casinoTables[tableId]) return resolve();
        const m = multAt(Date.now() - gs.startTime);
        if (m >= gs.crashPoint) { gs.currentMultiplier = gs.crashPoint; return resolve(); }
        gs.currentMultiplier = m;
        // Auto cash-out
        for (const [id, b] of Object.entries(gs.bets)) {
          if (!b.cashedOut && b.autoCashout && m >= b.autoCashout) {
            await settleCashout(table, io, casino, id, b.autoCashout, null);
          }
        }
        io.to(room).emit('casinoCrashTick', { tableId, multiplier: m });
        setTimeout(tick, TICK_MS);
      };
      setTimeout(tick, TICK_MS);
    });
    if (!casino.casinoTables[tableId]) return;

    // Auto cash-out ustawiony dokładnie na crash point lub niżej, którego tick nie złapał
    for (const [id, b] of Object.entries(gs.bets)) {
      if (!b.cashedOut && b.autoCashout && b.autoCashout < gs.crashPoint) {
        await settleCashout(table, io, casino, id, b.autoCashout, null);
      }
    }

    gs.phase = 'crashed';
    table.status = 'results';
    for (const id of Object.keys(gs.bets)) await casino.recordGame(id).catch(() => {});
    gs.history = [{ crashPoint: gs.crashPoint }, ...(gs.history || [])].slice(0, 25);
    io.to(room).emit('casinoCrashState', buildPublicState(gs, table));

    await sleep(PAUSE_AFTER_CRASH_MS);
    if (casino.casinoTables[tableId]) runRound();
  }

  runRound().catch(e => { console.error('Crash loop error:', e); setTimeout(() => startCrashLoop(table, io, casino), 5000); });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { registerHandlers, startCrashLoop, sendState, generateCrashPoint };
