/**
 * ═══════════════════════════════════════════════════════════════
 *  SYSTEM KASYNA AT GAMING
 *  Baza danych:
 *    - PostgreSQL (Railway) gdy DATABASE_URL jest ustawione
 *    - JSON file jako fallback (lokalne dev)
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const START_BALANCE  = 100_000;
const WEEKLY_MINIMUM = 10_000;
const WEEKLY_TOP_UP  = 100_000;

const USE_PG = !!process.env.DATABASE_URL;
let pg = null;

// ─── POSTGRES ───────────────────────────────────────────────────
async function initPg() {
  const { Pool } = require('pg');
  pg = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  // Migracja: INTEGER → BIGINT dla dużych sald
  // Osobne query dla każdej kolumny — niektóre PG nie obsługują wielu ALTER COLUMN naraz
  for (const col of ['balance', 'total_won', 'total_lost']) {
    await pg.query(`ALTER TABLE casino_wallets ALTER COLUMN ${col} TYPE BIGINT`)
      .then(() => console.log(`✅ Migracja: ${col} → BIGINT`))
      .catch(e => {
        if (e.message.includes('does not exist')) return; // tabela jeszcze nie istnieje
        if (e.message.includes('already') || e.code === '42804') return; // już BIGINT
        console.log(`ℹ️ Migracja ${col}: ${e.message}`);
      });
  }

  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_wallets (
      discord_id    TEXT PRIMARY KEY,
      username      TEXT NOT NULL,
      global_name   TEXT NOT NULL,
      avatar        TEXT,
      balance       BIGINT NOT NULL DEFAULT ${START_BALANCE},
      total_won     BIGINT NOT NULL DEFAULT 0,
      total_lost    BIGINT NOT NULL DEFAULT 0,
      games_played  INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_topup_log (
      id      SERIAL PRIMARY KEY,
      ran_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      count   INTEGER NOT NULL,
      details JSONB
    )
  `);
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_slot_stats (
      discord_id  TEXT NOT NULL,
      game_id     TEXT NOT NULL,
      spins       BIGINT NOT NULL DEFAULT 0,
      spent       BIGINT NOT NULL DEFAULT 0,
      won         BIGINT NOT NULL DEFAULT 0,
      best_win    BIGINT NOT NULL DEFAULT 0,
      pit_meter   INTEGER NOT NULL DEFAULT 0,
      recent_wins JSONB NOT NULL DEFAULT '[]',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (discord_id, game_id)
    )
  `);
  // Migracja dla istniejących baz
  await pg.query(`ALTER TABLE casino_slot_stats ADD COLUMN IF NOT EXISTS pit_meter INTEGER NOT NULL DEFAULT 0`).catch(()=>{});
  await pg.query(`ALTER TABLE casino_slot_stats ADD COLUMN IF NOT EXISTS recent_wins JSONB NOT NULL DEFAULT '[]'`).catch(()=>{});
  console.log('🐘 Casino: połączono z PostgreSQL');
}

// ─── JSON FALLBACK ───────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, 'casino_data.json');
let jsonDb = { wallets: {}, topupLog: [], lastWeeklyTopup: null };

function loadJsonDb() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      jsonDb = { ...jsonDb, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
      console.log(`💾 Casino JSON DB: ${Object.keys(jsonDb.wallets).length} portfeli`);
    }
  } catch(e) { console.error('Casino JSON load error:', e.message); }
}
function saveJsonDb() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(jsonDb, null, 2)); }
  catch(e) { console.error('Casino JSON save error:', e.message); }
}

// ─── INICJALIZACJA ───────────────────────────────────────────────
let _ready = false;
async function init() {
  if (_ready) return;
  if (USE_PG) {
    try { await initPg(); }
    catch(e) {
      console.error('❌ PostgreSQL błąd, fallback na JSON:', e.message);
      pg = null; loadJsonDb();
    }
  } else {
    console.log('💾 Casino: tryb JSON (brak DATABASE_URL)');
    loadJsonDb();
  }
  _ready = true;
}

// ─── PORTFELE ────────────────────────────────────────────────────
function rowToWallet(row) {
  return { balance:Number(row.balance), username:row.username, globalName:row.global_name, avatar:row.avatar, totalWon:Number(row.total_won), totalLost:Number(row.total_lost), gamesPlayed:Number(row.games_played), createdAt:row.created_at, lastSeen:row.last_seen };
}

async function getWallet(discordId) {
  if (pg) {
    const r = await pg.query('SELECT * FROM casino_wallets WHERE discord_id=$1',[discordId]);
    return r.rows[0] ? rowToWallet(r.rows[0]) : null;
  }
  return jsonDb.wallets[discordId] || null;
}

const walletCache = {}; // discord_id → wallet (in-memory, czyszczony co godzinę)
const walletPending = {}; // discord_id → Promise (zapobiega równoczesnym tworzeniom portfela)
setInterval(() => { Object.keys(walletCache).forEach(k => delete walletCache[k]); }, 3600_000);

async function ensureWallet(discordUser) {
  const { id, username } = discordUser;
  const globalName = discordUser.globalName || discordUser.username;
  if (walletCache[id]) return walletCache[id]; // cache hit — nie bij w DB

  // Jeśli inne wywołanie już czeka na ten sam portfel — dołącz do jego Promise
  // Zapobiega race condition gdzie dwa równoczesne requesty tworzą dwa wpisy
  if (walletPending[id]) return walletPending[id];

  walletPending[id] = (async () => {
    try {
      const avatar = discordUser.avatar || null;

      if (pg) {
        const r = await pg.query(`
          INSERT INTO casino_wallets (discord_id,username,global_name,avatar)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (discord_id) DO UPDATE SET
            username=EXCLUDED.username, global_name=EXCLUDED.global_name,
            avatar=COALESCE(EXCLUDED.avatar,casino_wallets.avatar), last_seen=NOW()
          RETURNING *, (xmax=0) AS is_new`,[id,username,globalName,avatar]);
        const w = rowToWallet(r.rows[0]);
        if (r.rows[0].is_new)
          console.log(`💳 Nowy portfel: ${globalName} (${START_BALANCE} AT$)`);
        walletCache[id] = w;
        return w;
      }
      if (!jsonDb.wallets[id]) {
        jsonDb.wallets[id] = { balance:START_BALANCE, username, globalName, avatar, totalWon:0, totalLost:0, gamesPlayed:0, createdAt:new Date().toISOString(), lastSeen:new Date().toISOString() };
        console.log(`💳 Nowy portfel: ${globalName} (${START_BALANCE} AT$)`);
      } else {
        Object.assign(jsonDb.wallets[id], { username, globalName, avatar:avatar||jsonDb.wallets[id].avatar, lastSeen:new Date().toISOString() });
      }
      saveJsonDb();
      walletCache[id] = jsonDb.wallets[id];
      return jsonDb.wallets[id];
    } finally {
      delete walletPending[id];
    }
  })();

  return walletPending[id];
}

async function updateBalance(discordId, delta) {
  delete walletCache[discordId]; // uniewazniaj cache — saldo sie zmienilo
  if (pg) {
    const r = await pg.query(`
      UPDATE casino_wallets SET
        balance     = GREATEST(0, balance+$2),
        total_won   = CASE WHEN $2>0 THEN total_won+$2   ELSE total_won   END,
        total_lost  = CASE WHEN $2<0 THEN total_lost+(-$2) ELSE total_lost END,
        last_seen   = NOW()
      WHERE discord_id=$1 RETURNING balance`,[discordId,delta]);
    return r.rows[0] ? Number(r.rows[0].balance) : null;
  }
  const w = jsonDb.wallets[discordId];
  if (!w) return null;
  w.balance = Math.max(0, w.balance+delta);
  if (delta>0) w.totalWon+=delta; else w.totalLost+=Math.abs(delta);
  saveJsonDb();
  return w.balance;
}

async function recordGame(discordId) {
  if (pg) { await pg.query('UPDATE casino_wallets SET games_played=games_played+1 WHERE discord_id=$1',[discordId]); return; }
  const w = jsonDb.wallets[discordId];
  if (w) { w.gamesPlayed++; saveJsonDb(); }
}

// ─── WSZYSTKIE PORTFELE (admin) ─────────────────────────────────
async function getAllWallets() {
  if (pg) {
    const r = await pg.query(`SELECT discord_id,username,global_name,avatar,balance,total_won,total_lost,games_played FROM casino_wallets ORDER BY balance DESC`);
    const result = {};
    for (const row of r.rows) {
      result[row.discord_id] = {
        balance: Number(row.balance),
        username: row.username,
        globalName: row.global_name,
        avatar: row.avatar,
        totalWon: Number(row.total_won),
        totalLost: Number(row.total_lost),
        gamesPlayed: Number(row.games_played),
      };
    }
    return result;
  }
  return jsonDb.wallets;
}

// ─── ADMIN: bezpośredni SET salda (omija GREATEST) ─────────────
async function adminSetBalance(discordId, newBalance) {
  delete walletCache[discordId];
  if (pg) {
    const r = await pg.query(
      'UPDATE casino_wallets SET balance=$1, last_seen=NOW() WHERE discord_id=$2 RETURNING discord_id',
      [newBalance, discordId]
    );
    return r.rowCount > 0;
  }
  const w = jsonDb.wallets[discordId];
  if (!w) return false;
  w.balance = newBalance;
  saveJsonDb();
  return true;
}

// ─── RANKING ────────────────────────────────────────────────────
async function getLeaderboard(limit=50) {
  if (pg) {
    const r = await pg.query(`SELECT discord_id,username,global_name,avatar,balance,total_won,total_lost,games_played,(total_won-total_lost) AS profit FROM casino_wallets ORDER BY balance DESC LIMIT $1`,[limit]);
    return r.rows.map(row=>({ discordId:row.discord_id, globalName:row.global_name, username:row.username, avatar:row.avatar, balance:row.balance, totalWon:row.total_won, totalLost:row.total_lost, gamesPlayed:row.games_played, profit:row.profit }));
  }
  return Object.entries(jsonDb.wallets).map(([id,w])=>({ discordId:id, globalName:w.globalName, username:w.username, avatar:w.avatar, balance:w.balance, totalWon:w.totalWon, totalLost:w.totalLost, gamesPlayed:w.gamesPlayed, profit:w.totalWon-w.totalLost })).sort((a,b)=>b.balance-a.balance).slice(0,limit);
}

// ─── TYGODNIOWE DOŁADOWANIE ─────────────────────────────────────
async function runWeeklyTopup() {
  const topped = [];
  if (pg) {
    const r = await pg.query('SELECT discord_id,global_name,balance FROM casino_wallets WHERE balance<$1',[WEEKLY_MINIMUM]);
    for (const row of r.rows) {
      const added = WEEKLY_TOP_UP - row.balance;
      await pg.query('UPDATE casino_wallets SET balance=$1 WHERE discord_id=$2',[WEEKLY_TOP_UP,row.discord_id]);
      topped.push({ id:row.discord_id, name:row.global_name, added });
    }
    await pg.query('INSERT INTO casino_topup_log(count,details) VALUES($1,$2)',[topped.length,JSON.stringify(topped)]);
  } else {
    for (const [id,w] of Object.entries(jsonDb.wallets)) {
      if (w.balance<WEEKLY_MINIMUM) { const added=WEEKLY_TOP_UP-w.balance; w.balance=WEEKLY_TOP_UP; topped.push({id,name:w.globalName,added}); }
    }
    jsonDb.lastWeeklyTopup=new Date().toISOString();
    jsonDb.topupLog=[...(jsonDb.topupLog||[]).slice(-51),{date:new Date().toISOString(),count:topped.length}];
    saveJsonDb();
  }
  console.log(`\n📅 Tygodniowe doładowanie AT$: uzupełniono ${topped.length} portfeli`);
  topped.forEach(t=>console.log(`   💳 ${t.name}: +${t.added} AT$`));
  return topped;
}

function scheduleWeeklyTopup(io) {
  function nextSunday() {
    const now=new Date(), diff=now.getDay()===0?7:7-now.getDay(), next=new Date(now);
    next.setDate(now.getDate()+diff); next.setHours(0,0,0,0); return next;
  }
  async function schedule() {
    const next=nextSunday(), delay=next.getTime()-Date.now();
    console.log(`⏰ Następne doładowanie AT$: ${next.toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'})} (za ${Math.round(delay/3600000)}h)`);
    setTimeout(async()=>{ const topped=await runWeeklyTopup(); if(io&&topped.length>0) io.emit('weeklyTopup',{count:topped.length,message:`📅 Tygodniowe doładowanie! ${topped.length} graczy otrzymało AT$ do 100 000`}); schedule(); },delay);
  }
  schedule();
}

// ─── STOŁY ───────────────────────────────────────────────────────
const casinoTables = {};
let tableIdCounter = 1;

// ─── TWORZENIE STOŁÓW (dynamiczne) ──────────────────────────────
function createTable({ game, name, config }) {
  const id = `${game}-${Date.now()}-${tableIdCounter++}`;
  const base = { id, game, name, config, players:[], observers:[], status:'open', gameState:null, round:0 };
  if (game==='poker')    Object.assign(base, { dealerIdx:0 });
  casinoTables[id] = base;
  console.log(`🎰 Nowy stół [${game}]: "${name}" (id: ${id})`);
  return base;
}

function deleteTable(tableId) {
  const t = casinoTables[tableId];
  if (!t) return false;
  if (t.players.length > 0) return false; // nie usuwaj zajętego stołu
  // FIX #19: Wyczyść timer countdown ruletki przed usunięciem stołu
  if (t.gameState?.timer) clearInterval(t.gameState.timer);
  if (t.gameState?.spinTimer) clearTimeout(t.gameState.spinTimer);
  delete casinoTables[tableId];
  return true;
}

// Predefiniowane jednorazowo (na start serwera) - można też tworzyć przez API
function initTables() {
  // Lucky Fruits — 3 warianty stawek
  createTable({ game:'slots', name:'Lucky Fruits — Low',    config:{ minBet:10,   maxBet:5000,   maxPlayers:99 }});
  createTable({ game:'slots', name:'Lucky Fruits — Medium', config:{ minBet:100,  maxBet:25000,  maxPlayers:99 }});
  createTable({ game:'slots', name:'Lucky Fruits — High',   config:{ minBet:1000, maxBet:100000, maxPlayers:99 }});
  // Ruletka
  createTable({ game:'roulette', name:'Ruletka Europejska', config:{ minBet:50, maxBet:2000, maxPlayers:20 }});
  // Pachinko
  createTable({ game:'pachinko', name:'Pachinko',  config:{ minBet:25, maxBet:500, maxPlayers:99 }});
  // Crash — stały stół (pętla startuje w server.js po init)
  createTable({ game:'crash', name:'Crash 🚀', config:{ minBet:50, maxBet:10000 }});
  // Path of Gambling — 3 warianty stawek
  createTable({ game:'path_of_gambling', name:'Path of Gambling — Low',    config:{ minBet:10,   maxBet:5000,   maxPlayers:99 }});
  createTable({ game:'path_of_gambling', name:'Path of Gambling — Medium', config:{ minBet:100,  maxBet:25000,  maxPlayers:99 }});
  createTable({ game:'path_of_gambling', name:'Path of Gambling — High',   config:{ minBet:1000, maxBet:100000, maxPlayers:99 }});
  console.log(`🃏 Zainicjowano ${Object.keys(casinoTables).length} stołów kasyna`);
}

function getTablePublic(table) {
  return {
    id:table.id, game:table.game, name:table.name, config:table.config,
    status:table.status, round:table.round,
    playerCount:table.players.length, maxPlayers:table.config.maxPlayers,
    players:table.players.map(p=>({name:p.name,avatar:p.avatar,discordId:p.discordId,sessionChips:p.sessionChips,seatIndex:p.seatIndex})),
    observers:table.observers.length,
    createdBy: table.createdBy || null,
  };
}

// ─── STATYSTYKI SLOTÓW per gracz per gra ────────────────────────
async function getSlotStats(discordId, gameId) {
  if (pg) {
    const r = await pg.query(
      'SELECT spins,spent,won,best_win,pit_meter,recent_wins FROM casino_slot_stats WHERE discord_id=$1 AND game_id=$2',
      [discordId, gameId]
    );
    if (r.rows[0]) {
      const row = r.rows[0];
      return { spins: Number(row.spins), spent: Number(row.spent), won: Number(row.won), bestWin: Number(row.best_win), pitMeter: Number(row.pit_meter||0), recentWins: row.recent_wins || [] };
    }
    return { spins: 0, spent: 0, won: 0, bestWin: 0, pitMeter: 0, recentWins: [] };
  }
  // JSON fallback
  const key = discordId + ':' + gameId;
  const d = jsonDb.slotStats?.[key] || {};
  return { spins: d.spins||0, spent: d.spent||0, won: d.won||0, bestWin: d.bestWin||0, pitMeter: d.pitMeter||0, recentWins: d.recentWins||[] };
}

async function updateSlotStats(discordId, gameId, { spins = 0, spent = 0, won = 0, bestWin = 0, pitMeter = null, recentWin = null }) {
  if (pg) {
    // Buduj dynamiczny UPDATE żeby obsłużyć opcjonalne pola
    const params = [discordId, gameId, spins, spent, won, bestWin];
    let extraSet = '';
    if (pitMeter !== null) { params.push(pitMeter); extraSet += `, pit_meter = $${params.length}`; }
    if (recentWin !== null) {
      params.push(JSON.stringify(recentWin));
      // Dodaj na początek listy, przytnij do 20 wpisów
      extraSet += `, recent_wins = (SELECT jsonb_agg(x) FROM (SELECT x FROM jsonb_array_elements($${params.length}::jsonb || recent_wins) AS x LIMIT 20) sub)`;
    }
    await pg.query(`
      INSERT INTO casino_slot_stats (discord_id, game_id, spins, spent, won, best_win)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (discord_id, game_id) DO UPDATE SET
        spins    = casino_slot_stats.spins    + $3,
        spent    = casino_slot_stats.spent    + $4,
        won      = casino_slot_stats.won      + $5,
        best_win = GREATEST(casino_slot_stats.best_win, $6),
        updated_at = NOW()${extraSet}
    `, params);
    return;
  }
  if (!jsonDb.slotStats) jsonDb.slotStats = {};
  const key = discordId + ':' + gameId;
  const cur = jsonDb.slotStats[key] || { spins: 0, spent: 0, won: 0, bestWin: 0, pitMeter: 0, recentWins: [] };
  cur.spins   += spins;
  cur.spent   += spent;
  cur.won     += won;
  cur.bestWin  = Math.max(cur.bestWin, bestWin);
  if (pitMeter !== null) cur.pitMeter = pitMeter;
  if (recentWin !== null) { cur.recentWins = [recentWin, ...(cur.recentWins||[])].slice(0, 20); }
  jsonDb.slotStats[key] = cur;
  saveJsonDb();
}

module.exports = {
  init, getWallet, ensureWallet, updateBalance, recordGame, getLeaderboard, getAllWallets, adminSetBalance,
  getSlotStats, updateSlotStats,
  scheduleWeeklyTopup, runWeeklyTopup,
  casinoTables, createTable, deleteTable, getTablePublic, initTables,
  START_BALANCE, WEEKLY_MINIMUM, WEEKLY_TOP_UP,
  get db() { return jsonDb; }, saveDb: saveJsonDb,
};
