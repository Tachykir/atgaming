/**
 * ═══════════════════════════════════════════════════════════════
 *  WARSTWA DANYCH KASYNA
 *   - PostgreSQL gdy ustawione DATABASE_URL (produkcja / Railway)
 *   - plik JSON jako fallback (lokalny dev) — zapis odroczony i atomowy
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';

const fs = require('fs');
const path = require('path');

const START_BALANCE  = 100_000;
const WEEKLY_MINIMUM = 10_000;
const WEEKLY_TOP_UP  = 100_000;

const DATA_FILE = process.env.CASINO_DATA_FILE || path.join(__dirname, '..', 'casino_data.json');
let pg = null;
let jsonDb = null;

// ─── POSTGRES ───────────────────────────────────────────────────
async function initPg() {
  const { Pool } = require('pg');
  pg = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 10 });
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_wallets (
      discord_id   TEXT PRIMARY KEY,
      username     TEXT NOT NULL,
      global_name  TEXT NOT NULL,
      avatar       TEXT,
      balance      BIGINT NOT NULL DEFAULT ${START_BALANCE},
      total_won    BIGINT NOT NULL DEFAULT 0,
      total_lost   BIGINT NOT NULL DEFAULT 0,
      games_played INTEGER NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  // Migracja starszych instalacji: INTEGER → BIGINT
  for (const col of ['balance', 'total_won', 'total_lost']) {
    await pg.query(`ALTER TABLE casino_wallets ALTER COLUMN ${col} TYPE BIGINT`).catch(() => {});
  }
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_topup_log (
      id SERIAL PRIMARY KEY, ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), count INTEGER NOT NULL, details JSONB
    )`);
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_slot_stats (
      discord_id TEXT NOT NULL, game_id TEXT NOT NULL,
      spins BIGINT NOT NULL DEFAULT 0, spent BIGINT NOT NULL DEFAULT 0, won BIGINT NOT NULL DEFAULT 0,
      best_win BIGINT NOT NULL DEFAULT 0, pit_meter INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (discord_id, game_id)
    )`);
  await pg.query(`ALTER TABLE casino_slot_stats ADD COLUMN IF NOT EXISTS pit_meter INTEGER NOT NULL DEFAULT 0`).catch(() => {});
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_settings (
      key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_slot_state (
      discord_id TEXT NOT NULL, game_id TEXT NOT NULL, state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (discord_id, game_id)
    )`);
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_game_totals (
      game_id TEXT PRIMARY KEY, rounds BIGINT NOT NULL DEFAULT 0,
      wagered BIGINT NOT NULL DEFAULT 0, returned BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pg.query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      sid TEXT PRIMARY KEY, sess JSONB NOT NULL, expire TIMESTAMPTZ NOT NULL
    )`);
  await pg.query('CREATE INDEX IF NOT EXISTS app_sessions_expire ON app_sessions (expire)');
  // Profil gracza (osiągnięcia, liczniki, dzienny bonus) i historia gier
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_player_meta (
      discord_id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_history (
      id BIGSERIAL PRIMARY KEY, discord_id TEXT NOT NULL, ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      game TEXT NOT NULL, kind TEXT NOT NULL, bet BIGINT NOT NULL DEFAULT 0, win BIGINT NOT NULL DEFAULT 0,
      balance BIGINT, note TEXT
    )`);
  await pg.query('CREATE INDEX IF NOT EXISTS casino_history_user ON casino_history (discord_id, id DESC)');
  console.log('🐘 Casino: połączono z PostgreSQL');
}

// ─── JSON FALLBACK ───────────────────────────────────────────────
const JSON_DEFAULT = () => ({ wallets: {}, topupLog: [], lastWeeklyTopup: null, slotStats: {}, settings: {}, slotState: {}, gameTotals: {}, sessions: {}, meta: {}, history: {} });
let saveTimer = null;
function loadJsonDb() {
  jsonDb = JSON_DEFAULT();
  try {
    if (fs.existsSync(DATA_FILE)) {
      jsonDb = { ...jsonDb, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
      console.log(`💾 Casino JSON DB: ${Object.keys(jsonDb.wallets).length} portfeli`);
    }
  } catch (e) { console.error('Casino JSON load error:', e.message); }
}
function flushJsonSync() {
  if (!jsonDb) return;
  clearTimeout(saveTimer); saveTimer = null;
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(jsonDb));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) { console.error('Casino JSON save error:', e.message); }
}
// Zapis odroczony (wiele zmian w krótkim czasie = jeden zapis na dysk)
function saveJson() { if (!saveTimer) saveTimer = setTimeout(flushJsonSync, 400); }

// ─── INICJALIZACJA ───────────────────────────────────────────────
let ready = false;
let readyResolve;
const readyPromise = new Promise(r => { readyResolve = r; });
const whenReady = () => readyPromise;
async function init() {
  if (ready) return;
  if (process.env.DATABASE_URL) {
    try { await initPg(); }
    catch (e) { console.error('❌ PostgreSQL błąd, fallback na JSON:', e.message); pg = null; loadJsonDb(); }
  } else {
    console.log('💾 Casino: tryb JSON (brak DATABASE_URL)');
    loadJsonDb();
  }
  ready = true;
  readyResolve();
}
async function close() {
  if (pg) { await pg.end().catch(() => {}); pg = null; }
  else flushJsonSync();
}

// ─── PORTFELE ────────────────────────────────────────────────────
function rowToWallet(row) {
  return { balance: Number(row.balance), username: row.username, globalName: row.global_name, avatar: row.avatar, totalWon: Number(row.total_won), totalLost: Number(row.total_lost), gamesPlayed: Number(row.games_played), createdAt: row.created_at, lastSeen: row.last_seen };
}

async function getWallet(id) {
  if (pg) {
    const r = await pg.query('SELECT * FROM casino_wallets WHERE discord_id=$1', [id]);
    return r.rows[0] ? rowToWallet(r.rows[0]) : null;
  }
  return jsonDb.wallets[id] || null;
}

const walletPending = {};
const seenRecently = new Map(); // id → timestamp ostatniego upserta (ogranicza zapisy do DB)
async function ensureWallet(user) {
  const { id, username } = user;
  const globalName = user.globalName || user.username;
  const avatar = user.avatar || null;
  const last = seenRecently.get(id);
  if (last && Date.now() - last < 60_000) { const w = await getWallet(id); if (w) return w; }
  if (walletPending[id]) return walletPending[id];
  walletPending[id] = (async () => {
    try {
      if (pg) {
        const r = await pg.query(`
          INSERT INTO casino_wallets (discord_id,username,global_name,avatar) VALUES ($1,$2,$3,$4)
          ON CONFLICT (discord_id) DO UPDATE SET username=EXCLUDED.username, global_name=EXCLUDED.global_name,
            avatar=COALESCE(EXCLUDED.avatar,casino_wallets.avatar), last_seen=NOW()
          RETURNING *, (xmax=0) AS is_new`, [id, username, globalName, avatar]);
        if (r.rows[0].is_new) console.log(`💳 Nowy portfel: ${globalName} (${START_BALANCE} AT$)`);
        seenRecently.set(id, Date.now());
        return rowToWallet(r.rows[0]);
      }
      const now = new Date().toISOString();
      if (!jsonDb.wallets[id]) {
        jsonDb.wallets[id] = { balance: START_BALANCE, username, globalName, avatar, totalWon: 0, totalLost: 0, gamesPlayed: 0, createdAt: now, lastSeen: now };
        console.log(`💳 Nowy portfel: ${globalName} (${START_BALANCE} AT$)`);
      } else Object.assign(jsonDb.wallets[id], { username, globalName, avatar: avatar || jsonDb.wallets[id].avatar, lastSeen: now });
      saveJson();
      seenRecently.set(id, Date.now());
      return jsonDb.wallets[id];
    } finally { delete walletPending[id]; }
  })();
  return walletPending[id];
}

async function updateBalance(id, delta) {
  delta = Math.trunc(Number(delta) || 0);
  if (pg) {
    const r = await pg.query(`
      UPDATE casino_wallets SET balance = GREATEST(0, balance+$2),
        total_won  = CASE WHEN $2>0 THEN total_won+$2 ELSE total_won END,
        total_lost = CASE WHEN $2<0 THEN total_lost-$2 ELSE total_lost END,
        last_seen = NOW()
      WHERE discord_id=$1 RETURNING balance`, [id, delta]);
    return r.rows[0] ? Number(r.rows[0].balance) : null;
  }
  const w = jsonDb.wallets[id];
  if (!w) return null;
  w.balance = Math.max(0, w.balance + delta);
  if (delta > 0) w.totalWon += delta; else w.totalLost -= delta;
  saveJson();
  return w.balance;
}

// Atomowe pobranie: nowe saldo albo null (brak środków)
async function debit(id, amount) {
  amount = Math.floor(Number(amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (pg) {
    const r = await pg.query(`
      UPDATE casino_wallets SET balance = balance - $2, total_lost = total_lost + $2, last_seen = NOW()
      WHERE discord_id=$1 AND balance >= $2 RETURNING balance`, [id, amount]);
    return r.rows[0] ? Number(r.rows[0].balance) : null;
  }
  const w = jsonDb.wallets[id];
  if (!w || w.balance < amount) return null;
  w.balance -= amount; w.totalLost += amount;
  saveJson();
  return w.balance;
}

async function recordGame(id) {
  if (pg) { await pg.query('UPDATE casino_wallets SET games_played=games_played+1 WHERE discord_id=$1', [id]); return; }
  const w = jsonDb.wallets[id];
  if (w) { w.gamesPlayed++; saveJson(); }
}

async function getAllWallets() {
  if (pg) {
    const r = await pg.query('SELECT * FROM casino_wallets ORDER BY balance DESC');
    return Object.fromEntries(r.rows.map(row => [row.discord_id, rowToWallet(row)]));
  }
  return jsonDb.wallets;
}

async function adminSetBalance(id, balance) {
  if (pg) {
    const r = await pg.query('UPDATE casino_wallets SET balance=$1, last_seen=NOW() WHERE discord_id=$2', [balance, id]);
    return r.rowCount > 0;
  }
  const w = jsonDb.wallets[id];
  if (!w) return false;
  w.balance = balance; saveJson();
  return true;
}

let lbCache = null, lbCacheAt = 0;
async function getLeaderboard(limit = 50) {
  if (lbCache && Date.now() - lbCacheAt < 5000) return lbCache.slice(0, limit);
  let rows;
  if (pg) {
    const r = await pg.query('SELECT * FROM casino_wallets ORDER BY balance DESC LIMIT 100');
    rows = r.rows.map(row => ({ discordId: row.discord_id, globalName: row.global_name, username: row.username, avatar: row.avatar, balance: Number(row.balance), totalWon: Number(row.total_won), totalLost: Number(row.total_lost), gamesPlayed: Number(row.games_played), profit: Number(row.total_won) - Number(row.total_lost) }));
  } else {
    rows = Object.entries(jsonDb.wallets).map(([id, w]) => ({ discordId: id, globalName: w.globalName, username: w.username, avatar: w.avatar, balance: w.balance, totalWon: w.totalWon, totalLost: w.totalLost, gamesPlayed: w.gamesPlayed, profit: w.totalWon - w.totalLost }))
      .sort((a, b) => b.balance - a.balance).slice(0, 100);
  }
  lbCache = rows; lbCacheAt = Date.now();
  return rows.slice(0, limit);
}

async function runWeeklyTopup() {
  const topped = [];
  if (pg) {
    const r = await pg.query(`
      UPDATE casino_wallets w SET balance=$2 FROM (SELECT discord_id, balance AS old FROM casino_wallets WHERE balance<$1) o
      WHERE w.discord_id=o.discord_id RETURNING w.discord_id, w.global_name, o.old`, [WEEKLY_MINIMUM, WEEKLY_TOP_UP]);
    r.rows.forEach(row => topped.push({ id: row.discord_id, name: row.global_name, added: WEEKLY_TOP_UP - Number(row.old) }));
    await pg.query('INSERT INTO casino_topup_log(count,details) VALUES($1,$2)', [topped.length, JSON.stringify(topped)]);
  } else {
    for (const [id, w] of Object.entries(jsonDb.wallets)) {
      if (w.balance < WEEKLY_MINIMUM) { topped.push({ id, name: w.globalName, added: WEEKLY_TOP_UP - w.balance }); w.balance = WEEKLY_TOP_UP; }
    }
    jsonDb.lastWeeklyTopup = new Date().toISOString();
    jsonDb.topupLog = [...(jsonDb.topupLog || []).slice(-51), { date: jsonDb.lastWeeklyTopup, count: topped.length }];
    saveJson();
  }
  console.log(`📅 Tygodniowe doładowanie AT$: uzupełniono ${topped.length} portfeli`);
  return topped;
}

// ─── STATYSTYKI GRACZA PER GRA ──────────────────────────────────
async function getSlotStats(id, gameId) {
  if (pg) {
    const r = await pg.query('SELECT spins,spent,won,best_win,pit_meter FROM casino_slot_stats WHERE discord_id=$1 AND game_id=$2', [id, gameId]);
    const row = r.rows[0];
    return row ? { spins: Number(row.spins), spent: Number(row.spent), won: Number(row.won), bestWin: Number(row.best_win), pitMeter: Number(row.pit_meter) } : { spins: 0, spent: 0, won: 0, bestWin: 0, pitMeter: 0 };
  }
  return jsonDb.slotStats[id + ':' + gameId] || { spins: 0, spent: 0, won: 0, bestWin: 0, pitMeter: 0 };
}
async function updateSlotStats(id, gameId, { spins = 0, spent = 0, won = 0, bestWin = 0, pitMeter = null }) {
  if (pg) {
    await pg.query(`
      INSERT INTO casino_slot_stats (discord_id, game_id, spins, spent, won, best_win, pit_meter)
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,0))
      ON CONFLICT (discord_id, game_id) DO UPDATE SET
        spins=casino_slot_stats.spins+$3, spent=casino_slot_stats.spent+$4, won=casino_slot_stats.won+$5,
        best_win=GREATEST(casino_slot_stats.best_win,$6),
        pit_meter=COALESCE($7, casino_slot_stats.pit_meter), updated_at=NOW()`,
      [id, gameId, spins, spent, won, bestWin, pitMeter]);
    return;
  }
  const key = id + ':' + gameId;
  const cur = jsonDb.slotStats[key] || { spins: 0, spent: 0, won: 0, bestWin: 0, pitMeter: 0 };
  jsonDb.slotStats[key] = { spins: cur.spins + spins, spent: cur.spent + spent, won: cur.won + won, bestWin: Math.max(cur.bestWin, bestWin), pitMeter: pitMeter !== null ? pitMeter : (cur.pitMeter || 0) };
  saveJson();
}

// ─── STAN GRACZA W AUTOMACIE (free spiny, liczniki) ──────────────
async function getSlotState(id, gameId) {
  if (pg) {
    const r = await pg.query('SELECT state FROM casino_slot_state WHERE discord_id=$1 AND game_id=$2', [id, gameId]);
    return r.rows[0]?.state || null;
  }
  return jsonDb.slotState[id + ':' + gameId] || null;
}
async function setSlotState(id, gameId, state) {
  if (pg) {
    await pg.query(`INSERT INTO casino_slot_state (discord_id, game_id, state) VALUES ($1,$2,$3)
      ON CONFLICT (discord_id, game_id) DO UPDATE SET state=EXCLUDED.state, updated_at=NOW()`, [id, gameId, JSON.stringify(state)]);
    return;
  }
  jsonDb.slotState[id + ':' + gameId] = state;
  saveJson();
}

// ─── USTAWIENIA (np. RTP gier) ───────────────────────────────────
async function getSetting(key) {
  if (pg) {
    const r = await pg.query('SELECT value FROM casino_settings WHERE key=$1', [key]);
    return r.rows[0]?.value ?? null;
  }
  return jsonDb.settings[key] ?? null;
}
async function setSetting(key, value) {
  if (pg) {
    await pg.query(`INSERT INTO casino_settings (key, value) VALUES ($1,$2)
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [key, JSON.stringify(value)]);
    return;
  }
  jsonDb.settings[key] = value;
  saveJson();
}

// ─── SUMY PER GRA (obserwowane RTP) ──────────────────────────────
async function addGameTotals(batch) { // { gameId: { rounds, wagered, returned } }
  const entries = Object.entries(batch);
  if (!entries.length) return;
  if (pg) {
    for (const [g, t] of entries) {
      await pg.query(`INSERT INTO casino_game_totals (game_id, rounds, wagered, returned) VALUES ($1,$2,$3,$4)
        ON CONFLICT (game_id) DO UPDATE SET rounds=casino_game_totals.rounds+$2, wagered=casino_game_totals.wagered+$3,
          returned=casino_game_totals.returned+$4, updated_at=NOW()`, [g, t.rounds, Math.round(t.wagered), Math.round(t.returned)]);
    }
    return;
  }
  for (const [g, t] of entries) {
    const cur = jsonDb.gameTotals[g] || { rounds: 0, wagered: 0, returned: 0 };
    jsonDb.gameTotals[g] = { rounds: cur.rounds + t.rounds, wagered: cur.wagered + t.wagered, returned: cur.returned + t.returned };
  }
  saveJson();
}
async function getGameTotals() {
  if (pg) {
    const r = await pg.query('SELECT * FROM casino_game_totals');
    return Object.fromEntries(r.rows.map(row => [row.game_id, { rounds: Number(row.rounds), wagered: Number(row.wagered), returned: Number(row.returned) }]));
  }
  return { ...jsonDb.gameTotals };
}
async function resetGameTotals(gameId) {
  if (pg) { await (gameId ? pg.query('DELETE FROM casino_game_totals WHERE game_id=$1', [gameId]) : pg.query('DELETE FROM casino_game_totals')); return; }
  if (gameId) delete jsonDb.gameTotals[gameId]; else jsonDb.gameTotals = {};
  saveJson();
}
async function getEconomySummary() {
  if (pg) {
    const r = await pg.query('SELECT COUNT(*) AS n, COALESCE(SUM(balance),0) AS total FROM casino_wallets');
    return { wallets: Number(r.rows[0].n), totalBalance: Number(r.rows[0].total) };
  }
  const ws = Object.values(jsonDb.wallets);
  return { wallets: ws.length, totalBalance: ws.reduce((s, w) => s + w.balance, 0) };
}

// ─── SESJE LOGOWANIA (express-session) ───────────────────────────
// Trzymane w bazie, żeby restart / deploy serwera nie wylogowywał graczy
async function sessionGet(sid) {
  if (pg) {
    const r = await pg.query('SELECT sess FROM app_sessions WHERE sid=$1 AND expire > NOW()', [sid]);
    return r.rows[0]?.sess ?? null;
  }
  const e = jsonDb.sessions[sid];
  if (!e) return null;
  if (e.expire < Date.now()) { delete jsonDb.sessions[sid]; saveJson(); return null; }
  return e.sess;
}
async function sessionSet(sid, sess, expireAt) {
  if (pg) {
    await pg.query(`INSERT INTO app_sessions (sid, sess, expire) VALUES ($1,$2,$3)
      ON CONFLICT (sid) DO UPDATE SET sess=EXCLUDED.sess, expire=EXCLUDED.expire`, [sid, JSON.stringify(sess), new Date(expireAt)]);
    return;
  }
  jsonDb.sessions[sid] = { sess, expire: expireAt };
  saveJson();
}
async function sessionTouch(sid, expireAt) {
  if (pg) { await pg.query('UPDATE app_sessions SET expire=$2 WHERE sid=$1', [sid, new Date(expireAt)]); return; }
  if (jsonDb.sessions[sid]) { jsonDb.sessions[sid].expire = expireAt; saveJson(); }
}
async function sessionDestroy(sid) {
  if (pg) { await pg.query('DELETE FROM app_sessions WHERE sid=$1', [sid]); return; }
  delete jsonDb.sessions[sid];
  saveJson();
}
async function pruneSessions() {
  if (pg) { const r = await pg.query('DELETE FROM app_sessions WHERE expire < NOW()'); return r.rowCount; }
  let n = 0;
  for (const [sid, e] of Object.entries(jsonDb.sessions)) if (e.expire < Date.now()) { delete jsonDb.sessions[sid]; n++; }
  if (n) saveJson();
  return n;
}

// ─── PROFIL GRACZA I HISTORIA ────────────────────────────────────
const HISTORY_KEEP = 200;   // tyle ostatnich wpisów na gracza
async function getMeta(id) {
  if (pg) { const r = await pg.query('SELECT data FROM casino_player_meta WHERE discord_id=$1', [id]); return r.rows[0]?.data ?? null; }
  return jsonDb.meta[id] ?? null;
}
async function setMeta(id, data) {
  if (pg) {
    await pg.query(`INSERT INTO casino_player_meta (discord_id, data) VALUES ($1,$2)
      ON CONFLICT (discord_id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`, [id, JSON.stringify(data)]);
    return;
  }
  jsonDb.meta[id] = data; saveJson();
}
// rows: [{ discordId, ts, game, kind, bet, win, balance, note }]
async function addHistory(rows) {
  if (!rows.length) return;
  if (pg) {
    const vals = [], args = [];
    rows.forEach((r, i) => {
      const o = i * 8;
      vals.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8})`);
      args.push(r.discordId, new Date(r.ts), r.game, r.kind, Math.round(r.bet || 0), Math.round(r.win || 0), r.balance ?? null, r.note ?? null);
    });
    await pg.query(`INSERT INTO casino_history (discord_id, ts, game, kind, bet, win, balance, note) VALUES ${vals.join(',')}`, args);
    return;
  }
  for (const r of rows) {
    const list = (jsonDb.history[r.discordId] ||= []);
    list.unshift({ ts: r.ts, game: r.game, kind: r.kind, bet: r.bet || 0, win: r.win || 0, balance: r.balance ?? null, note: r.note ?? null });
    if (list.length > HISTORY_KEEP) list.length = HISTORY_KEEP;
  }
  saveJson();
}
async function getHistory(id, limit = 50) {
  limit = Math.max(1, Math.min(HISTORY_KEEP, limit));
  if (pg) {
    const r = await pg.query('SELECT ts, game, kind, bet, win, balance, note FROM casino_history WHERE discord_id=$1 ORDER BY id DESC LIMIT $2', [id, limit]);
    return r.rows.map(x => ({ ts: x.ts, game: x.game, kind: x.kind, bet: Number(x.bet), win: Number(x.win), balance: x.balance === null ? null : Number(x.balance), note: x.note }));
  }
  return (jsonDb.history[id] || []).slice(0, limit);
}
// Usuwa wpisy starsze niż 30 dni (PG; JSON i tak trzyma tylko ostatnie HISTORY_KEEP)
async function pruneHistory() {
  if (pg) await pg.query("DELETE FROM casino_history WHERE ts < NOW() - INTERVAL '30 days'");
}

module.exports = {
  init, close, flushJsonSync, whenReady,
  getMeta, setMeta, addHistory, getHistory, pruneHistory,
  sessionGet, sessionSet, sessionTouch, sessionDestroy, pruneSessions,
  getWallet, ensureWallet, updateBalance, debit, recordGame, getAllWallets, adminSetBalance, getLeaderboard, runWeeklyTopup,
  getSlotStats, updateSlotStats, getSlotState, setSlotState, getSetting, setSetting,
  addGameTotals, getGameTotals, resetGameTotals, getEconomySummary,
  START_BALANCE, WEEKLY_MINIMUM, WEEKLY_TOP_UP,
  get usingPg() { return !!pg; },
};
