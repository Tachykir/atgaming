/**
 * COINFLIP — AT Gaming Casino
 *  - PvP: gracz wystawia wyzwanie (strona + stawka), drugi gracz je przyjmuje; zwycięzca bierze pulę.
 *  - Solo: rzut przeciwko kasynu, wypłata ×1.96 (house edge 2%).
 */
'use strict';

const MAX_OPEN_PER_PLAYER = 3;
const SOLO_PAYOUT = 1.96;
const FLIP_MS = 1800;

function ensureState(table) {
  if (!table.gameState) table.gameState = { challenges: {}, history: [] };
  if (!table.gameState.challenges) table.gameState.challenges = {};
  if (!table.gameState.history) table.gameState.history = [];
  return table.gameState;
}

function buildPublicState(table) {
  const gs = ensureState(table);
  return {
    tableId: table.id,
    challenges: Object.values(gs.challenges).filter(c => c.status !== 'done'),
    history: gs.history,
    minBet: table.config.minBet,
    maxBet: table.config.maxBet || null,
    soloPayout: SOLO_PAYOUT,
  };
}
function broadcast(table, io) { io.to('casino:' + table.id).emit('casinoCoinflipState', buildPublicState(table)); }
function sendState(table, socket) { socket.emit('casinoCoinflipState', buildPublicState(table)); }

function pushHistory(table, entry) {
  const gs = ensureState(table);
  gs.history = [entry, ...gs.history].slice(0, 15);
}

function clampBet(table, bet) {
  const cfg = table.config;
  const b = Math.floor(Number(bet) || 0);
  if (b < cfg.minBet) return { error: `Minimalna stawka to ${cfg.minBet.toLocaleString('pl-PL')} AT$` };
  if (cfg.maxBet && b > cfg.maxBet) return { error: `Maksymalna stawka to ${cfg.maxBet.toLocaleString('pl-PL')} AT$` };
  return { bet: b };
}

const userOf = u => ({ id: u.id, name: u.globalName || u.username, avatar: u.avatar });

function registerHandlers(socket, io, casino) {
  socket.on('casinoCoinflipCreate', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'coinflip') return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });
    if (!['heads', 'tails'].includes(data.side)) return socket.emit('casinoError', { message: 'Wybierz stronę monety' });
    const { bet, error } = clampBet(table, data.bet);
    if (error) return socket.emit('casinoError', { message: error });
    const gs = ensureState(table);

    await casino.exclusive('cf:' + discordUser.id, async () => {
      const open = Object.values(gs.challenges).filter(c => c.creator.id === discordUser.id && c.status === 'open').length;
      if (open >= MAX_OPEN_PER_PLAYER) return socket.emit('casinoError', { message: `Możesz mieć max ${MAX_OPEN_PER_PLAYER} otwarte wyzwania` });
      await casino.ensureWallet(discordUser);
      const balance = await casino.debit(discordUser.id, bet);
      if (balance === null) return socket.emit('casinoError', { message: 'Za mało AT$!' });

      const id = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      gs.challenges[id] = { id, creator: userOf(discordUser), side: data.side, bet, status: 'open', createdAt: Date.now() };
      socket.emit('casinoCoinflipCreated', { challengeId: id, bet, side: data.side, balance });
      broadcast(table, io);
    });
  });

  socket.on('casinoCoinflipAccept', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'coinflip') return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });
    const gs = ensureState(table);
    const c = gs.challenges[data.challengeId];
    if (!c) return socket.emit('casinoError', { message: 'Wyzwanie nie istnieje' });
    if (c.status !== 'open') return socket.emit('casinoError', { message: 'Wyzwanie już przyjęte!' });
    if (c.creator.id === discordUser.id) return socket.emit('casinoError', { message: 'Nie możesz przyjąć własnego wyzwania!' });

    c.status = 'flipping'; // zablokuj zanim pojawi się pierwszy await
    await casino.ensureWallet(discordUser);
    const balance = await casino.debit(discordUser.id, c.bet);
    if (balance === null) {
      c.status = 'open';
      return socket.emit('casinoError', { message: 'Za mało AT$!' });
    }
    c.opponent = userOf(discordUser);
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    c.result = result;
    broadcast(table, io);
    io.to('casino:' + table.id).emit('casinoCoinflipFlip', { tableId: table.id, challengeId: c.id, result, durationMs: FLIP_MS, creator: c.creator, opponent: c.opponent, bet: c.bet, side: c.side });

    await sleep(FLIP_MS);
    const winner = c.side === result ? c.creator : c.opponent;
    const loser  = c.side === result ? c.opponent : c.creator;
    const pot = c.bet * 2;
    await casino.updateBalance(winner.id, pot);
    await casino.recordGame(c.creator.id);
    await casino.recordGame(c.opponent.id);
    c.status = 'done';
    pushHistory(table, { result, winner: winner.name, loser: loser.name, bet: c.bet, pvp: true, at: Date.now() });

    const balances = {
      [c.creator.id]:  (await casino.getWallet(c.creator.id))?.balance ?? 0,
      [c.opponent.id]: (await casino.getWallet(c.opponent.id))?.balance ?? 0,
    };
    io.to('casino:' + table.id).emit('casinoCoinflipResult', { tableId: table.id, challengeId: c.id, result, winner, loser, bet: c.bet, totalPot: pot, creatorSide: c.side, balances });
    delete gs.challenges[c.id];
    broadcast(table, io);
  });

  socket.on('casinoCoinflipCancel', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'coinflip') return;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;
    const gs = ensureState(table);
    const c = gs.challenges[data.challengeId];
    if (!c || c.creator.id !== discordUser.id) return socket.emit('casinoError', { message: 'Nie możesz anulować tego wyzwania' });
    if (c.status !== 'open') return socket.emit('casinoError', { message: 'Nie można anulować — już przyjęte' });
    c.status = 'done';
    delete gs.challenges[c.id];
    const balance = await casino.updateBalance(discordUser.id, c.bet);
    socket.emit('casinoCoinflipCancelled', { challengeId: c.id, refund: c.bet, balance });
    broadcast(table, io);
  });

  // Solo: rzut przeciwko kasynu
  socket.on('casinoCoinflipSolo', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'coinflip') return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });
    if (!['heads', 'tails'].includes(data.side)) return socket.emit('casinoError', { message: 'Wybierz stronę monety' });
    const { bet, error } = clampBet(table, data.bet);
    if (error) return socket.emit('casinoError', { message: error });

    await casino.exclusive('cf:' + discordUser.id, async () => {
      await casino.ensureWallet(discordUser);
      if (await casino.debit(discordUser.id, bet) === null) return socket.emit('casinoError', { message: 'Za mało AT$!' });
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const win = result === data.side;
      const payout = win ? Math.floor(bet * SOLO_PAYOUT) : 0;
      if (payout) await casino.updateBalance(discordUser.id, payout);
      await casino.recordGame(discordUser.id);
      const balance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
      pushHistory(table, { result, winner: win ? (discordUser.globalName || discordUser.username) : 'Kasyno', loser: win ? 'Kasyno' : (discordUser.globalName || discordUser.username), bet, pvp: false, at: Date.now() });
      socket.emit('casinoCoinflipSoloResult', { tableId: table.id, result, side: data.side, win, bet, payout, net: payout - bet, balance, durationMs: FLIP_MS });
      setTimeout(() => broadcast(table, io), FLIP_MS);
    });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { registerHandlers, sendState, ensureState };
