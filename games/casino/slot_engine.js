/**
 * Wspólny silnik automatów — AT Gaming Casino
 *
 * Każdy automat definiuje:
 *   game        — id gry (table.game)
 *   event       — nazwa eventu spinu (socket)
 *   resultEvent — nazwa eventu z wynikiem
 *   newState()  — stan gracza (free spiny, liczniki funkcji…)
 *   spin(state, ctx) → { payout, ...payload }   (czysta logika, bez I/O)
 *       ctx = { bet, paid, level, cfg }
 *       bet  — stawka łączna obowiązująca w tym spinie (dla free spinów: zapamiętana)
 *       paid — czy spin był płatny
 *   isFree(state) → czy następny spin jest darmowy (wtedy pobierana jest stawka zapamiętana w state.freeBet)
 *
 * Silnik zajmuje się: autoryzacją, blokadą równoległych spinów, walidacją stawki,
 * atomowym pobraniem AT$, wypłatą, statystykami i emisją wyniku.
 */
'use strict';

const WIN_TIERS = [
  { min: 0,   tier: 'win',   label: 'Wygrana'   },
  { min: 2,   tier: 'big',   label: 'Big Win'   },
  { min: 8,   tier: 'mega',  label: 'Mega Win'  },
  { min: 25,  tier: 'huge',  label: 'Huge Win'  },
  { min: 75,  tier: 'giga',  label: 'Giga Win'  },
  { min: 250, tier: 'frito', label: 'Mega Giga Frito Win' },
];
function getTier(mult) {
  if (!(mult > 0)) return { tier: 'none', label: '' };
  let t = WIN_TIERS[0];
  for (const w of WIN_TIERS) if (mult >= w.min) t = w;
  return t;
}

function weightedPick(weights, total) {
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}
function makePicker(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  return () => weightedPick(weights, total);
}

// Średnia ważona stawka do funkcji typu "licznik" (pit meter, kociołki, speed meter).
// Zapobiega nabijaniu licznika na minimalnej stawce i odbieraniu bonusu na maksymalnej.
function meterAdd(meter, bet, points) {
  meter.points = (meter.points || 0) + points;
  meter.wager = (meter.wager || 0) + bet * points;
}
function meterBet(meter, fallback) {
  return meter.points > 0 ? Math.max(1, Math.round(meter.wager / meter.points)) : fallback;
}
function meterReset(meter) { meter.points = 0; meter.wager = 0; }

// Stany graczy: per gra → per gracz
const states = {};
function stateFor(def, userId) {
  if (!states[def.game]) states[def.game] = new Map();
  const m = states[def.game];
  if (!m.has(userId)) m.set(userId, def.newState());
  return m.get(userId);
}

function register(def, socket, io, casino) {
  socket.on(def.event, async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== def.game) return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord!' });

    const done = await casino.exclusive(def.game + ':' + discordUser.id, async () => {
      const state = stateFor(def, discordUser.id);
      if (def.load && !state._loaded) {
        state._loaded = true;
        try { await def.load(state, casino, discordUser.id); } catch (e) {}
      }
      const blockedMsg = def.blocked ? def.blocked(state) : null;
      if (blockedMsg) return socket.emit('casinoError', { message: blockedMsg });
      const cfg = table.config;
      const level = cfg.level || levelFromConfig(cfg);
      const free = def.isFree(state);
      let bet;
      if (free) {
        bet = state.freeBet;
      } else {
        bet = Math.floor(Number(data.bet) || 0);
        if (bet < cfg.minBet || bet > cfg.maxBet)
          return socket.emit('casinoError', { message: `Stawka musi być w zakresie ${cfg.minBet.toLocaleString('pl-PL')}–${cfg.maxBet.toLocaleString('pl-PL')} AT$` });
        await casino.ensureWallet(discordUser);
        if (await casino.debit(discordUser.id, bet) === null)
          return socket.emit('casinoError', { message: 'Za mało AT$!' });
      }

      let res;
      try {
        res = def.spin(state, { bet, paid: !free, level, cfg, data });
      } catch (e) {
        console.error(`[${def.game}] spin error:`, e);
        if (!free) await casino.updateBalance(discordUser.id, bet);
        return socket.emit('casinoError', { message: 'Błąd automatu — stawka zwrócona' });
      }
      const payout = Math.max(0, Math.floor(res.payout || 0));
      if (payout > 0) await casino.updateBalance(discordUser.id, payout);
      await casino.recordGame(discordUser.id);
      await casino.updateSlotStats(discordUser.id, def.statsId || def.game, {
        spins: 1, spent: free ? 0 : bet, won: payout, bestWin: payout,
        pitMeter: def.saveMeter ? def.saveMeter(state) : null,
      });
      const balance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
      const mult = bet > 0 ? payout / bet : 0;
      const tier = getTier(mult);
      socket.emit(def.resultEvent, {
        ...res,
        payout, bet, paid: !free, cost: free ? 0 : bet, net: payout - (free ? 0 : bet),
        mult, tier: tier.tier, label: tier.label, balance,
        nextFree: def.isFree(state),
      });
      return true;
    });
    if (done === undefined) socket.emit('casinoSlotBusy', { game: def.game });
  });
}

