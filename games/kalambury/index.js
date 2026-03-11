/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: KALAMBURY (Charades)
 *  Plik: games/kalambury/index.js
 * ═══════════════════════════════════════════
 */

module.exports = {
  meta: {
    id: 'kalambury',
    name: 'Kalambury',
    icon: '🎨',
    description: 'Rysuj, a inni zgadują! Klasyczne kalambury.',
    color: '#fc5ce0',
    minPlayers: 2,
    maxPlayers: 8,
    supportsGameMaster: false,
  },

  defaultContent: {
    animals: {
      label: '🐾 Zwierzęta',
      easy: ['kot', 'pies', 'ryba', 'kura', 'krowa', 'slon', 'zaba', 'orzel', 'lew', 'kon'],
      medium: ['pingwin', 'delfin', 'gepard', 'kangur', 'krokodyl', 'flaming', 'hipopotam', 'struś', 'bison', 'rekien'],
      hard: ['kameleon', 'platypus', 'axolotl', 'mantaraja', 'gnugnest', 'salamandra', 'jaguarundi'],
    },
    objects: {
      label: '🏠 Przedmioty',
      easy: ['krzeslo', 'stol', 'okno', 'drzwi', 'lampa', 'telefon', 'ksiazka', 'zegarek', 'klucz', 'butelka'],
      medium: ['pralka', 'lodowka', 'rower', 'parasol', 'latarka', 'komputer', 'gitara', 'balon', 'kamera'],
      hard: ['teleskop', 'periskop', 'akordeon', 'termometr', 'metronom', 'sejf', 'kalkulator'],
    },
    activities: {
      label: '🏃 Czynności',
      easy: ['bieganie', 'spanie', 'jedzenie', 'picie', 'pisanie', 'skakanie', 'plywanie', 'latanie', 'czytanie'],
      medium: ['gotowanie', 'rysowanie', 'tańczenie', 'sprzatanie', 'majsterkowanie', 'ogrodnictwo'],
      hard: ['żonglowanie', 'akrobatyka', 'nurkowanie', 'wspinaczka', 'medytowanie', 'kaligrafia'],
    },
    food: {
      label: '🍕 Jedzenie',
      easy: ['pizza', 'banan', 'jablko', 'chleb', 'jajko', 'ciasto', 'lody', 'zupa', 'ryba', 'herbata'],
      medium: ['hamburger', 'spaghetti', 'waffel', 'omlet', 'sushi', 'pierogi', 'bigos', 'tiramisu'],
      hard: ['guacamole', 'paella', 'croissant', 'bruschetta', 'ratatouille', 'creme brulee'],
    },
    movies: {
      label: '🎬 Filmy',
      easy: ['batman', 'titanic', 'lion king', 'toy story', 'frozen', 'avatar', 'shrek'],
      medium: ['jurassic park', 'star wars', 'matrix', 'gladiator', 'inception', 'harry potter'],
      hard: ['schindler\'s list', 'forrest gump', 'silence of the lambs', 'amadeus', 'blade runner'],
    },
    sports: {
      label: '⚽ Sport',
      easy: ['pilka nozna', 'koszykowka', 'tenis', 'golf', 'boks', 'narty', 'plywanie'],
      medium: ['siatkowka', 'lekkoatletyka', 'szermierka', 'gimnastyka', 'judo', 'wioslowanie'],
      hard: ['pentatlon', 'bobslej', 'curling', 'kolarstwo gorskie', 'triathlon', 'taekwondo'],
    },
    places: {
      label: '🌍 Miejsca',
      easy: ['szkola', 'kosciol', 'sklep', 'park', 'most', 'zamek', 'plaz', 'las', 'miasto', 'lotnisko'],
      medium: ['muzeum', 'szpital', 'restauracja', 'biblioteka', 'stadion', 'teatr', 'cyrk', 'zoo'],
      hard: ['piramida', 'wodospad', 'latarnia morska', 'wiezowiec', 'akwarium', 'obserwatorium'],
    },
  },

  createState(config) {
    return {
      rounds: [],
      currentRound: 0,
      currentDrawer: null,
      currentWord: null,
      guessedPlayers: [],
      drawerIndex: 0,
      phase: 'draw', // 'draw' | 'guess' | 'reveal'
      roundTimer: null,
      totalRounds: 0,
    };
  },

  onStart({ room, content, io }) {
    const gs = room.gameState;
    const cat = content[room.config?.category] || Object.values(content)[0];
    const diff = room.config?.difficulty || 'medium';
    const pool = [...(cat?.[diff] || cat?.medium || [])];

    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    gs.words = pool;
    gs.wordIndex = 0;
    gs.drawerIndex = 0;
    gs.currentRound = 0;
    gs.totalRounds = room.players.length; // each player draws once
    gs.phase = 'draw';

    io.to(room.id).emit('gameStarted', { room });
    _startRound(room, io);
  },

  onEvent({ event, data, socket, room, io }) {
    const gs = room.gameState;

    if (event === 'kalamburyDraw') {
      // Forward drawing data to all others
      if (socket.id !== gs.currentDrawer) return;
      socket.to(room.id).emit('kalamburyDrawUpdate', { drawData: data.drawData });
    }

    if (event === 'kalamburyGuess') {
      if (socket.id === gs.currentDrawer) return;
      if (gs.guessedPlayers.includes(socket.id)) return;
      if (gs.phase !== 'guess') return;

      const player = room.players.find(p => p.id === socket.id);
      const norm = (s) => s.toLowerCase().replace(/[^a-ząćęłńóśźż]/g, '');
      const correct = norm(data.guess || '') === norm(gs.currentWord || '');

      // Emit guess to all players (so everyone can see it in chat)
      io.to(room.id).emit('kalamburyGuessResult', {
        playerName: player?.name,
        guess: data.guess,
        correct,
        playerId: socket.id,
      });

      if (correct) {
        gs.guessedPlayers.push(socket.id);
        // Points: first guesser gets more
        const points = Math.max(10, 100 - gs.guessedPlayers.length * 20);
        if (player) player.score += points;
        // Drawer also gets points
        const drawer = room.players.find(p => p.id === gs.currentDrawer);
        if (drawer) drawer.score += 20;

        io.to(room.id).emit('kalamburyCorrect', {
          playerName: player?.name,
          points,
          room,
        });

        // All non-drawers guessed?
        const nonDrawers = room.players.filter(p => p.id !== gs.currentDrawer);
        if (gs.guessedPlayers.length >= nonDrawers.length) {
          clearTimeout(gs.roundTimer);
          _endRound(room, io);
        }
      }
    }

    if (event === 'kalamburyClearCanvas') {
      if (socket.id !== gs.currentDrawer) return;
      io.to(room.id).emit('kalamburyClearCanvas');
    }
  },
};

