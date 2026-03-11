const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── GAME STATE ───────────────────────────────────────────────
const rooms = {}; // roomId -> room object

// ─── HANGMAN DATA ─────────────────────────────────────────────
const HANGMAN_WORDS = [
  'javascript', 'programowanie', 'komputer', 'internet', 'algorytm',
  'baza', 'serwer', 'klawiatura', 'monitor', 'procesor',
  'python', 'reaktywny', 'framework', 'biblioteka', 'funkcja',
  'zmienna', 'petla', 'tablica', 'obiekt', 'klasa'
];

// ─── QUIZ DATA ─────────────────────────────────────────────────
const QUIZ_QUESTIONS = [
  { question: 'Stolica Polski?', answers: ['Warszawa', 'Kraków', 'Gdańsk', 'Wrocław'], correct: 0, points: 100 },
  { question: 'Ile to 7 × 8?', answers: ['54', '56', '64', '48'], correct: 1, points: 100 },
  { question: 'Który rok to rok założenia Google?', answers: ['1994', '1996', '1998', '2000'], correct: 2, points: 200 },
  { question: 'Najdłuższa rzeka świata?', answers: ['Amazonka', 'Nil', 'Jangcy', 'Missisipi'], correct: 1, points: 200 },
  { question: 'Ile planet ma Układ Słoneczny?', answers: ['7', '8', '9', '10'], correct: 1, points: 100 },
  { question: 'Kto namalował Monę Lisę?', answers: ['Michał Anioł', 'Rembrandt', 'Da Vinci', 'Picasso'], correct: 2, points: 300 },
  { question: 'Symbol chemiczny złota?', answers: ['Go', 'Gd', 'Au', 'Ag'], correct: 2, points: 300 },
  { question: 'Ile bitów ma 1 bajt?', answers: ['4', '8', '16', '32'], correct: 1, points: 100 },
  { question: 'Rok lądowania na księżycu?', answers: ['1965', '1967', '1969', '1971'], correct: 2, points: 200 },
  { question: 'Autor "Pana Tadeusza"?', answers: ['Słowacki', 'Mickiewicz', 'Norwid', 'Krasicki'], correct: 1, points: 200 },
];

// ─── HELPERS ──────────────────────────────────────────────────
function createRoom(roomId, gameType, hostId, hostName) {
  const base = {
    id: roomId,
    gameType,
    hostId,
    players: [{ id: hostId, name: hostName, score: 0 }],
    status: 'waiting', // waiting | playing | finished
  };

  if (gameType === 'hangman') {
    return {
      ...base,
      word: '',
      guessed: [],
      wrongGuesses: [],
      currentTurn: hostId,
      maxWrong: 6,
    };
  } else if (gameType === 'quiz') {
    return {
      ...base,
      questions: [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 8),
      currentQuestion: 0,
      answeredPlayers: [],
      questionTimer: null,
    };
  }
  return base;
}

function getHangmanMask(word, guessed) {
  return word.split('').map(l => guessed.includes(l) ? l : '_').join(' ');
}

function checkHangmanWin(word, guessed) {
  return word.split('').every(l => guessed.includes(l));
}

