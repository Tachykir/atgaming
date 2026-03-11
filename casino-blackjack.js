/**
 * ═══════════════════════════════════════════════════════════
 *  BLACKJACK — STÓŁ KASYNOWY
 *  Stały stół, gracze dołączają przed każdą rundą zakładów
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function makeDeck(n = 6) {
  const d = [];
  for (let i = 0; i < n; i++)
    for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  return d;
}

function shuffle(d) {
  const a = [...d];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(card) {
  const r = card.slice(0, -1);
  if (['J','Q','K'].includes(r)) return 10;
  if (r === 'A') return 11;
  return parseInt(r);
}

function handValue(cards) {
  let v = (cards || []).filter(c => c !== '??').reduce((s, c) => s + cardValue(c), 0);
  let aces = (cards || []).filter(c => c !== '??' && c.startsWith('A')).length;
  while (v > 21 && aces > 0) { v -= 10; aces--; }
  return v;
}

function isBust(cards)      { return handValue(cards) > 21; }
function isBlackjack(cards) { return cards.length === 2 && handValue(cards) === 21; }

// ─── STAŁE ───────────────────────────────────────────────────────
const BETTING_WINDOW = 20;   // sekund na zakłady
const NEXT_ROUND_DELAY = 8000; // ms po wynikach

const countdownTimers = {};

// ─── TALIA ───────────────────────────────────────────────────────
function ensureDeck(table) {
  if (!table._deck || table._deckIdx >= table._deck.length * 0.65) {
    table._deck    = shuffle(makeDeck(6));
    table._deckIdx = 0;
  }
}

function draw(table) {
  ensureDeck(table);
  return table._deck[table._deckIdx++];
}

// ─── START OKNA ZAKŁADÓW ─────────────────────────────────────────
function startBettingWindow(table, io, seconds = BETTING_WINDOW) {
  clearTimeout(countdownTimers[table.id]);
  if (table.players.length === 0) return;

  table.status    = 'betting';
  table.gameState = {
    phase:      'betting',
    bets:       {},
    hands:      {},
    dealerHand: [],
    results:    {},
    actingPlayer: null,
    actingQueue: [],
    sessionChipsStart: Object.fromEntries(table.players.map(p => [p.socketId, p.sessionChips])),
  };

  let remaining = seconds;
  emitTableState(table, io);
  io.to('casino:' + table.id).emit('casinoCountdown', { tableId: table.id, seconds: remaining });

  function tick() {
    remaining--;
    io.to('casino:' + table.id).emit('casinoCountdown', { tableId: table.id, seconds: remaining });
    if (remaining <= 0) {
      startDeal(table, io);
    } else {
      countdownTimers[table.id] = setTimeout(tick, 1000);
    }
  }
  countdownTimers[table.id] = setTimeout(tick, 1000);
}

// ─── DEAL ────────────────────────────────────────────────────────
function startDeal(table, io) {
  clearTimeout(countdownTimers[table.id]);
  const gs = table.gameState;
  if (!gs) return;

  const bettors = table.players.filter(p => gs.bets[p.socketId] > 0);
  if (bettors.length === 0) {
    // Nikt nie postawił
    table.status = 'open';
    emitTableState(table, io);
    setTimeout(() => startBettingWindow(table, io), 5000);
    return;
  }

  table.status  = 'playing';
  gs.phase      = 'playing';

  // Odejmij zakłady
  bettors.forEach(p => { p.sessionChips -= gs.bets[p.socketId]; });

  // Rozdaj 2 karty każdemu + krupier
  bettors.forEach(p => { gs.hands[p.socketId] = [draw(table), draw(table)]; });
  gs.dealerHand = [draw(table), draw(table)];

  // Kolejka akcji
  gs.actingQueue = bettors.map(p => p.socketId);

  // Automatyczne Blackjacki
  gs.actingQueue = gs.actingQueue.filter(sid => {
    if (isBlackjack(gs.hands[sid])) {
      gs.results[sid] = 'blackjack_pending';
      return false;
    }
    return true;
  });

  if (gs.actingQueue.length === 0) {
    return dealerPlay(table, io);
  }

  gs.actingPlayer = gs.actingQueue[0];
  emitTableState(table, io); // krupier ukryty
}

// ─── AKCJA GRACZA ────────────────────────────────────────────────
function handleAction(table, socketId, event, data, io) {
  const gs = table.gameState;
  if (!gs || gs.phase === 'betting') {
    if (event === 'casinoBJBet') {
      placeBet(table, socketId, data.amount, io);
    }
    return;
  }

  if (gs.phase !== 'playing') return;
  if (gs.actingPlayer !== socketId) return;

  const p = table.players.find(p => p.socketId === socketId);
  if (!p) return;

  if (event === 'casinoBJHit') {
    gs.hands[socketId].push(draw(table));
    if (isBust(gs.hands[socketId])) {
      advanceTurn(table, io);
    } else {
      emitTableState(table, io);
    }
  } else if (event === 'casinoBJStand') {
    advanceTurn(table, io);
  } else if (event === 'casinoBJDouble') {
    if (gs.hands[socketId].length !== 2) return;
    const extra = Math.min(gs.bets[socketId] || 0, p.sessionChips);
    p.sessionChips         -= extra;
    gs.bets[socketId]       = (gs.bets[socketId] || 0) + extra;
    gs.hands[socketId].push(draw(table));
    advanceTurn(table, io);
  }
}

function placeBet(table, socketId, amount, io) {
  const gs = table.gameState;
  if (!gs || gs.phase !== 'betting') return;
  const p = table.players.find(p => p.socketId === socketId);
  if (!p) return;

  const cfg = table.config;
  const bet = Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(amount) || cfg.minBet));
  if (p.sessionChips < bet) return;

  gs.bets[socketId] = bet;
  emitTableState(table, io);
}

function advanceTurn(table, io) {
  const gs = table.gameState;
  gs.actingQueue.shift();
  if (gs.actingQueue.length === 0) {
    dealerPlay(table, io);
  } else {
    gs.actingPlayer = gs.actingQueue[0];
    emitTableState(table, io);
  }
}

// ─── KRUPIER ─────────────────────────────────────────────────────
function dealerPlay(table, io) {
  const gs      = table.gameState;
  gs.phase      = 'dealer';
  gs.actingPlayer = null;

  while (handValue(gs.dealerHand) < 17) {
    gs.dealerHand.push(draw(table));
  }

  const dv   = handValue(gs.dealerHand);
  const dBJ  = isBlackjack(gs.dealerHand);
  const dBust = dv > 21;

  const bettors = table.players.filter(p => gs.bets[p.socketId] > 0);

  bettors.forEach(p => {
    const sid = p.socketId;
    const pv  = handValue(gs.hands[sid] || []);
    const pBust = isBust(gs.hands[sid] || []);
    const pBJ   = gs.results[sid] === 'blackjack_pending';
    let result;

    if (pBust)           result = 'lose';
    else if (pBJ && !dBJ) result = 'blackjack';
    else if (pBJ && dBJ)  result = 'push';
    else if (dBust)       result = 'win';
    else if (pv > dv)     result = 'win';
    else if (pv < dv)     result = 'lose';
    else                  result = 'push';

    gs.results[sid] = result;
    const bet = gs.bets[sid] || 0;

    if      (result === 'win')       { p.sessionChips += bet * 2; }
    else if (result === 'blackjack') { p.sessionChips += Math.floor(bet * 2.5); }
    else if (result === 'push')      { p.sessionChips += bet; }
    // lose: nothing returned
  });

  gs.phase     = 'results';
  table.status = 'results';
  emitTableState(table, io);

  // Sync AT$
  setTimeout(() => endRound(table, io), NEXT_ROUND_DELAY);
}

// ─── KONIEC RUNDY ────────────────────────────────────────────────
function endRound(table, io) {
  const gs = table.gameState;
  if (!gs) return;

  if (table._casino) {
    table.players.forEach(p => {
      if (!p.discordId) return;
      const delta = p.sessionChips - (gs.sessionChipsStart?.[p.socketId] || 0);
      table._casino.updateBalance(p.discordId, delta);
      table._casino.recordGame(p.discordId);
    });
  }

  // Wyrzuć graczy bez żetonów
  table.players = table.players.filter(p => p.sessionChips > 0);

  table.round++;
  table.gameState = null;

  if (table.players.length > 0) {
    table.status = 'betting';
    startBettingWindow(table, io);
  } else {
    table.status = 'open';
    emitTableState(table, io);
  }
}

// ─── EMIT ────────────────────────────────────────────────────────
function emitTableState(table, io) {
  const gs = table.gameState;
  const publicState = {
    table: getTablePublicFull(table, gs),
    phase:       gs?.phase || 'idle',
    dealerHand:  gs?.phase === 'playing' || gs?.phase === 'betting'
                   ? [gs.dealerHand?.[0] || '??', '??']
                   : (gs?.dealerHand || []),
    dealerValue: gs?.phase === 'results' || gs?.phase === 'dealer'
                   ? handValue(gs.dealerHand || []) : null,
    bets:        gs?.bets || {},
    hands:       gs?.hands || {},
    results:     gs?.results || {},
    actingPlayer: gs?.actingPlayer || null,
    actingQueue: gs?.actingQueue || [],
  };

  io.to('casino:' + table.id).emit('casinoTableState', publicState);
}

function getTablePublicFull(table, gs) {
  return {
    id:       table.id,
    game:     table.game,
    name:     table.name,
    config:   table.config,
    status:   table.status,
    round:    table.round,
    players:  table.players.map(p => ({
      socketId:     p.socketId,
      discordId:    p.discordId,
      name:         p.name,
      avatar:       p.avatar,
      sessionChips: p.sessionChips,
      seatIndex:    p.seatIndex,
    })),
    observerCount: table.observers?.length || 0,
  };
}

module.exports = {
  startBettingWindow,
  startDeal,
  handleAction,
  endRound,
  emitTableState,
  getTablePublicFull,
  countdownTimers,
};