/**
 * Ewaluacja linii (od lewej, opcjonalnie też od prawej).
 * grid[col][row] = indeks symbolu; syms[i] = { p:[...wypłata za N], wild?, scatter? }
 * Wild zastępuje każdy symbol poza scatterem; linia samych wildów płaci jak wild.
 * Zwraca [{ li, count, symIdx, cells:[[c,r]], win, dir }]
 */
function evalLines(grid, lines, syms, lineBet, opts = {}) {
  const cols = grid.length;
  const wins = [];
  const dirs = opts.bothWays ? ['ltr', 'rtl'] : ['ltr'];
  for (const dir of dirs) {
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const colAt = k => dir === 'ltr' ? k : cols - 1 - k;
      let target = -1, count = 0, wildRun = 0, wildRunDone = false;
      for (let k = 0; k < cols; k++) {
        const c = colAt(k);
        const si = grid[c][line[c]];
        const s = syms[si];
        if (s.scatter || s.blank) break;
        if (s.wild) { count++; if (!wildRunDone) wildRun++; continue; }
        wildRunDone = true;
        if (target === -1) { target = si; count++; }
        else if (si === target) count++;
        else break;
      }
      let best = null;
      const wildIdx = syms.findIndex(s => s.wild && s.p);
      if (wildRun > 0 && wildIdx >= 0) {
        const pw = syms[wildIdx].p[wildRun] || 0;
        if (pw > 0) best = { symIdx: wildIdx, count: wildRun, pay: pw };
      }
      if (target >= 0) {
        const ps = syms[target].p[count] || 0;
        if (ps > 0 && (!best || ps > best.pay)) best = { symIdx: target, count, pay: ps };
      }
      if (!best) continue;
      // Linia pełna (wszystkie kolumny) liczona tylko raz przy bothWays
      if (dir === 'rtl' && best.count === cols) continue;
      const cells = [];
      for (let k = 0; k < best.count; k++) { const c = colAt(k); cells.push([c, line[c]]); }
      wins.push({ li, count: best.count, symIdx: best.symIdx, cells, win: best.pay * lineBet, dir });
    }
  }
  return wins;
}

function countSym(grid, pred) {
  let n = 0;
  const cells = [];
  for (let c = 0; c < grid.length; c++) for (let r = 0; r < grid[c].length; r++) if (pred(grid[c][r])) { n++; cells.push([c, r]); }
  return { n, cells };
}

function levelFromConfig(cfg) {
  if (cfg.minBet >= 1000000) return 'high';
  if (cfg.minBet >= 10000) return 'medium';
  return 'low';
}

// Symulacja RTP (używana w testach/kalibracji)
function simulate(def, spins = 200000, bet = 100) {
  const state = def.newState();
  let paid = 0, won = 0, hits = 0, max = 0;
  for (let i = 0; i < spins; i++) {
    const free = def.isFree(state);
    const b = free ? state.freeBet : bet;
    if (!free) paid += bet;
    const r = def.spin(state, { bet: b, paid: !free, level: 'low', cfg: { minBet: 1, maxBet: 1e9 }, data: {} });
    won += r.payout;
    if (r.payout > 0) hits++;
    if (r.payout / bet > max) max = r.payout / bet;
  }
  return { rtp: won / paid, hitRate: hits / spins, maxMult: max };
}

module.exports = { register, stateFor, getTier, WIN_TIERS, makePicker, weightedPick, meterAdd, meterBet, meterReset, simulate, levelFromConfig, evalLines, countSym };
