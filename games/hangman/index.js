/**
 * MODUŁ GRY: WISIELEC
 * Każdy gracz ma WŁASNE życia.
 * Konfigurowalne: maxWrong, maxPlayers, rounds.
 */

module.exports = {
  meta: {
    id: 'hangman',
    name: 'Wisielec',
    icon: '🪓',
    description: 'Zgaduj litery — każdy gracz ma własne życia!',
    color: '#5cf0c8',
    minPlayers: 1,
    maxPlayers: 8,
    supportsGameMaster: true,
    gameMasterHint: 'Możesz wpisać własne słowo lub wybrać z kategorii',
    configSchema: {
      maxPlayers: { type: 'number', label: 'Maks. graczy', min: 2, max: 20, default: 8 },
      maxWrong:   { type: 'number', label: 'Błędy na grę', min: 1, max: 10, default: 6 },
      rounds:     { type: 'number', label: 'Liczba słów',  min: 1, max: 10, default: 1 },
    },
  },

  defaultContent: require('./content'),

  createState(config) {
    return {
      word: '',
      guessed: [],
      playerLives: {},       // { socketId: wrongCount }
      playerEliminated: {},  // { socketId: bool }
      currentTurn: null,
      maxWrong: Number(config.maxWrong) || 6,
      totalRounds: Number(config.rounds) || 1,
      currentRound: 0,
      wordsUsed: [],
      _content: null,
    };
  },

  onStart({ room, content, customWord, io }) {
    const gs = room.gameState;
    gs.maxWrong = Number(room.config.maxWrong) || 6;
    gs.totalRounds = Number(room.config.rounds) || 1;
    gs.currentRound = 0;
    gs.wordsUsed = [];
    gs._content = content;

    room.players.forEach(p => {
      gs.playerLives[p.id] = 0;
      gs.playerEliminated[p.id] = false;
    });

    _startRound({ room, content, customWord, io });
  },

  onEvent({ event, data, socket, room, io }) {
    if (event === 'guessLetter') return _guessLetter({ data, socket, room, io });
  },
};

function _mask(word, guessed) {
  return word.split('').map(l => guessed.includes(l) ? l : '_').join(' ');
}

function _activePlayers(room) {
  const gs = room.gameState;
  return room.players.filter(p => !gs.playerEliminated[p.id]);
}

function _startRound({ room, content, customWord, io }) {
  const gs = room.gameState;
  const cat = content[room.config.category] || Object.values(content)[0] || {};
  const pool = (cat[room.config.difficulty] || cat.medium || []).filter(w => !gs.wordsUsed.includes(w));

  if (customWord && customWord.trim() && gs.currentRound === 0) {
    gs.word = customWord.trim().toLowerCase();
  } else {
    gs.word = pool.length ? pool[Math.floor(Math.random() * pool.length)]
      : (cat.easy || ['programowanie'])[0];
  }
  gs.wordsUsed.push(gs.word);
  gs.guessed = [];

  room.players.forEach(p => {
    gs.playerLives[p.id] = 0;
    gs.playerEliminated[p.id] = false;
  });

  gs.currentTurn = room.players[0]?.id;

  io.to(room.id).emit('gameStarted', {
    room,
    mask: _mask(gs.word, gs.guessed),
    wordLength: gs.word.length,
    round: gs.currentRound + 1,
    totalRounds: gs.totalRounds,
    maxWrong: gs.maxWrong,
    playerLives: gs.playerLives,
  });
}

function _guessLetter({ data, socket, room, io }) {
  const gs = room.gameState;
  const { letter } = data;

  if (room.status !== 'playing') return;
  if (gs.playerEliminated[socket.id]) return socket.emit('error', { message: 'Zostałeś wyeliminowany!' });
  if (gs.currentTurn !== socket.id) return socket.emit('error', { message: 'Nie twoja kolej!' });
  if (gs.guessed.includes(letter)) return;

  const pi = room.players.findIndex(p => p.id === socket.id);
  const active = _activePlayers(room);
  const myIdx = active.findIndex(p => p.id === socket.id);

  if (gs.word.includes(letter)) {
    gs.guessed.push(letter);
    room.players[pi].score += gs.word.split('').filter(l => l === letter).length * 10;
  } else {
    gs.playerLives[socket.id] = (gs.playerLives[socket.id] || 0) + 1;
    if (gs.playerLives[socket.id] >= gs.maxWrong) {
      gs.playerEliminated[socket.id] = true;
      room.players[pi].score = Math.max(0, room.players[pi].score - 20);
    }
  }

  const mask = _mask(gs.word, gs.guessed);
  const wordWon = gs.word.split('').every(l => gs.guessed.includes(l));
  const remainingActive = _activePlayers(room);
  const allEliminated = remainingActive.length === 0;

  if (wordWon || allEliminated) {
    if (wordWon) {
      remainingActive.forEach(p => {
        const pi2 = room.players.findIndex(x => x.id === p.id);
        if (pi2 >= 0) room.players[pi2].score += 50;
      });
    }
    gs.currentRound++;

    if (gs.currentRound < gs.totalRounds) {
      io.to(room.id).emit('hangmanRoundEnd', {
        room, word: gs.word, won: wordWon, mask,
        round: gs.currentRound, totalRounds: gs.totalRounds,
        playerLives: gs.playerLives, playerEliminated: gs.playerEliminated,
      });
      setTimeout(() => {
        _startRound({ room, content: gs._content || {}, customWord: null, io });
      }, 4000);
    } else {
      room.status = 'finished';
      io.to(room.id).emit('gameOver', {
        room, word: gs.word, won: wordWon, mask,
        playerLives: gs.playerLives,
        sorted: [...room.players].sort((a,b) => b.score - a.score),
      });
    }
    return;
  }

  // Advance turn to next active player
  const updatedActive = _activePlayers(room);
  const nextIdx = (myIdx + 1) % Math.max(updatedActive.length, 1);
  gs.currentTurn = updatedActive[nextIdx]?.id || updatedActive[0]?.id;

  io.to(room.id).emit('letterGuessed', {
    room, letter,
    correct: gs.word.includes(letter),
    mask,
    currentTurn: gs.currentTurn,
    playerLives: gs.playerLives,
    playerEliminated: gs.playerEliminated,
  });
}
