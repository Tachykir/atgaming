/**
 * Trasy HTTP kasyna: API gracza (/api/casino/*) i panelu admina (/api/admin/casino/*).
 */
'use strict';
const path = require('path');
const { Worker } = require('worker_threads');
const casino = require('./index');
const games = require('./games');
const { requireAdmin } = require('../lib/adminAuth');

const META = Object.fromEntries(Object.entries(games.SLOTS).map(([id, m]) => [id, m.meta]).filter(([, m]) => m));

// Konfiguracja nowych stołów graczy (poker / blackjack / coinflip) — wspólna dla HTTP i socketów
function sanitizeTableConfig(game, config = {}) {
  const n = (v, d) => Number(v) || d;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (game === 'poker') {
    const cfg = { blindAmount: clamp(n(config.blindAmount, 50), 5, 1000), minBuyIn: clamp(n(config.minBuyIn, 1000), 100, 50000), maxBuyIn: clamp(n(config.maxBuyIn, 5000), 500, 100000), maxPlayers: clamp(n(config.maxPlayers, 6), 2, 8) };
    cfg.minBuyIn = Math.min(cfg.minBuyIn, cfg.maxBuyIn);
    return cfg;
  }
  if (game === 'coinflip') return { minBet: Math.max(10, n(config.minBet, 100)), maxPlayers: 99 };
  const cfg = { minBet: clamp(n(config.minBet, 50), 10, 5000), maxBet: clamp(n(config.maxBet, 500), 50, 50000), maxPlayers: clamp(n(config.maxPlayers, 5), 1, 7) };
  cfg.minBet = Math.min(cfg.minBet, cfg.maxBet);
  return cfg;
}

function createPlayerTable(user, { game, name, config }, io) {
  if (!['poker', 'blackjack', 'coinflip'].includes(game)) return { error: 'Nieprawidłowy typ gry' };
  const mine = Object.values(casino.casinoTables).filter(t => t.createdBy?.id === user.id);
  if (mine.length >= 3) return { error: 'Możesz mieć maksymalnie 3 własne stoły' };
  const safeName = String(name || '').trim().slice(0, 40) || `Stół ${user.globalName || user.username}`;
  const table = casino.createTable({ game, name: safeName, config: sanitizeTableConfig(game, config) });
  table.createdBy = { id: user.id, name: user.globalName || user.username };
  table._casino = casino;
  if (game === 'coinflip') table.gameState = { challenges: {}, history: [] };
  io.emit('casinoTablesUpdated');
  return { table };
}

function deletePlayerTable(user, tableId, io) {
  const t = casino.casinoTables[tableId];
  if (!t) return { status: 404, error: 'Stół nie istnieje' };
  if (t.createdBy?.id !== user.id) return { status: 403, error: 'Brak uprawnień' };
  for (const timers of [games.poker.countdownTimers, games.blackjack.countdownTimers, games.poker.turnTimers, games.blackjack.turnTimers]) clearTimeout(timers[tableId]);
  if (!casino.deleteTable(tableId)) return { status: 400, error: 'Nie można usunąć stołu z graczami' };
  io.emit('casinoTablesUpdated');
  return { ok: true };
}

let simBusy = false;
function runSim(game, spins) {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(__dirname, 'simWorker.js'), { workerData: { game, spins, scale: casino.rtp.scale(game) } });
    const kill = setTimeout(() => { w.terminate(); reject(new Error('Symulacja trwała zbyt długo')); }, 120_000);
    w.once('message', m => { clearTimeout(kill); resolve(m); w.terminate(); });
    w.once('error', e => { clearTimeout(kill); reject(e); });
  });
}

