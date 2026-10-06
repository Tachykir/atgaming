/**
 * Zliczanie postawionych i wypłaconych AT$ per gra (obserwowane RTP dla panelu admina).
 * Dane trzymane w pamięci i zapisywane do bazy co 15 s (oraz przy wyłączaniu serwera).
 */
'use strict';
const store = require('./store');

let pending = {};
let timer = null;

function track(gameId, { wagered = 0, returned = 0, rounds = 1 } = {}) {
  if (!gameId) return;
  const t = pending[gameId] || (pending[gameId] = { rounds: 0, wagered: 0, returned: 0 });
  t.rounds += rounds; t.wagered += wagered; t.returned += returned;
}

async function flush() {
  const batch = pending;
  pending = {};
  try { await store.addGameTotals(batch); }
  catch (e) {
    console.error('Tracker flush error:', e.message);
    for (const [g, t] of Object.entries(batch)) track(g, t); // spróbuj ponownie później
  }
}

function start() { if (!timer) timer = setInterval(flush, 15_000); }
function stop() { clearInterval(timer); timer = null; }

async function totals() {
  const saved = await store.getGameTotals();
  for (const [g, t] of Object.entries(pending)) {
    const s = saved[g] || { rounds: 0, wagered: 0, returned: 0 };
    saved[g] = { rounds: s.rounds + t.rounds, wagered: s.wagered + t.wagered, returned: s.returned + t.returned };
  }
  return saved;
}
async function reset(gameId) {
  if (gameId) delete pending[gameId]; else pending = {};
  await store.resetGameTotals(gameId);
}

module.exports = { track, flush, start, stop, totals, reset };
