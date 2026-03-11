/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: FAMILY FEUD (Familiada)
 *  Plik: games/familyfeud/index.js
 * ═══════════════════════════════════════════
 */

module.exports = {
  meta: {
    id: 'familyfeud',
    name: 'Familiada',
    icon: '👨‍👩‍👧‍👦',
    description: 'Zgadnij najpopularniejsze odpowiedzi ankietowanych!',
    color: '#fc7d5c',
    minPlayers: 2,
    maxPlayers: 10,
    supportsGameMaster: false,
    configSchema: {
      maxPlayers: { type: 'number', label: 'Maks. graczy',  min: 2, max: 20, default: 10 },
      rounds:     { type: 'number', label: 'Liczba pytań',  min: 1, max: 10, default: 5 },
    },
  },

  defaultContent: {
    general: {
      label: '🎯 Ogólne',
      questions: [
        {
          question: 'Podaj popularne imię dla psa',
          answers: [
            { text: 'Burek', points: 35 },
            { text: 'Reksio', points: 25 },
            { text: 'Azor', points: 18 },
            { text: 'Fafik', points: 12 },
            { text: 'Max', points: 10 },
          ],
        },
        {
          question: 'Co ludzie robią gdy nudzą się w domu?',
          answers: [
            { text: 'Oglądają TV', points: 40 },
            { text: 'Grają w gry', points: 25 },
            { text: 'Śpią', points: 18 },
            { text: 'Jedzą', points: 10 },
            { text: 'Przeglądają telefon', points: 7 },
          ],
        },
        {
          question: 'Co zabrałbyś na bezludną wyspę?',
          answers: [
            { text: 'Telefon', points: 38 },
            { text: 'Wodę', points: 28 },
            { text: 'Jedzenie', points: 20 },
            { text: 'Nóż', points: 8 },
            { text: 'Zapałki', points: 6 },
          ],
        },
        {
          question: 'Wymień popularny sport zimowy',
          answers: [
            { text: 'Narty', points: 45 },
            { text: 'Sanki', points: 22 },
            { text: 'Łyżwy', points: 18 },
            { text: 'Snowboard', points: 10 },
            { text: 'Biathlon', points: 5 },
          ],
        },
        {
          question: 'Co robisz w sylwestra?',
          answers: [
            { text: 'Oglądam fajerwerki', points: 35 },
            { text: 'Bawię się z rodziną', points: 30 },
            { text: 'Idę na imprezę', points: 20 },
            { text: 'Śpię', points: 10 },
            { text: 'Oglądam transmisję', points: 5 },
          ],
        },
      ],
    },
    food: {
      label: '🍕 Jedzenie',
      questions: [
        {
          question: 'Podaj popularną pizzę',
          answers: [
            { text: 'Margherita', points: 40 },
            { text: 'Pepperoni', points: 30 },
            { text: 'Hawajska', points: 15 },
            { text: 'Capricciosa', points: 10 },
            { text: 'Quattro formaggi', points: 5 },
          ],
        },
        {
          question: 'Wymień popularne polskie danie',
          answers: [
            { text: 'Bigos', points: 35 },
            { text: 'Pierogi', points: 32 },
            { text: 'Żurek', points: 18 },
            { text: 'Barszcz', points: 10 },
            { text: 'Kotlet schabowy', points: 5 },
          ],
        },
        {
          question: 'Co pijesz rano?',
          answers: [
            { text: 'Kawę', points: 50 },
            { text: 'Herbatę', points: 30 },
            { text: 'Wodę', points: 12 },
            { text: 'Sok', points: 6 },
            { text: 'Mleko', points: 2 },
          ],
        },
        {
          question: 'Jaki owoc jest najbardziej popularny?',
          answers: [
            { text: 'Jabłko', points: 42 },
            { text: 'Banan', points: 28 },
            { text: 'Pomarańcza', points: 15 },
            { text: 'Truskawka', points: 10 },
            { text: 'Winogrono', points: 5 },
          ],
        },
      ],
    },
    lifestyle: {
      label: '🏠 Styl życia',
      questions: [
        {
          question: 'Co robisz po pracy?',
          answers: [
            { text: 'Oglądam seriale', points: 38 },
            { text: 'Ćwiczę', points: 25 },
            { text: 'Gotuję', points: 18 },
            { text: 'Czytam', points: 12 },
            { text: 'Spotykam się ze znajomymi', points: 7 },
          ],
        },
        {
          question: 'Wymień popularne zwierzę domowe',
          answers: [
            { text: 'Pies', points: 48 },
            { text: 'Kot', points: 35 },
            { text: 'Rybki', points: 10 },
            { text: 'Chomik', points: 5 },
            { text: 'Papuga', points: 2 },
          ],
        },
        {
          question: 'Co kupujesz na prezent urodzinowy?',
          answers: [
            { text: 'Kwiaty', points: 30 },
            { text: 'Książkę', points: 25 },
            { text: 'Perfumy', points: 22 },
            { text: 'Gotówkę', points: 15 },
            { text: 'Słodycze', points: 8 },
          ],
        },
        {
          question: 'Gdzie spędzasz wakacje?',
          answers: [
            { text: 'Morze', points: 42 },
            { text: 'Góry', points: 28 },
            { text: 'Zagranica', points: 18 },
            { text: 'Dom', points: 8 },
            { text: 'Jezioro', points: 4 },
          ],
        },
      ],
    },
  },

  createState(config) {
    return {
      questions: [],
      currentQuestionIndex: 0,
      revealedAnswers: [],
      strikes: 0,
      maxStrikes: 3,
      phase: 'question', // 'question' | 'reveal' | 'finished'
      buzzedPlayers: [],
    };
  },

  onStart({ room, content, io }) {
    const gs = room.gameState;
    const cat = content[room.config?.category] || Object.values(content)[0];
    const pool = [...(cat?.questions || [])];
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    gs.questions = pool.slice(0, Math.min(5, pool.length));
    gs.currentQuestionIndex = 0;
    gs.revealedAnswers = [];
    gs.strikes = 0;
    gs.phase = 'question';
    gs.buzzedPlayers = [];

    io.to(room.id).emit('gameStarted', { room });
    _sendQuestion(room, io);
  },

  onEvent({ event, data, socket, room, io }) {
    const gs = room.gameState;

    if (event === 'familyFeudAnswer') {
      if (gs.phase !== 'question') return;
      const q = gs.questions[gs.currentQuestionIndex];
      if (!q) return;

      const norm = (s) => s.toLowerCase().replace(/[^a-ząćęłńóśźż]/g, '');
      const answer = norm(data.answer || '');

      const matchIdx = q.answers.findIndex(a =>
        norm(a.text) === answer ||
        norm(a.text).includes(answer) && answer.length > 3 ||
        answer.includes(norm(a.text)) && norm(a.text).length > 3
      );

      if (matchIdx !== -1 && !gs.revealedAnswers.includes(matchIdx)) {
        gs.revealedAnswers.push(matchIdx);
        const pts = q.answers[matchIdx].points;
        const player = room.players.find(p => p.id === socket.id);
        if (player) player.score += pts;

        io.to(room.id).emit('familyFeudCorrect', {
          playerName: player?.name,
          answerIndex: matchIdx,
          answer: q.answers[matchIdx].text,
          points: pts,
          revealedAnswers: gs.revealedAnswers,
          room,
        });

        if (gs.revealedAnswers.length === q.answers.length) {
          _nextQuestion(room, io);
        }
      } else if (matchIdx === -1 || gs.revealedAnswers.includes(matchIdx)) {
        gs.strikes++;
        const player = room.players.find(p => p.id === socket.id);
        io.to(room.id).emit('familyFeudWrong', {
          playerName: player?.name,
          strikes: gs.strikes,
          maxStrikes: gs.maxStrikes,
        });

        if (gs.strikes >= gs.maxStrikes) {
          _nextQuestion(room, io);
        }
      }
    }
  },
};

function _sendQuestion(room, io) {
  const gs = room.gameState;
  const q = gs.questions[gs.currentQuestionIndex];
  if (!q) return;
  gs.revealedAnswers = [];
  gs.strikes = 0;

  io.to(room.id).emit('familyFeudQuestion', {
    questionIndex: gs.currentQuestionIndex,
    total: gs.questions.length,
    question: q.question,
    answerCount: q.answers.length,
    room,
  });
}

function _nextQuestion(room, io) {
  const gs = room.gameState;
  const q = gs.questions[gs.currentQuestionIndex];
  // reveal all remaining
  io.to(room.id).emit('familyFeudRevealAll', {
    answers: q.answers,
    room,
  });

  setTimeout(() => {
    gs.currentQuestionIndex++;
    if (gs.currentQuestionIndex >= gs.questions.length) {
      room.status = 'finished';
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      io.to(room.id).emit('gameOver', { room, sorted });
    } else {
      _sendQuestion(room, io);
    }
  }, 3000);
}
