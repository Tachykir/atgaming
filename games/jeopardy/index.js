/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: JEOPARDY — v2
 *  Zmiany:
 *  - Game Master może ręcznie akceptować/odrzucać odpowiedź
 *  - Bez GM: ulepszone porównanie (akcenty, synonimy, partial)
 *  - Timer wysyłany do klienta (countdown)
 *  - Blokada BUZZ po timeout
 *  - configSchema: maxPlayers, buzzTime, questionTime
 * ═══════════════════════════════════════════
 */

module.exports = {
  meta: {
    id: 'jeopardy',
    name: 'Jeopardy',
    icon: '❓',
    description: 'Wybierz kategorię, wciśnij BUZZ i odpowiedz!',
    color: '#5c7dfc',
    minPlayers: 1,
    maxPlayers: 6,
    supportsGameMaster: true,
    gameMasterHint: 'Ty oceniasz czy odpowiedź jest poprawna',
    configSchema: {
      maxPlayers:    { type: 'number', label: 'Maks. graczy',        min: 2, max: 12, default: 6 },
      questionTime:  { type: 'number', label: 'Czas na BUZZ (s)',    min: 5, max: 60, default: 20 },
      buzzTime:      { type: 'number', label: 'Czas na odpowiedź (s)', min: 5, max: 30, default: 10 },
    },
  },

  defaultContent: {
    science: {
      label: '🔬 Nauka',
      questions: [
        { value: 100, clue: 'Ten pierwiastek ma symbol "O" i jest niezbędny do oddychania', answer: 'tlen', aliases: ['oxygen'] },
        { value: 200, clue: 'Prędkość światła w próżni wynosi ok. 300 000 km/s — kto to obliczył?', answer: 'einstein', aliases: ['albert einstein'] },
        { value: 300, clue: 'Układ słoneczny ma tyle planet (od 2006 r.)', answer: 'osiem', aliases: ['8'] },
        { value: 400, clue: 'Teoria ewolucji przez dobór naturalny — kto ją sformułował?', answer: 'darwin', aliases: ['karol darwin', 'charles darwin'] },
        { value: 500, clue: 'Bozon Higgsa wykryto w 2012 r. w tym laboratorium', answer: 'cern', aliases: ['lhc'] },
      ],
    },
    history: {
      label: '📜 Historia',
      questions: [
        { value: 100, clue: 'Rok wybuchu II Wojny Światowej', answer: '1939' },
        { value: 200, clue: 'Piramida Cheopsa stoi w tym kraju', answer: 'egipt', aliases: ['egypt'] },
        { value: 300, clue: 'Polska odzyskała niepodległość w tym roku', answer: '1918' },
        { value: 400, clue: 'Odkrył, że Ziemia krąży wokół Słońca', answer: 'kopernik', aliases: ['mikolaj kopernik', 'copernicus'] },
        { value: 500, clue: 'Rewolucja Październikowa 1917 r. — ten kraj ją przeprowadził', answer: 'rosja', aliases: ['zsrr', 'rosja radziecka', 'sowiety'] },
      ],
    },
    geography: {
      label: '🌍 Geografia',
      questions: [
        { value: 100, clue: 'Stolica Francji', answer: 'paryz', aliases: ['paris'] },
        { value: 200, clue: 'Najdłuższa rzeka świata', answer: 'nil', aliases: ['nile'] },
        { value: 300, clue: 'Kraj ze szczytem Mount Everest', answer: 'nepal' },
        { value: 400, clue: 'Największy kontynent na świecie', answer: 'azja', aliases: ['asia'] },
        { value: 500, clue: 'Miasto z największą liczbą mieszkańców na świecie', answer: 'tokio', aliases: ['tokyo'] },
      ],
    },
    culture: {
      label: '🎭 Kultura',
      questions: [
        { value: 100, clue: 'Twórca "Pana Tadeusza"', answer: 'mickiewicz', aliases: ['adam mickiewicz'] },
        { value: 200, clue: '"Życie jest jak pudełko czekoladek" — tytuł tego filmu z 1994 r.', answer: 'forrest gump' },
        { value: 300, clue: 'Namalował "Gwiaździstą Noc" w szpitalu psychiatrycznym', answer: 'van gogh', aliases: ['vincent van gogh'] },
        { value: 400, clue: 'Seria powieści o czarodzieju Harry\'m — autorka', answer: 'rowling', aliases: ['jk rowling', 'j.k. rowling'] },
        { value: 500, clue: 'Opera Verdiego, której bohaterką jest egipska księżniczka', answer: 'aida' },
      ],
    },
    sports: {
      label: '⚽ Sport',
      questions: [
        { value: 100, clue: 'Ile graczy ma drużyna piłkarska na boisku?', answer: '11', aliases: ['jedenastu', 'jedenascie'] },
        { value: 200, clue: 'Rekordowy zdobywca tytułów Wimbledon wśród mężczyzn', answer: 'federer', aliases: ['roger federer'] },
        { value: 300, clue: 'Kraj — mistrz Świata 2022 w Katarze', answer: 'argentyna', aliases: ['argentina'] },
        { value: 400, clue: 'Sport olimpijski — podnoszenie ciężarów w dwóch ruchach', answer: 'dwuboj', aliases: ['weightlifting', 'podnoszenie ciezarow'] },
        { value: 500, clue: 'Polska bokserka, złoty medal Tokio 2020', answer: 'kalis', aliases: ['julia kalis', 'szczepanek kalis'] },
      ],
    },
    it: {
      label: '💻 Technologia',
      questions: [
        { value: 100, clue: 'Najpopularniejszy system mobilny — Google', answer: 'android' },
        { value: 200, clue: 'Język programowania popularny w AI — nazwa gatunku węża', answer: 'python' },
        { value: 300, clue: 'Firma stojąca za ChatGPT', answer: 'openai', aliases: ['open ai'] },
        { value: 400, clue: 'Bezpieczny protokół stron www — 5-literowy skrót', answer: 'https' },
        { value: 500, clue: 'Algorytm sortowania Tony\'ego Hoare\'a — "szybkie sortowanie"', answer: 'quicksort', aliases: ['quick sort', 'szybkie sortowanie'] },
      ],
    },
  },

  createState(config) {
    return {
      board: {},
      currentPicker: null,
      activeQuestion: null,
      buzzedPlayer: null,
      buzzedPlayerName: null,
      phase: 'pick',   // pick | question | buzz | judging | reveal
      pickerIndex: 0,
      questionTime: Number(config?.questionTime) || 20,
      buzzTime:     Number(config?.buzzTime)     || 10,
      timerStart: null,
      alreadyBuzzed: [],  // players who buzzed and got it wrong this round
    };
  },

  onStart({ room, content, io }) {
    const gs = room.gameState;
    gs.questionTime = Number(room.config?.questionTime) || 20;
    gs.buzzTime     = Number(room.config?.buzzTime)     || 10;
    gs.board = {};
    room.players.forEach(p => { p.score = 0; });

    Object.entries(content).forEach(([key, cat]) => {
      gs.board[key] = {};
      (cat.questions || []).forEach(q => { gs.board[key][q.value] = false; });
    });

    gs.pickerIndex   = 0;
    gs.currentPicker = room.players[0]?.id;
    gs.phase         = 'pick';

    io.to(room.id).emit('gameStarted', { room });
    io.to(room.id).emit('jeopardyBoard', {
      board: gs.board, currentPicker: gs.currentPicker,
      phase: gs.phase, room,
    });
  },

  onEvent({ event, data, socket, room, io }) {
    const gs  = room.gameState;
    const mod = module.exports;

    if (event === 'jeopardyPick') {
      if (socket.id !== gs.currentPicker) return socket.emit('error', { message: 'Nie twoja kolej na wybór!' });
      const { catKey, value } = data;
      const cat = room._content?.[catKey] || mod.defaultContent[catKey] || {};
      const q   = (cat.questions || []).find(q => q.value === Number(value));
      if (!q || gs.board[catKey]?.[value]) return socket.emit('error', { message: 'To pytanie jest już zajęte!' });

      gs.board[catKey][value]  = true;
      gs.activeQuestion        = { catKey, value: Number(value), clue: q.clue, answer: _norm(q.answer), aliases: (q.aliases||[]).map(_norm) };
      gs.buzzedPlayer          = null;
      gs.alreadyBuzzed         = [];
      gs.phase                 = 'question';
      gs.timerStart            = Date.now();

      io.to(room.id).emit('jeopardyQuestion', {
        catKey, value: Number(value), clue: q.clue,
        timeLimit: gs.questionTime, room,
      });

      gs.questionTimer = setTimeout(() => {
        if (gs.phase !== 'question') return;
        gs.phase = 'reveal';
        _advancePicker(room);
        io.to(room.id).emit('jeopardyTimeout', {
          answer: q.answer, board: gs.board,
          currentPicker: gs.currentPicker, room,
        });
        _checkEnd(room, io);
      }, gs.questionTime * 1000);
    }

    if (event === 'jeopardyBuzz') {
      if (gs.phase !== 'question') return;
      if (gs.alreadyBuzzed.includes(socket.id)) return socket.emit('error', { message: 'Już buzowałeś!' });

      clearTimeout(gs.questionTimer);
      gs.buzzedPlayer     = socket.id;
      gs.buzzedPlayerName = room.players.find(p => p.id === socket.id)?.name || '';
      gs.phase            = 'buzz';
      gs.timerStart       = Date.now();

      io.to(room.id).emit('jeopardyBuzzed', {
        playerId: socket.id, playerName: gs.buzzedPlayerName,
        timeLimit: gs.buzzTime,
      });

      gs.answerTimer = setTimeout(() => {
        if (gs.phase !== 'buzz') return;
        _wrongAnswer(socket.id, room, io, true);
      }, gs.buzzTime * 1000);
    }

    if (event === 'jeopardyAnswer') {
      if (gs.phase !== 'buzz' && gs.phase !== 'judging') return;
      if (gs.buzzedPlayer !== socket.id) return;
      clearTimeout(gs.answerTimer);

      const answer = _norm(data.answer || '');

      if (room.isGameMaster) {
        // GM mode — send to GM for judgment
        gs.phase = 'judging';
        gs.pendingAnswer = data.answer;
        const gmSocket = io.sockets.sockets.get(room.gameMasterId);
        io.to(room.id).emit('jeopardyAwaitingJudge', {
          playerName: gs.buzzedPlayerName, answer: data.answer,
        });
        // Also send to GM with judgment buttons
        if (gmSocket) {
          gmSocket.emit('jeopardyJudgeRequest', {
            playerName: gs.buzzedPlayerName,
            answer: data.answer,
            correctAnswer: gs.activeQuestion.answer,
          });
        }
      } else {
        // Auto mode — compare with aliases
        const correct = _isCorrect(answer, gs.activeQuestion);
        _resolveAnswer(socket.id, correct, room, io);
      }
    }

    // GM judges the answer
    if (event === 'jeopardyJudge') {
      if (!room.isGameMaster || socket.id !== room.gameMasterId) return;
      if (gs.phase !== 'judging') return;
      _resolveAnswer(gs.buzzedPlayer, data.correct === true, room, io);
    }
  },
};

