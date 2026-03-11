/**
 * ═══════════════════════════════════════════════════════════
 *  GameNight — Modularny serwer gier
 * ═══════════════════════════════════════════════════════════
 *
 *  Aby dodać nową grę:
 *  1. Stwórz folder: games/<nazwa-gry>/
 *  2. Dodaj plik:    games/<nazwa-gry>/index.js
 *  3. Zrestartuj serwer — gra pojawi się automatycznie!
 *
 *  Struktura modułu gry → patrz games/hangman/index.js
 * ═══════════════════════════════════════════════════════════
 */

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const fs       = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ─── AUTO-LOAD GAME MODULES ───────────────────────────────────
const GAMES = {};   // { gameId: module }
const CONTENT = {}; // { gameId: { ...mutable content } }

function loadGameModules() {
  const gamesDir = path.join(__dirname, 'games');
  if (!fs.existsSync(gamesDir)) return;

  const dirs = fs.readdirSync(gamesDir).filter(d => {
    const indexPath = path.join(gamesDir, d, 'index.js');
    return fs.existsSync(indexPath);
  });

  for (const dir of dirs) {
    try {
      const mod = require(path.join(gamesDir, dir, 'index.js'));
      const id  = mod.meta?.id || dir;
      GAMES[id]   = mod;
      CONTENT[id] = JSON.parse(JSON.stringify(mod.defaultContent || {}));
      console.log(`  ✅ Załadowano grę: ${mod.meta?.icon || '🎮'} ${mod.meta?.name || id}`);
    } catch (err) {
      console.error(`  ❌ Błąd ładowania gry "${dir}":`, err.message);
    }
  }

  console.log(`\n🎮 Załadowano ${Object.keys(GAMES).length} gier: ${Object.keys(GAMES).join(', ')}\n`);
}

loadGameModules();

// ─── HELPERS przekazywane do modułów ──────────────────────────
function makeHelpers(roomId) {
  return {
    emitError(targetRoomId, message) {
      io.to(targetRoomId).emit('error', { message });
    },

    // Quiz helpers
    startQuizQuestion(rId) {
      const room = rooms[rId];
      if (!room) return;
      const gs = room.gameState;
      gs.answeredPlayers = [];
      const q = gs.questions[gs.currentQuestion];
      io.to(rId).emit('quizQuestion', {
        questionIndex: gs.currentQuestion,
        total: gs.questions.length,
        question: q.question,
        answers: q.answers,
        points: q.points,
        timeLimit: 15,
      });
      gs.questionTimer = setTimeout(() => this.endQuizQuestion(rId), 15000);
    },

    endQuizQuestion(rId) {
      const room = rooms[rId];
      if (!room) return;
      const gs = room.gameState;
      const q  = gs.questions[gs.currentQuestion];
      io.to(rId).emit('quizReveal', { correctIndex: q.correct, room });
      gs.currentQuestion++;
      setTimeout(() => {
        if (gs.currentQuestion >= gs.questions.length) {
          room.status = 'finished';
          io.to(rId).emit('gameOver', { room, sorted: [...room.players].sort((a,b)=>b.score-a.score) });
        } else {
          this.startQuizQuestion(rId);
        }
      }, 3000);
    },

    // WordRace helpers
    startWordRaceRound(rId) {
      const room = rooms[rId];
      if (!room) return;
      const gs = room.gameState;
      gs.answered = [];
      gs.roundWinner = null;
      const round = gs.rounds[gs.currentRound];
      io.to(rId).emit('wordRaceRound', {
        roundIndex: gs.currentRound,
        total: gs.rounds.length,
        clue: round.clue,
        timeLimit: 20,
        room,
      });
      gs.roundTimer = setTimeout(() => {
        io.to(rId).emit('wordRaceTimeout', { answer: round.answer, room });
        setTimeout(() => this.nextWordRaceRound(rId), 2500);
      }, 20000);
    },

    nextWordRaceRound(rId) {
      const room = rooms[rId];
      if (!room) return;
      const gs = room.gameState;
      gs.currentRound++;
      if (gs.currentRound >= gs.rounds.length) {
        room.status = 'finished';
        io.to(rId).emit('gameOver', { room, sorted: [...room.players].sort((a,b)=>b.score-a.score) });
      } else {
        this.startWordRaceRound(rId);
      }
    },
  };
}

