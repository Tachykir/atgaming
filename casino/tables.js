/**
 * Rejestr stołów kasyna (w pamięci). Stałe stoły mają stabilne ID (np. "slots-low"),
 * dzięki czemu linki i zapamiętane ustawienia graczy przeżywają restart serwera.
 */
'use strict';

const tables = {};
let counter = 1;

const STAKES = {
  low:    { minBet: 10,        maxBet: 10_000 },
  medium: { minBet: 10_000,    maxBet: 1_000_000 },
  high:   { minBet: 1_000_000, maxBet: 10_000_000 },
};
const LEVEL_NAME = { low: 'Low', medium: 'Medium', high: 'High' };

// Gry ze stawkami Low / Medium / High
const TIERED = [
  ['slots', 'Lucky Fruits'], ['path_of_gambling', 'Path of Gambling'], ['jackpot_frenzy', 'Jackpot Frenzy'],
  ['dragon_hoard', 'Dragon Hoard'], ['arcane_academy', 'Arcane Academy'], ['dual_blades', 'Dual Blades'],
  ['neon_racer', 'Neon Racer'], ['candy_tumble', 'Candy Tumble'], ['book_pharaoh', 'Księga Faraona'],
  ['hot_777', 'Hot 777'], ['pachinko', 'Pachinko'], ['crash', 'Crash 🚀'],
];

function createTable({ game, name, config, id }) {
  id = id || `${game}-${Date.now().toString(36)}-${counter++}`;
  const table = { id, game, name, config, players: [], observers: [], status: 'open', gameState: null, round: 0 };
  if (game === 'poker') table.dealerIdx = 0;
  tables[id] = table;
  return table;
}

function deleteTable(tableId, refund) {
  const t = tables[tableId];
  if (!t || t.players.length > 0) return false;
  if (t.game === 'coinflip') {
    const challenges = Object.values(t.gameState?.challenges || {});
    if (challenges.some(c => c.status === 'flipping')) return false;
    challenges.filter(c => c.status === 'open').forEach(c => refund && refund(c.creator.id, c.bet));
  }
  if (t.gameState?.timer) clearInterval(t.gameState.timer);
  if (t.gameState?.spinTimer) clearTimeout(t.gameState.spinTimer);
  delete tables[tableId];
  return true;
}

function initTables() {
  for (const [game, title] of TIERED) {
    for (const level of ['low', 'medium', 'high']) {
      createTable({ id: `${game}-${level}`, game, name: `${title} — ${LEVEL_NAME[level]}`, config: { ...STAKES[level], maxPlayers: 99, level } });
    }
  }
  createTable({ id: 'roulette-main', game: 'roulette', name: 'Ruletka Europejska', config: { minBet: 10, maxBet: 1_000_000, maxPlayers: 20 } });
  createTable({ id: 'coinflip-arena', game: 'coinflip', name: 'Coinflip Arena', config: { minBet: 10, maxBet: 10_000_000, maxPlayers: 99 } });
  console.log(`🃏 Zainicjowano ${Object.keys(tables).length} stołów kasyna`);
}

function getTablePublic(t) {
  return {
    id: t.id, game: t.game, name: t.name, config: t.config, status: t.status, round: t.round,
    playerCount: t.players.length, maxPlayers: t.config.maxPlayers,
    players: t.players.map(p => ({ name: p.name, avatar: p.avatar, discordId: p.discordId, sessionChips: p.sessionChips, seatIndex: p.seatIndex })),
    observers: t.observers.length, createdBy: t.createdBy || null,
  };
}

module.exports = { tables, createTable, deleteTable, initTables, getTablePublic, STAKES };
