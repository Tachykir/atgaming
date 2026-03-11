const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const fs       = require('fs');
const discordAuth = require('./discord-auth');

// Ładuj .env jeśli istnieje
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && !key.startsWith('#') && rest.length) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    });
  }
} catch(e) {}

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json());

// ── DISCORD SESSION ───────────────────────────────────────────
discordAuth.setupSession(app);

app.use(express.static(path.join(__dirname, 'public')));

// ── DISCORD ROUTES ────────────────────────────────────────────
discordAuth.setupRoutes(app);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ─── LEADERBOARD (in-memory, persists until server restart) ───
// Structure: { gameId: [ { name, score, date, category, difficulty } ] }
const leaderboard = {};
const LEADERBOARD_MAX = 100; // max entries per game

function recordScore(gameId, playerName, score, meta = {}) {
  if (!leaderboard[gameId]) leaderboard[gameId] = [];
  leaderboard[gameId].push({
    name: playerName,
    score,
    date: new Date().toISOString(),
    ...meta,
  });
  // Sort descending, keep top N
  leaderboard[gameId].sort((a, b) => b.score - a.score);
  if (leaderboard[gameId].length > LEADERBOARD_MAX) {
    leaderboard[gameId] = leaderboard[gameId].slice(0, LEADERBOARD_MAX);
  }
}

// ─── AUTO-LOAD GAME MODULES ───────────────────────────────────
const GAMES   = {};
const CONTENT = {};

function loadGameModules() {
  const gamesDir = path.join(__dirname, 'games');
  if (!fs.existsSync(gamesDir)) return;
  const dirs = fs.readdirSync(gamesDir).filter(d =>
    fs.existsSync(path.join(gamesDir, d, 'index.js'))
  );
  for (const dir of dirs) {
    try {
      const mod = require(path.join(gamesDir, dir, 'index.js'));
      const id  = mod.meta?.id || dir;
      GAMES[id]   = mod;
      CONTENT[id] = JSON.parse(JSON.stringify(mod.defaultContent || {}));
      console.log(`  ✅ ${mod.meta?.icon || '🎮'} ${mod.meta?.name || id}`);
    } catch (err) {
      console.error(`  ❌ "${dir}":`, err.message);
    }
  }
  console.log(`\n🎮 Załadowano ${Object.keys(GAMES).length} gier: ${Object.keys(GAMES).join(', ')}\n`);
}
loadGameModules();

// ─── HELPERS FOR MODULES ──────────────────────────────────────
function makeHelpers(roomId) {
  return {
    emitError(rId, message) { io.to(rId).emit('error', { message }); },

    startQuizQuestion(rId) {
      const room = rooms[rId]; if (!room) return;
      const gs = room.gameState;
      gs.answeredPlayers = [];
      const q = gs.questions[gs.currentQuestion];
      const timeLimit = Number(room.config?.questionTime) || 15;
      io.to(rId).emit('quizQuestion', { questionIndex: gs.currentQuestion, total: gs.questions.length, question: q.question, answers: q.answers, points: q.points, timeLimit });
      gs.questionTimer = setTimeout(() => this.endQuizQuestion(rId), timeLimit * 1000);
    },

    endQuizQuestion(rId) {
      const room = rooms[rId]; if (!room) return;
      const gs = room.gameState;
      const q  = gs.questions[gs.currentQuestion];
      io.to(rId).emit('quizReveal', { correctIndex: q.correct, room });
      gs.currentQuestion++;
      setTimeout(() => {
        if (gs.currentQuestion >= gs.questions.length) {
          room.status = 'finished';
          const sorted = [...room.players].sort((a,b) => b.score - a.score);
          sorted.forEach(p => recordScore('quiz', p.name, p.score, { category: room.config.category, difficulty: room.config.difficulty }));
          io.to(rId).emit('gameOver', { room, sorted });
        } else this.startQuizQuestion(rId);
      }, 3000);
    },

    startWordRaceRound(rId) {
      const room = rooms[rId]; if (!room) return;
      const gs = room.gameState;
      gs.answered = []; gs.roundWinner = null;
      const round = gs.rounds[gs.currentRound];
      const timeLimit = Number(room.config?.roundTime) || 20;
      io.to(rId).emit('wordRaceRound', { roundIndex: gs.currentRound, total: gs.rounds.length, clue: round.clue, timeLimit, room });
      gs.roundTimer = setTimeout(() => {
        io.to(rId).emit('wordRaceTimeout', { answer: round.answer, room });
        setTimeout(() => this.nextWordRaceRound(rId), 2500);
      }, timeLimit * 1000);
    },

    nextWordRaceRound(rId) {
      const room = rooms[rId]; if (!room) return;
      const gs = room.gameState;
      gs.currentRound++;
      if (gs.currentRound >= gs.rounds.length) {
        room.status = 'finished';
        const sorted = [...room.players].sort((a,b) => b.score - a.score);
        sorted.forEach(p => recordScore('wordrace', p.name, p.score, { category: room.config.category, difficulty: room.config.difficulty }));
        io.to(rId).emit('gameOver', { room, sorted });
      } else this.startWordRaceRound(rId);
    },
  };
}

