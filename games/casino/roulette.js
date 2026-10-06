/**
 * RULETKA EUROPEJSKA — AT Gaming Casino
 * Wspólny stół: okno zakładów → obrót koła → rozliczenie → kolejna runda.
 *
 * Zakłady są pobierane z portfela w momencie postawienia; przy rozliczeniu
 * dopisywana jest tylko wygrana (stawka + zysk). Wszystkie zakłady są walidowane
 * po stronie serwera (typ, wartość, limit stołu).
 */
'use strict';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
// Kolejność pól na kole europejskim (zgodnie z ruchem wskazówek zegara od zera)
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

function getColor(n) {
  if (n === 0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

// Pozycja numeru na planszy: kolumna 0-11, rząd 0-2 (rząd 0 = 3,6,9…)
function boardPos(n) { return { col: Math.floor((n - 1) / 3), row: 2 - ((n - 1) % 3) }; }
function isValidSplit(a, b) {
  if (a === b) return false;
  if (a === 0 || b === 0) return [1, 2, 3].includes(a + b) && Math.min(a, b) === 0;
  const pa = boardPos(a), pb = boardPos(b);
  return (pa.col === pb.col && Math.abs(pa.row - pb.row) === 1) || (pa.row === pb.row && Math.abs(pa.col - pb.col) === 1);
}
function parseNums(value) {
  return String(value ?? '').split('-').map(v => Number(v)).filter(v => Number.isInteger(v) && v >= 0 && v <= 36);
}

// Każdy typ: normalize(value) → kanoniczna wartość albo null (nieprawidłowy zakład)
const BETS = {
  straight: { payout: 35, normalize: v => { const n = parseNums(v); return n.length === 1 ? String(n[0]) : null; }, match: (n, v) => n === Number(v) },
  split:    { payout: 17, normalize: v => { const n = parseNums(v); return n.length === 2 && isValidSplit(n[0], n[1]) ? n.sort((a, b) => a - b).join('-') : null; }, match: (n, v) => parseNums(v).includes(n) },
  street:   { payout: 11, normalize: v => { const s = Number(v); return Number.isInteger(s) && s >= 1 && s <= 34 && (s - 1) % 3 === 0 ? String(s) : null; }, match: (n, v) => n >= Number(v) && n <= Number(v) + 2 && n > 0 },
  corner:   { payout: 8,  normalize: v => { const s = Number(v); return Number.isInteger(s) && s >= 1 && s <= 32 && s % 3 !== 0 ? String(s) : null; }, match: (n, v) => [0, 1, 3, 4].map(d => Number(v) + d).includes(n) },
  sixline:  { payout: 5,  normalize: v => { const s = Number(v); return Number.isInteger(s) && s >= 1 && s <= 31 && (s - 1) % 3 === 0 ? String(s) : null; }, match: (n, v) => n >= Number(v) && n <= Number(v) + 5 && n > 0 },
  red:      { payout: 1,  match: n => RED.has(n) },
  black:    { payout: 1,  match: n => n > 0 && !RED.has(n) },
  even:     { payout: 1,  match: n => n > 0 && n % 2 === 0 },
  odd:      { payout: 1,  match: n => n % 2 === 1 },
  low:      { payout: 1,  match: n => n >= 1 && n <= 18 },
  high:     { payout: 1,  match: n => n >= 19 && n <= 36 },
  dozen1:   { payout: 2,  match: n => n >= 1 && n <= 12 },
  dozen2:   { payout: 2,  match: n => n >= 13 && n <= 24 },
  dozen3:   { payout: 2,  match: n => n >= 25 && n <= 36 },
  col1:     { payout: 2,  match: n => n > 0 && n % 3 === 1 },
  col2:     { payout: 2,  match: n => n > 0 && n % 3 === 2 },
  col3:     { payout: 2,  match: n => n > 0 && n % 3 === 0 },
};

const BETTING_TIME = 20;    // s
const SPIN_TIME    = 7000;  // ms — musi pasować do animacji koła na froncie
const RESULT_TIME  = 5000;  // ms

function sumBets(bets) { return (bets || []).reduce((s, b) => s + b.amount, 0); }

function publicState(table) {
  const gs = table.gameState;
  if (!gs) return { tableId: table.id, phase: 'idle', players: [], history: table.rouletteHistory || [] };
  return {
    tableId:   table.id,
    phase:     gs.phase,
    countdown: gs.countdown,
    bettingTime: BETTING_TIME,
    spinTime:  SPIN_TIME,
    result:    gs.phase === 'betting' ? null : gs.result,
    results:   gs.phase === 'results' ? gs.results : null,
    history:   table.rouletteHistory || [],
    minBet:    table.config.minBet,
    maxBet:    table.config.maxBet,
    players:   table.players.map(p => {
      const bets = gs.bets[p.discordId] || [];
      const res  = gs.phase === 'results' ? (gs.results || []).find(r => r.discordId === p.discordId) : null;
      return { name: p.name, avatar: p.avatar, discordId: p.discordId, bets, totalBet: sumBets(bets), net: res ? res.net : null, won: res ? res.won : null };
    }),
  };
}

function broadcastState(table, io) {
  io.to('casino:' + table.id).emit('casinoRouletteState', publicState(table));
}
function sendState(table, socket) {
  socket.emit('casinoRouletteState', publicState(table));
}

function stopTable(table) {
  const gs = table.gameState;
  if (gs) { clearInterval(gs.timer); clearTimeout(gs.spinTimer); }
  table.status = 'open';
  table.gameState = null;
}

function startRound(table, io, casino) {
  if (table.gameState) { clearInterval(table.gameState.timer); clearTimeout(table.gameState.spinTimer); }
  const gs = { phase: 'betting', bets: {}, result: null, results: null, countdown: BETTING_TIME, timer: null, spinTimer: null, round: (table.round || 0) + 1 };
  table.gameState = gs;
  table.status = 'betting';
  broadcastState(table, io);

  gs.timer = setInterval(() => {
    if (table.gameState !== gs) return clearInterval(gs.timer);
    gs.countdown--;
    if (gs.countdown <= 0) {
      clearInterval(gs.timer);
      doSpin(table, io, casino, gs);
    } else {
      broadcastState(table, io);
    }
  }, 1000);
}

function doSpin(table, io, casino, gs) {
  gs.phase = 'spinning';
  gs.countdown = 0;
  table.status = 'spinning';
  const number = Math.floor(Math.random() * 37);
  gs.result = { number, color: getColor(number), wheelIndex: WHEEL_ORDER.indexOf(number) };
  broadcastState(table, io);

  gs.spinTimer = setTimeout(async () => {
    if (table.gameState !== gs) return;
    const results = [];
    for (const [discordId, bets] of Object.entries(gs.bets)) {
      const staked = sumBets(bets);
      let won = 0;
      const wins = [];
      for (const b of bets) {
        const def = BETS[b.type];
        if (def && def.match(number, b.value)) {
          const w = b.amount * (def.payout + 1);
          won += w;
          wins.push({ type: b.type, value: b.value, win: w });
        }
      }
      if (won > 0) await casino.updateBalance(discordId, won).catch(() => {});
      casino.tracker?.track('roulette', { wagered: staked, returned: won });
      await casino.recordGame(discordId).catch(() => {});
      const balance = (await casino.getWallet(discordId).catch(() => null))?.balance ?? null;
      results.push({ discordId, staked, won, net: won - staked, wins, balance });
    }
    if (table.gameState !== gs) return;
    gs.results = results;
    gs.phase = 'results';
    table.status = 'results';
    table.round = gs.round;
    table.rouletteHistory = [{ number, color: getColor(number) }, ...(table.rouletteHistory || [])].slice(0, 18);
    broadcastState(table, io);

    gs.spinTimer = setTimeout(() => {
      if (table.gameState !== gs) return;
      if (table.players.length > 0) startRound(table, io, casino);
      else stopTable(table);
    }, RESULT_TIME);
  }, SPIN_TIME);
}

function registerHandlers(socket, io, casino) {
  socket.on('casinoRouletteJoin', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'roulette') return;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });

    await casino.ensureWallet(discordUser);
    const already = table.players.find(p => p.discordId === discordUser.id);
    if (!already) {
      if (table.players.length >= (table.config.maxPlayers || 20))
        return socket.emit('casinoError', { message: 'Stół pełny!' });
      table.players.push({ socketId: socket.id, discordId: discordUser.id, name: discordUser.globalName || discordUser.username, avatar: discordUser.avatar });
    } else {
      already.socketId = socket.id;
    }
    socket.join('casino:' + table.id);
    socket.casinoTableId = table.id;

    if (!table.gameState) startRound(table, io, casino);
    else broadcastState(table, io);
  });

  socket.on('casinoRouletteBet', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'roulette') return;
    const gs = table.gameState;
    if (!gs || gs.phase !== 'betting') return socket.emit('casinoError', { message: 'Zakłady są zamknięte — poczekaj na kolejną rundę' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;
    if (!table.players.some(p => p.discordId === discordUser.id))
      return socket.emit('casinoError', { message: 'Musisz dołączyć do stołu, żeby obstawiać!' });

    const def = BETS[data.type];
    if (!def) return socket.emit('casinoError', { message: 'Nieprawidłowy zakład' });
    const value = def.normalize ? def.normalize(data.value) : null;
    if (def.normalize && value === null) return socket.emit('casinoError', { message: 'Nieprawidłowe pole zakładu' });

    const cfg = table.config;
    const amount = Math.floor(Number(data.amount) || 0);
    if (amount < cfg.minBet) return socket.emit('casinoError', { message: `Minimalny zakład to ${cfg.minBet.toLocaleString('pl-PL')} AT$` });
    const current = sumBets(gs.bets[discordUser.id]);
    if (current + amount > cfg.maxBet)
      return socket.emit('casinoError', { message: `Limit stołu: ${cfg.maxBet.toLocaleString('pl-PL')} AT$ na rundę` });

    const balance = await casino.debit(discordUser.id, amount);
    if (balance === null) return socket.emit('casinoError', { message: 'Za mało AT$!' });
    // Runda mogła się zmienić w trakcie await — zwróć środki
    if (table.gameState !== gs || gs.phase !== 'betting') {
      await casino.updateBalance(discordUser.id, amount);
      return socket.emit('casinoError', { message: 'Zakłady zostały zamknięte' });
    }
    if (!gs.bets[discordUser.id]) gs.bets[discordUser.id] = [];
    // Scal z istniejącym zakładem na to samo pole
    const same = gs.bets[discordUser.id].find(b => b.type === data.type && b.value === value);
    if (same) same.amount += amount;
    else gs.bets[discordUser.id].push({ type: data.type, value, amount });
    socket.emit('casinoRouletteBalance', { balance });
    broadcastState(table, io);
  });

  // Zdejmij wszystkie zakłady (tylko w fazie zakładów)
  socket.on('casinoRouletteClear', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'roulette') return;
    const gs = table.gameState;
    const discordUser = socket.getDiscordUser(data);
    if (!gs || gs.phase !== 'betting' || !discordUser) return;
    const bets = gs.bets[discordUser.id];
    if (!bets?.length) return;
    delete gs.bets[discordUser.id];
    const balance = await casino.updateBalance(discordUser.id, sumBets(bets));
    socket.emit('casinoRouletteBalance', { balance });
    broadcastState(table, io);
  });
}

module.exports = { registerHandlers, sendState, BETS, getColor, WHEEL_ORDER };
