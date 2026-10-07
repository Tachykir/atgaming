/**
 * ═══════════════════════════════════════════════════════════════
 *  POSTĘPY GRACZA: historia gier, dzienny bonus, osiągnięcia
 *  - historia zapisywana paczkami (jeden zapis do bazy na kilka sekund),
 *  - profil gracza (liczniki, osiągnięcia, seria bonusów) w pamięci + zapis odroczony,
 *  - osiągnięcie = jednorazowa nagroda AT$ + powiadomienie na żywo.
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';
const store = require('./store');

const SLOT_GAMES = ['slots', 'path_of_gambling', 'jackpot_frenzy', 'dragon_hoard', 'arcane_academy', 'dual_blades', 'neon_racer', 'candy_tumble', 'book_pharaoh', 'hot_777'];
const DAILY = [2_000, 3_000, 4_000, 5_000, 6_500, 8_000, 10_000]; // dzień serii 1…7+

// cond(m, ev) → true gdy zdobyte; progress(m) → [ile, cel] dla paska postępu
const ACHIEVEMENTS = [
  { id: 'first_win',   icon: '🎉', name: 'Pierwsza wygrana',    desc: 'Wygraj cokolwiek w kasynie',              reward: 1_000,  cond: (m, ev) => ev?.win > 0 },
  { id: 'spins_100',   icon: '🎰', name: 'Rozgrzewka',          desc: 'Zakręć 100 razy na automatach',           reward: 2_500,  progress: m => [m.c.spins, 100] },
  { id: 'spins_1000',  icon: '🌀', name: 'Maratończyk',         desc: 'Zakręć 1 000 razy na automatach',         reward: 15_000, progress: m => [m.c.spins, 1000] },
  { id: 'bonus',       icon: '🎁', name: 'Bonus!',              desc: 'Uruchom funkcję bonusową automatu',       reward: 2_000,  cond: (m, ev) => !!ev?.feature },
  { id: 'bonus_10',    icon: '🎊', name: 'Łowca bonusów',       desc: 'Uruchom 10 funkcji bonusowych',           reward: 12_000, progress: m => [m.c.bonuses, 10] },
  { id: 'big_win',     icon: '💰', name: 'Duża wygrana',        desc: 'Wygraj co najmniej 25× stawki',           reward: 5_000,  cond: (m, ev) => ev?.mult >= 25 },
  { id: 'giga_win',    icon: '💎', name: 'Giga wygrana',        desc: 'Wygraj co najmniej 75× stawki',           reward: 15_000, cond: (m, ev) => ev?.mult >= 75 },
  { id: 'frito',       icon: '🔥', name: 'Mega Giga Frito',     desc: 'Wygraj co najmniej 250× stawki',          reward: 50_000, cond: (m, ev) => ev?.mult >= 250 },
  { id: 'high_roller', icon: '🎩', name: 'High roller',         desc: 'Postaw 100 000 AT$ w jednym zakładzie',   reward: 10_000, cond: (m, ev) => ev?.bet >= 100_000 },
  { id: 'explorer',    icon: '🧭', name: 'Odkrywca',            desc: 'Zagraj na wszystkich 10 automatach',      reward: 10_000, progress: m => [SLOT_GAMES.filter(g => m.games.includes(g)).length, SLOT_GAMES.length] },
  { id: 'crash_10x',   icon: '🚀', name: 'Na Księżyc',          desc: 'Wypłać w Crash przy mnożniku ≥ 10×',      reward: 8_000,  cond: (m, ev) => ev?.game === 'crash' && ev?.mult >= 10 && ev?.win > 0 },
  { id: 'roulette_35', icon: '🎡', name: 'Strzał w numer',      desc: 'Traf pojedynczy numer w ruletce',         reward: 5_000,  cond: (m, ev) => ev?.game === 'roulette' && ev?.straight },
  { id: 'daily_7',     icon: '📅', name: 'Stały bywalec',       desc: 'Odbierz dzienny bonus 7 dni z rzędu',     reward: 15_000, progress: m => [m.daily.streak || 0, 7] },
  { id: 'millionaire', icon: '🏦', name: 'Milioner',            desc: 'Miej na koncie 1 000 000 AT$',            reward: 25_000, progress: m => [Math.min(m.c.maxBalance, 1_000_000), 1_000_000] },
];

let io = null;
function setIo(i) { io = i; }

// ── Profil gracza ────────────────────────────────────────────
const metas = new Map();   // id → { data, dirty }
const fresh = () => ({ c: { rounds: 0, spins: 0, wins: 0, bonuses: 0, wagered: 0, won: 0, maxBalance: 0 }, games: [], ach: {}, daily: { last: null, streak: 0 } });
async function meta(id) {
  let e = metas.get(id);
  if (!e) {
    const saved = await store.getMeta(id).catch(() => null);
    const base = fresh();
    const data = saved ? { ...base, ...saved, c: { ...base.c, ...saved.c }, daily: { ...base.daily, ...saved.daily } } : base;
    e = metas.get(id) || { data, dirty: false };   // ktoś mógł załadować w międzyczasie
    metas.set(id, e);
  }
  return e;
}
const touch = e => { e.dirty = true; scheduleFlush(); };

// ── Historia (bufor) ─────────────────────────────────────────
let historyBuf = [];
let flushTimer = null;
function scheduleFlush() { if (!flushTimer) flushTimer = setTimeout(flush, 3000); }
async function flush() {
  clearTimeout(flushTimer); flushTimer = null;
  const rows = historyBuf; historyBuf = [];
  try { await store.addHistory(rows); } catch (e) { console.error('Historia kasyna — zapis nieudany:', e.message); }
  for (const [id, e] of metas) {
    if (!e.dirty) continue;
    e.dirty = false;
    try { await store.setMeta(id, e.data); } catch (err) { e.dirty = true; console.error('Profil gracza — zapis nieudany:', err.message); }
  }
  // Nieużywane profile nie muszą siedzieć w pamięci
  if (metas.size > 2000) for (const [id, e] of metas) if (!e.dirty) metas.delete(id);
}
function log(id, row) {
  historyBuf.push({ discordId: id, ts: Date.now(), bet: 0, win: 0, ...row });
  if (historyBuf.length >= 200) flush(); else scheduleFlush();
}

// ── Osiągnięcia ──────────────────────────────────────────────
function achieved(a, m, ev) {
  if (a.cond) return a.cond(m, ev);
  const [have, need] = a.progress(m);
  return have >= need;
}
async function checkAchievements(id, e, ev) {
  const m = e.data;
  for (const a of ACHIEVEMENTS) {
    if (m.ach[a.id] || !achieved(a, m, ev)) continue;
    m.ach[a.id] = Date.now();
    touch(e);
    const balance = await store.updateBalance(id, a.reward).catch(() => null);
    log(id, { game: 'achievement', kind: 'achievement', win: a.reward, balance, note: a.name });
    io?.to('user:' + id).emit('casinoAchievement', { id: a.id, icon: a.icon, name: a.name, desc: a.desc, reward: a.reward, balance });
  }
}

/**
 * Zakończona runda gry.
 * ev: { game, bet, win, mult?, feature?, straight?, kind?, balance?, note? }
 */
