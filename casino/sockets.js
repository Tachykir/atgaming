/**
 * Obsługa socketów kasyna: portfel, stoły (dołącz/obserwuj/utwórz/usuń/opuść),
 * akcje pokera i blackjacka oraz rejestracja handlerów wszystkich gier.
 */
'use strict';
const casino = require('./index');
const games = require('./games');
const { createPlayerTable, deletePlayerTable } = require('./http');
const { poker, blackjack } = games;

const POKER_EVENTS = ['casinoPokerFold', 'casinoPokerCheck', 'casinoPokerCall', 'casinoPokerRaise'];
const BJ_EVENTS = ['casinoBJBet', 'casinoBJHit', 'casinoBJStand', 'casinoBJDouble', 'casinoBJSplit'];

// Limit zdarzeń kasyna per socket (token bucket): 15/s, zryw do 40 — chroni przed floodem
const RATE = 20, BURST = 60;
function rateLimiter(socket) {
  let tokens = BURST, last = Date.now(), warned = 0;
  socket.use(([event], next) => {
    if (typeof event !== 'string' || !event.startsWith('casino')) return next();
    const now = Date.now();
    tokens = Math.min(BURST, tokens + (now - last) / 1000 * RATE);
    last = now;
    if (tokens < 1) {
      if (now - warned > 2000) { warned = now; socket.emit('casinoError', { message: 'Zbyt wiele akcji — zwolnij' }); }
      return;
    }
    tokens--;
    next();
  });
}

function sendTableState(table, socket, io) {
  if (table.game === 'poker') poker.emitTableState(table, io);
  else if (table.game === 'blackjack') blackjack.emitTableState(table, io);
  else if (table.game === 'roulette' && table.gameState) games.roulette.sendState(table, socket);
  else if (table.game === 'crash' && table.gameState) games.crash.sendState(table, socket);
  else if (table.game === 'coinflip') games.coinflip.sendState(table, socket);
}

function leaveTable(socket, tableId, io) {
  const table = casino.casinoTables[tableId];
  if (!table) return;
  table.observers = (table.observers || []).filter(id => id !== socket.id);
  if (socket.casinoObserving === tableId) socket.casinoObserving = null;

  const idx = table.players.findIndex(p => p.socketId === socket.id);
  if (idx === -1) return;
  const player = table.players[idx];

  // Ruletka: zwróć zakłady postawione w fazie zakładów
  if (table.game === 'roulette' && player.discordId) {
    const gs = table.gameState;
    if (gs && gs.phase === 'betting' && gs.bets[player.discordId]?.length > 0) {
      const refund = gs.bets[player.discordId].reduce((s, b) => s + b.amount, 0);
      delete gs.bets[player.discordId];
      if (refund > 0) casino.updateBalance(player.discordId, refund).catch(() => {});
    }
  }

  // Poker / blackjack: wyjście w trakcie ręki = fold / utrata postawionego zakładu
  if (table.game === 'poker') poker.playerLeft(table, socket.id, io);
  if (table.game === 'blackjack') blackjack.playerLeft(table, socket.id, io);

  // Zwróć żetony ze stołu do portfela
  if (player.discordId && player.sessionChips > 0) casino.updateBalance(player.discordId, player.sessionChips).catch(() => {});
  table.players.splice(idx, 1);
  socket.leave('casino:' + tableId);
  if (socket.casinoTableId === tableId) socket.casinoTableId = null;

  if (table.game === 'poker') {
    if (table.players.length < 2 && table.status !== 'playing' && table.status !== 'showdown') {
      clearTimeout(poker.countdownTimers[tableId]);
      delete poker.countdownTimers[tableId];
      table.status = 'open';
      table.gameState = null;
    }
    poker.emitTableState(table, io);
  } else if (table.game === 'blackjack') {
    if (table.players.length === 0 && table.gameState?.phase === 'betting') {
      clearTimeout(blackjack.countdownTimers[tableId]);
      table.status = 'open';
      table.gameState = null;
    }
    blackjack.emitTableState(table, io);
  }

  // Ruletka: zatrzymaj pętlę gdy stół opustoszeje
  if (table.game === 'roulette' && table.players.length === 0 && table.gameState) {
    clearInterval(table.gameState.timer);
    clearTimeout(table.gameState.spinTimer);
    table.status = 'open';
    table.gameState = null;
  }
}