// ── HELPERS ──────────────────────────────────────────────────

function _norm(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim();
}

function _isCorrect(answer, aq) {
  if (!answer) return false;
  const targets = [aq.answer, ...(aq.aliases || [])];
  for (const t of targets) {
    if (!t) continue;
    if (answer === t) return true;
    // allow if answer contains the target as whole word (or vice versa), min 4 chars
    if (t.length >= 4 && answer.includes(t)) return true;
    if (answer.length >= 4 && t.includes(answer)) return true;
  }
  return false;
}

function _wrongAnswer(playerId, room, io, timeout = false) {
  const gs = room.gameState;
  const player = room.players.find(p => p.id === playerId);
  const penalty = Math.floor(gs.activeQuestion.value / 2);
  if (player) player.score = Math.max(0, player.score - penalty);
  gs.alreadyBuzzed.push(playerId);

  // Check if ALL players have buzzed and been wrong
  const activePlayers = room.players.filter(p => !gs.alreadyBuzzed.includes(p.id));
  if (activePlayers.length === 0) {
    // Everyone tried — reveal answer
    gs.phase = 'reveal';
    _advancePicker(room);
    io.to(room.id).emit('jeopardyAnswerResult', {
      correct: false, timeout,
      answer: '', correctAnswer: gs.activeQuestion.answer,
      board: gs.board, currentPicker: gs.currentPicker, room,
    });
    _checkEnd(room, io);
  } else {
    // Reopen for remaining players
    gs.phase = 'question';
    gs.buzzedPlayer = null;
    gs.timerStart = Date.now();
    io.to(room.id).emit('jeopardyAnswerResult', {
      correct: false, timeout,
      answer: '', correctAnswer: null,
      board: gs.board, currentPicker: gs.currentPicker, room,
      remainingBuzzers: activePlayers.map(p => p.name),
    });
    gs.questionTimer = setTimeout(() => {
      if (gs.phase !== 'question') return;
      gs.phase = 'reveal';
      _advancePicker(room);
      io.to(room.id).emit('jeopardyTimeout', {
        answer: gs.activeQuestion.answer, board: gs.board,
        currentPicker: gs.currentPicker, room,
      });
      _checkEnd(room, io);
    }, (room.gameState.questionTime || 20) * 1000);
  }
}

