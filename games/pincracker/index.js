/**
 * MODUŁ GRY: PIN CRACKER
 * 2 graczy — każdy ustala 4-cyfrowy PIN,
 * następnie zgadują na zmianę. Poprawnie odgadnięte cyfry
 * zostają odkryte (pozostają widoczne w kolejnych próbach).
 *
 * POPRAWKA: usunięto użycie `this` w metodach wywoływanych przez serwer
 * (mod.onEvent/onStart tracą kontekst `this`).
 */

function evalGuess(secret, guess, prevRevealed) {
  return secret.map((digit, i) => {
    if (prevRevealed[i]) return 'correct';
    return guess[i] === digit ? 'correct' : 'wrong';
  });
}

function sanitize(gs, room) {
  const safe = JSON.parse(JSON.stringify(gs));
  safe.pins = {};
  return { gs: safe, room };
}

function resetRound(gs, room) {
  const [p1, p2] = room.players;
  gs.phase = 'choosing';
  gs.pins = {};
  gs.chosen = {};
  gs.revealed = {
    [p1.id]: [null, null, null, null],
    [p2.id]: [null, null, null, null],
  };
  gs.guessHistory = {
    [p1.id]: [],
    [p2.id]: [],
  };
  gs.currentTurn = null;
}

function nextRoundOrEnd(gs, room, io) {
  if (gs.roundCurrent >= gs.roundsTotal) {
    room.status = 'finished';
    const sorted = room.players
      .map(p => ({ ...p, score: gs.wins[p.id] || 0 }))
      .sort((a, b) => b.score - a.score);
    room.players = sorted;
    setTimeout(() => io.to(room.id).emit('gameOver', { room, sorted }), 3000);
  } else {
    gs.roundCurrent++;
    const ids = room.players.map(p => p.id);
    gs.firstGuesser = ids[(gs.roundCurrent - 1) % 2];
    setTimeout(() => {
      resetRound(gs, room);
      io.to(room.id).emit('pincrackerState', sanitize(gs, room));
    }, 3000);
  }
}

module.exports = {
  meta: {
    id: 'pincracker',
    name: 'PIN Cracker',
    icon: '🔑',
    description: 'Odgadnij tajny 4-cyfrowy PIN rywala! Trafione cyfry zostają odkryte.',
    color: '#6c3483',
    minPlayers: 2,
    maxPlayers: 2,
    supportsGameMaster: false,
    configSchema: {
      rounds:      { type: 'number', label: 'Liczba rund',          min: 1,  max: 10, default: 3  },
      maxAttempts: { type: 'number', label: 'Maks. prób na rundę',  min: 3,  max: 20, default: 10 },
    },
  },

  defaultContent: {},

  createState(config) {
    return {
      phase:        'choosing',
      pins:         {},
      chosen:       {},
      revealed:     {},
      guessHistory: {},
      currentTurn:  null,
      roundsTotal:  Number(config.rounds)      || 3,
      roundCurrent: 1,
      maxAttempts:  Number(config.maxAttempts) || 10,
      wins:         {},
      firstGuesser: null,
    };
  },

  onStart({ room, io }) {
    const gs = room.gameState;
    const [p1, p2] = room.players;
    gs.wins[p1.id] = 0;
    gs.wins[p2.id] = 0;
    gs.firstGuesser = p1.id;
    resetRound(gs, room);
    io.to(room.id).emit('pincrackerState', sanitize(gs, room));
  },

  onEvent({ event, data, socket, room, io }) {
    const gs = room.gameState;

    // ── Gracz ustawia swój PIN ──────────────────────────────
    if (event === 'pincrackerChoose') {
      if (gs.phase !== 'choosing') return;
      if (gs.chosen[socket.id]) return;

      const pin = String(data.pin).replace(/\D/g, '').split('').map(Number);
      if (pin.length !== 4) return;

      gs.pins[socket.id] = pin;
      gs.chosen[socket.id] = true;

      io.to(room.id).emit('pincrackerState', sanitize(gs, room));

      if (Object.keys(gs.chosen).length === 2) {
        gs.phase = 'guessing';
        gs.currentTurn = gs.firstGuesser;
        io.to(room.id).emit('pincrackerState', sanitize(gs, room));
      }
      return;
    }

    // ── Gracz zgaduje PIN przeciwnika ───────────────────────
    if (event === 'pincrackerGuess') {
      if (gs.phase !== 'guessing') return;
      if (socket.id !== gs.currentTurn) return;

      const guess = String(data.pin).replace(/\D/g, '').split('').map(Number);
      if (guess.length !== 4) return;

      const opponent = room.players.find(p => p.id !== socket.id);
      if (!opponent) return;

      const secret       = gs.pins[opponent.id];
      const prevRevealed = gs.revealed[opponent.id];
      const result       = evalGuess(secret, guess, prevRevealed);

      result.forEach((r, i) => {
        if (r === 'correct') gs.revealed[opponent.id][i] = 'correct';
      });
      gs.guessHistory[socket.id].push({ guess, result });

      const allCorrect   = gs.revealed[opponent.id].every(r => r === 'correct');
      const myAttempts   = gs.guessHistory[socket.id].length;

      if (allCorrect) {
        gs.phase = 'roundEnd';
        gs.wins[socket.id] = (gs.wins[socket.id] || 0) + 1;

        const revealedPins = {};
        room.players.forEach(p => { revealedPins[p.id] = gs.pins[p.id]; });

        io.to(room.id).emit('pincrackerRoundEnd', {
          ...sanitize(gs, room),
          winner: socket.id,
          revealedPins,
          attemptsUsed: myAttempts,
        });

        nextRoundOrEnd(gs, room, io);
        return;
      }

      // Nie trafił — zmień turę
      const nextPlayer  = room.players.find(p => p.id !== socket.id);
      gs.currentTurn    = nextPlayer.id;
      io.to(room.id).emit('pincrackerState', sanitize(gs, room));

      // Remis: przeciwnik też wyczerpał próby
      const nextAttempts = gs.guessHistory[nextPlayer.id].length;
      if (myAttempts >= gs.maxAttempts && nextAttempts >= gs.maxAttempts) {
        gs.phase = 'roundEnd';
        const revealedPins = {};
        room.players.forEach(p => { revealedPins[p.id] = gs.pins[p.id]; });
        io.to(room.id).emit('pincrackerRoundEnd', {
          ...sanitize(gs, room),
          winner: null,
          revealedPins,
          attemptsUsed: myAttempts,
        });
        nextRoundOrEnd(gs, room, io);
      }
    }
  },
};