// ─── ROOM STATE ────────────────────────────────────────────────
const rooms = {};

function createRoom(roomId, gameType, hostId, hostName, isGameMaster, config) {
  const mod = GAMES[gameType];
  return {
    id: roomId,
    gameType,
    hostId,
    isGameMaster: !!isGameMaster,
    config: config || {},
    players: isGameMaster ? [] : [{ id: hostId, name: hostName, score: 0 }],
    gameMasterId:   isGameMaster ? hostId   : null,
    gameMasterName: isGameMaster ? hostName : null,
    status: 'waiting',
    gameState: mod ? mod.createState(config || {}) : {},
  };
}

// ─── PUBLIC API ────────────────────────────────────────────────
app.get('/api/games', (req, res) => {
  res.json(Object.values(GAMES).map(m => m.meta));
});

app.get('/api/content', (req, res) => {
  res.json(CONTENT);
});

// ─── ADMIN API ────────────────────────────────────────────────
function adminCheck(password, res) {
  if (password !== ADMIN_PASSWORD) { res.status(403).json({ error: 'Brak dostępu' }); return false; }
  return true;
}

app.post('/api/admin/login', (req, res) => {
  res.json({ ok: req.body.password === ADMIN_PASSWORD });
});

app.post('/api/admin/reset', (req, res) => {
  if (!adminCheck(req.body.password, res)) return;
  for (const id of Object.keys(GAMES)) {
    CONTENT[id] = JSON.parse(JSON.stringify(GAMES[id].defaultContent || {}));
  }
  res.json({ ok: true });
});

// Hangman words
app.post('/api/admin/hangman/word', (req, res) => {
  const { password, category, difficulty, word } = req.body;
  if (!adminCheck(password, res)) return;
  const c = CONTENT.hangman;
  if (!c[category]) c[category] = { label: category, easy:[], medium:[], hard:[] };
  const w = word.toLowerCase().trim();
  if (!c[category][difficulty].includes(w)) c[category][difficulty].push(w);
  res.json({ ok: true });
});

app.delete('/api/admin/hangman/word', (req, res) => {
  const { password, category, difficulty, word } = req.body;
  if (!adminCheck(password, res)) return;
  CONTENT.hangman[category][difficulty] = CONTENT.hangman[category][difficulty].filter(w => w !== word);
  res.json({ ok: true });
});

app.post('/api/admin/hangman/category', (req, res) => {
  const { password, key, label } = req.body;
  if (!adminCheck(password, res)) return;
  if (!CONTENT.hangman[key]) CONTENT.hangman[key] = { label, easy:[], medium:[], hard:[] };
  res.json({ ok: true });
});

// Quiz questions
app.post('/api/admin/quiz/question', (req, res) => {
  const { password, category, difficulty, question, answers, correct, points } = req.body;
  if (!adminCheck(password, res)) return;
  const c = CONTENT.quiz;
  if (!c[category]) c[category] = { label: category, easy:[], medium:[], hard:[] };
  c[category][difficulty].push({ question, answers, correct: +correct, points: +points });
  res.json({ ok: true });
});

app.delete('/api/admin/quiz/question', (req, res) => {
  const { password, category, difficulty, index } = req.body;
  if (!adminCheck(password, res)) return;
  CONTENT.quiz[category][difficulty].splice(index, 1);
  res.json({ ok: true });
});

app.post('/api/admin/quiz/category', (req, res) => {
  const { password, key, label } = req.body;
  if (!adminCheck(password, res)) return;
  if (!CONTENT.quiz[key]) CONTENT.quiz[key] = { label, easy:[], medium:[], hard:[] };
  res.json({ ok: true });
});