function _resolveAnswer(playerId, correct, room, io) {
  const gs = room.gameState;
  const player = room.players.find(p => p.id === playerId);

  if (correct) {
    if (player) player.score += gs.activeQuestion.value;
    gs.currentPicker = playerId;  // winner picks next
    gs.pickerIndex   = room.players.findIndex(p => p.id === playerId);
    gs.phase         = 'reveal';
    io.to(room.id).emit('jeopardyAnswerResult', {
      correct: true, answer: gs.pendingAnswer || '',
      correctAnswer: gs.activeQuestion.answer,
      board: gs.board, currentPicker: gs.currentPicker, room,
    });
    _checkEnd(room, io);
  } else {
    gs.pendingAnswer = null;
    _wrongAnswer(playerId, room, io, false);
  }
}

function _advancePicker(room) {
  const gs = room.gameState;
  gs.pickerIndex   = (gs.pickerIndex + 1) % Math.max(room.players.length, 1);
  gs.currentPicker = room.players[gs.pickerIndex]?.id;
}

function _checkEnd(room, io) {
  const gs      = room.gameState;
  const allDone = Object.values(gs.board).every(cat => Object.values(cat).every(v => v === true));
  if (allDone) {
    room.status  = 'finished';
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    io.to(room.id).emit('gameOver', { room, sorted });
  }
}
