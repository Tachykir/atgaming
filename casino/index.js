/**
 * ═══════════════════════════════════════════════════════════════
 *  KASYNO AT$ — fasada modułu
 *  Gry (games/casino/*) dostają ten obiekt jako `casino` i korzystają z:
 *  portfeli (store), stołów (tables), RTP (rtp), statystyk (tracker), exclusive().
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';

const store = require('./store');
const tablesMod = require('./tables');
const rtp = require('./rtp');
const tracker = require('./tracker');

// Wyłączność per klucz (gracz+gra): odrzuca równoległe żądania zamiast je kolejkować
const busyKeys = new Set();
async function exclusive(key, fn) {
  if (busyKeys.has(key)) return undefined;
  busyKeys.add(key);
  try { return await fn(); }
  finally { busyKeys.delete(key); }
}

async function init() {
  await store.init();
  await rtp.load();
  tracker.start();
}

function scheduleWeeklyTopup(io) {
  const nextSunday = () => {
    const now = new Date(), next = new Date(now);
    next.setDate(now.getDate() + (now.getDay() === 0 ? 7 : 7 - now.getDay()));
    next.setHours(0, 0, 0, 0);
    return next;
  };
  const schedule = () => {
    const next = nextSunday();
    console.log(`⏰ Następne doładowanie AT$: ${next.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}`);
    setTimeout(async () => {
      try {
        const topped = await store.runWeeklyTopup();
        if (io && topped.length) io.emit('weeklyTopup', { count: topped.length, message: `📅 Tygodniowe doładowanie! ${topped.length} graczy otrzymało AT$ do 100 000` });
      } catch (e) { console.error('Weekly topup error:', e); }
      schedule();
    }, Math.min(next.getTime() - Date.now(), 2 ** 31 - 1));
  };
  schedule();
}

const api = module.exports = {
  init,
  // portfele / dane
  getWallet: store.getWallet, ensureWallet: store.ensureWallet, updateBalance: store.updateBalance, debit: store.debit,
  recordGame: store.recordGame, getLeaderboard: store.getLeaderboard, getAllWallets: store.getAllWallets,
  adminSetBalance: store.adminSetBalance, runWeeklyTopup: store.runWeeklyTopup,
  getSlotStats: store.getSlotStats, updateSlotStats: store.updateSlotStats,
  getSlotState: store.getSlotState, setSlotState: store.setSlotState,
  // stoły
  casinoTables: tablesMod.tables,
  createTable: opts => { const t = tablesMod.createTable(opts); t._casino = api; return t; },
  initTables: () => { tablesMod.initTables(); for (const t of Object.values(tablesMod.tables)) t._casino = api; },
  getTablePublic: tablesMod.getTablePublic,
  deleteTable: id => tablesMod.deleteTable(id, (pid, amt) => store.updateBalance(pid, amt).catch(() => {})),
  // pozostałe
  exclusive, scheduleWeeklyTopup, rtp, tracker, store,
  START_BALANCE: store.START_BALANCE, WEEKLY_MINIMUM: store.WEEKLY_MINIMUM, WEEKLY_TOP_UP: store.WEEKLY_TOP_UP,
};
