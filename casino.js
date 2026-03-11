/**
 * ═══════════════════════════════════════════════════════════════
 *  SYSTEM KASYNA AT GAMING
 *  Zarządza walutą AT$, stołami pokera i blackjacka
 *  oraz tygodniowym doładowaniem w niedzielę
 * ═══════════════════════════════════════════════════════════════
 */

const START_BALANCE   = 10_000;   // AT$ na start
const WEEKLY_MINIMUM  = 1_000;    // jeśli poniżej → uzupełnij do 10 000
const WEEKLY_TOP_UP   = 10_000;   // do tej kwoty uzupełniamy

// ─── BAZA DANYCH (in-memory, persist przez JSON file) ───────────
const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'casino_data.json');

let db = {
  wallets: {},       // discordId -> { balance, username, globalName, avatar, totalWon, totalLost, gamesPlayed, lastSeen }
  topupLog: [],      // historia tygodniowych doładowań
  lastWeeklyTopup: null,  // ISO date string
};

function loadDb() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      db = { ...db, ...JSON.parse(raw) };
      console.log(`💰 Casino DB załadowane: ${Object.keys(db.wallets).length} portfeli`);
    }
  } catch(e) {
    console.error('Casino DB load error:', e.message);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch(e) {
    console.error('Casino DB save error:', e.message);
  }
}

loadDb();

// ─── PORTFEL ────────────────────────────────────────────────────
function getWallet(discordId) {
  return db.wallets[discordId] || null;
}

function ensureWallet(discordUser) {
  const id = discordUser.id;
  if (!db.wallets[id]) {
    db.wallets[id] = {
      balance:     START_BALANCE,
      username:    discordUser.username,
      globalName:  discordUser.globalName || discordUser.username,
      avatar:      discordUser.avatar || null,
      totalWon:    0,
      totalLost:   0,
      gamesPlayed: 0,
      createdAt:   new Date().toISOString(),
      lastSeen:    new Date().toISOString(),
    };
    saveDb();
    console.log(`💳 Nowy portfel: ${db.wallets[id].globalName} (${START_BALANCE} AT$)`);
  } else {
    // Aktualizuj dane z Discorda
    db.wallets[id].username   = discordUser.username;
    db.wallets[id].globalName = discordUser.globalName || discordUser.username;
    db.wallets[id].avatar     = discordUser.avatar || db.wallets[id].avatar;
    db.wallets[id].lastSeen   = new Date().toISOString();
  }
  return db.wallets[id];
}

function updateBalance(discordId, delta) {
  const w = db.wallets[discordId];
  if (!w) return null;
  w.balance = Math.max(0, w.balance + delta);
  if (delta > 0) w.totalWon  += delta;
  else           w.totalLost += Math.abs(delta);
  saveDb();
  return w.balance;
}

function recordGame(discordId) {
  const w = db.wallets[discordId];
  if (w) { w.gamesPlayed++; saveDb(); }
}

