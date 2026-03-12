/**
 * MODUŁ GRY: POKER TEXAS HOLD'EM
 * 2-8 graczy, pełne rundy licytacji
 */

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

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

function rankValue(card) {
  return RANKS.indexOf(card.slice(0, -1));
}

function compareTiebreak(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function evaluateHand(cards) {
  // Returns { rank: 0-8, name, tiebreak }
  const vals = cards.map(rankValue).sort((a,b) => b-a);
  const suits = cards.map(c => c.slice(-1));
  const counts = {};
  vals.forEach(v => counts[v] = (counts[v]||0)+1);
  const groups = Object.entries(counts).map(([v,c]) => [+v,c]).sort((a,b) => b[1]-a[1]||b[0]-a[0]);
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = vals.length === 5 && vals[0]-vals[4] === 4 && new Set(vals).size === 5;
  // Ace-low straight: A-2-3-4-5 (vals=[12,3,2,1,0])
  const isAceLow = vals.length === 5 && vals[0] === 12 && vals[1] === 3 && vals[2] === 2 && vals[3] === 1 && vals[4] === 0;
  const aceLowTb = [3, 2, 1, 0, -1]; // tiebreak dla A-2-3-4-5 (As liczy jako 1)
  // Royal/Straight flush
  if (isFlush && isStraight) return { rank: vals[0] === 12 ? 8 : 7, name: vals[0]===12?'Royal Flush':'Straight Flush', tiebreak: vals };
  if (isFlush && isAceLow) return { rank: 7, name: 'Straight Flush', tiebreak: aceLowTb };
  if (groups[0][1] === 4) return { rank: 6, name: 'Kareta', tiebreak: vals };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { rank: 5, name: 'Full House', tiebreak: vals };
  if (isFlush) return { rank: 4, name: 'Kolor', tiebreak: vals };
  if (isStraight) return { rank: 3, name: 'Strit', tiebreak: vals };
  if (isAceLow) return { rank: 3, name: 'Strit', tiebreak: aceLowTb };
  if (groups[0][1] === 3) return { rank: 2, name: 'Trójka', tiebreak: vals };
  if (groups[0][1] === 2 && groups[1][1] === 2) return { rank: 1, name: 'Dwie pary', tiebreak: vals };
  if (groups[0][1] === 2) return { rank: 0.5, name: 'Para', tiebreak: vals };
  return { rank: 0, name: 'Wysoka karta', tiebreak: vals };
}

function bestHand(hole, community) {
  // Best 5-card hand from 7 cards
  const all = [...hole, ...community];
  let best = null;
  for (let i = 0; i < all.length - 4; i++)
    for (let j = i+1; j < all.length - 3; j++)
      for (let k = j+1; k < all.length - 2; k++)
        for (let l = k+1; l < all.length - 1; l++)
          for (let m = l+1; m < all.length; m++) {
            const h = evaluateHand([all[i],all[j],all[k],all[l],all[m]]);
            if (!best || h.rank > best.rank || (h.rank === best.rank && compareTiebreak(h.tiebreak, best.tiebreak) > 0)) best = h;
          }
  return best;
}

function dealNewRound(room) {
  const gs = room.gameState;
  const deck = shuffle(makeDeck());
  gs.deck = deck;
  gs.community = [];
  gs.pot = 0;
  gs.sidePots = [];
  gs.phase = 'preflop'; // preflop > flop > turn > river > showdown
  gs.deckIdx = 0;

  // Deal 2 hole cards to each active player
  const active = room.players.filter(p => gs.chips[p.id] > 0);
  active.forEach(p => {
    gs.hands[p.id] = [deck[gs.deckIdx++], deck[gs.deckIdx++]];
    gs.folded[p.id] = false;
    gs.allIn[p.id] = false;
    gs.currentBet[p.id] = 0;
  });

  // Blinds
  const blindIdx = gs.dealerIdx % active.length;
  const sbId = active[(blindIdx + 1) % active.length].id;
  const bbId = active[(blindIdx + 2) % active.length].id;
  gs.smallBlind = sbId;
  gs.bigBlind = bbId;

  const sb = Math.min(gs.blindAmount, gs.chips[sbId]);
  const bb = Math.min(gs.blindAmount * 2, gs.chips[bbId]);
  gs.chips[sbId] -= sb; gs.currentBet[sbId] = sb; gs.pot += sb;
  gs.chips[bbId] -= bb; gs.currentBet[bbId] = bb; gs.pot += bb;
  gs.callAmount = bb;
  gs.lastRaiser = bbId;

  // UTG acts first preflop
  const utg = active[(blindIdx + 3) % active.length];
  gs.actingPlayer = utg ? utg.id : active[0].id;
  gs.actingQueue = active.map(p => p.id).filter(id => !gs.folded[id]);
  // Rotate queue to start at UTG
  while (gs.actingQueue[0] !== gs.actingPlayer) gs.actingQueue.push(gs.actingQueue.shift());

  gs.dealerIdx++;
}

function nextPhase(room, io) {
  const gs = room.gameState;
  const active = room.players.filter(p => !gs.folded[p.id] && gs.chips[p.id] >= 0);
  const notFolded = active.filter(p => !gs.folded[p.id]);

  if (notFolded.length === 1) {
    // Everyone else folded
    return finishRound(room, io);
  }

  gs.callAmount = 0;
  Object.keys(gs.currentBet).forEach(id => gs.currentBet[id] = 0);

  if (gs.phase === 'preflop') {
    gs.phase = 'flop';
    gs.community.push(gs.deck[gs.deckIdx++], gs.deck[gs.deckIdx++], gs.deck[gs.deckIdx++]);
  } else if (gs.phase === 'flop') {
    gs.phase = 'turn';
    gs.community.push(gs.deck[gs.deckIdx++]);
  } else if (gs.phase === 'turn') {
    gs.phase = 'river';
    gs.community.push(gs.deck[gs.deckIdx++]);
  } else if (gs.phase === 'river') {
    return finishRound(room, io);
  }

  // Reset betting queue - start from first active player after dealer
  const actives = notFolded.map(p => p.id);
  gs.actingQueue = [...actives];
  gs.actingPlayer = actives[0];
  gs.lastRaiser = null;

  io.to(room.id).emit('pokerState', buildPublicState(room));
}

function finishRound(room, io) {
  const gs = room.gameState;
  const notFolded = room.players.filter(p => !gs.folded[p.id]);

  let winners = [];
  if (notFolded.length === 1) {
    winners = [notFolded[0].id];
  } else {
    // Evaluate hands
    const scored = notFolded.map(p => ({
      id: p.id,
      hand: bestHand(gs.hands[p.id], gs.community),
    })).sort((a,b) => b.hand.rank - a.hand.rank || compareTiebreak(b.hand.tiebreak, a.hand.tiebreak));

    const top = scored[0].hand;
    winners = scored.filter(s => s.hand.rank === top.rank && compareTiebreak(s.hand.tiebreak, top.tiebreak) === 0).map(s => s.id);
  }

  const share = Math.floor(gs.pot / winners.length);
  winners.forEach(id => gs.chips[id] += share);

  gs.phase = 'showdown';
  gs.roundWinners = winners;
  gs.showHands = {};
  notFolded.forEach(p => { gs.showHands[p.id] = gs.hands[p.id]; });

  io.to(room.id).emit('pokerRoundEnd', {
    winners,
    pot: gs.pot,
    showHands: gs.showHands,
    community: gs.community,
    chips: gs.chips,
    handNames: Object.fromEntries(
      Object.entries(gs.showHands).map(([id, cards]) => [id, bestHand(cards, gs.community)?.name])
    ),
    room,
  });

  // Check if game over
  const eliminated = room.players.filter(p => gs.chips[p.id] <= 0);
  const alive = room.players.filter(p => gs.chips[p.id] > 0);

  if (alive.length <= 1) {
    room.status = 'finished';
    const sorted = room.players.map(p => ({ ...p, score: gs.chips[p.id] || 0 })).sort((a,b) => b.score-a.score);
    room.players = sorted;
    setTimeout(() => io.to(room.id).emit('gameOver', { room, sorted }), 4000);
  } else {
    setTimeout(() => {
      dealNewRound(room);
      io.to(room.id).emit('pokerState', buildPublicState(room));
    }, 4000);
  }
}

function buildPublicState(room) {
  const gs = room.gameState;
  // Don't reveal hole cards to other players
  const publicHands = {};
  Object.entries(gs.hands).forEach(([id, cards]) => {
    publicHands[id] = gs.folded[id] ? [] : ['??','??']; // hidden
  });
  return {
    phase: gs.phase,
    community: gs.community,
    pot: gs.pot,
    chips: gs.chips,
    folded: gs.folded,
    allIn: gs.allIn,
    actingPlayer: gs.actingPlayer,
    callAmount: gs.callAmount,
    currentBet: gs.currentBet,
    smallBlind: gs.smallBlind,
    bigBlind: gs.bigBlind,
    handCount: gs.handCount || 1,
    room,
    _privateHands: gs.hands, // server sends this, client shows only own cards
  };
}

module.exports = {
  meta: {
    id: 'poker',
    name: 'Poker Texas Hold\'em',
    icon: '🃏',
    description: 'Klasyczny poker z licytacją dla 2-8 graczy',
    color: '#5cf0c8',
    minPlayers: 2,
    maxPlayers: 8,
    supportsGameMaster: false,
    configSchema: {
      startChips:   { type: 'number', label: 'Żetony startowe', min: 100, max: 10000, default: 1000 },
      blindAmount:  { type: 'number', label: 'Mała ciemna',      min: 5,   max: 500,  default: 10 },
    },
  },

  defaultContent: {},

  createState(config) {
    return {
      chips: {},
      hands: {},
      folded: {},
      allIn: {},
      currentBet: {},
      community: [],
      pot: 0,
      phase: 'waiting',
      actingPlayer: null,
      actingQueue: [],
      callAmount: 0,
      lastRaiser: null,
      dealerIdx: 0,
      deckIdx: 0,
      deck: [],
      startChips: Number(config.startChips) || 1000,
      blindAmount: Number(config.blindAmount) || 10,
      roundWinners: [],
      showHands: {},
      smallBlind: null,
      bigBlind: null,
    };
  },

  onStart({ room, io }) {
    const gs = room.gameState;
    room.players.forEach(p => {
      gs.chips[p.id] = gs.startChips;
    });
    dealNewRound(room);
    io.to(room.id).emit('pokerState', buildPublicState(room));
  },

  onEvent({ event, data, socket, room, io }) {
    if (!['pokerFold','pokerCall','pokerRaise','pokerCheck'].includes(event)) return;
    const gs = room.gameState;
    if (socket.id !== gs.actingPlayer) return;

    const playerId = socket.id;
    const chips = gs.chips[playerId];
    const toCall = gs.callAmount - (gs.currentBet[playerId] || 0);

    if (event === 'pokerFold') {
      gs.folded[playerId] = true;
    } else if (event === 'pokerCheck') {
      if (toCall > 0) return; // can't check
    } else if (event === 'pokerCall') {
      const amount = Math.min(toCall, chips);
      gs.chips[playerId] -= amount;
      gs.currentBet[playerId] = (gs.currentBet[playerId] || 0) + amount;
      gs.pot += amount;
      if (gs.chips[playerId] === 0) gs.allIn[playerId] = true;
    } else if (event === 'pokerRaise') {
      const raiseTotal = Math.min(Number(data.amount) || gs.callAmount * 2, chips + (gs.currentBet[playerId]||0));
      const diff = raiseTotal - (gs.currentBet[playerId] || 0);
      if (diff <= 0 || diff > chips) return;
      gs.chips[playerId] -= diff;
      gs.currentBet[playerId] = raiseTotal;
      gs.pot += diff;
      gs.callAmount = raiseTotal;
      gs.lastRaiser = playerId;
      if (gs.chips[playerId] === 0) gs.allIn[playerId] = true;

      // Po raise: przebuduj kolejkę — wszyscy aktywni gracze oprócz raisera i all-in
      // muszą dostać szansę odpowiedzi (nawet jeśli już zagrali w tej rundzie)
      const allActive = room.players.filter(p => !gs.folded[p.id] && !gs.allIn[p.id] && p.id !== playerId);
      // Kolejność: gracze po raiserze (wrap-around)
      const allIds = room.players.map(p => p.id);
      const raiserIdx = allIds.indexOf(playerId);
      const orderedAfterRaiser = [
        ...allIds.slice(raiserIdx + 1),
        ...allIds.slice(0, raiserIdx),
      ].filter(id => allActive.some(p => p.id === id));
      gs.actingQueue = orderedAfterRaiser;
    }

    // Advance queue — przesuń bieżącego gracza (chyba że to był raise, który już przebudował kolejkę)
    if (event !== 'pokerRaise') {
      gs.actingQueue.shift();
    }

    const remaining = gs.actingQueue.filter(id => !gs.folded[id] && !gs.allIn[id]);

    if (remaining.length === 0) {
      return nextPhase(room, io);
    }

    // Sprawdź czy wszyscy wyrównali
    const allActive2 = room.players.filter(p => !gs.folded[p.id] && !gs.allIn[p.id]);
    const allCallMatch = allActive2.every(p => (gs.currentBet[p.id]||0) >= gs.callAmount);
    if (allCallMatch && gs.actingQueue.length === 0) {
      return nextPhase(room, io);
    }

    gs.actingPlayer = gs.actingQueue[0];
    io.to(room.id).emit('pokerState', buildPublicState(room));
  },
};
