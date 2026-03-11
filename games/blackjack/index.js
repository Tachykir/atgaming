/**
 * MODUŁ GRY: BLACKJACK
 * 1-6 graczy vs krupier
 * Każdy gracz gra jednocześnie przeciwko krupierowi
 */

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function makeDeck(numDecks = 2) {
  const d = [];
  for (let i = 0; i < numDecks; i++)
    for (const s of SUITS) for (const r of RANKS) d.push(r+s);
  return d;
}

function shuffle(d) {
  const a = [...d];
  for (let i = a.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function cardValue(card) {
  const r = card.slice(0,-1);
  if (['J','Q','K'].includes(r)) return 10;
  if (r === 'A') return 11;
  return parseInt(r);
}

function handValue(cards) {
  let v = cards.reduce((s,c) => s + cardValue(c), 0);
  let aces = cards.filter(c => c.startsWith('A')).length;
  while (v > 21 && aces > 0) { v -= 10; aces--; }
  return v;
}

function isBust(cards) { return handValue(cards) > 21; }
function isBlackjack(cards) { return cards.length === 2 && handValue(cards) === 21; }

module.exports = {
  meta: {
    id: 'blackjack',
    name: 'Blackjack',
    icon: '🎰',
    description: 'Klasyczny blackjack – bliżej 21 niż krupier!',
    color: '#fc5c7d',
    minPlayers: 1,
    maxPlayers: 6,
    supportsGameMaster: false,
    configSchema: {
      startChips:  { type: 'number', label: 'Żetony startowe', min: 100, max: 10000, default: 500 },
      minBet:      { type: 'number', label: 'Min. zakład',      min: 1,   max: 100,  default: 10 },
      maxBet:      { type: 'number', label: 'Maks. zakład',     min: 10,  max: 1000, default: 100 },
    },
  },

  defaultContent: {},

  createState(config) {
    return {
      phase: 'betting', // betting > playing > dealer > results
      deck: [],
      deckIdx: 0,
      hands: {},       // playerId -> [cards]
      dealerHand: [],
      bets: {},        // playerId -> number
      chips: {},       // playerId -> number
      results: {},     // playerId -> win|lose|push|blackjack
      actingPlayer: null,
      actingQueue: [],
      startChips: Number(config.startChips) || 500,
      minBet: Number(config.minBet) || 10,
      maxBet: Number(config.maxBet) || 100,
      roundNum: 0,
    };
  },

  onStart({ room, io }) {
    const gs = room.gameState;
    room.players.forEach(p => { gs.chips[p.id] = gs.startChips; gs.bets[p.id] = 0; });
    gs.deck = shuffle(makeDeck(2));
    gs.deckIdx = 0;
    gs.phase = 'betting';
    gs.roundNum = 1;
    io.to(room.id).emit('bjState', { gs, room });
  },

  onEvent({ event, data, socket, room, io }) {
    const gs = room.gameState;

    if (event === 'bjBet') {
      if (gs.phase !== 'betting') return;
      const amount = Math.max(gs.minBet, Math.min(gs.maxBet, Number(data.amount) || gs.minBet));
      if (gs.chips[socket.id] < amount) return;
      gs.bets[socket.id] = amount;
      io.to(room.id).emit('bjState', { gs, room });

      // All players bet?
      const alive = room.players.filter(p => gs.chips[p.id] > 0);
      if (alive.every(p => gs.bets[p.id] > 0)) {
        startDeal(room, io);
      }
      return;
    }

    if (event === 'bjHit') {
      if (gs.phase !== 'playing' || gs.actingPlayer !== socket.id) return;
      gs.hands[socket.id].push(gs.deck[gs.deckIdx++]);
      if (isBust(gs.hands[socket.id])) {
        advanceTurn(room, io);
      } else {
        io.to(room.id).emit('bjState', { gs, room });
      }
      return;
    }

    if (event === 'bjStand') {
      if (gs.phase !== 'playing' || gs.actingPlayer !== socket.id) return;
      advanceTurn(room, io);
      return;
    }

    if (event === 'bjDouble') {
      if (gs.phase !== 'playing' || gs.actingPlayer !== socket.id) return;
      if (gs.hands[socket.id].length !== 2) return;
      const extra = Math.min(gs.bets[socket.id], gs.chips[socket.id]);
      gs.chips[socket.id] -= extra;
      gs.bets[socket.id] += extra;
      gs.hands[socket.id].push(gs.deck[gs.deckIdx++]);
      advanceTurn(room, io);
      return;
    }
  },
};

function startDeal(room, io) {
  const gs = room.gameState;
  const alive = room.players.filter(p => gs.chips[p.id] > 0);

  // Deduct bets
  alive.forEach(p => { gs.chips[p.id] -= gs.bets[p.id]; });

  // Deal 2 each
  alive.forEach(p => { gs.hands[p.id] = [gs.deck[gs.deckIdx++], gs.deck[gs.deckIdx++]]; });
  gs.dealerHand = [gs.deck[gs.deckIdx++], gs.deck[gs.deckIdx++]];

  gs.phase = 'playing';
  gs.actingQueue = alive.map(p => p.id);

  // Check instant blackjacks
  gs.actingQueue = gs.actingQueue.filter(id => {
    if (isBlackjack(gs.hands[id])) {
      gs.results[id] = 'blackjack_pending';
      return false;
    }
    return true;
  });

  if (gs.actingQueue.length === 0) {
    return dealerPlay(room, io);
  }

  gs.actingPlayer = gs.actingQueue[0];
  io.to(room.id).emit('bjState', { gs: { ...gs, dealerHand: [gs.dealerHand[0], '??'] }, room });
}

function advanceTurn(room, io) {
  const gs = room.gameState;
  gs.actingQueue.shift();
  if (gs.actingQueue.length === 0) {
    return dealerPlay(room, io);
  }
  gs.actingPlayer = gs.actingQueue[0];
  io.to(room.id).emit('bjState', { gs: { ...gs, dealerHand: [gs.dealerHand[0], '??'] }, room });
}

function dealerPlay(room, io) {
  const gs = room.gameState;
  gs.phase = 'dealer';
  gs.actingPlayer = null;

  // Dealer draws to 17
  while (handValue(gs.dealerHand) < 17) {
    gs.dealerHand.push(gs.deck[gs.deckIdx++]);
  }

  const dv = handValue(gs.dealerHand);
  const dBust = dv > 21;
  const dBJ = isBlackjack(gs.dealerHand);

  room.players.forEach(p => {
    const id = p.id;
    if (!gs.bets[id] && !gs.hands[id]) return;
    const pv = handValue(gs.hands[id] || []);
    const pBust = isBust(gs.hands[id] || []);
    const pBJ = gs.results[id] === 'blackjack_pending';

    let result;
    if (pBust) result = 'lose';
    else if (pBJ && !dBJ) result = 'blackjack';
    else if (pBJ && dBJ) result = 'push';
    else if (dBust) result = 'win';
    else if (pv > dv) result = 'win';
    else if (pv < dv) result = 'lose';
    else result = 'push';

    gs.results[id] = result;

    const bet = gs.bets[id] || 0;
    if (result === 'win') { gs.chips[id] += bet * 2; p.score = (p.score||0) + bet; }
    else if (result === 'blackjack') { gs.chips[id] += Math.floor(bet * 2.5); p.score = (p.score||0) + Math.floor(bet * 1.5); }
    else if (result === 'push') { gs.chips[id] += bet; }
  });

  gs.phase = 'results';
  io.to(room.id).emit('bjResults', { gs, room });

  // Check game over (all bust or config rounds)
  const alive = room.players.filter(p => gs.chips[p.id] > 0);
  if (alive.length === 0) {
    room.status = 'finished';
    const sorted = [...room.players].sort((a,b) => b.score - a.score);
    setTimeout(() => io.to(room.id).emit('gameOver', { room, sorted }), 4000);
  } else {
    // New round after delay
    setTimeout(() => {
      gs.roundNum++;
      gs.phase = 'betting';
      gs.bets = {};
      gs.hands = {};
      gs.dealerHand = [];
      gs.results = {};
      alive.forEach(p => { gs.bets[p.id] = 0; });
      // Reshuffle if deck running low
      if (gs.deckIdx > gs.deck.length * 0.7) {
        gs.deck = shuffle(makeDeck(2));
        gs.deckIdx = 0;
      }
      io.to(room.id).emit('bjState', { gs, room });
    }, 5000);
  }
}