// WordRace words
app.post('/api/admin/wordrace/word', (req, res) => {
  const { password, category, difficulty, clue, answer } = req.body;
  if (!adminCheck(password, res)) return;
  const c = CONTENT.wordrace;
  if (!c[category]) c[category] = { label: category, easy:[], medium:[], hard:[] };
  c[category][difficulty].push({ clue, answer: answer.toLowerCase().trim() });
  res.json({ ok: true });
});

app.delete('/api/admin/wordrace/word', (req, res) => {
  const { password, category, difficulty, index } = req.body;
  if (!adminCheck(password, res)) return;
  CONTENT.wordrace[category][difficulty].splice(index, 1);
  res.json({ ok: true });
});

app.post('/api/admin/wordrace/category', (req, res) => {
  const { password, key, label } = req.body;
  if (!adminCheck(password, res)) return;
  if (!CONTENT.wordrace[key]) CONTENT.wordrace[key] = { label, easy:[], medium:[], hard:[] };
  res.json({ ok: true });
});

// ─── SOCKET ────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('createRoom', ({ gameType, playerName, isGameMaster, config }) => {
    if (!GAMES[gameType]) return socket.emit('error', { message: `Nieznana gra: ${gameType}` });
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[roomId] = createRoom(roomId, gameType, socket.id, playerName, isGameMaster, config || {});
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, room: rooms[roomId] });
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('error', { message: 'Pokój nie istnieje!' });
    if (room.status !== 'waiting') return socket.emit('error', { message: 'Gra już trwa!' });
    const meta = GAMES[room.gameType]?.meta;
    if (room.players.length >= (meta?.maxPlayers || 8)) return socket.emit('error', { message: 'Pokój jest pełny!' });
    room.players.push({ id: socket.id, name: playerName, score: 0 });
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, room });
    io.to(roomId).emit('playerJoined', { room });
  });

  socket.on('startGame', ({ roomId, customWord }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id && room.gameMasterId !== socket.id) return;
    const meta = GAMES[room.gameType]?.meta;
    if (room.players.length < (meta?.minPlayers || 1)) {
      return socket.emit('error', { message: `Potrzeba min. ${meta?.minPlayers || 1} graczy!` });
    }
    room.status = 'playing';
    const mod = GAMES[room.gameType];
    if (mod?.onStart) {
      mod.onStart({
        room,
        content: CONTENT[room.gameType] || {},
        customWord,
        io,
        helpers: makeHelpers(roomId),
      });
    }
  });

  // ── Forward all game events to the right module ──
  const GAME_EVENTS = ['guessLetter','quizAnswer','wordRaceAnswer'];
  for (const event of GAME_EVENTS) {
    socket.on(event, (data) => {
      const room = rooms[data.roomId];
      if (!room || room.status !== 'playing') return;
      const mod = GAMES[room.gameType];
      if (mod?.onEvent) {
        mod.onEvent({
          event, data, socket, room, io,
          helpers: makeHelpers(data.roomId),
        });
      }
    });
  }

  socket.on('playAgain', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    const nr = createRoom(roomId, room.gameType, room.hostId, room.gameMasterName || '', room.isGameMaster, room.config);
    nr.players = room.players.map(p => ({ ...p, score: 0 }));
    if (room.isGameMaster) { nr.gameMasterId = room.gameMasterId; nr.gameMasterName = room.gameMasterName; }
    rooms[roomId] = nr;
    io.to(roomId).emit('gameReset', { room: rooms[roomId] });
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const idx  = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        const name = room.players[idx].name;
        room.players.splice(idx, 1);
        if (room.players.length === 0 && room.gameMasterId !== socket.id) { delete rooms[roomId]; continue; }
        if (room.hostId === socket.id && room.players[0]) room.hostId = room.players[0].id;
        io.to(roomId).emit('playerLeft', { room, playerName: name });
      } else if (room.gameMasterId === socket.id) {
        io.to(roomId).emit('playerLeft', { room, playerName: room.gameMasterName + ' (GM)' });
        delete rooms[roomId];
      }
    }
  });
});

// ─── START ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n🚀 GameNight server na http://localhost:${PORT}\n`));
