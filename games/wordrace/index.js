/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: WYŚCIG SŁÓW
 *  Plik: games/wordrace/index.js
 *
 *  Gracze dostają definicję/wskazówkę i muszą
 *  jak najszybciej wpisać poprawne słowo.
 *  Pierwszy kto wpisze poprawnie — dostaje punkty!
 * ═══════════════════════════════════════════
 */

module.exports = {
  meta: {
    id: 'wordrace',
    name: 'Wyścig Słów',
    icon: '⚡',
    description: 'Kto pierwszy wpisze poprawne słowo?',
    color: '#fcc05c',
    minPlayers: 2,
    maxPlayers: 8,
    supportsGameMaster: false,
    configSchema: {
      maxPlayers: { type: 'number', label: 'Maks. graczy',   min: 2, max: 20, default: 8 },
      rounds:     { type: 'number', label: 'Liczba rund',    min: 3, max: 20, default: 6 },
      roundTime:  { type: 'number', label: 'Czas rundy (s)', min: 10, max: 60, default: 20 },
    },
  },

  defaultContent: require('./content'),

  createState(config) {
    return {
      rounds: [],
      currentRound: 0,
      roundTimer: null,
      roundWinner: null,
      answered: [],
    };
  },

  onStart({ room, content, io, helpers }) {
    const gs = room.gameState;
    const cat = content[room.config.category] || Object.values(content)[0];
    const pool = cat[room.config.difficulty] || cat.easy || [];
    const numRounds = Math.min(Number(room.config.rounds) || 6, pool.length || 6);
    gs.rounds = [...pool].sort(() => Math.random() - 0.5).slice(0, numRounds);

    if (!gs.rounds.length) {
      return helpers.emitError(room.id, 'Brak słów w tej kategorii!');
    }

    gs.currentRound = 0;
    io.to(room.id).emit('gameStarted', { room });
    helpers.startWordRaceRound(room.id);
  },

  onEvent({ event, data, socket, room, io, helpers }) {
    if (event === 'wordRaceAnswer') return _checkAnswer({ data, socket, room, io, helpers });
  },
};

function _checkAnswer({ data, socket, room, io, helpers }) {
  const gs = room.gameState;
  if (room.status !== 'playing') return;
  if (gs.answered.includes(socket.id)) return;

  const currentRound = gs.rounds[gs.currentRound];
  const guess = (data.answer || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents
  const correct = currentRound.answer.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (guess === correct) {
    gs.answered.push(socket.id);
    const pi = room.players.findIndex(p => p.id === socket.id);
    const points = Math.max(50, 200 - gs.answered.length * 30);
    room.players[pi].score += points;
    gs.roundWinner = socket.id;

    clearTimeout(gs.roundTimer);
    io.to(room.id).emit('wordRaceCorrect', {
      playerName: room.players[pi].name,
      answer: currentRound.answer,
      points,
      room,
    });

    setTimeout(() => helpers.nextWordRaceRound(room.id), 2500);
  } else {
    socket.emit('wordRaceWrong', { guess });
  }
}