/**
 * @param hooks.onObserve(socket, table) — np. aktualizacja listy graczy online
 */
function register(socket, io, hooks = {}) {
  rateLimiter(socket);

  socket.on('casinoGetWallet', async (data, cb) => {
    const reply = typeof cb === 'function' ? cb : () => {};
    const user = socket.getDiscordUser(data);
    if (!user) return reply({ error: 'Brak sesji Discord' });
    reply({ wallet: await casino.ensureWallet(user) });
  });

  // Dołącz do stołu pokera / blackjacka (buy-in z portfela)
  socket.on('casinoJoinTable', async (data) => {
    const { tableId, buyIn } = data || {};
    const table = casino.casinoTables[tableId];
    if (!table) return socket.emit('casinoError', { message: 'Stół nie istnieje' });
    if (table.game !== 'poker' && table.game !== 'blackjack') return;
    const user = socket.getDiscordUser(data);
    if (!user) return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord, żeby grać!' });

    await casino.exclusive('join:' + user.id, async () => {
      if (table.players.find(p => p.socketId === socket.id || p.discordId === user.id)) return socket.emit('casinoError', { message: 'Już siedzisz przy tym stole' });
      if (table.players.length >= table.config.maxPlayers) return socket.emit('casinoError', { message: 'Stół pełny!' });
      if (table.status === 'playing') return socket.emit('casinoError', { message: 'Runda w toku — poczekaj na kolejną' });

      const wallet = await casino.ensureWallet(user);
      const cfg = table.config;
      const minBI = cfg.minBuyIn || cfg.minBet * 10;
      const maxBI = cfg.maxBuyIn || cfg.maxBet * 20;
      const amount = Math.floor(Math.max(minBI, Math.min(maxBI, Number(buyIn) || minBI)));

      const balanceAfter = await casino.debit(user.id, amount);
      if (balanceAfter === null) return socket.emit('casinoError', { message: `Za mało AT$! Potrzebujesz ${amount.toLocaleString('pl-PL')} AT$, masz ${wallet.balance.toLocaleString('pl-PL')}` });
      if (!casino.casinoTables[tableId] || table.players.length >= cfg.maxPlayers) {
        await casino.updateBalance(user.id, amount);
        return socket.emit('casinoError', { message: 'Nie udało się dołączyć do stołu' });
      }

      table.players.push({ socketId: socket.id, discordId: user.id, name: user.globalName || user.username, avatar: user.avatar, sessionChips: amount, seatIndex: table.players.length });
      socket.join('casino:' + tableId);
      socket.casinoTableId = tableId;
      socket.discordId = user.id;
      socket.emit('casinoJoined', { tableId, sessionChips: amount, walletBalance: balanceAfter });

      (table.game === 'poker' ? poker : blackjack).emitTableState(table, io);
      if (table.game === 'poker' && table.players.length >= 2 && table.status === 'open' && !table.gameState) poker.startCountdown(table, io, 10);
      if (table.game === 'blackjack' && table.status === 'open' && !table.gameState) blackjack.startBettingWindow(table, io);
    });
  });

  socket.on('casinoObserveTable', (data) => {
    const tableId = data?.tableId || data;
    const table = casino.casinoTables[tableId];
    if (!table) return;
    hooks.onObserve?.(socket, table);
    socket.join('casino:' + tableId);
    table.observers = table.observers || [];
    if (!table.observers.includes(socket.id)) table.observers.push(socket.id);
    socket.casinoObserving = tableId;
    sendTableState(table, socket, io);
  });

  socket.on('casinoCreateTable', (data) => {
    const user = socket.getDiscordUser(data);
    if (!user) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });
    const r = createPlayerTable(user, data || {}, io);
    if (r.error) return socket.emit('casinoError', { message: r.error });
    socket.emit('casinoTableCreated', { table: casino.getTablePublic(r.table) });
  });

  socket.on('casinoDeleteTable', (data) => {
    const user = socket.getDiscordUser(data);
    if (!user) return;
    const r = deletePlayerTable(user, data?.tableId, io);
    if (r.error && r.status !== 404) socket.emit('casinoError', { message: r.error });
  });

  socket.on('casinoLeaveTable', (data) => leaveTable(socket, data?.tableId, io));

  for (const event of POKER_EVENTS) socket.on(event, (data) => {
    const table = casino.casinoTables[data?.tableId || socket.casinoTableId];
    if (table?.game === 'poker') poker.handleAction(table, socket.id, event, data, io);
  });
  for (const event of BJ_EVENTS) socket.on(event, (data) => {
    const table = casino.casinoTables[data?.tableId || socket.casinoTableId];
    if (table?.game === 'blackjack') blackjack.handleAction(table, socket.id, event, data, io);
  });

  for (const mod of games.HANDLERS) mod.registerHandlers(socket, io, casino);

  socket.on('disconnect', () => {
    if (socket.casinoTableId) leaveTable(socket, socket.casinoTableId, io);
    if (socket.casinoObserving) {
      const t = casino.casinoTables[socket.casinoObserving];
      if (t) t.observers = (t.observers || []).filter(id => id !== socket.id);
    }
  });
}

