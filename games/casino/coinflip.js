/**
 * COINFLIP — AT Gaming Casino
 * Gracz vs gracz: jeden rzuca, drugi przyjmuje wyzwanie
 * Można też grać solo (vs dom)
 */
'use strict';

function registerHandlers(socket, io, casino) {

  // Utwórz wyzwanie coinflip
  socket.on('casinoCoinflipCreate', async (data) => {
    const { tableId, bet, side } = data; // side: 'heads' | 'tails'
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'coinflip') return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });

    const cfg = table.config;
    const betAmt = Math.max(1, Number(bet) || cfg.minBet);
    const wallet = await casino.ensureWallet(discordUser);
    if (wallet.balance < betAmt) return socket.emit('casinoError', { message: `Za mało AT$! Masz ${wallet.balance}` });
    if (!['heads', 'tails'].includes(side)) return socket.emit('casinoError', { message: 'Wybierz: heads lub tails' });

    await casino.updateBalance(discordUser.id, -betAmt);

    const challengeId = `cf_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    table.gameState.challenges = table.gameState.challenges || {};
    table.gameState.challenges[challengeId] = {
      id: challengeId,
      creator: { id: discordUser.id, name: discordUser.globalName || discordUser.username, avatar: discordUser.avatar },
      side,
      bet: betAmt,
      status: 'open',       // open | accepted | done
      createdAt: Date.now(),
    };

    socket.emit('casinoCoinflipCreated', { challengeId, bet: betAmt, side });
    io.to('casino:' + tableId).emit('casinoCoinflipState', buildPublicState(table.gameState));
  });

  // Przyjmij wyzwanie (drugi gracz)
  socket.on('casinoCoinflipAccept', async (data) => {
    const { tableId, challengeId } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'coinflip') return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });

    const challenge = table.gameState.challenges?.[challengeId];
    if (!challenge) return socket.emit('casinoError', { message: 'Wyzwanie nie istnieje' });
    if (challenge.status !== 'open') return socket.emit('casinoError', { message: 'Wyzwanie już przyjęte!' });
    if (challenge.creator.id === discordUser.id) return socket.emit('casinoError', { message: 'Nie możesz przyjąć własnego wyzwania!' });

    // FIX #2: Ustaw status PRZED pierwszym await, żeby uniknąć race condition
    // (Node.js single-thread, ale między await mogą dojść inne eventy)
    challenge.status = 'flipping';

    const wallet = await casino.ensureWallet(discordUser);
    if (wallet.balance < challenge.bet) {
      challenge.status = 'open'; // Cofnij jeśli brak środków
      return socket.emit('casinoError', { message: `Za mało AT$! Masz ${wallet.balance}` });
    }

    await casino.updateBalance(discordUser.id, -challenge.bet);
    challenge.opponent = { id: discordUser.id, name: discordUser.globalName || discordUser.username, avatar: discordUser.avatar };

    io.to('casino:' + tableId).emit('casinoCoinflipState', buildPublicState(table.gameState));

    // Animacja — 1.5s potem wynik
    await sleep(1500);

    // Sprawdź ponownie czy wyzwanie nadal istnieje (mogło zostać usunięte podczas sleep)
    if (!table.gameState.challenges?.[challengeId] || challenge.status !== 'flipping') {
      // Wyzwanie zniknęło — zwróć zakład przeciwnikowi
      await casino.updateBalance(discordUser.id, challenge.bet);
      return socket.emit('casinoError', { message: 'Wyzwanie zostało anulowane' });
    }

    const result = Math.random() < 0.5 ? 'heads' : 'tails'; // 50/50
    const creatorWins = (challenge.side === result);
    const winner = creatorWins ? challenge.creator : challenge.opponent;
    const loser  = creatorWins ? challenge.opponent : challenge.creator;
    const totalPot = challenge.bet * 2;

    await casino.updateBalance(winner.id, totalPot);
    await casino.recordGame(challenge.creator.id);
    await casino.recordGame(challenge.opponent.id);

    challenge.status = 'done';
    challenge.result = result;
    challenge.winner = winner;
    challenge.loser  = loser;
    challenge.resolvedAt = Date.now();

    // Zbierz wyniki dla obu graczy
    const creatorBalance = (await casino.getWallet(challenge.creator.id))?.balance ?? 0;
    const opponentBalance = (await casino.getWallet(challenge.opponent.id))?.balance ?? 0;

    io.to('casino:' + tableId).emit('casinoCoinflipResult', {
      challengeId,
      result,
      winner,
      loser,
      bet: challenge.bet,
      totalPot,
      creatorSide: challenge.side,
      creatorBalance,
      opponentBalance,
    });

    // Usuń wyzwanie po 8 sekundach
    setTimeout(() => {
      if (table.gameState.challenges?.[challengeId]) {
        delete table.gameState.challenges[challengeId];
        io.to('casino:' + tableId).emit('casinoCoinflipState', buildPublicState(table.gameState));
      }
    }, 8000);

    io.to('casino:' + tableId).emit('casinoCoinflipState', buildPublicState(table.gameState));
  });

  // Anuluj własne wyzwanie (zwrot)
  socket.on('casinoCoinflipCancel', async (data) => {
    const { tableId, challengeId } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'coinflip') return;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;

    const challenge = table.gameState.challenges?.[challengeId];
    if (!challenge || challenge.creator.id !== discordUser.id) return socket.emit('casinoError', { message: 'Nie możesz anulować tego wyzwania' });
    if (challenge.status !== 'open') return socket.emit('casinoError', { message: 'Nie można anulować — już przyjęte' });

    await casino.updateBalance(discordUser.id, challenge.bet);
    delete table.gameState.challenges[challengeId];
    socket.emit('casinoCoinflipCancelled', { challengeId, refund: challenge.bet });
    io.to('casino:' + tableId).emit('casinoCoinflipState', buildPublicState(table.gameState));
  });
}

function buildPublicState(gs) {
  return {
    challenges: Object.values(gs.challenges || {}).filter(c => c.status !== 'done'),
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { registerHandlers };
