/**
 * MODUŁ GRY: HIGH LOW
 * 2 graczy — każdy wybiera tajną liczbę 1-100,
 * następnie zgadują nawzajem na zmianę z podpowiedziami wyżej/niżej.
 *
 * POPRAWKA:
 * - usunięto martwy kod (pętla po p.socket która nie istnieje)
 * - guess === 0 był odrzucany przez !guess — teraz sprawdzamy num >= 1
 */

function sanitize(gs) {
  const safe = JSON.parse(JSON.stringify(gs));
  safe.secrets = {};
  return safe;
}

function startNextRound(gs, room, io) {
  gs.roundCurrent++;
  gs.phase = 'choosing';
  gs.secrets = {};
  gs.chosen  = {};
  gs.guesses = {};
  gs.guessHistory[room.players[0].id] = [];
  gs.guessHistory[room.players[1].id] = [];
  const ids = room.players.map(p => p.id);
  gs.firstGuesser = ids[(gs.roundCurrent - 1) % 2];
  gs.currentTurn  = null;
  io.to(room.id).emit('highlowState', { gs: sanitize(gs), room });
}

module.exports = {
  meta: {
    id: 'highlow',
    name: 'High Low',
    icon: '🔢',
    description: 'Odgadnij tajną liczbę rywala (1-100)! Zgadujecie na zmianę.',
    color: '#f7971e',
    minPlayers: 2,
    maxPlayers: 2,
    supportsGameMaster: false,
    configSchema: {
      rounds: { type: 'number', label: 'Liczba rund', min: 1, max: 10, default: 3 },
    },
  },

  defaultContent: {},

  createState(config) {
    return {
      phase:        'choosing',
      secrets:      {},
      chosen:       {},
      guesses:      {},
      guessHistory: {},
      currentTurn:  null,
      roundsTotal:  Number(config.rounds) || 3,
      roundCurrent: 1,
      wins:         {},
      firstGuesser: null,
    };
  },

  onStart({ room, io }) {
    const gs      = room.gameState;
    const [p1, p2] = room.players;
    gs.wins[p1.id]         = 0;
    gs.wins[p2.id]         = 0;
    gs.guessHistory[p1.id] = [];
    gs.guessHistory[p2.id] = [];
    gs.phase        = 'choosing';
    gs.secrets      = {};
    gs.chosen       = {};
    gs.guesses      = {};
    gs.firstGuesser = p1.id;
    gs.currentTurn  = null;
    io.to(room.id).emit('highlowState', { gs: sanitize(gs), room });
  },

  onEvent({ event, data, socket, room, io }) {
    const gs = room.gameState;

    if (event === 'highlowChoose') {
      if (gs.phase !== 'choosing') return;
      if (gs.chosen[socket.id]) return;

      const num = parseInt(data.number);
      if (isNaN(num) || num < 1 || num > 100) return;

      gs.secrets[socket.id] = num;
      gs.chosen[socket.id]  = true;

      // Broadcast — secrets stripped by sanitize
      io.to(room.id).emit('highlowState', { gs: sanitize(gs), room });

      if (Object.keys(gs.chosen).length === 2) {
        gs.phase       = 'guessing';
        gs.currentTurn = gs.firstGuesser;
        gs.guessHistory[room.players[0].id] = [];
        gs.guessHistory[room.players[1].id] = [];
        io.to(room.id).emit('highlowState', { gs: sanitize(gs), room });
      }
      return;
    }

    if (event === 'highlowGuess') {
      if (gs.phase !== 'guessing') return;
      if (socket.id !== gs.currentTurn) return;

      const guess = parseInt(data.guess);
      if (isNaN(guess) || guess < 1 || guess > 100) return;

      const opponent = room.players.find(p => p.id !== socket.id);
      if (!opponent) return;

      const secret      = gs.secrets[opponent.id];
      gs.guesses[socket.id] = guess;

      const hint = guess === secret ? 'correct'
                 : guess  <  secret ? 'higher'
                 :                    'lower';

      gs.guessHistory[socket.id].push({ guess, hint });

      if (hint === 'correct') {
        gs.phase = 'roundEnd';
        gs.wins[socket.id] = (gs.wins[socket.id] || 0) + 1;

        io.to(room.id).emit('highlowRoundEnd', {
          gs: sanitize(gs),
          result: { winner: socket.id, guess, secret, guesserId: socket.id, opponentId: opponent.id },
          room,
        });

        if (gs.roundCurrent >= gs.roundsTotal) {
          room.status = 'finished';
          const sorted = room.players
            .map(p => ({ ...p, score: gs.wins[p.id] || 0 }))
            .sort((a, b) => b.score - a.score);
          room.players = sorted;
          setTimeout(() => io.to(room.id).emit('gameOver', { room, sorted }), 2500);
        } else {
          setTimeout(() => startNextRound(gs, room, io), 2500);
        }
      } else {
        const nextPlayer   = room.players.find(p => p.id !== socket.id);
        gs.currentTurn     = nextPlayer.id;
        io.to(room.id).emit('highlowHint', { gs: sanitize(gs), hint, guess, guesserId: socket.id, room });
        io.to(room.id).emit('highlowState', { gs: sanitize(gs), room });
      }
    }
  },
};