function _startRound(room, io) {
  const gs = room.gameState;
  gs.currentDrawer = room.players[gs.drawerIndex]?.id;
  gs.currentWord = gs.words[gs.wordIndex % gs.words.length];
  gs.wordIndex = (gs.wordIndex || 0) + 1;
  gs.guessedPlayers = [];
  gs.phase = 'guess';

  const drawerName = room.players[gs.drawerIndex]?.name;

  // Tell everyone who draws (but not the word)
  io.to(room.id).emit('kalamburyRound', {
    roundIndex: gs.currentRound,
    total: gs.totalRounds,
    drawerId: gs.currentDrawer,
    drawerName,
    room,
  });

  // Tell the drawer the word privately
  io.to(gs.currentDrawer).emit('kalamburyYourWord', {
    word: gs.currentWord,
  });

  // 60 seconds to draw
  gs.roundTimer = setTimeout(() => {
    _endRound(room, io);
  }, 60000);
}

function _endRound(room, io) {
  const gs = room.gameState;
  gs.phase = 'reveal';

  io.to(room.id).emit('kalamburyReveal', {
    word: gs.currentWord,
    room,
  });

  setTimeout(() => {
    gs.currentRound++;
    gs.drawerIndex = (gs.drawerIndex + 1) % room.players.length;

    if (gs.currentRound >= gs.totalRounds) {
      room.status = 'finished';
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      io.to(room.id).emit('gameOver', { room, sorted });
    } else {
      _startRound(room, io);
    }
  }, 4000);
}
