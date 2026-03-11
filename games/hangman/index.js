/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: WISIELEC
 *  Plik: games/hangman/index.js
 * ═══════════════════════════════════════════
 *
 *  Każdy moduł gry MUSI eksportować obiekt z polami:
 *
 *  meta        - informacje o grze (wyświetlane w UI)
 *  defaultContent - domyślne dane (słowa, pytania itp.)
 *  createState - funkcja tworząca stan gry dla pokoju
 *  onStart     - wywoływana gdy host startuje grę
 *  onEvent     - obsługuje eventy socket od graczy
 *  adminRoutes - (opcjonalne) dodatkowe trasy Express dla admina
 */

module.exports = {
  // ─── META (wyświetlane w UI) ─────────────────────────────────
  meta: {
    id: 'hangman',
    name: 'Wisielec',
    icon: '🪓',
    description: 'Zgaduj litery zanim skończy się sznur',
    color: '#5cf0c8',
    minPlayers: 1,
    maxPlayers: 8,
    supportsGameMaster: true,
    gameMasterHint: 'Możesz wpisać własne słowo lub wybrać z kategorii',
  },

  // ─── DOMYŚLNE TREŚCI (admin może edytować) ──────────────────
  defaultContent: {
    it: {
      label: '💻 IT / Programowanie',
      easy:   ['baza','serwer','petla','obiekt','klasa','zmienna','tablica'],
      medium: ['javascript','komputer','algorytm','monitor','procesor','internet','klawiatura'],
      hard:   ['programowanie','reaktywny','framework','biblioteka','rekurencja'],
    },
    geography: {
      label: '🌍 Geografia',
      easy:   ['polska','morze','rzeka','miasto','europa','ocean','pustynia'],
      medium: ['warszawa','kontynent','rownikowy','himalaje','atlantyk'],
      hard:   ['madagaskar','mezopotamia','geograficzny','archipelag'],
    },
    animals: {
      label: '🐾 Zwierzęta',
      easy:   ['kot','pies','ryba','kon','kura','koza','wilk'],
      medium: ['slon','jelen','pingwin','delfin','gepard','orzel'],
      hard:   ['kameleon','hipopotam','kangur','salamandra'],
    },
    sports: {
      label: '⚽ Sport',
      easy:   ['pilka','gol','bieg','skok','mecz','kort'],
      medium: ['koszykowka','siatkowka','plywanie','kolarska','szermierka'],
      hard:   ['mistrzostwa','lekkoatletyka','olimpiada'],
    },
  },

  // ─── TWORZENIE STANU GRY ────────────────────────────────────
  createState(config) {
    return {
      word: '',
      guessed: [],
      wrongGuesses: [],
      currentTurn: null,
      maxWrong: 6,
    };
  },

  // ─── START GRY ──────────────────────────────────────────────
  onStart({ room, content, customWord, io }) {
    const gameState = room.gameState;

    if (customWord && customWord.trim()) {
      gameState.word = customWord.trim().toLowerCase();
    } else {
      const cat = content[room.config.category] || Object.values(content)[0];
      const pool = cat[room.config.difficulty] || cat.medium || [];
      gameState.word = pool.length
        ? pool[Math.floor(Math.random() * pool.length)]
        : 'programowanie';
    }

    gameState.guessed = [];
    gameState.wrongGuesses = [];
    gameState.currentTurn = room.players[0].id;

    io.to(room.id).emit('gameStarted', {
      room,
      mask: _mask(gameState.word, gameState.guessed),
      wordLength: gameState.word.length,
    });
  },

  // ─── EVENTY OD GRACZY ───────────────────────────────────────
  onEvent({ event, data, socket, room, io }) {
    if (event === 'guessLetter') return _guessLetter({ data, socket, room, io });
  },
};

// ── HELPERS ──────────────────────────────────────────────────
function _mask(word, guessed) {
  return word.split('').map(l => guessed.includes(l) ? l : '_').join(' ');
}

function _guessLetter({ data, socket, room, io }) {
  const gs = room.gameState;
  const { letter } = data;

  if (room.status !== 'playing') return;
  if (gs.currentTurn !== socket.id) return socket.emit('error', { message: 'Nie twoja kolej!' });
  if (gs.guessed.includes(letter) || gs.wrongGuesses.includes(letter)) return;

  const pi = room.players.findIndex(p => p.id === socket.id);
  const next = (pi + 1) % room.players.length;

  if (gs.word.includes(letter)) {
    gs.guessed.push(letter);
    room.players[pi].score += gs.word.split('').filter(l => l === letter).length * 10;
  } else {
    gs.wrongGuesses.push(letter);
  }

  const mask = _mask(gs.word, gs.guessed);
  const won = gs.word.split('').every(l => gs.guessed.includes(l));
  const lost = gs.wrongGuesses.length >= gs.maxWrong;

  if (won || lost) {
    room.status = 'finished';
    io.to(room.id).emit('gameOver', { room, word: gs.word, won, mask });
  } else {
    gs.currentTurn = room.players[next].id;
    io.to(room.id).emit('letterGuessed', {
      room, letter,
      correct: gs.word.includes(letter),
      mask,
      currentTurn: gs.currentTurn,
    });
  }
}
