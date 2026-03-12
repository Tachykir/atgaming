/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: QUIZ
 *  Plik: games/quiz/index.js
 * ═══════════════════════════════════════════
 */

module.exports = {
  meta: {
    id: 'quiz',
    name: 'Quiz',
    icon: '🧠',
    description: 'Szybkie pytania, punkty za refleks',
    color: '#7c5cfc',
    minPlayers: 1,
    maxPlayers: 8,
    supportsGameMaster: false,
    configSchema: {
      maxPlayers:   { type: 'number', label: 'Maks. graczy',     min: 2, max: 20, default: 8 },
      rounds:       { type: 'number', label: 'Liczba pytań',     min: 3, max: 20, default: 8 },
      questionTime: { type: 'number', label: 'Czas na pytanie (s)', min: 5, max: 60, default: 15 },
    },
  },

  defaultContent: require('./content'),

  createState(config) {
    return {
      questions: [],
      currentQuestion: 0,
      answeredPlayers: [],
      questionTimer: null,
    };
  },

  onStart({ room, content, io, helpers }) {
    const gs = room.gameState;
    const cat = content[room.config.category] || Object.values(content)[0];
    const pool = cat[room.config.difficulty] || cat.medium || [];
    const numQ = Math.min(Number(room.config.rounds) || 8, pool.length || 8);
    gs.questions = [...pool].sort(() => Math.random() - 0.5).slice(0, numQ);

    if (!gs.questions.length) {
      return helpers.emitError(room.id, 'Brak pytań w tej kategorii! Dodaj pytania w panelu admina.');
    }

    gs.currentQuestion = 0;
    gs.answeredPlayers = [];
    io.to(room.id).emit('gameStarted', { room });
    helpers.startQuizQuestion(room.id);
  },

  onEvent({ event, data, socket, room, io, helpers }) {
    if (event === 'quizAnswer') return _quizAnswer({ data, socket, room, io, helpers });
  },
};

function _quizAnswer({ data, socket, room, io, helpers }) {
  const gs = room.gameState;
  if (room.status !== 'playing') return;
  if (gs.answeredPlayers.includes(socket.id)) return;

  gs.answeredPlayers.push(socket.id);
  const q = gs.questions[gs.currentQuestion];
  const pi = room.players.findIndex(p => p.id === socket.id);

  if (data.answerIndex === q.correct) {
    const bonus = Math.max(0, 3 - gs.answeredPlayers.length) * 50;
    room.players[pi].score += q.points + bonus;
    socket.emit('answerResult', { correct: true, points: q.points + bonus });
  } else {
    socket.emit('answerResult', { correct: false, points: 0 });
  }

  io.to(room.id).emit('playerAnswered', {
    playerName: room.players[pi]?.name,
    answeredCount: gs.answeredPlayers.length,
    totalPlayers: room.players.length,
  });

  if (gs.answeredPlayers.length === room.players.length) {
    clearTimeout(gs.questionTimer);
    helpers.endQuizQuestion(room.id);
  }
}
