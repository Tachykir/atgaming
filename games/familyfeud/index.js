/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: FAMILIADA — v2
 *  Zmiany:
 *  - Kolejka — jeden gracz odpowiada na raz (round-robin)
 *  - Każdy gracz ma własne strikes per pytanie (3 = OUT)
 *  - Cooldown 2s po błędnej odpowiedzi
 *  - Ulepszone porównanie (normalizacja, aliasy, minimalna długość)
 *  - configSchema: maxPlayers, rounds, strikesPerPlayer
 * ═══════════════════════════════════════════
 */

module.exports = {
  meta: {
    id: 'familyfeud',
    name: 'Familiada',
    icon: '👨‍👩‍👧‍👦',
    description: 'Podaj najpopularniejsze odpowiedzi — każdy ma 3 próby!',
    color: '#fc7d5c',
    minPlayers: 2,
    maxPlayers: 10,
    supportsGameMaster: false,
    configSchema: {
      maxPlayers:       { type: 'number', label: 'Maks. graczy',         min: 2, max: 20, default: 10 },
      rounds:           { type: 'number', label: 'Liczba pytań',         min: 1, max: 10, default: 5  },
      strikesPerPlayer: { type: 'number', label: 'Błędy na gracza',      min: 1, max: 5,  default: 3  },
    },
  },

  defaultContent: require('./content'),

  createState(config) {
    return {
      questions: [],
      currentQuestionIndex: 0,
      revealedAnswers: [],   // indices of revealed answers
      playerStrikes: {},     // { socketId: count }
      playerEliminated: {},  // { socketId: bool } — eliminated this round
      strikesPerPlayer: Number(config?.strikesPerPlayer) || 3,
      phase: 'question',     // question | reveal | between
      currentResponder: null,  // whose turn to answer
      responderIndex: 0,
      cooldowns: {},          // { socketId: timestamp } — can't answer until
    };
  },

  onStart({ room, content, io }) {
    const gs   = room.gameState;
    const cat  = content[room.config?.category] || Object.values(content)[0];
    const pool = [...(cat?.questions || [])];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const numQ = Number(room.config?.rounds) || 5;
    gs.questions         = pool.slice(0, Math.min(numQ, pool.length));
    gs.strikesPerPlayer  = Number(room.config?.strikesPerPlayer) || 3;
    gs.currentQuestionIndex = 0;
    gs.responderIndex    = 0;

    io.to(room.id).emit('gameStarted', { room });
    _startQuestion(room, io);
  },

  onEvent({ event, data, socket, room, io }) {
    if (event === 'familyFeudAnswer') _handleAnswer({ data, socket, room, io });
  },
};

// ── HELPERS ───────────────────────────────────────────────────

function _norm(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim();
}

function _isMatch(input, answer) {
  const i = _norm(input);
  const targets = [_norm(answer.text), ...(answer.aliases || []).map(_norm)];
  for (const t of targets) {
    if (!t || t.length < 2) continue;
    if (i === t) return true;
    // Only allow partial if BOTH sides are at least 4 chars
    if (i.length >= 4 && t.length >= 4) {
      if (i === t) return true;
      // Whole-word containment
      if (t.split(' ').some(word => word.length >= 4 && i === word)) return true;
      if (i.split(' ').some(word => word.length >= 4 && t === word)) return true;
    }
  }
  return false;
}

function _activePlayers(room) {
  const gs = room.gameState;
  return room.players.filter(p => !gs.playerEliminated[p.id]);
}

function _startQuestion(room, io) {
  const gs = room.gameState;
  const q  = gs.questions[gs.currentQuestionIndex];
  if (!q) return;

  gs.revealedAnswers = [];
  gs.playerStrikes   = {};
  gs.playerEliminated= {};
  gs.cooldowns       = {};
  room.players.forEach(p => {
    gs.playerStrikes[p.id]   = 0;
    gs.playerEliminated[p.id]= false;
  });

  gs.responderIndex   = 0;
  gs.currentResponder = room.players[0]?.id;
  gs.phase            = 'question';

  io.to(room.id).emit('familyFeudQuestion', {
    questionIndex: gs.currentQuestionIndex,
    total:         gs.questions.length,
    question:      q.question,
    answerCount:   q.answers.length,
    currentResponder: gs.currentResponder,
    responderName: room.players.find(p=>p.id===gs.currentResponder)?.name,
    strikesPerPlayer: gs.strikesPerPlayer,
    room,
  });
}

