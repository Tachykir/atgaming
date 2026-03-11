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
  },

  defaultContent: {
    general: {
      label: '🌐 Ogólne',
      easy: [
        { clue: 'Stolica Polski', answer: 'warszawa' },
        { clue: 'Największy ocean', answer: 'spokojny' },
        { clue: 'Autor Quo Vadis', answer: 'sienkiewicz' },
        { clue: 'Planeta najbliżej Słońca', answer: 'merkury' },
        { clue: 'Ile sekund ma minuta?', answer: '60' },
        { clue: 'Kolor nieba w dzień', answer: 'niebieski' },
      ],
      medium: [
        { clue: 'Symbol chemiczny złota', answer: 'au' },
        { clue: 'Najwyższa góra świata', answer: 'everest' },
        { clue: 'Rok wybuchu II Wojny Światowej', answer: '1939' },
        { clue: 'Najdłuższa rzeka Afryki', answer: 'nil' },
      ],
      hard: [
        { clue: 'Pierwiastek o liczbie atomowej 79', answer: 'zloto' },
        { clue: 'Stolica Kazachstanu', answer: 'astana' },
        { clue: 'Twórca teorii względności', answer: 'einstein' },
      ],
    },
    science: {
      label: '🔬 Nauka',
      easy: [
        { clue: 'Wzór chemiczny wody', answer: 'h2o' },
        { clue: 'Ile nóg ma pająk?', answer: '8' },
        { clue: 'Najlżejszy pierwiastek', answer: 'wodor' },
      ],
      medium: [
        { clue: 'Jednostka siły w układzie SI', answer: 'niuton' },
        { clue: 'Narząd produkujący insulinę', answer: 'trzustka' },
      ],
      hard: [
        { clue: 'Pierwiastek o symbolu Hg', answer: 'rtec' },
        { clue: 'Liczba Avogadro (zaokrąglona, potęga 10)', answer: '23' },
      ],
    },
  },

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
    gs.rounds = [...pool].sort(() => Math.random() - 0.5).slice(0, 6);

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