// ─── ROOM STATE ────────────────────────────────────────────────
const rooms = {};

function createRoom(roomId, gameType, hostId, hostName, isGameMaster, config) {
  const mod = GAMES[gameType];
  return {
    id: roomId, gameType, hostId, isGameMaster: !!isGameMaster, config,
    players: isGameMaster ? [] : [{ id: hostId, name: hostName, score: 0 }],
    gameMasterId:   isGameMaster ? hostId   : null,
    gameMasterName: isGameMaster ? hostName : null,
    status: 'waiting',
    observers: [],
    createdAt: Date.now(),
    gameState: mod ? mod.createState(config || {}) : {},
  };
}

// ─── PUBLIC API ────────────────────────────────────────────────
app.get('/api/games', (req, res) => res.json(Object.values(GAMES).map(m => m.meta)));
app.get('/api/content', (req, res) => res.json(CONTENT));

// ─── ACTIVE ROOMS API ──────────────────────────────────────────
app.get('/api/rooms', (req, res) => {
  const publicRooms = Object.values(rooms).map(r => {
    const meta = GAMES[r.gameType]?.meta || {};
    return {
      id: r.id,
      gameType: r.gameType,
      gameName: meta.name || r.gameType,
      gameIcon: meta.icon || '🎮',
      gameColor: meta.color || '#7c5cfc',
      status: r.status,
      playerCount: r.players.length,
      maxPlayers: Number(r.config?.maxPlayers) || meta.maxPlayers || 8,
      hasGameMaster: !!r.gameMasterId,
      gameMasterName: r.gameMasterName || null,
      hostName: r.players[0]?.name || null,
      createdAt: r.createdAt || Date.now(),
    };
  });
  res.json(publicRooms);
});
app.get('/api/config-schemas', (req, res) => {
  const schemas = {};
  for (const [id, mod] of Object.entries(GAMES)) {
    schemas[id] = mod.meta.configSchema || {};
  }
  res.json(schemas);
});

app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard);
});

app.get('/api/leaderboard/:gameId', (req, res) => {
  res.json(leaderboard[req.params.gameId] || []);
});

// ─── ADMIN API ────────────────────────────────────────────────
function adminCheck(password, res) {
  if (password !== ADMIN_PASSWORD) { res.status(403).json({ error: 'Brak dostępu' }); return false; }
  return true;
}

app.post('/api/admin/login',  (req, res) => res.json({ ok: req.body.password === ADMIN_PASSWORD }));

app.post('/api/admin/reset', (req, res) => {
  if (!adminCheck(req.body.password, res)) return;
  for (const id of Object.keys(GAMES)) CONTENT[id] = JSON.parse(JSON.stringify(GAMES[id].defaultContent || {}));
  res.json({ ok: true });
});

