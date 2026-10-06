/**
 * ═══════════════════════════════════════════════════════════
 *  BLACKJACK — STÓŁ KASYNOWY
 *  6 talii, krupier stoi na soft 17, BJ płaci 3:2, double na 2 kartach,
 *  split par (1×, asy dostają po jednej karcie), peek krupiera przy A/10.
 *  Żetony przy stole (sessionChips) pochodzą z buy-inu i wracają do portfela
 *  przy wyjściu — portfel NIE jest synchronizowany po każdej rundzie.
 * ═══════════════════════════════════════════════════════════
 */
'use strict';

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const BETTING_WINDOW = 15;    // s
const TURN_SECONDS   = 20;
const RESULTS_MS     = 6000;
const DEALER_STEP_MS = 700;

const countdownTimers = {};
const turnTimers = {};

function makeShoe(n = 6) {
  const d = [];
  for (let i = 0; i < n; i++) for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
function rankOf(c) { return c.slice(0, -1); }
function cardValue(c) { const r = rankOf(c); return ['J','Q','K'].includes(r) ? 10 : r === 'A' ? 11 : parseInt(r); }
function handInfo(cards) {
  let v = 0, aces = 0;
  for (const c of cards || []) { if (c === '??') continue; v += cardValue(c); if (rankOf(c) === 'A') aces++; }
  while (v > 21 && aces > 0) { v -= 10; aces--; }
  return { value: v, soft: aces > 0 };
}
function handValue(cards) { return handInfo(cards).value; }
function isBlackjack(cards) { return cards.length === 2 && handValue(cards) === 21; }

function draw(table) {
  if (!table._deck || table._deckIdx >= table._deck.length * 0.75) { table._deck = makeShoe(6); table._deckIdx = 0; }
  return table._deck[table._deckIdx++];
}
function pBySid(table, sid) { return table.players.find(p => p.socketId === sid); }

// ─── OKNO ZAKŁADÓW ───────────────────────────────────────────────
function startBettingWindow(table, io, seconds = BETTING_WINDOW) {
  clearTimeout(countdownTimers[table.id]);
  if (table.players.length === 0) { table.status = 'open'; table.gameState = null; return emitTableState(table, io); }
  table.status = 'betting';
  const gs = table.gameState = { phase: 'betting', bets: {}, seats: [], hands: {}, dealerHand: [], results: {}, payouts: {}, actingPlayer: null, actingHand: 0, turnDeadline: null };
  let remaining = seconds;
  table.countdownMax = seconds;
  emitTableState(table, io);
  io.to('casino:' + table.id).emit('casinoCountdown', { tableId: table.id, seconds: remaining, max: seconds });
  const tick = () => {
    if (table.gameState !== gs) return;
    remaining--;
    io.to('casino:' + table.id).emit('casinoCountdown', { tableId: table.id, seconds: remaining, max: seconds });
    if (remaining <= 0) startDeal(table, io);
    else countdownTimers[table.id] = setTimeout(tick, 1000);
  };
  countdownTimers[table.id] = setTimeout(tick, 1000);
}

function placeBet(table, sid, amount, io) {
  const gs = table.gameState;
  if (!gs || gs.phase !== 'betting') return;
  const p = pBySid(table, sid);
  if (!p) return;
  const cfg = table.config;
  const bet = Math.floor(Number(amount) || 0);
  if (bet < cfg.minBet || bet > cfg.maxBet || bet > p.sessionChips)
    return io.to(sid).emit('casinoError', { message: `Zakład musi być w zakresie ${cfg.minBet}–${Math.min(cfg.maxBet, p.sessionChips)} AT$` });
  gs.bets[sid] = bet;
  emitTableState(table, io);
  if (table.players.every(pl => gs.bets[pl.socketId] > 0)) {
    clearTimeout(countdownTimers[table.id]);
    countdownTimers[table.id] = setTimeout(() => startDeal(table, io), 600);
  }
}

// ─── ROZDANIE ────────────────────────────────────────────────────
function startDeal(table, io) {
  clearTimeout(countdownTimers[table.id]);
  const gs = table.gameState;
  if (!gs || gs.phase !== 'betting') return;

  const bettors = table.players.filter(p => gs.bets[p.socketId] > 0 && p.sessionChips >= gs.bets[p.socketId]);
  if (bettors.length === 0) {
    table.status = 'open';
    gs.phase = 'idle';
    emitTableState(table, io);
    countdownTimers[table.id] = setTimeout(() => { if (table.gameState === gs) startBettingWindow(table, io); }, 3000);
    return;
  }
  table.status = 'playing';
  gs.phase = 'playing';
  gs.seats = bettors.map(p => p.socketId);
  bettors.forEach(p => {
    const bet = gs.bets[p.socketId];
    p.sessionChips -= bet;
    gs.hands[p.socketId] = [{ cards: [draw(table), draw(table)], bet, done: false, doubled: false, split: false }];
  });
  gs.dealerHand = [draw(table), draw(table)];

  // Peek: krupier sprawdza blackjacka przy A lub 10 na odkrytej karcie
  if (cardValue(gs.dealerHand[0]) >= 10 && isBlackjack(gs.dealerHand)) return dealerPlay(table, io);

  gs.seats.forEach(sid => { const h = gs.hands[sid][0]; if (isBlackjack(h.cards)) h.done = true; });
  nextTurn(table, io);
}

function nextTurn(table, io) {
  const gs = table.gameState;
  clearTimeout(turnTimers[table.id]);
  for (const sid of gs.seats) {
    const hands = gs.hands[sid];
    const idx = hands.findIndex(h => !h.done);
    if (idx !== -1) {
      gs.actingPlayer = sid;
      gs.actingHand = idx;
      gs.turnDeadline = Date.now() + TURN_SECONDS * 1000;
      turnTimers[table.id] = setTimeout(() => {
        if (table.gameState === gs && gs.actingPlayer === sid && gs.actingHand === idx) act(table, sid, 'stand', io);
      }, TURN_SECONDS * 1000 + 300);
      return emitTableState(table, io);
    }
  }
  gs.actingPlayer = null;
  gs.turnDeadline = null;
  dealerPlay(table, io);
}

const EVENT_MAP = { casinoBJHit: 'hit', casinoBJStand: 'stand', casinoBJDouble: 'double', casinoBJSplit: 'split' };

function handleAction(table, sid, event, data, io) {
  const gs = table.gameState;
  if (event === 'casinoBJBet') return placeBet(table, sid, data?.amount, io);
  const action = EVENT_MAP[event];
  if (action && gs && gs.phase === 'playing') act(table, sid, action, io);
}

function act(table, sid, action, io) {
  const gs = table.gameState;
  if (gs.actingPlayer !== sid) return;
  const p = pBySid(table, sid);
  const hand = gs.hands[sid]?.[gs.actingHand];
  if (!hand || hand.done) return;

  if (action === 'hit') {
    hand.cards.push(draw(table));
    if (handValue(hand.cards) >= 21) hand.done = true;
  } else if (action === 'stand') {
    hand.done = true;
  } else if (action === 'double') {
    if (hand.cards.length !== 2 || !p || p.sessionChips < hand.bet) return;
    p.sessionChips -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    hand.cards.push(draw(table));
    hand.done = true;
  } else if (action === 'split') {
    const hands = gs.hands[sid];
    if (hands.length !== 1 || hand.cards.length !== 2 || cardValue(hand.cards[0]) !== cardValue(hand.cards[1]) || !p || p.sessionChips < hand.bet) return;
    p.sessionChips -= hand.bet;
    const aces = rankOf(hand.cards[0]) === 'A';
    const h2 = { cards: [hand.cards.pop(), draw(table)], bet: hand.bet, done: aces, doubled: false, split: true };
    hand.cards.push(draw(table));
    hand.split = true;
    hand.done = aces;
    hands.push(h2);
    [hand, h2].forEach(h => { if (handValue(h.cards) === 21) h.done = true; });
  } else return;

  nextTurn(table, io);
}

// ─── KRUPIER ─────────────────────────────────────────────────────
function dealerPlay(table, io) {
  const gs = table.gameState;
  clearTimeout(turnTimers[table.id]);
  gs.phase = 'dealer';
  gs.actingPlayer = null;
  emitTableState(table, io);

  const anyLive = gs.seats.some(sid => gs.hands[sid].some(h => handValue(h.cards) <= 21 && !(isBlackjack(h.cards) && !h.split)));
  const step = () => {
    if (table.gameState !== gs) return;
    if (anyLive && handValue(gs.dealerHand) < 17) {
      gs.dealerHand.push(draw(table));
      emitTableState(table, io);
      return setTimeout(step, DEALER_STEP_MS);
    }
    settle(table, io);
  };
  setTimeout(step, DEALER_STEP_MS);
}

function settle(table, io) {
  const gs = table.gameState;
  const dv = handValue(gs.dealerHand);
  const dBJ = isBlackjack(gs.dealerHand);
  for (const sid of gs.seats) {
    const p = pBySid(table, sid);
    gs.results[sid] = [];
    let ret = 0, staked = 0;
    for (const h of gs.hands[sid]) {
      const pv = handValue(h.cards);
      const pBJ = isBlackjack(h.cards) && !h.split;
      let r;
      if (pv > 21) r = 'bust';
      else if (pBJ && !dBJ) r = 'blackjack';
      else if (dBJ && !pBJ) r = 'lose';
      else if (pBJ && dBJ) r = 'push';
      else if (dv > 21 || pv > dv) r = 'win';
      else if (pv < dv) r = 'lose';
      else r = 'push';
      const back = r === 'blackjack' ? Math.floor(h.bet * 2.5) : r === 'win' ? h.bet * 2 : r === 'push' ? h.bet : 0;
      ret += back; staked += h.bet;
      h.result = r;
      gs.results[sid].push(r);
    }
    gs.payouts[sid] = ret - staked;
    if (p) p.sessionChips += ret;
  }
  gs.phase = 'results';
  table.status = 'results';
  emitTableState(table, io);
  setTimeout(() => { if (table.gameState === gs) endRound(table, io); }, RESULTS_MS);
}

function endRound(table, io) {
  const gs = table.gameState;
  if (table._casino && gs) gs.seats.forEach(sid => {
    const p = pBySid(table, sid);
    if (p?.discordId) table._casino.recordGame(p.discordId).catch(() => {});
  });
  const broke = table.players.filter(p => p.sessionChips < (table.config.minBet || 1));
  broke.forEach(p => {
    io.to(p.socketId).emit('casinoBusted', { tableId: table.id, message: 'Za mało żetonów na kolejny zakład — opuszczasz stół.' });
    if (p.sessionChips > 0 && table._casino) table._casino.updateBalance(p.discordId, p.sessionChips).catch(() => {});
  });
  table.players = table.players.filter(p => p.sessionChips >= (table.config.minBet || 1));
  table.round = (table.round || 0) + 1;
  table.gameState = null;
  startBettingWindow(table, io);
}

// Gracz wychodzi: jeśli był w trakcie ręki — jego ręce przepadają (zakład już pobrany)
function playerLeft(table, sid, io) {
  const gs = table.gameState;
  if (!gs) return;
  delete gs.bets[sid];
  if (gs.phase === 'playing' && gs.seats.includes(sid)) {
    gs.hands[sid].forEach(h => { h.done = true; h.cards = h.cards.length ? h.cards : []; });
    gs.seats = gs.seats.filter(s => s !== sid);
    if (gs.actingPlayer === sid) setImmediate(() => { if (table.gameState === gs) nextTurn(table, io); });
  }
}

// ─── EMIT ────────────────────────────────────────────────────────
function emitTableState(table, io) {
  const gs = table.gameState;
  const hideHole = gs && (gs.phase === 'playing' || gs.phase === 'betting');
  const dealerHand = !gs ? [] : hideHole ? (gs.dealerHand.length ? [gs.dealerHand[0], '??'] : []) : gs.dealerHand;
  io.to('casino:' + table.id).emit('casinoTableState', {
    table:        getTablePublicFull(table),
    phase:        gs?.phase || 'idle',
    dealerHand,
    dealerValue:  dealerHand.length ? handValue(dealerHand) : null,
    bets:         gs?.bets || {},
    seats:        gs?.seats || [],
    hands:        gs?.hands || {},
    results:      gs?.results || {},
    payouts:      gs?.payouts || {},
    actingPlayer: gs?.actingPlayer || null,
    actingHand:   gs?.actingHand || 0,
    turnDeadline: gs?.turnDeadline || null,
    turnSeconds:  TURN_SECONDS,
    serverNow:    Date.now(),
  });
}

function getTablePublicFull(table) {
  return {
    id: table.id, game: table.game, name: table.name, config: table.config, status: table.status, round: table.round,
    players: table.players.map(p => ({ socketId: p.socketId, discordId: p.discordId, name: p.name, avatar: p.avatar, sessionChips: p.sessionChips, seatIndex: p.seatIndex })),
    observerCount: table.observers?.length || 0,
  };
}

module.exports = { startBettingWindow, startDeal, handleAction, playerLeft, endRound, emitTableState, getTablePublicFull, countdownTimers, turnTimers, handValue, isBlackjack };
