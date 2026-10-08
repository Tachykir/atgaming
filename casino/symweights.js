/**
 * ═══════════════════════════════════════════════════════════════
 *  SZANSE SYMBOLI — ustawiane z panelu admina
 *
 *  Dla każdego automatu admin może pomnożyć szansę wypadnięcia symbolu (×0 … ×10).
 *  Silnik (slot_engine.symPicker) mnoży przez te współczynniki wagi bębnów.
 *  Opcja „zachowaj RTP”: po zmianie wag symulacja mierzy nowe bazowe RTP gry,
 *  a skalowanie wypłat (rtp.scale) koryguje je tak, by docelowe RTP się nie zmieniło —
 *  zmienia się wtedy tylko charakter gry (częstość symboli / zmienność), nie zwrot.
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';
const store = require('./store');
const rtp = require('./rtp');

const KEY = 'symbol_weights';
const MAX_F = 10;
let cfg = {};   // gameId → { f: [..], keep: bool, base: number|null, at }

async function load() {
  const saved = await store.getSetting(KEY).catch(() => null);
  cfg = saved && typeof saved === 'object' ? saved : {};
  for (const [g, c] of Object.entries(cfg)) rtp.setBaseOverride(g, c.keep ? c.base : null);
}
const save = () => store.setSetting(KEY, cfg);

/** Współczynniki szans gry (ta sama tablica dopóki nie zmieniona — picker cache'uje po referencji). */
function factors(gameId) { return cfg[gameId]?.f || null; }
function get(gameId) { return cfg[gameId] || null; }

function sanitize(arr, n) {
  if (!Array.isArray(arr) || arr.length !== n) throw new Error('Nieprawidłowa liczba symboli');
  const f = arr.map(v => Math.round(Math.max(0, Math.min(MAX_F, Number(v) || 0)) * 100) / 100);
  if (f.every(v => v === 0)) throw new Error('Przynajmniej jeden symbol musi mieć szansę > 0');
  return f;
}

/**
 * Zapis. measure(factors) → Promise<surowe RTP przy tych wagach> (symulacja w wątku).
 * keep=true → bazowe RTP gry zastąpione zmierzonym (docelowe RTP zostaje).
 */
async function set(gameId, arr, n, { keep = true, measure } = {}) {
  const f = sanitize(arr, n);
  if (f.every(v => v === 1)) return reset(gameId);
  let base = null;
  if (keep) {
    base = await measure(f);
    if (!(base > 0.05)) throw new Error('Te wagi dają praktycznie zerowe RTP — nie da się go skorygować');
  }
  cfg[gameId] = { f, keep: !!keep, base, at: new Date().toISOString() };
  rtp.setBaseOverride(gameId, keep ? base : null);
  await save();
  return cfg[gameId];
}
async function reset(gameId) {
  delete cfg[gameId];
  rtp.setBaseOverride(gameId, null);
  await save();
  return null;
}

module.exports = { load, factors, get, set, reset, MAX_F };