async function recordRound(id, ev) {
  if (!id) return;
  try {
    const e = await meta(id);
    const m = e.data, c = m.c;
    const bet = ev.bet || 0, win = ev.win || 0;
    c.rounds++;
    if (SLOT_GAMES.includes(ev.game) && bet > 0) c.spins++;
    if (win > 0) c.wins++;
    if (ev.feature) c.bonuses++;
    c.wagered += bet; c.won += win;
    if (ev.balance > c.maxBalance) c.maxBalance = ev.balance;
    if (!m.games.includes(ev.game)) m.games.push(ev.game);
    if (ev.mult === undefined && bet > 0) ev.mult = win / bet;
    touch(e);
    if (ev.history !== false) log(id, { game: ev.game, kind: ev.kind || 'round', bet, win, balance: ev.balance ?? null, note: ev.note ?? null });
    await checkAchievements(id, e, ev);
  } catch (err) { console.error('recordRound:', err.message); }
}

/** Zmiana salda poza grą (np. doładowanie) — tylko do osiągnięcia „Milioner”. */
async function noteBalance(id, balance) {
  const e = await meta(id);
  if (balance > e.data.c.maxBalance) { e.data.c.maxBalance = balance; touch(e); await checkAchievements(id, e, null); }
}

// ── Dzienny bonus ────────────────────────────────────────────
// Dzień liczony w strefie czasowej Polski
const dayOf = (t = Date.now()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(t);
function nextDayStart() {
  const today = dayOf();
  let t = Date.now();
  while (dayOf(t) === today) t += 15 * 60_000;
  return t;
}
async function dailyStatus(id) {
  const m = (await meta(id)).data;
  const today = dayOf(), yesterday = dayOf(Date.now() - 86_400_000);
  const available = m.daily.last !== today;
  const streakIfClaimed = m.daily.last === yesterday ? m.daily.streak + 1 : (m.daily.last === today ? m.daily.streak : 1);
  return { available, streak: m.daily.streak, nextStreak: streakIfClaimed, amount: DAILY[Math.min(streakIfClaimed, DAILY.length) - 1], table: DAILY, nextAt: available ? null : nextDayStart() };
}
const claiming = new Set();
async function claimDaily(id) {
  if (claiming.has(id)) return { error: 'Chwila…' };
  claiming.add(id);
  try {
    const e = await meta(id), m = e.data;
    const st = await dailyStatus(id);
    if (!st.available) return { error: 'Bonus już odebrany — wróć jutro!', ...st };
    m.daily = { last: dayOf(), streak: st.nextStreak };
    touch(e);
    await flush();   // zapisz od razu — restart nie może pozwolić odebrać drugi raz
    const balance = await store.updateBalance(id, st.amount);
    log(id, { game: 'daily', kind: 'bonus', win: st.amount, balance, note: `Seria: ${st.nextStreak} ${st.nextStreak === 1 ? 'dzień' : 'dni'}` });
    await checkAchievements(id, e, null);
    if (balance) await noteBalance(id, balance);
    return { ok: true, amount: st.amount, streak: st.nextStreak, balance, nextAt: nextDayStart() };
  } finally { claiming.delete(id); }
}

async function achievementsFor(id) {
  const m = (await meta(id)).data;
  return ACHIEVEMENTS.map(a => {
    const p = a.progress ? a.progress(m) : null;
    return { id: a.id, icon: a.icon, name: a.name, desc: a.desc, reward: a.reward, unlocked: m.ach[a.id] || null, progress: p ? { have: Math.min(p[0], p[1]), need: p[1] } : null };
  });
}

async function history(id, limit) {
  await flush();   // pokaż też najświeższe wpisy z bufora
  return store.getHistory(id, limit);
}

let pruneTimer = null;
function start() {
  if (!pruneTimer) { pruneTimer = setInterval(() => store.pruneHistory().catch(() => {}), 6 * 3600_000); pruneTimer.unref?.(); }
}

module.exports = { logEvent: log, recordRound, noteBalance, claimDaily, dailyStatus, achievementsFor, history, flush, start, setIo, ACHIEVEMENTS, DAILY, dayOf };
