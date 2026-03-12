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
    configSchema: {
      maxPlayers: { type: 'number', label: 'Maks. graczy',   min: 2, max: 16, default: 8 },
      rounds:     { type: 'number', label: 'Liczba rund',    min: 1, max: 10, default: 1 },
      roundTime:  { type: 'number', label: 'Czas rysowania (s)', min: 30, max: 180, default: 60 },
    },
  },

  defaultContent: require('./content'),

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
  // Czas rysowania z config (domyślnie 60s)
  const roundTimeSec = Number(room.config?.roundTime) || 60;

  // Tell everyone who draws (but not the word)
  io.to(room.id).emit('kalamburyRound', {
    roundIndex: gs.currentRound,
    total: gs.totalRounds,
    drawerId: gs.currentDrawer,
    drawerName,
    roundTime: roundTimeSec,
    room,
  });

  // Tell the drawer the word privately
  io.to(gs.currentDrawer).emit('kalamburyYourWord', {
    word: gs.currentWord,
  });

  gs.roundTimer = setTimeout(() => {
    _endRound(room, io);
  }, roundTimeSec * 1000);
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