/** Start pętli gier działających bez graczy (crash). */
function startLoops(io) {
  for (const t of Object.values(casino.casinoTables).filter(t => t.game === 'crash')) {
    t.gameState = { phase: 'betting', bets: {}, currentMultiplier: 1.00, crashPoint: null, history: [], bettingTimeLeft: 5 };
    games.crash.startCrashLoop(t, io, casino);
  }
}

/**
 * Bezpieczne zamknięcie: zwraca graczom wszystkie AT$ "w grze" (żetony przy stołach,
 * zakłady ruletki / crash z bieżącej rundy, otwarte wyzwania coinflip), zapisuje statystyki
 * i zamyka bazę. Zwraca łączną kwotę zwrotów.
 */
async function shutdown() {
  const refunds = new Map();
  const add = (id, amt) => { if (id && amt > 0) refunds.set(id, (refunds.get(id) || 0) + amt); };
  for (const t of Object.values(casino.casinoTables)) {
    const gs = t.gameState;
    if (t.game === 'poker' || t.game === 'blackjack') {
      for (const p of t.players) {
        add(p.discordId, p.sessionChips);
        // Wkład w nierozliczoną rękę: pula pokera (contrib) / zakłady BJ już pobrane z żetonów
        if (t.game === 'poker' && gs?.contrib && gs.phase !== 'showdown') add(p.discordId, gs.contrib[p.socketId] || 0);
        if (t.game === 'blackjack' && gs?.hands && (gs.phase === 'playing' || gs.phase === 'dealer'))
          add(p.discordId, (gs.hands[p.socketId] || []).reduce((s, h) => s + (h.bet || 0), 0));
        p.sessionChips = 0;
      }
    } else if (t.game === 'roulette' && gs?.phase !== 'results') {
      for (const [id, bets] of Object.entries(gs?.bets || {})) add(id, bets.reduce((s, b) => s + b.amount, 0));
      if (gs) gs.bets = {};
    } else if (t.game === 'crash' && gs && gs.phase !== 'crashed') {
      for (const [id, b] of Object.entries(gs.bets || {})) if (!b.cashedOut) { add(id, b.amount); b.cashedOut = true; casino.tracker.track('crash', { wagered: -b.amount, returned: 0, rounds: -1 }); }
    } else if (t.game === 'coinflip') {
      for (const c of Object.values(gs?.challenges || {})) if (c.status === 'open') { add(c.creator?.id, c.bet); c.status = 'done'; }
    }
  }
  let total = 0;
  for (const [id, amt] of refunds) { total += amt; await casino.updateBalance(id, Math.floor(amt)).catch(e => console.error('refund', id, e.message)); }
  await casino.tracker.flush().catch(() => {});
  casino.tracker.stop();
  await casino.store.close();
  return { players: refunds.size, total };
}

module.exports = { register, leaveTable, startLoops, shutdown };
