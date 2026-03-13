/**
 * CRASH — AT Gaming Casino
 * Mnożnik rośnie, gracze muszą cash-out zanim crashnie
 * Wszyscy gracze przy stole uczestniczą w tej samej rundzie
 */
'use strict';

// Generuje punkt crashu z house edge ~5%
// Rozkład: P(crash >= x) = 1/x * 0.95
function generateCrashPoint() {
  const r = Math.random();
  if (r < 0.05) return 1.00; // 5% szans na instant crash
  return Math.max(1.00, Math.floor((99 / (100 * r)) * 100) / 100);
}

function registerHandlers(socket, io, casino) {

  // Gracz stawia zakład przed rundą
  socket.on('casinoCrashBet', async (data) => {
    const { tableId, bet } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'crash') return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });

    const gs = table.gameState;
    if (gs.phase !== 'betting') return socket.emit('casinoError', { message: 'Zakłady przyjmowane tylko przed runną!' });
    if (gs.bets[discordUser.id]) return socket.emit('casinoError', { message: 'Już postawiłeś w tej rundzie!' });

    const cfg = table.config;
    const betAmt = Math.max(cfg.minBet, Math.min(cfg.maxBet || 100000, Number(bet) || cfg.minBet));
    const wallet = await casino.ensureWallet(discordUser);
    if (wallet.balance < betAmt) return socket.emit('casinoError', { message: `Za mało AT$! Masz ${wallet.balance}` });

    await casino.updateBalance(discordUser.id, -betAmt);
    gs.bets[discordUser.id] = {
      amount: betAmt,
      name: discordUser.globalName || discordUser.username,
      avatar: discordUser.avatar,
      cashedOut: false,
      cashOutAt: null,
      winAmount: 0,
    };

    io.to('casino:' + tableId).emit('casinoCrashState', buildPublicState(gs, table));
  });

  // Gracz cash-out w trakcie rundy
  socket.on('casinoCrashCashOut', async (data) => {
    const { tableId } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'crash') return;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;

    const gs = table.gameState;
    if (gs.phase !== 'running') return socket.emit('casinoError', { message: 'Runda nie trwa!' });
    const playerBet = gs.bets[discordUser.id];
    if (!playerBet) return socket.emit('casinoError', { message: 'Nie postawiłeś w tej rundzie!' });
    if (playerBet.cashedOut) return socket.emit('casinoError', { message: 'Już wycofałeś środki!' });

    const currentMultiplier = gs.currentMultiplier;
    const winAmount = Math.floor(playerBet.amount * currentMultiplier);
    playerBet.cashedOut = true;
    playerBet.cashOutAt = currentMultiplier;
    playerBet.winAmount = winAmount;

    await casino.updateBalance(discordUser.id, winAmount);
    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;

    socket.emit('casinoCrashCashedOut', {
      multiplier: currentMultiplier,
      winAmount,
      net: winAmount - playerBet.amount,
      balance: newBalance,
    });
    io.to('casino:' + tableId).emit('casinoCrashState', buildPublicState(gs, table));
  });
}

function buildPublicState(gs, table) {
  return {
    tableId: table.id,
    phase: gs.phase,
    currentMultiplier: gs.currentMultiplier,
    crashPoint: gs.phase === 'crashed' ? gs.crashPoint : null,
    bets: gs.bets,
    history: gs.history || [],
    bettingTimeLeft: gs.bettingTimeLeft || 0,
  };
}

// Uruchamia pętlę gry Crash dla stołu
function startCrashLoop(table, io, casino) {
  const gs = table.gameState;
  const tableId = table.id;

  async function runRound() {
    if (!casino.casinoTables[tableId]) return; // stół usunięty

    // Faza zakładów (5 sekund)
    gs.phase = 'betting';
    gs.bets = {};
    gs.currentMultiplier = 1.00;
    gs.crashPoint = generateCrashPoint();
    gs.bettingTimeLeft = 5;
    io.to('casino:' + tableId).emit('casinoCrashState', buildPublicState(gs, table));

    // Odliczanie zakładów
    for (let i = 4; i >= 0; i--) {
      await sleep(1000);
      if (!casino.casinoTables[tableId]) return;
      gs.bettingTimeLeft = i;
      io.to('casino:' + tableId).emit('casinoCrashState', buildPublicState(gs, table));
    }

    // Faza lotu
    gs.phase = 'running';
    gs.currentMultiplier = 1.00;
    io.to('casino:' + tableId).emit('casinoCrashState', buildPublicState(gs, table));

    const tickMs = 100;
    const startTime = Date.now();

    await new Promise(resolve => {
      function tick() {
        if (!casino.casinoTables[tableId]) return resolve();
        const elapsed = (Date.now() - startTime) / 1000;
        // Wzrost wykładniczy: multiplier = e^(0.06 * t)
        gs.currentMultiplier = Math.floor(Math.exp(0.06 * elapsed) * 100) / 100;

        if (gs.currentMultiplier >= gs.crashPoint) {
          gs.currentMultiplier = gs.crashPoint;
          resolve();
        } else {
          io.to('casino:' + tableId).emit('casinoCrashTick', {
            tableId,
            multiplier: gs.currentMultiplier,
          });
          setTimeout(tick, tickMs);
        }
      }
      setTimeout(tick, tickMs);
    });

    if (!casino.casinoTables[tableId]) return;

    // Crash!
    gs.phase = 'crashed';
    // Rozlicz niezabezpieczonych graczy (nie cash-out)
    for (const [id, bet] of Object.entries(gs.bets)) {
      if (!bet.cashedOut) {
        bet.winAmount = 0;
        await casino.recordGame(id);
      } else {
        await casino.recordGame(id);
      }
    }

    gs.history = [{ crashPoint: gs.crashPoint }, ...(gs.history || [])].slice(0, 20);
    io.to('casino:' + tableId).emit('casinoCrashState', buildPublicState(gs, table));

    // Pauza 3 sekundy przed kolejną rundą
    await sleep(3000);
    if (casino.casinoTables[tableId]) runRound();
  }

  runRound();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { registerHandlers, startCrashLoop };
