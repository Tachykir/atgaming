/**
 * ═══════════════════════════════════════════════════════════════
 *  SYSTEM KASYNA AT GAMING
 *  Baza danych:
 *    - PostgreSQL (Railway) gdy DATABASE_URL jest ustawione
 *    - JSON file jako fallback (lokalne dev)
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const START_BALANCE  = 10_000;
const WEEKLY_MINIMUM = 1_000;
const WEEKLY_TOP_UP  = 10_000;

const USE_PG = !!process.env.DATABASE_URL;
let pg = null;

// ─── POSTGRES ───────────────────────────────────────────────────
async function initPg() {
  const { Pool } = require('pg');
  pg = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pg.query(`
    CREATE TABLE IF NOT EXISTS casino_wallets (
      discord_id    TEXT PRIMARY KEY,
      username      TEXT NOT NULL,
      global_name   TEXT NOT NULL,
      avatar        TEXT,
      balance       INTEGER NOT NULL DEFAULT ${START_BALANCE},
      total_won     INTEGER NOT NULL DEFAULT 0,
      total_lost    INTEGER NOT NULL DEFAULT 0,
      games_played  INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS casino_topup_log (
      id      SERIAL PRIMARY KEY,
      ran_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      count   INTEGER NOT NULL,
      details JSONB
    );
  `);
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
  return { balance:row.balance, username:row.username, globalName:row.global_name, avatar:row.avatar, totalWon:row.total_won, totalLost:row.total_lost, gamesPlayed:row.games_played, createdAt:row.created_at, lastSeen:row.last_seen };
}

async function getWallet(discordId) {
  if (pg) {
    const r = await pg.query('SELECT * FROM casino_wallets WHERE discord_id=$1',[discordId]);
    return r.rows[0] ? rowToWallet(r.rows[0]) : null;
  }
  return jsonDb.wallets[discordId] || null;
}

async function ensureWallet(discordUser) {
  const { id, username } = discordUser;
  const globalName = discordUser.globalName || discordUser.username;
  const avatar     = discordUser.avatar || null;

  if (pg) {
    const r = await pg.query(`
      INSERT INTO casino_wallets (discord_id,username,global_name,avatar)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (discord_id) DO UPDATE SET
        username=EXCLUDED.username, global_name=EXCLUDED.global_name,
        avatar=COALESCE(EXCLUDED.avatar,casino_wallets.avatar), last_seen=NOW()
      RETURNING *`,[id,username,globalName,avatar]);
    const w = rowToWallet(r.rows[0]);
    if (r.rows[0].games_played===0 && r.rows[0].balance===START_BALANCE)
      console.log(`💳 Nowy portfel: ${globalName} (${START_BALANCE} AT$)`);
    return w;
  }
  if (!jsonDb.wallets[id]) {
    jsonDb.wallets[id] = { balance:START_BALANCE, username, globalName, avatar, totalWon:0, totalLost:0, gamesPlayed:0, createdAt:new Date().toISOString(), lastSeen:new Date().toISOString() };
    console.log(`💳 Nowy portfel: ${globalName} (${START_BALANCE} AT$)`);
  } else {
    Object.assign(jsonDb.wallets[id], { username, globalName, avatar:avatar||jsonDb.wallets[id].avatar, lastSeen:new Date().toISOString() });
  }
  saveJsonDb();
  return jsonDb.wallets[id];
}

async function updateBalance(discordId, delta) {
  if (pg) {
    const r = await pg.query(`
      UPDATE casino_wallets SET
        balance     = GREATEST(0, balance+$2),
        total_won   = CASE WHEN $2>0 THEN total_won+$2   ELSE total_won   END,
        total_lost  = CASE WHEN $2<0 THEN total_lost+(-$2) ELSE total_lost END,
        last_seen   = NOW()
      WHERE discord_id=$1 RETURNING balance`,[discordId,delta]);
    return r.rows[0]?.balance ?? null;
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
    setTimeout(async()=>{ const topped=await runWeeklyTopup(); if(io&&topped.length>0) io.emit('weeklyTopup',{count:topped.length,message:`📅 Tygodniowe doładowanie! ${topped.length} graczy otrzymało AT$ do 10 000`}); schedule(); },delay);
  }
  schedule();
}

// ─── STOŁY ───────────────────────────────────────────────────────
const casinoTables = {};
const TABLE_CONFIGS = {
  poker: [
    { id:'poker-micro', name:'Micro Stakes', blindAmount:10,  minBuyIn:200,  maxBuyIn:2000,  maxPlayers:6 },
    { id:'poker-low',   name:'Low Stakes',   blindAmount:50,  minBuyIn:1000, maxBuyIn:5000,  maxPlayers:6 },
    { id:'poker-high',  name:'High Stakes',  blindAmount:200, minBuyIn:4000, maxBuyIn:20000, maxPlayers:6 },
  ],
  blackjack: [
    { id:'bj-classic', name:'Classic', minBet:50,  maxBet:500,  maxPlayers:5 },
    { id:'bj-vip',     name:'VIP',     minBet:250, maxBet:2500, maxPlayers:4 },
  ],
};

function initTables() {
  for (const cfg of TABLE_CONFIGS.poker)     casinoTables[cfg.id]={ id:cfg.id, game:'poker',     name:cfg.name, config:cfg, players:[], observers:[], status:'open', gameState:null, round:0, dealerIdx:0 };
  for (const cfg of TABLE_CONFIGS.blackjack) casinoTables[cfg.id]={ id:cfg.id, game:'blackjack', name:cfg.name, config:cfg, players:[], observers:[], status:'open', gameState:null, round:0 };
  console.log(`🃏 Zainicjowano ${Object.keys(casinoTables).length} stołów kasyna`);
}

function getTablePublic(table) {
  return { id:table.id, game:table.game, name:table.name, config:table.config, status:table.status, round:table.round, playerCount:table.players.length, maxPlayers:table.config.maxPlayers, players:table.players.map(p=>({name:p.name,avatar:p.avatar,discordId:p.discordId,sessionChips:p.sessionChips,seatIndex:p.seatIndex})), observers:table.observers.length };
}

module.exports = {
  init, getWallet, ensureWallet, updateBalance, recordGame, getLeaderboard,
  scheduleWeeklyTopup, runWeeklyTopup,
  casinoTables, TABLE_CONFIGS, getTablePublic, initTables,
  START_BALANCE, WEEKLY_MINIMUM, WEEKLY_TOP_UP,
  get db() { return jsonDb; }, saveDb: saveJsonDb,
};