app.delete('/api/admin/leaderboard', (req, res) => {
  const { password, gameId } = req.body;
  if (!adminCheck(password, res)) return;
  if (gameId) leaderboard[gameId] = [];
  else Object.keys(leaderboard).forEach(k => leaderboard[k] = []);
  res.json({ ok: true });
});

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

  socket.on('observeRoom', ({ roomId, observerName }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('error', { message: 'Pokój nie istnieje!' });
    room.observers = room.observers || [];
    room.observers.push({ id: socket.id, name: observerName || 'Obserwator' });
    socket.join(roomId);
    socket.emit('roomObserved', { roomId, room });
    io.to(roomId).emit('observerJoined', { observerName: observerName || 'Obserwator', room });
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('error', { message: 'Pokój nie istnieje!' });
    if (room.status !== 'waiting') return socket.emit('error', { message: 'Gra już trwa!' });
    // Use configured maxPlayers if set, otherwise fall back to game meta
    const max = Number(room.config?.maxPlayers) || GAMES[room.gameType]?.meta?.maxPlayers || 8;
    if (room.players.length >= max) return socket.emit('error', { message: `Pokój jest pełny! (max ${max})` });
    room.players.push({ id: socket.id, name: playerName, score: 0 });
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, room });
    io.to(roomId).emit('playerJoined', { room });
  });

  socket.on('startGame', ({ roomId, customWord }) => {
    const room = rooms[roomId]; if (!room) return;
    if (room.hostId !== socket.id && room.gameMasterId !== socket.id) return;
    const min = GAMES[room.gameType]?.meta?.minPlayers || 1;
    if (room.players.length < min) return socket.emit('error', { message: `Potrzeba min. ${min} graczy!` });
    room.status = 'playing';
    const mod = GAMES[room.gameType];
    if (mod?.onStart) mod.onStart({ room, content: CONTENT[room.gameType] || {}, customWord, io, helpers: makeHelpers(roomId) });
  });

  // ── GAME EVENTS → forward to module ──
  const GAME_EVENTS = [
    'guessLetter','quizAnswer','wordRaceAnswer',
    'jeopardyPick','jeopardyBuzz','jeopardyAnswer','jeopardyJudge',
    'familyFeudAnswer',
    'kalamburyDraw','kalamburyGuess','kalamburyClearCanvas',
    // New games
    'tttMove',
    'chessMove',
    'pokerFold','pokerCall','pokerRaise','pokerCheck','pokerBet',
    'bjBet','bjHit','bjStand','bjDouble',
  ];
  for (const event of GAME_EVENTS) {
    socket.on(event, (data) => {
      const room = rooms[data.roomId];
      if (!room || room.status !== 'playing') return;
      const mod = GAMES[room.gameType];
      if (mod?.onEvent) mod.onEvent({ event, data, socket, room, io, helpers: makeHelpers(data.roomId) });
    });
  }

  // ── HANGMAN: record scores on gameOver ──
  // (hangman module emits gameOver directly, so we hook into the socket event)
  socket.on('_hangmanOver', () => {}); // placeholder — handled below via module patch

  // ── CHESS: legal moves query ──
  socket.on('chessRequestMoves', ({ roomId, from }) => {
    const room = rooms[roomId];
    if (!room || room.gameType !== 'chess') return;
    const gs = room.gameState;
    const chessmod = GAMES['chess'];
    if (!chessmod || !chessmod.getLegalMoves) return;
    try {
      const moves = chessmod.getLegalMoves(gs.board, from.r, from.c);
      socket.emit('chessLegalMoves', { moves });
    } catch(e) {
      socket.emit('chessLegalMoves', { moves: [] });
    }
  });

  socket.on('playAgain', ({ roomId }) => {
    const room = rooms[roomId]; if (!room || room.hostId !== socket.id) return;
    const nr = createRoom(roomId, room.gameType, room.hostId, room.gameMasterName || '', room.isGameMaster, room.config);
    nr.players = room.players.map(p => ({ ...p, score: 0 }));
    if (room.isGameMaster) { nr.gameMasterId = room.gameMasterId; nr.gameMasterName = room.gameMasterName; }
    rooms[roomId] = nr;
    io.to(roomId).emit('gameReset', { room: rooms[roomId] });
  });

  // ── CHAT ──
  socket.on('chatMessage', ({ roomId, message }) => {
    const room = rooms[roomId]; if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    const isGM   = room.gameMasterId === socket.id;
    const name   = player?.name || (isGM ? room.gameMasterName : 'Gość');
    if (!name || !message?.trim()) return;
    const msg = message.trim().substring(0, 200);
    io.to(roomId).emit('chatMessage', {
      name,
      message: msg,
      isGM,
      time: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    });
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      // Remove from observers
      if (room.observers) {
        room.observers = room.observers.filter(o => o.id !== socket.id);
      }
      const idx  = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        const name = room.players[idx].name;
        room.players.splice(idx, 1);
        if (room.players.length === 0 && room.gameMasterId !== socket.id) { delete rooms[roomId]; continue; }
        if (room.hostId === socket.id && room.players[0]) room.hostId = room.players[0].id;
        io.to(roomId).emit('playerLeft', { room, playerName: name });
        io.to(roomId).emit('chatMessage', { name: '🔔 System', message: `${name} opuścił grę`, isSystem: true, time: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) });
      } else if (room.gameMasterId === socket.id) {
        io.to(roomId).emit('playerLeft', { room, playerName: room.gameMasterName + ' (GM)' });
        delete rooms[roomId];
      }
    }
  });
});

// Patch hangman to record leaderboard on game over
const _hangmanOnStart = GAMES.hangman?.onStart;
if (GAMES.hangman) {
  const origOnEvent = GAMES.hangman.onEvent.bind(GAMES.hangman);
  GAMES.hangman.onEvent = function(ctx) {
    const { event, data, room, io } = ctx;
    if (event === 'guessLetter') {
      // intercept gameOver for leaderboard
      const origEmit = io.to.bind(io);
      const patchedIo = Object.create(io);
      const origTo = io.to.bind(io);
      // We'll just call original and then record after
    }
    origOnEvent(ctx);
    // Check if game just finished to record scores
    if (room.status === 'finished' && room._lbRecorded !== room.id + room.players.map(p=>p.score).join()) {
      room._lbRecorded = room.id + room.players.map(p=>p.score).join();
      room.players.forEach(p => recordScore('hangman', p.name, p.score, { category: room.config?.category, difficulty: room.config?.difficulty }));
    }
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n🚀 AT Gaming server na http://localhost:${PORT}\n`));
