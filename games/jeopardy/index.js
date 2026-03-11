/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: JEOPARDY
 *  Plik: games/jeopardy/index.js
 * ═══════════════════════════════════════════
 */

module.exports = {
  meta: {
    id: 'jeopardy',
    name: 'Jeopardy',
    icon: '❓',
    description: 'Wybierz kategorię i wartość — odpowiedz pytaniem!',
    color: '#5c7dfc',
    minPlayers: 1,
    maxPlayers: 6,
    supportsGameMaster: false,
  },

  defaultContent: {
    science: {
      label: '🔬 Nauka',
      questions: [
        { value: 100, clue: 'Ten pierwiastek ma symbol chemiczny "O" i jest niezbędny do oddychania', answer: 'tlen' },
        { value: 200, clue: 'Prędkość światła w próżni wynosi ok. 300 000 km/s — kto to odkrył?', answer: 'einstein' },
        { value: 300, clue: 'Układ słoneczny ma tyle planet (od 2006 r.)', answer: 'osiem' },
        { value: 400, clue: 'Teoria ewolucji gatunków przez dobór naturalny — kto ją sformułował?', answer: 'darwin' },
        { value: 500, clue: 'Najcięższa znana cząstka elementarna — bozon Higgsa — wykryty tu w 2012 r.', answer: 'cern' },
      ],
    },
    history: {
      label: '📜 Historia',
      questions: [
        { value: 100, clue: 'Rok wybuchu II Wojny Światowej', answer: '1939' },
        { value: 200, clue: 'Starożytny cud świata — piramida faraona Cheopsa stoi w tym kraju', answer: 'egipt' },
        { value: 300, clue: 'Polska odzyskała niepodległość w tym roku', answer: '1918' },
        { value: 400, clue: 'Słynny astronom, który odkrył, że Ziemia krąży wokół Słońca', answer: 'kopernik' },
        { value: 500, clue: 'Rewolucja Październikowa 1917 roku miała miejsce w tym kraju', answer: 'rosja' },
      ],
    },
    geography: {
      label: '🌍 Geografia',
      questions: [
        { value: 100, clue: 'Stolica Francji', answer: 'paryz' },
        { value: 200, clue: 'Najdłuższa rzeka świata', answer: 'nil' },
        { value: 300, clue: 'Kraj, w którym leży Mount Everest (od strony szczytu)', answer: 'nepal' },
        { value: 400, clue: 'Największy kontynent na świecie', answer: 'azja' },
        { value: 500, clue: 'Miasto, w którym żyje najwięcej ludzi na świecie', answer: 'tokio' },
      ],
    },
    culture: {
      label: '🎭 Kultura',
      questions: [
        { value: 100, clue: 'Twórca "Pana Tadeusza"', answer: 'mickiewicz' },
        { value: 200, clue: 'Film z 1994 roku z Tomem Hanksem — "Życie jest jak pudełko czekoladek"', answer: 'forrest gump' },
        { value: 300, clue: 'Artysta namalował "Gwiaździstą Noc" podczas pobytu w szpitalu psychiatrycznym', answer: 'van gogh' },
        { value: 400, clue: 'Seria powieści o czarodzieju Harrym, autorka J.K. Rowling', answer: 'harry potter' },
        { value: 500, clue: 'Najczęściej wykonywana opera na świecie — kompozytor Verdi, tytuł to imię bohaterki', answer: 'aida' },
      ],
    },
    sports: {
      label: '⚽ Sport',
      questions: [
        { value: 100, clue: 'Ile graczy ma drużyna piłkarska na boisku?', answer: 'jedenastu' },
        { value: 200, clue: 'Tenisista, który zdobył najwięcej turniejów Wimbledon (stan na 2023)', answer: 'federer' },
        { value: 300, clue: 'Kraj, który wygrał Mundial 2022 w Katarze', answer: 'argentyna' },
        { value: 400, clue: 'Dyscyplina olimpijska, w której podnosi się ciężary nad głowę w dwóch ruchach', answer: 'dwuboj' },
        { value: 500, clue: 'Polska bokserka, mistrzyni olimpijska z Tokio 2020', answer: 'kalis' },
      ],
    },
    it: {
      label: '💻 Technologia',
      questions: [
        { value: 100, clue: 'Najpopularniejszy system operacyjny na smartfonach — stworzony przez Google', answer: 'android' },
        { value: 200, clue: 'Język programowania węży — popularny w AI', answer: 'python' },
        { value: 300, clue: 'Firma stojąca za ChatGPT', answer: 'openai' },
        { value: 400, clue: 'Protokół komunikacji stron www (skrót czteroliterowy z "S" na końcu)', answer: 'https' },
        { value: 500, clue: 'Algorytm sortowania wynaleziony przez Tonyego Hoare\'a — "szybkie sortowanie"', answer: 'quicksort' },
      ],
    },
  },

  createState(config) {
    return {
      board: {},        // { catKey: { value: answered(bool) } }
      currentPicker: null,
      activeQuestion: null,  // { catKey, value, clue, answer }
      buzzedPlayer: null,
      scores: {},
      phase: 'pick',    // 'pick' | 'question' | 'buzz' | 'reveal'
      pickerIndex: 0,
    };
  },

  onStart({ room, content, io }) {
    const gs = room.gameState;
    const cats = content;
    gs.board = {};
    gs.scores = {};
    room.players.forEach(p => { gs.scores[p.id] = 0; });

    Object.entries(cats).forEach(([key, cat]) => {
      gs.board[key] = {};
      (cat.questions || []).forEach(q => {
        gs.board[key][q.value] = false; // false = not answered
      });
    });

    gs.pickerIndex = 0;
    gs.currentPicker = room.players[0]?.id;
    gs.phase = 'pick';

    io.to(room.id).emit('gameStarted', { room });
    io.to(room.id).emit('jeopardyBoard', { board: gs.board, currentPicker: gs.currentPicker, scores: gs.scores, phase: gs.phase });
  },

  onEvent({ event, data, socket, room, io }) {
    const gs = room.gameState;

    if (event === 'jeopardyPick') {
      if (socket.id !== gs.currentPicker) return socket.emit('error', { message: 'Nie twoja kolej na wybór!' });
      const { catKey, value } = data;
      const cat = module.exports.defaultContent[catKey] || {};
      const q = (cat.questions || []).find(q => q.value === value);
      if (!q || gs.board[catKey]?.[value]) return socket.emit('error', { message: 'Pytanie niedostępne' });

      gs.activeQuestion = { catKey, value, clue: q.clue, answer: q.answer.toLowerCase() };
      gs.buzzedPlayer = null;
      gs.phase = 'question';
      gs.board[catKey][value] = true;

      io.to(room.id).emit('jeopardyQuestion', { catKey, value, clue: q.clue, scores: gs.scores });

      gs.questionTimer = setTimeout(() => {
        if (gs.phase === 'question' || gs.phase === 'buzz') {
          gs.phase = 'pick';
          gs.pickerIndex = (gs.pickerIndex + 1) % room.players.length;
          gs.currentPicker = room.players[gs.pickerIndex]?.id;
          io.to(room.id).emit('jeopardyTimeout', { answer: gs.activeQuestion.answer, board: gs.board, currentPicker: gs.currentPicker, scores: gs.scores });
          checkJeopardyEnd(room, io);
        }
      }, 20000);
    }

    if (event === 'jeopardyBuzz') {
      if (gs.phase !== 'question') return;
      gs.buzzedPlayer = socket.id;
      gs.phase = 'buzz';
      clearTimeout(gs.questionTimer);
      io.to(room.id).emit('jeopardyBuzzed', { playerId: socket.id, playerName: room.players.find(p=>p.id===socket.id)?.name });

      gs.answerTimer = setTimeout(() => {
        // no answer in time
        const pi = room.players.find(p=>p.id===socket.id);
        if (pi) pi.score -= gs.activeQuestion.value;
        gs.scores[socket.id] = (gs.scores[socket.id]||0) - gs.activeQuestion.value;
        gs.phase = 'pick';
        gs.pickerIndex = (gs.pickerIndex + 1) % room.players.length;
        gs.currentPicker = room.players[gs.pickerIndex]?.id;
        io.to(room.id).emit('jeopardyTimeout', { answer: gs.activeQuestion.answer, board: gs.board, currentPicker: gs.currentPicker, scores: gs.scores });
        checkJeopardyEnd(room, io);
      }, 10000);
    }

    if (event === 'jeopardyAnswer') {
      if (gs.phase !== 'buzz' || gs.buzzedPlayer !== socket.id) return;
      clearTimeout(gs.answerTimer);
      const { answer } = data;
      const norm = (s) => s.toLowerCase().replace(/[^a-ząćęłńóśźż0-9]/g, '');
      const correct = norm(answer) === norm(gs.activeQuestion.answer) ||
                      gs.activeQuestion.answer.split(' ').some(w => norm(answer).includes(norm(w)) && norm(w).length > 3);

      const player = room.players.find(p => p.id === socket.id);
      if (correct) {
        if (player) player.score += gs.activeQuestion.value;
        gs.scores[socket.id] = (gs.scores[socket.id]||0) + gs.activeQuestion.value;
        gs.currentPicker = socket.id; // correct answerer picks next
      } else {
        if (player) player.score -= Math.floor(gs.activeQuestion.value / 2);
        gs.scores[socket.id] = (gs.scores[socket.id]||0) - Math.floor(gs.activeQuestion.value / 2);
        gs.pickerIndex = (gs.pickerIndex + 1) % room.players.length;
        gs.currentPicker = room.players[gs.pickerIndex]?.id;
      }

      gs.phase = 'pick';
      io.to(room.id).emit('jeopardyAnswerResult', { correct, answer, correctAnswer: gs.activeQuestion.answer, scores: gs.scores, board: gs.board, currentPicker: gs.currentPicker });
      checkJeopardyEnd(room, io);
    }
  },
};

function checkJeopardyEnd(room, io) {
  const gs = room.gameState;
  const allDone = Object.values(gs.board).every(cat => Object.values(cat).every(v => v === true));
  if (allDone) {
    room.status = 'finished';
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    io.to(room.id).emit('gameOver', { room, sorted });
  }
}
