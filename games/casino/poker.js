/**
 * ═══════════════════════════════════════════════════════════
 *  POKER TEXAS HOLD'EM — STÓŁ KASYNOWY
 *  Gracze kupują żetony (buy-in) przy dołączeniu; żetony wracają do portfela
 *  przy opuszczeniu stołu. Rundy startują automatycznie przy ≥2 graczach.
 * ═══════════════════════════════════════════════════════════
 */
'use strict';

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_IDX = Object.fromEntries(RANKS.map((r, i) => [r, i]));

const TURN_SECONDS     = 30;
const SHOWDOWN_MS      = 6000;
const NEXT_ROUND_SECS  = 6;

const HAND_NAMES = ['Wysoka karta','Para','Dwie pary','Trójka','Strit','Kolor','Full House','Kareta','Poker','Poker królewski'];

// ─── TALIA ───────────────────────────────────────────────────────
function makeDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── EWALUACJA RĄK ───────────────────────────────────────────────
// Zwraca { score:[kategoria, ...tiebreakery], name }
function eval5(cards) {
  const vals = cards.map(c => RANK_IDX[c.slice(0, -1)]).sort((a, b) => b - a);
  const suits = cards.map(c => c.slice(-1));
  const flush = suits.every(s => s === suits[0]);
  const uniq = [...new Set(vals)];
  let straightHigh = -1;
  if (uniq.length === 5) {
    if (vals[0] - vals[4] === 4) straightHigh = vals[0];
    else if (vals[0] === 12 && vals[1] === 3) straightHigh = 3; // A-2-3-4-5
  }
  const cnt = {};
  vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
  const groups = Object.entries(cnt).map(([v, c]) => [+v, c]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroups = groups.map(g => g[0]);

  if (flush && straightHigh >= 0) return { score: [straightHigh === 12 ? 9 : 8, straightHigh] };
  if (groups[0][1] === 4)                       return { score: [7, ...byGroups] };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { score: [6, ...byGroups] };
  if (flush)                                    return { score: [5, ...vals] };
  if (straightHigh >= 0)                        return { score: [4, straightHigh] };
  if (groups[0][1] === 3)                       return { score: [3, ...byGroups] };
  if (groups[0][1] === 2 && groups[1][1] === 2) return { score: [2, ...byGroups] };
  if (groups[0][1] === 2)                       return { score: [1, ...byGroups] };
  return { score: [0, ...vals] };
}

function cmpScore(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

function bestHand(hole, community) {
  const all = [...hole, ...community];
  let best = null;
  const n = all.length;
  if (n < 5) return { score: [0], name: HAND_NAMES[0], cards: all };
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const cards = [all[a], all[b], all[c], all[d], all[e]];
      const h = eval5(cards);
      if (!best || cmpScore(h.score, best.score) > 0) best = { ...h, cards };
    }
  best.name = HAND_NAMES[best.score[0]];
  return best;
}

// ─── POMOCNICZE ──────────────────────────────────────────────────
const countdownTimers = {};
const turnTimers = {};

function playerBySid(table, sid) { return table.players.find(p => p.socketId === sid); }
function inHandOrder(gs) { return gs.seats; }
function canAct(gs, sid) { return !gs.folded[sid] && !gs.allIn[sid] && gs.seats.includes(sid); }
function liveSids(gs) { return gs.seats.filter(sid => !gs.folded[sid]); }

// Kolejka graczy od pozycji `startIdx` (w kolejności siedzeń), opcjonalnie z pominięciem jednego
function queueFrom(gs, startIdx, exclude) {
  const n = gs.seats.length, q = [];
  for (let i = 0; i < n; i++) {
    const sid = gs.seats[(startIdx + i) % n];
    if (sid !== exclude && canAct(gs, sid)) q.push(sid);
  }
  return q;
}

function commit(table, gs, sid, amount) {
  const p = playerBySid(table, sid);
  if (!p) return 0;
  const amt = Math.max(0, Math.min(amount, p.sessionChips));
  p.sessionChips -= amt;
  gs.currentBet[sid] = (gs.currentBet[sid] || 0) + amt;
  gs.contrib[sid] = (gs.contrib[sid] || 0) + amt;
  gs.pot += amt;
  if (p.sessionChips === 0) gs.allIn[sid] = true;
  return amt;
}

// ─── START RUNDY ─────────────────────────────────────────────────
function startRound(table, io) {
  clearTimeout(countdownTimers[table.id]);
  delete countdownTimers[table.id];
  const players = table.players.filter(p => p.sessionChips > 0);
  if (players.length < 2) { table.status = 'open'; table.gameState = null; return emitTableState(table, io); }

  const seats = players.map(p => p.socketId);
  const n = seats.length;
  const dIdx = (table.dealerIdx || 0) % n;
  const blind = table.config.blindAmount;

  const gs = {
    phase: 'preflop', deck: makeDeck(), community: [], pot: 0,
    seats, hands: {}, folded: {}, allIn: {}, currentBet: {}, contrib: {},
    callAmount: 0, minRaise: blind * 2,
    dealer: seats[dIdx], smallBlind: null, bigBlind: null,
    actingPlayer: null, actingQueue: [], turnDeadline: null,
    lastAction: null, showHands: null, handNames: null, winners: [], winAmounts: {},
  };
  table.gameState = gs;
  table.status = 'playing';

  seats.forEach(sid => { gs.hands[sid] = [gs.deck.pop(), gs.deck.pop()]; gs.folded[sid] = false; gs.allIn[sid] = false; gs.currentBet[sid] = 0; gs.contrib[sid] = 0; });

  // Heads-up: dealer = small blind
  const sbIdx = n === 2 ? dIdx : (dIdx + 1) % n;
  const bbIdx = (sbIdx + 1) % n;
  gs.smallBlind = seats[sbIdx];
  gs.bigBlind   = seats[bbIdx];
  commit(table, gs, gs.smallBlind, blind);
  commit(table, gs, gs.bigBlind, blind * 2);
  gs.callAmount = Math.max(gs.currentBet[gs.smallBlind], gs.currentBet[gs.bigBlind]);

  gs.actingQueue = queueFrom(gs, (bbIdx + 1) % n);
  // BB ma opcję: jeśli nikt nie podbije, ostatni w kolejce jest BB (queueFrom to zapewnia)
  if (gs.actingQueue.length === 0 || (gs.actingQueue.length === 1 && gs.currentBet[gs.actingQueue[0]] >= gs.callAmount && liveSids(gs).filter(s => !gs.allIn[s]).length <= 1)) {
    return runOut(table, gs, io);
  }
  setActing(table, gs, io, gs.actingQueue[0]);
}

function setActing(table, gs, io, sid) {
  clearTimeout(turnTimers[table.id]);
  gs.actingPlayer = sid;
  gs.turnDeadline = Date.now() + TURN_SECONDS * 1000;
  turnTimers[table.id] = setTimeout(() => {
    if (table.gameState !== gs || gs.actingPlayer !== sid) return;
    const toCall = gs.callAmount - (gs.currentBet[sid] || 0);
    applyAction(table, sid, toCall > 0 ? 'fold' : 'check', {}, io, true);
  }, TURN_SECONDS * 1000 + 300);
  emitTableState(table, io);
}

// ─── AKCJE ───────────────────────────────────────────────────────
const EVENT_MAP = { casinoPokerFold: 'fold', casinoPokerCheck: 'check', casinoPokerCall: 'call', casinoPokerRaise: 'raise' };

function handleAction(table, socketId, event, data, io) {
  const action = EVENT_MAP[event];
  if (action) applyAction(table, socketId, action, data || {}, io, false);
}

function applyAction(table, sid, action, data, io, timedOut) {
  const gs = table.gameState;
  if (!gs || table.status !== 'playing' || gs.actingPlayer !== sid) return;
  const p = playerBySid(table, sid);
  const toCall = gs.callAmount - (gs.currentBet[sid] || 0);
  let label = '';

  if (action === 'fold') {
    gs.folded[sid] = true;
    label = timedOut ? 'Fold (czas)' : 'Fold';
  } else if (action === 'check') {
    if (toCall > 0) return;
    label = timedOut ? 'Check (czas)' : 'Check';
  } else if (action === 'call') {
    if (toCall <= 0) { label = 'Check'; }
    else { const amt = commit(table, gs, sid, toCall); label = gs.allIn[sid] ? `All-in ${amt}` : `Call ${amt}`; }
  } else if (action === 'raise') {
    if (!p) return;
    const maxTotal = (gs.currentBet[sid] || 0) + p.sessionChips;
    let target = Math.floor(Number(data.amount) || 0);
    const minTotal = gs.callAmount + gs.minRaise;
    if (target >= maxTotal) target = maxTotal;                     // all-in
    else if (target < minTotal) return;                            // za mały raise
    if (target <= gs.callAmount) {                                 // all-in poniżej call → traktuj jako call
      if (toCall <= 0) return;
      commit(table, gs, sid, toCall);
      label = `All-in ${gs.currentBet[sid]}`;
    } else {
      const raiseBy = target - gs.callAmount;
      commit(table, gs, sid, target - (gs.currentBet[sid] || 0));
      if (raiseBy >= gs.minRaise) gs.minRaise = raiseBy;
      gs.callAmount = target;
      label = gs.allIn[sid] ? `All-in ${target}` : `Raise ${target}`;
      // Wszyscy pozostali muszą odpowiedzieć
      const idx = gs.seats.indexOf(sid);
      gs.actingQueue = queueFrom(gs, (idx + 1) % gs.seats.length, sid);
      gs.lastAction = { sid, label, at: Date.now() };
      return afterAction(table, gs, io, true);
    }
  } else return;

  gs.lastAction = { sid, label, at: Date.now() };
  gs.actingQueue = gs.actingQueue.filter(s => s !== sid);
  afterAction(table, gs, io, false);
}

function afterAction(table, gs, io) {
  clearTimeout(turnTimers[table.id]);
  const live = liveSids(gs);
  if (live.length <= 1) return finishRound(table, gs, io);
  // Usuń z kolejki graczy, którzy nie mogą już działać (fold/all-in/odeszli)
  gs.actingQueue = gs.actingQueue.filter(s => canAct(gs, s));
  if (gs.actingQueue.length === 0) return nextStreet(table, gs, io);
  setActing(table, gs, io, gs.actingQueue[0]);
}

// ─── ULICE ───────────────────────────────────────────────────────
function dealStreet(gs) {
  if (gs.phase === 'preflop') { gs.phase = 'flop'; gs.deck.pop(); gs.community.push(gs.deck.pop(), gs.deck.pop(), gs.deck.pop()); }
  else if (gs.phase === 'flop') { gs.phase = 'turn'; gs.deck.pop(); gs.community.push(gs.deck.pop()); }
  else if (gs.phase === 'turn') { gs.phase = 'river'; gs.deck.pop(); gs.community.push(gs.deck.pop()); }
  else return false;
  return true;
}

function nextStreet(table, gs, io) {
  gs.seats.forEach(s => gs.currentBet[s] = 0);
  gs.callAmount = 0;
  gs.minRaise = table.config.blindAmount * 2;
  if (!dealStreet(gs)) return finishRound(table, gs, io);

  const canActCount = gs.seats.filter(s => canAct(gs, s)).length;
  if (canActCount <= 1) return runOut(table, gs, io);

  const dIdx = gs.seats.indexOf(gs.dealer);
  gs.actingQueue = queueFrom(gs, (dIdx + 1) % gs.seats.length);
  setActing(table, gs, io, gs.actingQueue[0]);
}

// Wszyscy all-in (lub tylko jeden może grać) — rozdaj resztę kart z małymi pauzami
function runOut(table, gs, io) {
  clearTimeout(turnTimers[table.id]);
  gs.actingPlayer = null;
  gs.actingQueue = [];
  gs.showHands = {};
  liveSids(gs).forEach(s => gs.showHands[s] = gs.hands[s]);
  const step = () => {
    if (table.gameState !== gs) return;
    if (dealStreet(gs)) { emitTableState(table, io); setTimeout(step, 1200); }
    else finishRound(table, gs, io);
  };
  emitTableState(table, io);
  setTimeout(step, 1000);
}

// ─── KONIEC RUNDY / PULE ─────────────────────────────────────────
function finishRound(table, gs, io) {
  clearTimeout(turnTimers[table.id]);
  if (gs.phase === 'showdown') return;
  const live = liveSids(gs);
  const scores = {};
  if (live.length > 1) live.forEach(s => scores[s] = bestHand(gs.hands[s], gs.community));

  const winAmounts = {};
  const credit = (sid, amt) => {
    if (amt <= 0) return;
    winAmounts[sid] = (winAmounts[sid] || 0) + amt;
    const p = playerBySid(table, sid);
    if (p) p.sessionChips += amt;
  };

  if (live.length === 1) {
    credit(live[0], gs.pot);
  } else {
    const levels = [...new Set(Object.values(gs.contrib).filter(v => v > 0))].sort((a, b) => a - b);
    let prev = 0;
    for (const lvl of levels) {
      let potPart = 0;
      for (const c of Object.values(gs.contrib)) potPart += Math.max(0, Math.min(c, lvl) - prev);
      let eligible = live.filter(s => gs.contrib[s] >= lvl);
      if (eligible.length === 0) eligible = live;
      let best = null;
      eligible.forEach(s => { if (!best || cmpScore(scores[s].score, best) > 0) best = scores[s].score; });
      const winners = eligible.filter(s => cmpScore(scores[s].score, best) === 0);
      const share = Math.floor(potPart / winners.length);
      winners.forEach((s, i) => credit(s, share + (i === 0 ? potPart - share * winners.length : 0)));
      prev = lvl;
    }
  }

  gs.phase = 'showdown';
  gs.actingPlayer = null;
  gs.turnDeadline = null;
  gs.winAmounts = winAmounts;
  gs.winners = Object.keys(winAmounts);
  if (live.length > 1) {
    gs.showHands = {}; gs.handNames = {}; gs.bestCards = {};
    live.forEach(s => { gs.showHands[s] = gs.hands[s]; gs.handNames[s] = scores[s].name; gs.bestCards[s] = scores[s].cards; });
  } else {
    gs.showHands = null; gs.handNames = null;
  }
  table.status = 'showdown';
  emitTableState(table, io, { showdown: true });

  setTimeout(() => { if (table.gameState === gs) endRound(table, gs, io); }, SHOWDOWN_MS);
}

function endRound(table, gs, io) {
  if (table._casino) gs.seats.forEach(sid => {
    const p = playerBySid(table, sid);
    if (p?.discordId) table._casino.recordGame(p.discordId).catch(() => {});
  });

  // Gracze bez żetonów opuszczają stół
  const broke = table.players.filter(p => p.sessionChips <= 0);
  broke.forEach(p => io.to(p.socketId).emit('casinoBusted', { tableId: table.id, message: 'Skończyły Ci się żetony — dołącz ponownie, aby kupić nowe.' }));
  table.players = table.players.filter(p => p.sessionChips > 0);

  table.round = (table.round || 0) + 1;
  table.dealerIdx = (table.dealerIdx || 0) + 1;
  table.gameState = null;
  table.status = 'open';
  emitTableState(table, io);
  if (table.players.length >= 2) startCountdown(table, io, NEXT_ROUND_SECS);
}

// ─── COUNTDOWN ───────────────────────────────────────────────────
function startCountdown(table, io, seconds = 10) {
  if (countdownTimers[table.id]) return; // już odlicza
  if (table.players.length < 2 || table.gameState) return;
  let remaining = seconds;
  table.countdownMax = seconds;
  io.to('casino:' + table.id).emit('casinoCountdown', { tableId: table.id, seconds: remaining, max: seconds });
  const tick = () => {
    remaining--;
    if (table.players.length < 2) {
      delete countdownTimers[table.id];
      io.to('casino:' + table.id).emit('casinoCountdown', { tableId: table.id, seconds: -1, max: seconds });
      return emitTableState(table, io);
    }
    if (remaining <= 0) { delete countdownTimers[table.id]; startRound(table, io); }
    else {
      io.to('casino:' + table.id).emit('casinoCountdown', { tableId: table.id, seconds: remaining, max: seconds });
      countdownTimers[table.id] = setTimeout(tick, 1000);
    }
  };
  countdownTimers[table.id] = setTimeout(tick, 1000);
}

// Gracz opuszcza stół — traktowany jako fold (chipy zwraca server.js)
function playerLeft(table, sid, io) {
  const gs = table.gameState;
  if (!gs || table.status !== 'playing' || !gs.seats.includes(sid) || gs.folded[sid]) return;
  gs.folded[sid] = true;
  gs.actingQueue = gs.actingQueue.filter(s => s !== sid);
  const wasActing = gs.actingPlayer === sid;
  // Opóźnij o tick, żeby server.js zdążył usunąć gracza z listy
  setImmediate(() => {
    if (table.gameState !== gs || gs.phase === 'showdown') return;
    if (liveSids(gs).length <= 1) return finishRound(table, gs, io);
    if (wasActing) afterAction(table, gs, io);
    else emitTableState(table, io);
  });
}

// ─── EMIT ────────────────────────────────────────────────────────
function emitTableState(table, io, extra = {}) {
  const gs = table.gameState;
  const room = 'casino:' + table.id;
  if (!gs) {
    io.to(room).emit('casinoTableState', { table: getTablePublicFull(table), phase: 'idle', ...extra });
    return;
  }
  const showdown = gs.phase === 'showdown';
  io.to(room).emit('casinoTableState', {
    table:        getTablePublicFull(table),
    community:    gs.community,
    pot:          gs.pot,
    phase:        gs.phase,
    actingPlayer: gs.actingPlayer,
    turnDeadline: gs.turnDeadline,
    turnSeconds:  TURN_SECONDS,
    serverNow:    Date.now(),
    callAmount:   gs.callAmount,
    minRaise:     gs.minRaise,
    currentBet:   gs.currentBet,
    folded:       gs.folded,
    allIn:        gs.allIn,
    inHand:       gs.seats,
    dealer:       gs.dealer,
    smallBlind:   gs.smallBlind,
    bigBlind:     gs.bigBlind,
    lastAction:   gs.lastAction,
    showHands:    gs.showHands,
    handNames:    showdown ? gs.handNames : null,
    bestCards:    showdown ? gs.bestCards : null,
    winners:      showdown ? gs.winners : null,
    winAmounts:   showdown ? gs.winAmounts : null,
    ...extra,
  });
  table.players.forEach(p => {
    if (gs.hands[p.socketId]) {
      io.to(p.socketId).emit('casinoMyHand', { tableId: table.id, cards: gs.hands[p.socketId], folded: !!gs.folded[p.socketId], handName: gs.community.length >= 3 ? bestHand(gs.hands[p.socketId], gs.community).name : null });
    }
  });
}

function getTablePublicFull(table) {
  return {
    id: table.id, game: table.game, name: table.name, config: table.config,
    status: table.status, round: table.round,
    players: table.players.map(p => ({ socketId: p.socketId, discordId: p.discordId, name: p.name, avatar: p.avatar, sessionChips: p.sessionChips, seatIndex: p.seatIndex })),
    observerCount: table.observers?.length || 0,
  };
}

module.exports = {
  startRound, startCountdown, handleAction, playerLeft, endRound, emitTableState, getTablePublicFull,
  countdownTimers, turnTimers, bestHand, eval5, cmpScore,
};