function mount(app, io) {
  const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => { console.error(req.path, e); res.status(500).json({ error: 'Błąd serwera' }); });
  const userOf = req => req.session?.discordUser || null;

  // ── API gracza ────────────────────────────────────────────
  app.get('/api/casino/wallet', wrap(async (req, res) => {
    const user = userOf(req);
    if (!user) return res.status(401).json({ error: 'Wymagane logowanie przez Discord' });
    res.json({ wallet: await casino.ensureWallet(user), discordId: user.id });
  }));
  app.get('/api/casino/slot-stats/:gameId', wrap(async (req, res) => {
    const user = userOf(req);
    if (!user) return res.status(401).json({ error: 'Wymagane logowanie przez Discord' });
    res.json(await casino.getSlotStats(user.id, req.params.gameId));
  }));
  app.get('/api/casino/game-meta/:game', (req, res) => {
    const g = req.params.game;
    if (g === 'pachinko') return res.json({ risks: games.pachinko.riskConfigs(casino.rtp.scale('pachinko')), rtp: casino.rtp.target('pachinko') });
    if (g === 'crash' || g === 'coinflip' || (casino.rtp.GAMES[g] && !META[g])) return res.json({ rtp: casino.rtp.target(g), rtpScale: casino.rtp.scale(g) });
    const m = META[g];
    if (!m) return res.status(404).json({ error: 'Brak danych' });
    const k = casino.rtp.scale(g);
    const sc = v => typeof v === 'number' ? v * k : Array.isArray(v) ? v.map(sc) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, sc(b)])) : v;
    res.json({ ...m, rtp: casino.rtp.target(g), rtpScale: k, syms: (m.syms || []).map(s => s.p ? { ...s, p: s.p.map(v => v * k) } : s),
      ...(m.scatterPay ? { scatterPay: sc(m.scatterPay) } : {}), ...(m.bookPay ? { bookPay: sc(m.bookPay) } : {}) });
  });
  // Dzienny bonus, historia, osiągnięcia
  const authed = fn => wrap(async (req, res) => {
    const user = userOf(req);
    if (!user) return res.status(401).json({ error: 'Wymagane logowanie przez Discord' });
    await casino.ensureWallet(user);
    return fn(req, res, user);
  });
  app.get('/api/casino/daily', authed(async (req, res, u) => res.json(await casino.progress.dailyStatus(u.id))));
  app.post('/api/casino/daily', authed(async (req, res, u) => {
    const r = await casino.progress.claimDaily(u.id);
    res.status(r.error ? 409 : 200).json(r);
  }));
  app.get('/api/casino/history', authed(async (req, res, u) => res.json(await casino.progress.history(u.id, Number(req.query.limit) || 50))));
  app.get('/api/casino/achievements', authed(async (req, res, u) => res.json(await casino.progress.achievementsFor(u.id))));

  app.get('/api/casino/leaderboard', wrap(async (req, res) => res.json(await casino.getLeaderboard(50))));
  app.get('/api/casino/tables', (req, res) => res.json(Object.values(casino.casinoTables).map(casino.getTablePublic)));
  app.get('/api/casino/tables/:tableId', (req, res) => {
    const t = casino.casinoTables[req.params.tableId];
    if (!t) return res.status(404).json({ error: 'Stół nie istnieje' });
    res.json(casino.getTablePublic(t));
  });
  app.post('/api/casino/tables', (req, res) => {
    const user = userOf(req);
    if (!user) return res.status(401).json({ error: 'Wymagane logowanie Discord' });
    const r = createPlayerTable(user, req.body || {}, io);
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ table: casino.getTablePublic(r.table) });
  });
  app.delete('/api/casino/tables/:tableId', (req, res) => {
    const user = userOf(req);
    if (!user) return res.status(401).json({ error: 'Wymagane logowanie Discord' });
    const r = deletePlayerTable(user, req.params.tableId, io);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true });
  });

  // ── API admina ────────────────────────────────────────────
  const admin = (method, route, fn) => app[method]('/api/admin/casino' + route, requireAdmin, wrap(fn));

  admin('post', '/topup', async (req, res) => {
    const topped = await casino.runWeeklyTopup();
    res.json({ ok: true, count: topped.length, players: topped });
  });
  admin('post', '/set-balance', async (req, res) => {
    const { discordId, amount } = req.body;
    const v = parseInt(amount);
    if (!discordId || !Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Nieprawidłowe dane' });
    if (!await casino.adminSetBalance(discordId, v)) return res.status(404).json({ error: 'Portfel nie istnieje' });
    casino.progress.logEvent(discordId, { game: 'admin', kind: 'admin', balance: v, note: `Saldo ustawione przez admina: ${v.toLocaleString('pl-PL')} AT$` });
    res.json({ ok: true, discordId, newBalance: v });
  });
  admin('post', '/wallets', async (req, res) => res.json(await casino.getAllWallets()));

  // RTP + statystyki
  admin('post', '/rtp', async (req, res) => {
    const totals = await casino.tracker.totals();
    const econ = await casino.store.getEconomySummary();
    res.json({ games: casino.rtp.list().map(g => ({ ...g, observed: totals[g.id] || { rounds: 0, wagered: 0, returned: 0 } })), history: casino.rtp.history, min: casino.rtp.MIN, max: casino.rtp.MAX, economy: econ, db: casino.store.usingPg ? 'PostgreSQL' : 'JSON' });
  });
  admin('post', '/rtp/set', async (req, res) => {
    try {
      const v = await casino.rtp.set(String(req.body.gameId), Number(req.body.target) / 100);   // panel wysyła procenty
      console.log(`🎛️  RTP ${req.body.gameId} → ${(v * 100).toFixed(2)}% (admin)`);
      res.json({ ok: true, target: v });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  admin('post', '/rtp/reset', async (req, res) => { await casino.rtp.resetAll(); res.json({ ok: true }); });
  admin('post', '/rtp/stats-reset', async (req, res) => { await casino.tracker.reset(req.body.gameId || null); res.json({ ok: true }); });
  admin('post', '/rtp/simulate', async (req, res) => {
    const game = String(req.body.gameId);
    if (!games.SLOTS[game]) return res.status(400).json({ error: 'Symulacja dostępna tylko dla automatów' });
    if (simBusy) return res.status(429).json({ error: 'Trwa inna symulacja — poczekaj' });
    simBusy = true;
    try { res.json(await runSim(game, Math.max(10_000, Math.min(400_000, Number(req.body.spins) || 100_000)))); }
    catch (e) { res.status(500).json({ error: e.message }); }
    finally { simBusy = false; }
  });
}

module.exports = { mount, createPlayerTable, deletePlayerTable };
