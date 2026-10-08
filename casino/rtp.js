/**
 * ═══════════════════════════════════════════════════════════════
 *  KONFIGURACJA RTP (zwrotu dla gracza) — ustawiana z panelu admina
 *
 *  Każda gra ma bazowe RTP (z kalibracji symulacjami). Admin ustawia docelowe RTP,
 *  a gra dostaje współczynnik scale = target / base:
 *   - automaty: wszystkie wypłaty (linie, scattery, jackpoty, bonusy) × scale
 *   - pachinko: mnożniki pól × scale
 *   - crash:    P(crash ≥ x) = target / x
 *   - coinflip: wypłata solo = 2 × target
 *  Gry o stałych zasadach (ruletka, blackjack, poker PvP) są tylko do podglądu.
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';

const store = require('./store');

const GAMES = {
  slots:            { name: 'Lucky Fruits',     kind: 'slot', base: 0.950 },
  path_of_gambling: { name: 'Path of Gambling', kind: 'slot', base: 0.950 },
  jackpot_frenzy:   { name: 'Jackpot Frenzy',   kind: 'slot', base: 0.955 },
  dragon_hoard:     { name: 'Dragon Hoard',     kind: 'slot', base: 0.950 },
  arcane_academy:   { name: 'Arcane Academy',   kind: 'slot', base: 0.945 },
  dual_blades:      { name: 'Dual Blades',      kind: 'slot', base: 0.955 },
  neon_racer:       { name: 'Neon Racer',       kind: 'slot', base: 0.952 },
  candy_tumble:     { name: 'Candy Tumble',     kind: 'slot', base: 0.951 },
  book_pharaoh:     { name: 'Księga Faraona',   kind: 'slot', base: 0.952 },
  hot_777:          { name: 'Hot 777',          kind: 'slot', base: 0.948 },
  olympus_ways: { name: "Olympus Ways", kind: 'slot', fromModule: true },
  wild_duel: { name: "Wild Duel", kind: 'slot', fromModule: true },
  cosmic_infinity: { name: "Cosmic Infinity", kind: 'slot', fromModule: true },
  deep_sea: { name: "Deep Sea Fortune", kind: 'slot', fromModule: true },
  sugar_cells: { name: "Sugar Cells", kind: 'slot', fromModule: true },
  pandora_mystery: { name: "Pandora's Mystery", kind: 'slot', fromModule: true },
  titan_colossus: { name: "Titan Colossus", kind: 'slot', fromModule: true },
  ninja_walk: { name: "Ninja Walk", kind: 'slot', fromModule: true },
  mega_wheel: { name: "Mega Wheel", kind: 'slot', fromModule: true },
  alchemy_lab: { name: "Alchemy Lab", kind: 'slot', fromModule: true },
  pachinko:         { name: 'Pachinko',         kind: 'pachinko', base: 0.960 },
  crash:            { name: 'Crash',            kind: 'crash', base: 0.960 },
  coinflip:         { name: 'Coinflip (solo)',  kind: 'coinflip', base: 0.980 },
  roulette:         { name: 'Ruletka',          kind: 'fixed', base: 0.973 },
  blackjack:        { name: 'Blackjack',        kind: 'fixed', base: 0.995 },
  poker:            { name: 'Poker (PvP)',      kind: 'fixed', base: 1.000 },
};
// Nowsze automaty podają bazowe RTP same (BASE_RTP w module gry — wynik ich kalibracji)
for (const [id, g] of Object.entries(GAMES)) if (g.fromModule) {
  Object.defineProperty(g, 'base', { get() { return require('./games').SLOTS[id]?.BASE_RTP ?? 0.95; }, enumerable: true });
}
const MIN = 0.5, MAX = 2.0;
const SETTING_KEY = 'rtp_targets';

let targets = {};      // gameId → docelowe RTP (tylko nadpisane)
let history = [];      // ostatnie zmiany (audyt)

async function load() {
  const saved = await store.getSetting(SETTING_KEY).catch(() => null);
  if (saved && typeof saved === 'object') {
    targets = saved.targets || {};
    history = saved.history || [];
  }
}

function adjustable(gameId) { const g = GAMES[gameId]; return !!g && g.kind !== 'fixed'; }
function target(gameId) { const g = GAMES[gameId]; if (!g) return 1; return targets[gameId] ?? g.base; }
// Bazowe RTP po zmianie szans symboli (zmierzone symulacją) — skalowanie liczone od niego
const baseOverride = {};
function setBaseOverride(gameId, v) { if (v > 0) baseOverride[gameId] = v; else delete baseOverride[gameId]; }
function effectiveBase(gameId) { return baseOverride[gameId] ?? GAMES[gameId]?.base; }
function scale(gameId) { const g = GAMES[gameId]; if (!g || g.kind === 'fixed') return 1; return target(gameId) / effectiveBase(gameId); }

async function set(gameId, value, by = 'admin') {
  if (!adjustable(gameId)) throw new Error('Tej gry nie można regulować');
  const v = Math.round(Number(value) * 10000) / 10000;
  if (!(v >= MIN && v <= MAX)) throw new Error(`RTP musi być w zakresie ${MIN * 100}–${MAX * 100}%`);
  const prev = target(gameId);
  if (Math.abs(v - GAMES[gameId].base) < 1e-9) delete targets[gameId]; else targets[gameId] = v;
  history = [{ gameId, from: prev, to: v, by, at: new Date().toISOString() }, ...history].slice(0, 50);
  await store.setSetting(SETTING_KEY, { targets, history });
  return v;
}
async function resetAll(by = 'admin') {
  history = [{ gameId: '*', from: null, to: null, by, at: new Date().toISOString() }, ...history].slice(0, 50);
  targets = {};
  await store.setSetting(SETTING_KEY, { targets, history });
}

function list() {
  return Object.entries(GAMES).map(([id, g]) => ({ id, name: g.name, kind: g.kind, base: g.base, effBase: effectiveBase(id), target: target(id), scale: scale(id), adjustable: g.kind !== 'fixed', overridden: id in targets }));
}

module.exports = { GAMES, MIN, MAX, load, setBaseOverride, effectiveBase, target, scale, set, resetAll, list, adjustable, get history() { return history; } };
