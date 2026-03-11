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
  },

  defaultContent: {
    general: {
      label: '🌐 Ogólna wiedza',
      easy: [
        { question: 'Stolica Polski?', answers: ['Warszawa','Kraków','Gdańsk','Wrocław'], correct: 0, points: 100 },
        { question: 'Ile planet ma Układ Słoneczny?', answers: ['7','8','9','10'], correct: 1, points: 100 },
        { question: 'Ile bitów ma 1 bajt?', answers: ['4','8','16','32'], correct: 1, points: 100 },
      ],
      medium: [
        { question: 'Rok założenia Google?', answers: ['1994','1996','1998','2000'], correct: 2, points: 200 },
        { question: 'Najdłuższa rzeka świata?', answers: ['Amazonka','Nil','Jangcy','Missisipi'], correct: 1, points: 200 },
        { question: 'Rok lądowania na księżycu?', answers: ['1965','1967','1969','1971'], correct: 2, points: 200 },
        { question: 'Autor Pana Tadeusza?', answers: ['Słowacki','Mickiewicz','Norwid','Krasicki'], correct: 1, points: 200 },
      ],
      hard: [
        { question: 'Kto namalował Monę Lisę?', answers: ['Michał Anioł','Rembrandt','Da Vinci','Picasso'], correct: 2, points: 300 },
        { question: 'Symbol chemiczny złota?', answers: ['Go','Gd','Au','Ag'], correct: 2, points: 300 },
      ],
    },
    science: {
      label: '🔬 Nauka',
      easy: [
        { question: 'Symbol chemiczny wody?', answers: ['HO','H2O','OH2','H3O'], correct: 1, points: 100 },
        { question: 'Przybliżone g na Ziemi?', answers: ['7.8','9.8','11.2','6.7'], correct: 1, points: 100 },
      ],
      medium: [
        { question: 'Ile chromosomów ma człowiek?', answers: ['23','44','46','48'], correct: 2, points: 200 },
        { question: 'Prędkość światła to około?', answers: ['200 000 km/s','300 000 km/s','400 000 km/s','500 000 km/s'], correct: 1, points: 200 },
      ],
      hard: [
        { question: 'Kto odkrył penicylinę?', answers: ['Pasteur','Curie','Fleming','Koch'], correct: 2, points: 300 },
        { question: 'Który pierwiastek ma symbol Fe?', answers: ['Fluorek','Fosfor','Żelazo','Ferm'], correct: 2, points: 300 },
      ],
    },
    sports: {
      label: '⚽ Sport',
      easy: [
        { question: 'Ile graczy w drużynie piłkarskiej?', answers: ['9','10','11','12'], correct: 2, points: 100 },
      ],
      medium: [
        { question: 'Gdzie odbyły się Igrzyska 2020?', answers: ['Pekin','Paryż','Tokio','Rio'], correct: 2, points: 200 },
      ],
      hard: [
        { question: 'Kto wygrał MŚ 2022?', answers: ['Francja','Brazylia','Argentyna','Niemcy'], correct: 2, points: 300 },
      ],
    },
  },

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
    gs.questions = [...pool].sort(() => Math.random() - 0.5).slice(0, 8);

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