// ─── SOCKET HANDLERS ──────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);

  // ── CREATE ROOM ──
  socket.on('createRoom', ({ gameType, playerName }) => {
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[roomId] = createRoom(roomId, gameType, socket.id, playerName);
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, room: rooms[roomId] });
    console.log(`🏠 Room ${roomId} created (${gameType}) by ${playerName}`);
  });

  // ── JOIN ROOM ──
  socket.on('joinRoom', ({ roomId, playerName }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('error', { message: 'Pokój nie istnieje!' });
    if (room.status !== 'waiting') return socket.emit('error', { message: 'Gra już trwa!' });
    if (room.players.length >= 6) return socket.emit('error', { message: 'Pokój jest pełny!' });

    room.players.push({ id: socket.id, name: playerName, score: 0 });
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, room });
    io.to(roomId).emit('playerJoined', { room });
    console.log(`👤 ${playerName} joined room ${roomId}`);
  });

  // ── START GAME ──
  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 1) return socket.emit('error', { message: 'Potrzeba co najmniej 1 gracza!' });

    room.status = 'playing';

    if (room.gameType === 'hangman') {
      room.word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
      room.guessed = [];
      room.wrongGuesses = [];
      room.currentTurn = room.players[0].id;
      io.to(roomId).emit('gameStarted', {
        room,
        mask: getHangmanMask(room.word, room.guessed),
        wordLength: room.word.length,
      });
    } else if (room.gameType === 'quiz') {
      room.currentQuestion = 0;
      room.answeredPlayers = [];
      io.to(roomId).emit('gameStarted', { room });
      startQuizQuestion(roomId);
    }
  });

  // ── HANGMAN: GUESS LETTER ──
  socket.on('guessLetter', ({ roomId, letter }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.gameType !== 'hangman') return;
    if (room.currentTurn !== socket.id) return socket.emit('error', { message: 'Nie twoja kolej!' });
    if (room.guessed.includes(letter) || room.wrongGuesses.includes(letter)) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    const nextPlayerIndex = (playerIndex + 1) % room.players.length;

    if (room.word.includes(letter)) {
      room.guessed.push(letter);
      const occurrences = room.word.split('').filter(l => l === letter).length;
      room.players[playerIndex].score += occurrences * 10;
    } else {
      room.wrongGuesses.push(letter);
    }

    const mask = getHangmanMask(room.word, room.guessed);
    const won = checkHangmanWin(room.word, room.guessed);
    const lost = room.wrongGuesses.length >= room.maxWrong;

    if (won || lost) {
      room.status = 'finished';
      io.to(roomId).emit('gameOver', {
        room,
        word: room.word,
        won,
        mask,
      });
    } else {
      room.currentTurn = room.players[nextPlayerIndex].id;
      io.to(roomId).emit('letterGuessed', {
        room,
        letter,
        correct: room.word.includes(letter),
        mask,
        currentTurn: room.currentTurn,
      });
    }
  });

  // ── QUIZ: ANSWER ──
  socket.on('quizAnswer', ({ roomId, answerIndex }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.gameType !== 'quiz') return;
    if (room.answeredPlayers.includes(socket.id)) return;

    room.answeredPlayers.push(socket.id);
    const q = room.questions[room.currentQuestion];
    const playerIndex = room.players.findIndex(p => p.id === socket.id);

    if (answerIndex === q.correct) {
      // Bonus za szybkość
      const speedBonus = Math.max(0, 3 - room.answeredPlayers.length) * 50;
      room.players[playerIndex].score += q.points + speedBonus;
      socket.emit('answerResult', { correct: true, points: q.points + speedBonus });
    } else {
      socket.emit('answerResult', { correct: false, points: 0 });
    }

    io.to(roomId).emit('playerAnswered', {
      playerName: room.players[playerIndex]?.name,
      answeredCount: room.answeredPlayers.length,
      totalPlayers: room.players.length,
    });

    if (room.answeredPlayers.length === room.players.length) {
      clearTimeout(room.questionTimer);
      endQuizQuestion(roomId);
    }
  });

  // ── PLAY AGAIN ──
  socket.on('playAgain', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;

    const newRoom = createRoom(roomId, room.gameType, room.hostId, room.players.find(p => p.id === room.hostId)?.name || 'Host');
    newRoom.players = room.players.map(p => ({ ...p, score: 0 }));
    rooms[roomId] = newRoom;
    io.to(roomId).emit('gameReset', { room: rooms[roomId] });
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        const name = room.players[idx].name;
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          if (room.hostId === socket.id) room.hostId = room.players[0].id;
          io.to(roomId).emit('playerLeft', { room, playerName: name });
        }
      }
    }
  });
});

// ── QUIZ HELPERS ──
function startQuizQuestion(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.answeredPlayers = [];
  const q = room.questions[room.currentQuestion];

  io.to(roomId).emit('quizQuestion', {
    questionIndex: room.currentQuestion,
    total: room.questions.length,
    question: q.question,
    answers: q.answers,
    points: q.points,
    timeLimit: 15,
  });

  room.questionTimer = setTimeout(() => endQuizQuestion(roomId), 15000);
}

function endQuizQuestion(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const q = room.questions[room.currentQuestion];
  io.to(roomId).emit('quizReveal', {
    correctIndex: q.correct,
    room,
  });

  room.currentQuestion++;

  setTimeout(() => {
    if (room.currentQuestion >= room.questions.length) {
      room.status = 'finished';
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      io.to(roomId).emit('gameOver', { room, sorted });
    } else {
      startQuizQuestion(roomId);
    }
  }, 3000);
}

// ─── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Game server running on http://localhost:${PORT}`);
});
