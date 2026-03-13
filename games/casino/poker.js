/**
 * ═══════════════════════════════════════════════════════════
 *  POKER TEXAS HOLD'EM — STÓŁ KASYNOWY
 *  Nie używa systemu pokojów — zarządzany przez casino.js
 *  Gracze siedzą przy stole, rundy startują automatycznie
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

// ─── TALIA ───────────────────────────────────────────────────────
function makeDeck() {
  const d = [];
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

// ─── EWALUACJA RĄKAWÓW ───────────────────────────────────────────
const RANK_IDX = Object.fromEntries(RANKS.map((r, i) => [r, i]));

function rankValue(card) { return RANK_IDX[card.slice(0, -1)]; }

function evaluateHand(cards) {
  const vals  = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(c => c.slice(-1));
  const cnt   = {};
  vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
  const groups = Object.entries(cnt).map(([v, c]) => [+v, c]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush    = suits.every(s => s === suits[0]);
  const straight = vals.length === 5 && vals[0] - vals[4] === 4 && new Set(vals).size === 5;
  // Ace-low straight (A-2-3-4-5)
  const aceLow = vals.length === 5 && JSON.stringify(vals) === JSON.stringify([12,3,2,1,0]);
  if (flush && (straight || aceLow)) return { rank: vals[0] === 12 && straight ? 8 : 7, name: vals[0]===12&&straight?'Royal Flush':'Straight Flush', tb: vals };
  if (groups[0][1] === 4) return { rank: 6, name: 'Kareta',       tb: vals };
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return { rank: 5, name: 'Full House', tb: vals };
  if (flush)    return { rank: 4, name: 'Kolor',      tb: vals };
  if (straight || aceLow) return { rank: 3, name: 'Strit',  tb: vals };
  if (groups[0][1] === 3) return { rank: 2, name: 'Trójka',  tb: vals };
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) return { rank: 1, name: 'Dwie pary', tb: vals };
  if (groups[0][1] === 2) return { rank: 0.5, name: 'Para',   tb: vals };
  return { rank: 0, name: 'Wysoka karta', tb: vals };
}

function bestHand(hole, community) {
  const all = [...hole, ...community];
  if (all.length < 5) return evaluateHand(all);
  let best = null;
  const n = all.length;
  for (let i = 0; i < n - 4; i++)
    for (let j = i+1; j < n - 3; j++)
      for (let k = j+1; k < n - 2; k++)
        for (let l = k+1; l < n - 1; l++)
          for (let m = l+1; m < n; m++) {
            const h = evaluateHand([all[i],all[j],all[k],all[l],all[m]]);
            if (!best || h.rank > best.rank || (h.rank === best.rank && compareTb(h.tb, best.tb) > 0)) best = h;
          }
  return best;
}

function compareTb(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// ─── STAN GRY ────────────────────────────────────────────────────
function createRoundState(table) {
  return {
    phase:       'preflop', // preflop|flop|turn|river|showdown
    deck:        shuffle(makeDeck()),
    deckIdx:     0,
    community:   [],
    pot:         0,
    hands:       {},    // socketId -> [card, card]
    folded:      {},
    allIn:       {},
    currentBet:  {},
    callAmount:  0,
    actingPlayer: null,
    actingQueue: [],
    dealerIdx:   table.dealerIdx || 0,
    smallBlind:  null,
    bigBlind:    null,
    lastRaiser:  null,
    showHands:   null,
    roundWinners: [],
    handNames:   {},
    sessionChipsStart: Object.fromEntries(table.players.map(p => [p.socketId, p.sessionChips])),
  };
}

// ─── ŚLEPE ───────────────────────────────────────────────────────
function postBlinds(table, gs) {
  const active = table.players.filter(p => p.sessionChips > 0);
  if (active.length < 2) return;
  const n       = active.length;
  const dIdx    = gs.dealerIdx % n;
  const sbPlayer = active[(dIdx + 1) % n];
  const bbPlayer = active[(dIdx + 2) % n];
  const blind   = table.config.blindAmount;

  const sbAmt = Math.min(blind, sbPlayer.sessionChips);
  const bbAmt = Math.min(blind * 2, bbPlayer.sessionChips);

  sbPlayer.sessionChips      -= sbAmt;
  bbPlayer.sessionChips      -= bbAmt;
  gs.currentBet[sbPlayer.socketId] = sbAmt;
  gs.currentBet[bbPlayer.socketId] = bbAmt;
  gs.pot     += sbAmt + bbAmt;
  gs.callAmount  = bbAmt;
  gs.smallBlind  = sbPlayer.socketId;
  gs.bigBlind    = bbPlayer.socketId;
  gs.lastRaiser  = bbPlayer.socketId;
  if (sbPlayer.sessionChips === 0) gs.allIn[sbPlayer.socketId] = true;
  if (bbPlayer.sessionChips === 0) gs.allIn[bbPlayer.socketId] = true;

  // UTG = gracz po BB
  const utg = active[(dIdx + 3) % n] || active[0];
  gs.actingPlayer = utg.socketId;
  gs.actingQueue  = active.map(p => p.socketId);
  while (gs.actingQueue[0] !== gs.actingPlayer) gs.actingQueue.push(gs.actingQueue.shift());
}

// ─── DEAL ────────────────────────────────────────────────────────
function dealCards(table, gs) {
  const active = table.players.filter(p => p.sessionChips > 0);
  active.forEach(p => {
    gs.hands[p.socketId]   = [gs.deck[gs.deckIdx++], gs.deck[gs.deckIdx++]];
    gs.folded[p.socketId]  = false;
    gs.allIn[p.socketId]   = gs.allIn[p.socketId] || false;
    gs.currentBet[p.socketId] = gs.currentBet[p.socketId] || 0;
  });
}

// ─── NASTĘPNA FAZA ───────────────────────────────────────────────
function nextPhase(table, gs, io) {
  const notFolded = table.players.filter(p => !gs.folded[p.socketId]);
  if (notFolded.length === 1) return finishRound(table, gs, io);

  // Reset bets
  gs.callAmount = 0;
  Object.keys(gs.currentBet).forEach(id => gs.currentBet[id] = 0);
  gs.lastRaiser = null;

  if      (gs.phase === 'preflop') { gs.phase = 'flop';  gs.community.push(gs.deck[gs.deckIdx++], gs.deck[gs.deckIdx++], gs.deck[gs.deckIdx++]); }
  else if (gs.phase === 'flop')    { gs.phase = 'turn';  gs.community.push(gs.deck[gs.deckIdx++]); }
  else if (gs.phase === 'turn')    { gs.phase = 'river'; gs.community.push(gs.deck[gs.deckIdx++]); }
  else if (gs.phase === 'river')   { return finishRound(table, gs, io); }

  const actives = notFolded.filter(p => !gs.allIn[p.socketId]).map(p => p.socketId);
  gs.actingQueue   = actives;
  gs.actingPlayer  = actives[0] || null;

  if (!gs.actingPlayer || actives.length === 0) {
    // Everyone all-in, run out board
    if (gs.phase === 'flop')   { gs.community.push(gs.deck[gs.deckIdx++]); gs.community.push(gs.deck[gs.deckIdx++]); }
    else if (gs.phase === 'turn')  { gs.community.push(gs.deck[gs.deckIdx++]); }
    return finishRound(table, gs, io);
  }

  emitTableState(table, io);
}

// ─── KONIEC RUNDY ────────────────────────────────────────────────
function finishRound(table, gs, io) {
  const notFolded = table.players.filter(p => !gs.folded[p.socketId]);
  let winners = [];

  if (notFolded.length === 1) {
    winners = [notFolded[0].socketId];
    gs.showHands = {};
  } else {
    const scored = notFolded.map(p => ({
      socketId: p.socketId,
      hand:     bestHand(gs.hands[p.socketId] || [], gs.community),
    })).sort((a, b) => {
      if (b.hand.rank !== a.hand.rank) return b.hand.rank - a.hand.rank;
      return compareTb(b.hand.tb, a.hand.tb);
    });
    const top = scored[0].hand;
    winners = scored.filter(s => s.hand.rank === top.rank && compareTb(s.hand.tb, top.tb) === 0).map(s => s.socketId);
    gs.showHands  = {};
    gs.handNames  = {};
    notFolded.forEach(p => {
      gs.showHands[p.socketId] = gs.hands[p.socketId];
      gs.handNames[p.socketId] = bestHand(gs.hands[p.socketId], gs.community)?.name;
    });
  }

  // FIX #20: Side poty dla graczy all-in
  // Gracz all-in może wygrać tylko tyle ile sam włożył × liczba graczy w tej puli.
  // Obliczamy serie side potów od najmniejszego wkładu wzwyż.
  {
    const allPlayers = table.players.filter(p => gs.hands[p.socketId]);
    const contributions = {};
    allPlayers.forEach(p => {
      const start = gs.sessionChipsStart?.[p.socketId] ?? p.sessionChips;
      contributions[p.socketId] = Math.max(0, start - p.sessionChips);
    });

    // Oceń ręce wszystkich niesfoldowanych raz (używane w każdym pocie)
    const handScores = {};
    notFolded.forEach(p => {
      handScores[p.socketId] = bestHand(gs.hands[p.socketId] || [], gs.community);
    });

    // Posortuj poziomy wkładu rosnąco (każdy unikalny poziom = 1 side pot)
    const capLevels = [...new Set(
      allPlayers.map(p => contributions[p.socketId]).filter(v => v > 0)
    )].sort((a, b) => a - b);

    let remaining  = gs.pot;
    let covered    = 0;

    for (const cap of capLevels) {
      const levelContrib = cap - covered;
      if (levelContrib <= 0) continue;

      // Ile osób płaciło co najmniej tyle
      const contributors = allPlayers.filter(p => contributions[p.socketId] >= cap).length;
      const sidePot = Math.min(levelContrib * contributors, remaining);
      remaining -= sidePot;
      covered    = cap;

      // Uprawnieni do wygrania tego potu: niesfoldowani którzy wnieśli co najmniej `cap`
      const eligible = notFolded.filter(p => contributions[p.socketId] >= cap);
      if (eligible.length === 0) continue;

      const scored = eligible
        .map(p => ({ socketId: p.socketId, hand: handScores[p.socketId] }))
        .sort((a, b) => b.hand.rank - a.hand.rank || compareTb(b.hand.tb, a.hand.tb));

      const topHand = scored[0].hand;
      const potWinners = scored
        .filter(s => s.hand.rank === topHand.rank && compareTb(s.hand.tb, topHand.tb) === 0)
        .map(s => s.socketId);

      const share = Math.floor(sidePot / potWinners.length);
      const rem   = sidePot - share * potWinners.length;
      potWinners.forEach((wsid, i) => {
        const wp = table.players.find(p => p.socketId === wsid);
        if (wp) wp.sessionChips += share + (i === 0 ? rem : 0);
      });

      // Zbierz winners z głównego potu do wyświetlenia (ostatni side pot = main pot winners)
      if (remaining === 0 || cap === capLevels[capLevels.length - 1]) {
        winners = potWinners;
      }
    }

    // Jeśli nie było żadnych capLevels (wszyscy sfolodwani, jeden zwycięzca) lub zostało reszty
    if (capLevels.length === 0) {
      const share = Math.floor(gs.pot / winners.length);
      const rem   = gs.pot - share * winners.length;
      winners.forEach((wsid, i) => {
        const wp = table.players.find(p => p.socketId === wsid);
        if (wp) wp.sessionChips += share + (i === 0 ? rem : 0);
      });
    } else if (remaining > 0 && notFolded.length > 0) {
      // Zostałe żetony (zaokrąglenie) -> najlepsza ręka
      const best = notFolded
        .map(p => ({ socketId: p.socketId, hand: handScores[p.socketId] }))
        .sort((a, b) => b.hand.rank - a.hand.rank || compareTb(b.hand.tb, a.hand.tb))[0];
      const wp = table.players.find(p => p.socketId === best?.socketId);
      if (wp) wp.sessionChips += remaining;
    }
  }

  gs.phase        = 'showdown';
  gs.roundWinners = winners;
  table.status    = 'showdown';

  emitTableState(table, io, { showdown: true, winners, pot: gs.pot, showHands: gs.showHands, handNames: gs.handNames });

  // Eliminate bankrupt players & sync AT$ back
  setTimeout(() => {
    endRound(table, gs, io);
  }, 5000);
}

// ─── PO RUNDZIE: sync AT$ + kick broke players ──────────────────
function endRound(table, gs, io, casino) {
  // casino może być undefined jeśli nie przekazano — zostanie wstrzyknięty przez server.js
  if (table._casino) {
    table.players.forEach(p => {
      if (!p.discordId) return;
      // FIX #21: Synchronizuj AT$ tylko dla graczy którzy faktycznie grali w tej rundzie
      // (byli w sessionChipsStart). Gracz który dołączył w trakcie rundy ma undefined w
      // sessionChipsStart -> bez tej ochrony dostałby podwójny zwrot buy-inu.
      if (gs.sessionChipsStart && !(p.socketId in gs.sessionChipsStart)) return;
      const delta = p.sessionChips - (gs.sessionChipsStart?.[p.socketId] || 0);
      table._casino.updateBalance(p.discordId, delta).catch(() => {});
      table._casino.recordGame(p.discordId).catch(() => {});
    });
  }

  // Wyrzuć graczy bez żetonów
  table.players = table.players.filter(p => p.sessionChips > 0);

  // Nowa runda jeśli >= 2 graczy
  table.round++;
  table.dealerIdx = (table.dealerIdx || 0) + 1;

  if (table.players.length >= 2) {
    table.status = 'open';
    startCountdown(table, io);
  } else {
    table.status = 'open';
    table.gameState = null;
    emitTableState(table, io);
  }
}

// ─── COUNTDOWN DO STARTU ─────────────────────────────────────────
const countdownTimers = {};

function startCountdown(table, io, seconds = 10) {
  clearTimeout(countdownTimers[table.id]);

  if (table.players.length < 2) {
    io.to('casino:' + table.id).emit('casinoTableState', { table: getTablePublicFull(table, null), countdown: null });
    return;
  }

  let remaining = seconds;
  io.to('casino:' + table.id).emit('casinoCountdown', { tableId: table.id, seconds: remaining });

  function tick() {
    remaining--;
    if (remaining <= 0) {
      startRound(table, io);
    } else {
      io.to('casino:' + table.id).emit('casinoCountdown', { tableId: table.id, seconds: remaining });
      countdownTimers[table.id] = setTimeout(tick, 1000);
    }
  }
  countdownTimers[table.id] = setTimeout(tick, 1000);
}

// ─── START RUNDY ─────────────────────────────────────────────────
function startRound(table, io) {
  if (table.players.length < 2) return;
  table.status    = 'playing';
  const gs        = createRoundState(table);
  table.gameState = gs;

  dealCards(table, gs);
  postBlinds(table, gs);

  emitTableState(table, io);
}

// ─── EMIT STATE ──────────────────────────────────────────────────
function emitTableState(table, io, extra = {}) {
  const gs = table.gameState;
  if (!gs) {
    io.to('casino:' + table.id).emit('casinoTableState', {
      table: getTablePublicFull(table, null),
      ...extra,
    });
    return;
  }
  // Broadcast public state (hides hole cards)
  io.to('casino:' + table.id).emit('casinoTableState', {
    table:       getTablePublicFull(table, gs),
    community:   gs.community,
    pot:         gs.pot,
    phase:       gs.phase,
    actingPlayer: gs.actingPlayer,
    callAmount:  gs.callAmount,
    currentBet:  gs.currentBet,
    folded:      gs.folded,
    allIn:       gs.allIn,
    smallBlind:  gs.smallBlind,
    bigBlind:    gs.bigBlind,
    showHands:   extra.showdown ? gs.showHands : null,
    handNames:   extra.showdown ? gs.handNames : null,
    ...extra,
  });

  // Send private hole cards to each player
  table.players.forEach(p => {
    if (gs.hands[p.socketId]) {
      io.to(p.socketId).emit('casinoMyHand', {
        tableId: table.id,
        cards:   gs.folded[p.socketId] ? [] : gs.hands[p.socketId],
      });
    }
  });
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

// ─── AKCJE GRACZA ────────────────────────────────────────────────
function handleAction(table, socketId, event, data, io) {
  const gs = table.gameState;
  if (!gs || table.status !== 'playing') return;
  if (gs.actingPlayer !== socketId) return;

  const p      = table.players.find(p => p.socketId === socketId);
  if (!p) return;
  const chips  = p.sessionChips;
  const toCall = (gs.callAmount || 0) - (gs.currentBet[socketId] || 0);

  if (event === 'casinoPokerFold') {
    gs.folded[socketId] = true;
  } else if (event === 'casinoPokerCheck') {
    if (toCall > 0) return;
  } else if (event === 'casinoPokerCall') {
    const amt = Math.min(toCall, chips);
    p.sessionChips             -= amt;
    gs.currentBet[socketId]     = (gs.currentBet[socketId] || 0) + amt;
    gs.pot                     += amt;
    if (p.sessionChips === 0) gs.allIn[socketId] = true;
  } else if (event === 'casinoPokerRaise') {
    const raiseTotal = Math.min(Number(data.amount) || gs.callAmount * 2, chips + (gs.currentBet[socketId]||0));
    const diff = raiseTotal - (gs.currentBet[socketId] || 0);
    if (diff <= 0 || diff > chips) return;
    p.sessionChips             -= diff;
    gs.currentBet[socketId]     = raiseTotal;
    gs.pot                     += diff;
    gs.callAmount               = raiseTotal;
    gs.lastRaiser               = socketId;
    if (p.sessionChips === 0) gs.allIn[socketId] = true;

    // Po raise: przebuduj kolejkę — wszyscy aktywni gracze oprócz raisera i all-in
    // muszą dostać kolejną szansę odpowiedzi (nawet jeśli już zagrali)
    const allSeats = table.players.map(p => p.socketId);
    const raiserIdx = allSeats.indexOf(socketId);
    const newQueue = [
      ...allSeats.slice(raiserIdx + 1),
      ...allSeats.slice(0, raiserIdx),
    ].filter(sid => !gs.folded[sid] && !gs.allIn[sid]);
    gs.actingQueue = newQueue;

    if (gs.actingQueue.length === 0) {
      nextPhase(table, gs, io);
    } else {
      gs.actingPlayer = gs.actingQueue[0];
      emitTableState(table, io);
    }
    return;
  } else {
    return;
  }

  // Advance action queue (tylko dla fold/check/call — raise obsługuje sam)
  gs.actingQueue.shift();

  const activePlayers = table.players.filter(p => !gs.folded[p.socketId] && !gs.allIn[p.socketId]);
  const allMatched    = activePlayers.every(pl => (gs.currentBet[pl.socketId]||0) >= gs.callAmount);

  // FIX #7: Big Blind zawsze dostaje opcję preflop, nawet gdy wszyscy wyrównali
  // BB może podnieść, więc runda zakładów nie kończy się, dopóki BB nie zagra
  const bbHasOption = gs.phase === 'preflop'
    && gs.bigBlind
    && gs.lastRaiser === gs.bigBlind  // nikt nie podbił po BB (lastRaiser to wciąż BB)
    && gs.actingQueue.includes(gs.bigBlind); // BB jeszcze w kolejce

  if (gs.actingQueue.length === 0 || (allMatched && !bbHasOption)) {
    nextPhase(table, gs, io);
  } else {
    gs.actingPlayer = gs.actingQueue[0];
    emitTableState(table, io);
  }
}

module.exports = {
  startRound,
  startCountdown,
  handleAction,
  endRound,
  emitTableState,
  getTablePublicFull,
  countdownTimers,
};