function _nextResponder(room, io) {
  const gs      = room.gameState;
  const active  = _activePlayers(room);
  if (!active.length) return _nextQuestion(room, io);

  const curIdx = active.findIndex(p => p.id === gs.currentResponder);
  gs.responderIndex   = (curIdx + 1) % active.length;
  gs.currentResponder = active[gs.responderIndex].id;

  io.to(room.id).emit('familyFeudNextResponder', {
    currentResponder: gs.currentResponder,
    responderName: active[gs.responderIndex].name,
    playerStrikes: gs.playerStrikes,
    playerEliminated: gs.playerEliminated,
  });
}

function _handleAnswer({ data, socket, room, io }) {
  const gs = room.gameState;
  if (gs.phase !== 'question') return;

  // Only current responder can answer
  if (socket.id !== gs.currentResponder) {
    return socket.emit('feudNotYourTurn', { currentResponder: gs.currentResponder });
  }

  // Cooldown check
  const now = Date.now();
  if (gs.cooldowns[socket.id] && now < gs.cooldowns[socket.id]) {
    return socket.emit('feudCooldown', { remaining: Math.ceil((gs.cooldowns[socket.id] - now) / 1000) });
  }

  const q   = gs.questions[gs.currentQuestionIndex];
  if (!q) return;

  const input    = (data.answer || '').trim();
  if (!input) return;

  const matchIdx = q.answers.findIndex(
    (a, i) => !gs.revealedAnswers.includes(i) && _isMatch(input, a)
  );

  if (matchIdx !== -1) {
    // Correct!
    gs.revealedAnswers.push(matchIdx);
    const pts    = q.answers[matchIdx].points;
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.score += pts;

    io.to(room.id).emit('familyFeudCorrect', {
      playerName:      player?.name,
      answerIndex:     matchIdx,
      answer:          q.answers[matchIdx].text,
      points:          pts,
      revealedAnswers: gs.revealedAnswers,
      room,
    });

    // All answers found?
    if (gs.revealedAnswers.length === q.answers.length) {
      return _nextQuestion(room, io);
    }
    // Same player gets another turn after correct answer
    // (don't advance responder)
  } else {
    // Already revealed?
    const alreadyIdx = q.answers.findIndex(
      (a, i) => gs.revealedAnswers.includes(i) && _isMatch(input, a)
    );
    if (alreadyIdx !== -1) {
      return socket.emit('feudAlreadyRevealed', { answer: q.answers[alreadyIdx].text });
    }

    // Wrong answer
    gs.playerStrikes[socket.id] = (gs.playerStrikes[socket.id] || 0) + 1;
    const strikes = gs.playerStrikes[socket.id];

    if (strikes >= gs.strikesPerPlayer) {
      gs.playerEliminated[socket.id] = true;
    } else {
      gs.cooldowns[socket.id] = Date.now() + 2000;  // 2s cooldown
    }

    io.to(room.id).emit('familyFeudWrong', {
      playerId:         socket.id,
      playerName:       room.players.find(p=>p.id===socket.id)?.name,
      strikes:          strikes,
      strikesPerPlayer: gs.strikesPerPlayer,
      eliminated:       gs.playerEliminated[socket.id],
      playerStrikes:    gs.playerStrikes,
      playerEliminated: gs.playerEliminated,
    });

    // All players eliminated?
    if (_activePlayers(room).length === 0) {
      return _nextQuestion(room, io);
    }

    // Advance to next responder
    _nextResponder(room, io);
  }
}

function _nextQuestion(room, io) {
  const gs = room.gameState;
  const q  = gs.questions[gs.currentQuestionIndex];

  io.to(room.id).emit('familyFeudRevealAll', { answers: q.answers, room });

  setTimeout(() => {
    gs.currentQuestionIndex++;
    if (gs.currentQuestionIndex >= gs.questions.length) {
      room.status  = 'finished';
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      io.to(room.id).emit('gameOver', { room, sorted });
    } else {
      _startQuestion(room, io);
    }
  }, 4000);
}