// ─── RANKING ────────────────────────────────────────────────────
function getLeaderboard(limit = 20) {
  return Object.entries(db.wallets)
    .map(([id, w]) => ({
      discordId:   id,
      globalName:  w.globalName,
      username:    w.username,
      avatar:      w.avatar,
      balance:     w.balance,
      totalWon:    w.totalWon,
      totalLost:   w.totalLost,
      gamesPlayed: w.gamesPlayed,
      profit:      w.totalWon - w.totalLost,
    }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, limit);
}

// ─── TYGODNIOWE DOŁADOWANIE ─────────────────────────────────────
function runWeeklyTopup() {
  const now  = new Date();
  const topped = [];

  for (const [id, w] of Object.entries(db.wallets)) {
    if (w.balance < WEEKLY_MINIMUM) {
      const added = WEEKLY_TOP_UP - w.balance;
      w.balance   = WEEKLY_TOP_UP;
      topped.push({ id, name: w.globalName, added });
    }
  }

  db.lastWeeklyTopup = now.toISOString();
  db.topupLog.push({ date: now.toISOString(), count: topped.length, players: topped });
  if (db.topupLog.length > 52) db.topupLog = db.topupLog.slice(-52); // max rok historii
  saveDb();

  console.log(`\n📅 Tygodniowe doładowanie AT$: uzupełniono ${topped.length} portfeli`);
  topped.forEach(t => console.log(`   💳 ${t.name}: +${t.added} AT$`));
  return topped;
}

// ─── SCHEDULER: co niedzielę o 00:00 ────────────────────────────
function scheduleWeeklyTopup(io) {
  function getNextSunday() {
    const now  = new Date();
    const day  = now.getDay(); // 0=niedziela
    const diff = day === 0 ? 7 : (7 - day); // dni do następnej niedzieli
    const next = new Date(now);
    next.setDate(now.getDate() + diff);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function schedule() {
    const next  = getNextSunday();
    const delay = next.getTime() - Date.now();
    console.log(`⏰ Następne doładowanie AT$: ${next.toLocaleDateString('pl-PL', { weekday:'long', day:'numeric', month:'long' })} (za ${Math.round(delay/3600000)}h)`);

    setTimeout(() => {
      const topped = runWeeklyTopup();
      // Powiadom wszystkich podłączonych
      if (io && topped.length > 0) {
        io.emit('weeklyTopup', {
          count: topped.length,
          message: `📅 Tygodniowe doładowanie! ${topped.length} graczy otrzymało AT$ do 10 000`,
        });
      }
      schedule(); // zaplanuj następne
    }, delay);
  }

  schedule();
}

// ─── STOŁY KASYNA ───────────────────────────────────────────────
// Stół = persistentny pokój bez kodu, do którego można dołączyć
// przed startem każdej rundy

const casinoTables = {};
// tableId -> { id, game:'poker'|'blackjack', name, config, players:[], status:'open'|'playing', round:0, ... }

let tableCounter = 1;

const TABLE_CONFIGS = {
  poker: [
    { id:'poker-micro', name:'Micro Stakes',  blindAmount:10,  minBuyIn:200,  maxBuyIn:2000,  maxPlayers:6 },
    { id:'poker-low',   name:'Low Stakes',    blindAmount:50,  minBuyIn:1000, maxBuyIn:5000,  maxPlayers:6 },
    { id:'poker-high',  name:'High Stakes',   blindAmount:200, minBuyIn:4000, maxBuyIn:20000, maxPlayers:6 },
  ],
  blackjack: [
    { id:'bj-classic', name:'Classic',  minBet:50,  maxBet:500,  maxPlayers:5 },
    { id:'bj-vip',     name:'VIP',      minBet:250, maxBet:2500, maxPlayers:4 },
  ],
};

function initTables() {
  // Poker
  for (const cfg of TABLE_CONFIGS.poker) {
    casinoTables[cfg.id] = {
      id:         cfg.id,
      game:       'poker',
      name:       cfg.name,
      config:     cfg,
      players:    [],  // { socketId, discordId, name, avatar, sessionChips, seatIndex }
      observers:  [],
      status:     'open',  // open | playing
      gameState:  null,
      round:      0,
      dealerIdx:  0,
      deck:       [],
      deckIdx:    0,
    };
  }
  // Blackjack
  for (const cfg of TABLE_CONFIGS.blackjack) {
    casinoTables[cfg.id] = {
      id:         cfg.id,
      game:       'blackjack',
      name:       cfg.name,
      config:     cfg,
      players:    [],
      observers:  [],
      status:     'open',
      gameState:  null,
      round:      0,
    };
  }
  console.log(`🃏 Zainicjowano ${Object.keys(casinoTables).length} stołów kasyna`);
}

function getTablePublic(table) {
  return {
    id:         table.id,
    game:       table.game,
    name:       table.name,
    config:     table.config,
    status:     table.status,
    round:      table.round,
    playerCount: table.players.length,
    maxPlayers:  table.config.maxPlayers,
    players:    table.players.map(p => ({
      name:       p.name,
      avatar:     p.avatar,
      discordId:  p.discordId,
      sessionChips: p.sessionChips,
      seatIndex:  p.seatIndex,
    })),
    observers:  table.observers.length,
  };
}

module.exports = {
  // Portfele
  getWallet,
  ensureWallet,
  updateBalance,
  recordGame,
  getLeaderboard,
  db,
  saveDb,

  // Scheduler
  scheduleWeeklyTopup,
  runWeeklyTopup,

  // Stoły
  casinoTables,
  TABLE_CONFIGS,
  getTablePublic,
  initTables,

  // Stałe
  START_BALANCE,
  WEEKLY_MINIMUM,
  WEEKLY_TOP_UP,
};
