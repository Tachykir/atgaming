const env      = require('./lib/env'); // pierwsze: wczytuje .env
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const tm       = require('./tournament');
const fs       = require('fs');
const discordAuth  = require('./discord-auth');
const casino        = require('./casino');
const casinoHttp    = require('./casino/http');
const casinoSockets = require('./casino/sockets');
const adminAuth     = require('./lib/adminAuth');
const { DbSessionStore } = require('./lib/sessionStore');
const { persisted, flushAll } = require('./lib/persisted');

const app    = express();
const server = http.createServer(app);
// Socket.io: połączenia tylko z tej samej domeny (lub z ALLOWED_ORIGINS / domeny z DISCORD_REDIRECT_URI)
const io     = new Server(server, {
  allowRequest(req, done) {
    const origin = req.headers.origin;
    if (!origin) return done(null, true);
    try {
      if (new URL(origin).host === req.headers.host || env.allowedOrigins().includes(origin)) return done(null, true);
    } catch (e) {}
    done('Niedozwolone źródło połączenia', false);
  },
});

app.use(express.json());

// ─── SOCKET TOKEN STORE ────────────────────────────────────────
// Prosty token → discordUser map, omija problemy z sesją przez WS
const socketTokens = new Map(); // token → discordUser

// ─── ONLINE DISCORD PLAYERS ────────────────────────────────────
// socket.id → { id, username, globalName, avatar, connectedAt, room, casino }
const onlineDiscord = new Map();
function createSocketToken(discordUser) {
  // Jeden token per user (unieważnia poprzedni)
  for (const [k, v] of socketTokens) if (v.id === discordUser.id) socketTokens.delete(k);
  const token = require('crypto').randomBytes(32).toString('hex');
  socketTokens.set(token, discordUser);
  return token;
}

// ── DISCORD SESSION ───────────────────────────────────────────
// WAŻNE: nadpisujemy setupSession PRZED wywołaniem, żeby _sessionMiddleware był zapisany
let _sessionMiddleware = null;
discordAuth.setupSession = function(app) {
  const session = require('express-session');
  const cfg = {
    store: new DbSessionStore(),   // sesje w bazie — restart nie wylogowuje graczy
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: (process.env.DISCORD_REDIRECT_URI || '').startsWith('https'),
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };
  // Sekret sesji: SESSION_SECRET z env, a gdy go brak — losowy, zapamiętany w bazie (stały między restartami)
  let real = null;
  const ready = (async () => {
    let secret = process.env.SESSION_SECRET;
    if (!secret) {
      await casino.store.whenReady();
      secret = await casino.store.getSetting('session_secret').catch(() => null);
      if (!secret) {
        secret = require('crypto').randomBytes(48).toString('hex');
        await casino.store.setSetting('session_secret', secret).catch(() => {});
      }
      console.warn('⚠️  SESSION_SECRET nie jest ustawiony — używam losowego sekretu zapisanego w bazie');
    }
    real = session({ ...cfg, secret });
  })();
  _sessionMiddleware = (req, res, next) => real ? real(req, res, next) : ready.then(() => real(req, res, next), next);
  app.set('trust proxy', 1);
  app.use(_sessionMiddleware);
};
discordAuth.setupSession(app); // wywołujemy już nadpisaną wersję

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, file) {
    // Service worker i manifest zawsze świeże — inaczej aktualizacja aplikacji mogłaby utknąć na starej wersji
    if (file.endsWith('sw.js') || file.endsWith('.webmanifest')) res.setHeader('Cache-Control', 'no-cache');
    if (file.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json');
    if (file.endsWith('sw.js')) res.setHeader('Service-Worker-Allowed', '/');
  },
}));

// ── DISCORD ROUTES ────────────────────────────────────────────
discordAuth.setupRoutes(app);

// Logowanie deweloperskie (lokalne testy bez Discorda) — tylko gdy DEV_LOGIN=1
if (process.env.DEV_LOGIN === '1') {
  console.warn('⚠️  DEV_LOGIN=1 — aktywne testowe logowanie /auth/dev-login (NIE włączaj na produkcji!)');
  app.get('/auth/dev-login', (req, res) => {
    const name = String(req.query.name || 'Tester').slice(0, 32);
    const id = 'dev-' + name.toLowerCase().replace(/[^a-z0-9]/g, '');
    req.session.discordUser = { id, username: name, globalName: name, avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' };
    res.redirect(`/?discord_login=1&nick=${encodeURIComponent(name)}`);
  });
}

// Endpoint zwracający token do autoryzacji socketów
app.get('/auth/socket-token', (req, res) => {
  const user = req.session?.discordUser;
  if (!user) return res.status(401).json({ error: 'not logged in' });
  const token = createSocketToken(user);
  res.json({ token });
});


// ─── LEADERBOARD (persystentny - zapisywany do pliku JSON) ───
// Structure: { gameId: [ { name, score, date, category, difficulty } ] }
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard_data.json');
const LEADERBOARD_MAX = 100; // max entries per game

let leaderboard = {};
// Trzymany w bazie (Postgres / JSON) — plik na dysku kontenera znika przy każdym deployu
const leaderboardStore = persisted('party_leaderboard', () => leaderboard);
async function loadLeaderboard() {
  const saved = await leaderboardStore.load().catch(() => null);
  if (saved && typeof saved === 'object') leaderboard = saved;
  else if (fs.existsSync(LEADERBOARD_FILE)) {
    // Jednorazowa migracja ze starego pliku
    try { leaderboard = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8')); leaderboardStore.save(); } catch (e) {}
  }
  console.log(`📊 Leaderboard wczytany (${Object.keys(leaderboard).length} gier)`);
}
function saveLeaderboard() { leaderboardStore.save(); }

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
  saveLeaderboard();
}

// ─── AUTO-LOAD GAME MODULES ───────────────────────────────────
const GAMES   = {};
const CONTENT = {};

function loadGameModules() {
  const gamesDir = path.join(__dirname, 'games');
  if (!fs.existsSync(gamesDir)) return;
  // poker i blackjack dostępne tylko w kasynie (nie jako gry pokojowe)
  const EXCLUDED = ['casino', 'poker', 'blackjack'];
  const dirs = fs.readdirSync(gamesDir).filter(d =>
    fs.existsSync(path.join(gamesDir, d, 'index.js')) && !EXCLUDED.includes(d)
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

// ─── KASYNO: INIT ──────────────────────────────────────────────
casino.initTables();

// Zainicjuj bazę danych (PG lub JSON) i dopiero potem uruchom serwer
const PORT = process.env.PORT || 3000;
casino.init().then(async () => {
  await Promise.all([loadLeaderboard(), loadContent()]);
  server.listen(PORT, () => console.log(`\n🚀 Serwer działa na porcie ${PORT}\n`));
  casino.scheduleWeeklyTopup(io);
  casinoSockets.startLoops(io);
}).catch(err => {
  console.error('Błąd inicjalizacji kasyna:', err);
  process.exit(1);
});

// Bezpieczne zamknięcie (deploy / restart): zwrot AT$ z gier w toku, zapis statystyk, zamknięcie bazy
let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 ${signal} — zamykanie serwera…`);
  const force = setTimeout(() => process.exit(1), 10_000);
  try {
    io.emit('serverRestart', { message: 'Serwer jest restartowany — AT$ z gier w toku zostały zwrócone.' });
    server.close();
    await flushAll();
    const r = await casinoSockets.shutdown();
    if (r.players) console.log(`💸 Zwrócono ${r.total.toLocaleString('pl-PL')} AT$ (${r.players} graczy)`);
  } catch (e) { console.error('Shutdown error:', e); }
  clearTimeout(force);
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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

const { publicRoom } = require('./lib/roomSerialize');

function createRoom(roomId, gameType, hostId, hostName, isGameMaster, config) {
  const mod = GAMES[gameType];
  const room = {
    id: roomId, gameType, hostId, isGameMaster: !!isGameMaster, config,
    players: isGameMaster ? [] : [{ id: hostId, name: hostName, score: 0 }],
    gameMasterId:   isGameMaster ? hostId   : null,
    gameMasterName: isGameMaster ? hostName : null,
    status: 'waiting',
    observers: [],
    createdAt: Date.now(),
    gameState: mod ? mod.createState(config || {}) : {},
  };
  Object.defineProperty(room, 'toJSON', { value: function () { return publicRoom(this); }, enumerable: false });
  return room;
}

// ─── PUBLIC API ────────────────────────────────────────────────
app.get('/api/games', (req, res) => res.json(Object.values(GAMES).map(m => m.meta)));
app.get('/api/content', (req, res) => res.json(CONTENT));

// ─── ACTIVE ROOMS API ──────────────────────────────────────────
app.get('/api/online-players', (req, res) => {
  const list = Array.from(onlineDiscord.values()).map(p => ({
    id:          p.id,
    username:    p.username,
    globalName:  p.globalName,
    avatar:      p.avatar,
    room:        p.room   || null,
    casino:      p.casino || null,
    connectedAt: p.connectedAt,
  }));
  // Deduplikuj po discord id (może być kilka tabów)
  const seen = new Set();
  const deduped = list.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  res.json(deduped);
});

app.get('/api/version', (req, res) => {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA
           || process.env.GIT_COMMIT
           || process.env.COMMIT_SHA
           || process.env.HEROKU_SLUG_COMMIT
           || null;
  res.json({
    version: sha ? sha.slice(0, 7) : null,
    sha:     sha || null,
    built:   new Date().toISOString(),
  });
});

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
// Uprawnienia admina: sesja (po zalogowaniu) lub hasło w body (zgodność wsteczna)
function adminCheck(password, res) {
  if (adminAuth.isAdmin(res.req)) return true;
  res.status(403).json({ error: 'Brak dostępu' });
  return false;
}

// Treści gier edytowane w panelu admina — zapis w bazie (przetrwają restart)
const contentStore = persisted('admin_content', () => CONTENT);
async function loadContent() {
  const saved = await contentStore.load().catch(() => null);
  if (saved && typeof saved === 'object') for (const [id, c] of Object.entries(saved)) if (CONTENT[id]) CONTENT[id] = c;
}
const DIFFS = ['easy', 'medium', 'hard'];
app.use(/^\/api\/admin\/(hangman|quiz|wordrace|reset)/, (req, res, next) => {
  const b = req.body || {};
  if (b.difficulty !== undefined && !DIFFS.includes(b.difficulty)) return res.status(400).json({ error: 'Nieprawidłowy poziom trudności' });
  const game = req.baseUrl.split('/')[3];
  if (req.method === 'DELETE' && CONTENT[game] && !CONTENT[game][b.category]?.[b.difficulty]) return res.status(404).json({ error: 'Nie ma takiej kategorii' });
  for (const f of ['word', 'question', 'clue', 'answer', 'key', 'label']) if (b[f] !== undefined && (typeof b[f] !== 'string' || b[f].length > 300)) return res.status(400).json({ error: 'Nieprawidłowe dane' });
  res.on('finish', () => { if (req.method !== 'GET' && res.statusCode < 300) contentStore.save(); });
  next();
});

app.post('/api/admin/login', adminAuth.login);
app.post('/api/admin/logout', adminAuth.logout);
app.get('/api/admin/session', (req, res) => res.json({ isAdmin: !!req.session?.isAdmin }));

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
  saveLeaderboard();
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

// ─── KASYNO API (casino/http.js) ───────────────────────────────
casinoHttp.mount(app, io);

// ─── SOCKET ────────────────────────────────────────────────────
// Wstrzyknij sesję do socketów (po inicjalizacji session middleware)
setImmediate(() => {
  if (_sessionMiddleware) {
    io.use((socket, next) => {
      _sessionMiddleware(socket.request, socket.request.res || {}, next);
    });
    io.use((socket, next) => {
      socket.discordUser = socket.request.session?.discordUser || null;
      // Helper: odczytaj świeżo z sesji (na wypadek gdyby login nastąpił po połączeniu)
      socket.getDiscordUser = () => socket.request.session?.discordUser || socket.discordUser || null;
      next();
    });
  }
});

io.on('connection', (socket) => {

  // Helper: zarejestruj gracza Discord w mapie online
  function registerOnlineUser(u) {
    if (!u || !u.id) return;
    // Jeden gracz = jeden wpis (usuń stare sockety tego samego gracza)
    for (const [sid, data] of onlineDiscord) {
      if (data.id === u.id && sid !== socket.id) onlineDiscord.delete(sid);
    }
    if (!onlineDiscord.has(socket.id)) {
      const avatarUrl = u.avatar
        ? (u.avatar.startsWith('http') ? u.avatar : `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`)
        : null;
      onlineDiscord.set(socket.id, {
        id: u.id, username: u.username,
        globalName: u.globalName || u.username,
        avatar: avatarUrl, connectedAt: Date.now(),
        room: null, casino: null,
      });
    }
  }

  // Zarejestruj od razu jeśli sesja zawiera discordUser (zalogowany przez Discord)
  const sessionUser = socket.request.session?.discordUser;
  if (sessionUser) registerOnlineUser(sessionUser);

  // Event wysyłany z frontendu po uzyskaniu socketToken
  socket.on('registerOnline', (data) => {
    const u = (data && data.socketToken && socketTokens.has(data.socketToken))
      ? socketTokens.get(data.socketToken)
      : socket.request.session?.discordUser;
    if (u) registerOnlineUser(u);
  });

  // Helper: pobierz discordUser z tokenu lub sesji
  socket.getDiscordUser = (data) => {
    if (data?.socketToken && socketTokens.has(data.socketToken)) {
      const u = socketTokens.get(data.socketToken);
      registerOnlineUser(u);
      return u;
    }
    return socket.request.session?.discordUser || socket.discordUser || null;
  };

  // casinoObserveTable: rejestracja online-map obsługiwana w głównym handlerze poniżej

  socket.on('createRoom', ({ gameType, playerName, isGameMaster, config }) => {
    if (!GAMES[gameType]) return socket.emit('error', { message: `Nieznana gra: ${gameType}` });
    let roomId;
    do { roomId = Math.random().toString(36).substring(2, 7).toUpperCase(); } while (rooms[roomId]);
    rooms[roomId] = createRoom(roomId, gameType, socket.id, playerName, isGameMaster, config || {});
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, room: rooms[roomId] });
    if (onlineDiscord.has(socket.id)) onlineDiscord.get(socket.id).room = roomId;
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

    // Tournament match: player may already be pre-added to room.players
    const alreadyIn = room.players.find(p => p.id === socket.id);
    if (alreadyIn) {
      socket.join(roomId);
      socket.emit('roomJoined', { roomId, room });
      io.to(roomId).emit('playerJoined', { room });
      if (onlineDiscord.has(socket.id)) onlineDiscord.get(socket.id).room = roomId;
      return;
    }

    if (room.status !== 'waiting') return socket.emit('error', { message: 'Gra już trwa!' });
    // Use configured maxPlayers if set, otherwise fall back to game meta
    const max = Number(room.config?.maxPlayers) || GAMES[room.gameType]?.meta?.maxPlayers || 8;
    if (room.players.length >= max) return socket.emit('error', { message: `Pokój jest pełny! (max ${max})` });
    room.players.push({ id: socket.id, name: playerName, score: 0 });
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, room });
    io.to(roomId).emit('playerJoined', { room });
    if (onlineDiscord.has(socket.id)) onlineDiscord.get(socket.id).room = roomId;
  });

  socket.on('startGame', ({ roomId, customWord }) => {
    const room = rooms[roomId]; if (!room) return;
    if (room.hostId !== socket.id && room.gameMasterId !== socket.id) return;
    const min = GAMES[room.gameType]?.meta?.minPlayers || 1;
    if (room.players.length < min) return socket.emit('error', { message: `Potrzeba min. ${min} graczy!` });
    room.status = 'playing';
    // Zapisz content w pokoju żeby moduły mogły go używać (np. Jeopardy)
    room._content = CONTENT[room.gameType] || {};
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
    'highlowChoose','highlowGuess',
    'pincrackerChoose','pincrackerGuess',
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
      const moves = chessmod.getLegalMoves(gs.board, from.r, from.c, gs.enPassantSquare, gs.castlingRights);
      socket.emit('chessLegalMoves', { moves });
    } catch(e) {
      socket.emit('chessLegalMoves', { moves: [] });
    }
  });

  // ── CHESS: promotion choice ──
  socket.on('chessPromotion', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'playing') return;
    const mod = GAMES[room.gameType];
    if (mod?.onEvent) mod.onEvent({ event: 'chessPromotion', data, socket, room, io, helpers: makeHelpers(data.roomId) });
  });


  socket.on('playAgain', ({ roomId }) => {
    const room = rooms[roomId];
    // FIX #9: Pozwol rowniez GM na restart gry (wczesniej tylko hostId mogl to zrobic)
    if (!room || (room.hostId !== socket.id && room.gameMasterId !== socket.id)) return;
    // FIX #8: Wyczysc timery przed resetem pokoju
    if (room.gameState?.questionTimer) clearTimeout(room.gameState.questionTimer);
    if (room.gameState?.roundTimer)    clearTimeout(room.gameState.roundTimer);
    // Uzyj hostName z pierwszego gracza, lub gameMasterName jesli pokój GM
    const hostName = room.isGameMaster ? (room.gameMasterName || '') : (room.players[0]?.name || '');
    const nr = createRoom(roomId, room.gameType, room.hostId, hostName, room.isGameMaster, room.config);
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

  // ── KASYNO (casino/sockets.js) ──
  casinoSockets.register(socket, io, {
    onObserve: (s, table) => { if (onlineDiscord.has(s.id)) onlineDiscord.get(s.id).casino = table.name; },
  });

  // ════════════════════════════════════════════════════════════
  //  TURNIEJ — socket handlers
  // ════════════════════════════════════════════════════════════

  socket.on('tournamentGetList', () => {
    socket.emit('tournamentList', tm.list());
  });

  socket.on('tournamentCreate', ({ playerName }) => {
    const t = tm.create({ hostId: socket.id, hostName: playerName });
    socket.join('t:' + t.id);
    socket.emit('tournamentCreated', { tournament: t });
    io.emit('tournamentList', tm.list());
  });

  socket.on('tournamentJoin', ({ tournamentId, playerName }) => {
    const res = tm.join(tournamentId, socket.id, playerName);
    if (res.error) return socket.emit('tournamentError', { message: res.error });
    socket.join('t:' + tournamentId);
    socket.emit('tournamentJoined', { tournament: res.tournament });
    io.to('t:' + tournamentId).emit('tournamentUpdate', { tournament: res.tournament });
    io.emit('tournamentList', tm.list());
  });

  socket.on('tournamentLeave', ({ tournamentId }) => {
    const t = tm.tournaments[tournamentId];
    const wasHost = t && t.hostId === socket.id;
    const upd = tm.leave(tournamentId, socket.id);
    socket.leave('t:' + tournamentId);
    if (upd) {
      io.to('t:' + tournamentId).emit('tournamentUpdate', { tournament: upd });
      if (wasHost && upd.players.length > 0) {
        // Notify new host
        io.to('t:' + tournamentId).emit('tournamentHostChanged', { newHostId: upd.hostId });
      }
      io.emit('tournamentList', tm.list());
    }
  });

  socket.on('tournamentSetAdvancers', ({ tournamentId, count }) => {
    const t = tm.tournaments[tournamentId];
    if (!t || t.hostId !== socket.id) return;
    const upd = tm.setAdvancers(tournamentId, count);
    if (upd) {
      io.to('t:' + tournamentId).emit('tournamentUpdate', { tournament: upd });
      io.emit('tournamentList', tm.list());
    }
  });

  socket.on('tournamentStart', ({ tournamentId }) => {
    const t = tm.tournaments[tournamentId];
    if (!t || t.hostId !== socket.id) return socket.emit('tournamentError', { message: 'Tylko host może startować' });
    const res = tm.startGroup(tournamentId);
    if (res.error) return socket.emit('tournamentError', { message: res.error });
    io.to('t:' + tournamentId).emit('tournamentUpdate', { tournament: res.tournament });
    // Poinformuj graczy o wyborze gry przez hosta
    io.to('t:' + tournamentId).emit('tournamentPickGame', {
      tournament: res.tournament,
      match: res.tournament.matches[0],
    });
  });

  socket.on('tournamentPickGame', ({ tournamentId, gameType }) => {
    const t = tm.tournaments[tournamentId];
    if (!t || t.hostId !== socket.id) return socket.emit('tournamentError', { message: 'Tylko host wybiera grę' });
    if (!GAMES[gameType]) return socket.emit('tournamentError', { message: 'Nieznana gra' });
    const res = tm.pickGame(tournamentId, gameType);
    if (res.error) return socket.emit('tournamentError', { message: res.error });

    const match = res.match;
    const tt = tm.tournaments[tournamentId];

    // Utwórz pokój dla tego meczu
    let roomId;
    do { roomId = Math.random().toString(36).substring(2,7).toUpperCase(); } while (rooms[roomId]);

    const cfg = { rounds: 1, _tournamentId: tournamentId, _matchId: match.id };
    rooms[roomId] = createRoom(roomId, gameType, match.p1.id, match.p1.name, false, cfg);
    // Dodaj p2 jako gracza
    rooms[roomId].players.push({ id: match.p2.id, name: match.p2.name, score: 0 });
    rooms[roomId].status = 'waiting';
    rooms[roomId]._tournamentMatchId = match.id;
    rooms[roomId]._tournamentId = tournamentId;

    tm.attachRoom(tournamentId, match.id, roomId);

    // Powiadom graczy turnieju
    io.to('t:' + tournamentId).emit('tournamentUpdate', { tournament: res.tournament });
    io.to('t:' + tournamentId).emit('tournamentMatchReady', {
      tournament: res.tournament,
      match,
      roomId,
    });

    // Auto-start the tournament match room after both players join (max 5s wait)
    let startAttempts = 0;
    const tryAutoStart = setInterval(() => {
      const r = rooms[roomId];
      startAttempts++;
      if (!r) { clearInterval(tryAutoStart); return; }
      if (r.players.length >= 2 || startAttempts >= 10) {
        clearInterval(tryAutoStart);
        if (r && r.players.length >= 2 && r.status === 'waiting') {
          r.status = 'playing';
          r._content = CONTENT[r.gameType] || {};
          const mod = GAMES[r.gameType];
          if (mod?.onStart) mod.onStart({ room: r, content: r._content, io, helpers: makeHelpers(roomId) });
        }
      }
    }, 500);
  });

  socket.on('tournamentGet', ({ tournamentId }) => {
    const t = tm.get(tournamentId);
    if (t) socket.emit('tournamentUpdate', { tournament: t });
  });

  socket.on('disconnect', () => {
    onlineDiscord.delete(socket.id);

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
        if (room.players.length === 0 && room.gameMasterId !== socket.id) {
          // FIX #8: Wyczyść timery quizu/wordrace przed usunięciem pokoju
          if (room.gameState?.questionTimer) clearTimeout(room.gameState.questionTimer);
          if (room.gameState?.roundTimer)    clearTimeout(room.gameState.roundTimer);
          delete rooms[roomId];
          continue;
        }
        if (room.hostId === socket.id && room.players[0]) room.hostId = room.players[0].id;

        // FIX #18: Jeśli gracz rozłączył się w środku gry turowej — przekaż turę dalej
        // Dotyczy: hangman, tictactoe, familyfeud, jeopardy, kalambury
        if (room.status === 'playing' && room.gameState) {
          const gs = room.gameState;
          const sid = socket.id;

          // Hangman / TicTacToe: currentTurn
          if (gs.currentTurn === sid) {
            if (room.gameType === 'tictactoe') {
              // TicTacToe: tylko 2 graczy — jeśli jeden odchodzi, gra nie ma sensu
              room.status = 'finished';
              const remaining = room.players[0];
              const sorted = remaining ? [{ ...remaining, score: 1 }] : [];
              io.to(roomId).emit('gameOver', { room, sorted, reason: 'Przeciwnik opuścił grę' });
            } else {
              // Hangman: wyczyść timer rundy (zapobiega podwójnemu startowi rundy)
              if (gs.roundTimer) { clearTimeout(gs.roundTimer); gs.roundTimer = null; }
              // Przekaż turę do następnego aktywnego gracza
              const active = room.players.filter(p => !gs.playerEliminated?.[p.id]);
              gs.currentTurn = active[0]?.id || null;
              io.to(roomId).emit('letterGuessed', {
                room, letter: null, correct: false,
                mask: gs.word ? gs.word.split('').map(l => (gs.guessed||[]).includes(l) ? l : '_').join(' ') : '',
                currentTurn: gs.currentTurn,
                playerLives: gs.playerLives,
                playerEliminated: gs.playerEliminated,
              });
            }
          }

          // FamilyFeud: currentResponder
          if (gs.currentResponder === sid) {
            const active = room.players.filter(p => !gs.playerEliminated?.[p.id]);
            if (active.length === 0) {
              // Wszyscy odeszli — przejdź do następnego pytania
              const mod = GAMES[room.gameType];
              if (mod?.onEvent) mod.onEvent({ event: 'familyFeudAnswer', data: { answer: '__skip__' }, socket, room, io });
            } else {
              const curIdx = active.findIndex(p => p.id === gs.currentResponder);
              gs.responderIndex = Math.min(curIdx >= 0 ? curIdx : 0, active.length - 1);
              gs.currentResponder = active[gs.responderIndex % active.length]?.id;
              io.to(roomId).emit('familyFeudNextResponder', {
                currentResponder: gs.currentResponder,
                responderName: active[gs.responderIndex % active.length]?.name,
                playerStrikes: gs.playerStrikes,
                playerEliminated: gs.playerEliminated,
              });
            }
          }

          // Jeopardy: currentPicker odszedł w fazie 'pick' — przekaż losowo
          if (gs.phase === 'pick' && gs.currentPicker === sid) {
            const next = room.players[gs.pickerIndex % Math.max(room.players.length, 1)];
            gs.currentPicker = next?.id || room.players[0]?.id;
            io.to(roomId).emit('jeopardyBoard', { board: gs.board, currentPicker: gs.currentPicker, phase: gs.phase, room });
          }

          // Kalambury: rysujący gracz odszedł — zakończ rundę natychmiast
          if (gs.currentDrawer === sid) {
            clearTimeout(gs.roundTimer);
            io.to(roomId).emit('kalamburyReveal', { word: gs.currentWord, room });
            setTimeout(() => {
              if (!rooms[roomId]) return;
              gs.currentRound++;
              gs.drawerIndex = (gs.drawerIndex + 1) % Math.max(room.players.length, 1);
              // Zakończ grę jeśli koniec rund LUB za mało graczy (sprawdzenie po usunięciu gracza)
              if (gs.currentRound >= gs.totalRounds || room.players.length < 2) {
                room.status = 'finished';
                const sorted = [...room.players].sort((a, b) => b.score - a.score);
                io.to(roomId).emit('gameOver', { room, sorted,
                  ...(room.players.length < 2 ? { reason: 'Za mało graczy' } : {})
                });
              } else {
                const mod = GAMES['kalambury'];
                if (mod?.onStart) {
                  io.to(roomId).emit('kalamburyRound', {
                    roundIndex: gs.currentRound,
                    total: gs.totalRounds,
                    drawerId: room.players[gs.drawerIndex % room.players.length]?.id,
                    drawerName: room.players[gs.drawerIndex % room.players.length]?.name,
                    roundTime: Number(room.config?.roundTime) || 60,
                    room,
                  });
                  gs.currentDrawer = room.players[gs.drawerIndex % room.players.length]?.id;
                  gs.currentWord = gs.words?.[gs.wordIndex % (gs.words?.length || 1)];
                  gs.wordIndex = (gs.wordIndex || 0) + 1;
                  gs.guessedPlayers = [];
                  gs.phase = 'guess';
                  if (gs.currentDrawer) {
                    io.to(gs.currentDrawer).emit('kalamburyYourWord', { word: gs.currentWord });
                  }
                  gs.roundTimer = setTimeout(() => {
                    if (!rooms[roomId]) return;
                    io.to(roomId).emit('kalamburyReveal', { word: gs.currentWord, room });
                    setTimeout(() => {
                      if (!rooms[roomId]) return;
                      gs.currentRound++;
                      gs.drawerIndex = (gs.drawerIndex + 1) % Math.max(room.players.length, 1);
                      if (gs.currentRound >= gs.totalRounds || room.players.length < 2) {
                        room.status = 'finished';
                        const sorted2 = [...room.players].sort((a, b) => b.score - a.score);
                        io.to(roomId).emit('gameOver', { room, sorted: sorted2,
                          ...(room.players.length < 2 ? { reason: 'Za mało graczy' } : {})
                        });
                      }
                    }, 4000);
                  }, (Number(room.config?.roundTime) || 60) * 1000);
                }
              }
            }, 3000);
          }
        }

        io.to(roomId).emit('playerLeft', { room, playerName: name });
        io.to(roomId).emit('chatMessage', { name: '🔔 System', message: `${name} opuścił grę`, isSystem: true, time: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) });
      } else if (room.gameMasterId === socket.id) {
        // FIX #8: Wyczyść timery też przy usunięciu pokoju przez GM
        if (room.gameState?.questionTimer) clearTimeout(room.gameState.questionTimer);
        if (room.gameState?.roundTimer)    clearTimeout(room.gameState.roundTimer);
        io.to(roomId).emit('playerLeft', { room, playerName: room.gameMasterName + ' (GM)' });
        delete rooms[roomId];
      }
    }
  });
});


// ── TURNIEJ: przechwytuj gameOver z meczów turniejowych ────────
// Przechwytuje gameOver z meczów turniejowych
function checkTournamentGameOver(roomId, sorted) {
  const room = rooms[roomId];
  if (!room || !room._tournamentId || !room._tournamentMatchId) return;
  const tournamentId = room._tournamentId;
  const matchId      = room._tournamentMatchId;
  const winnerId     = sorted?.[0]?.id;
  if (!winnerId) return;

  const res = tm.recordResult(tournamentId, matchId, winnerId);
  if (!res || res.error) return;

  io.to('t:' + tournamentId).emit('tournamentUpdate', { tournament: res.tournament });

  if (res.tournamentDone) {
    io.to('t:' + tournamentId).emit('tournamentFinished', { tournament: res.tournament });
    return;
  }
  if (res.phaseChange === 'playoff') {
    io.to('t:' + tournamentId).emit('tournamentPhaseChange', {
      phase: 'playoff',
      advancers: res.advancers,
      tournament: res.tournament,
    });
  }
  // Następny mecz — host musi wybrać grę
  if (res.tournament.currentMatchId) {
    const nextMatch = res.tournament.matches.find(m => m.id === res.tournament.currentMatchId);
    io.to('t:' + tournamentId).emit('tournamentPickGame', {
      tournament: res.tournament,
      match: nextMatch,
    });
  }
}


// ── Patch io: intercept gameOver for tournament tracking ───────
(function patchIoForTournament() {
  const _origTo = io.to.bind(io);
  io.to = function(roomId) {
    const socket = _origTo(roomId);
    const _origEmit = socket.emit.bind(socket);
    socket.emit = function(event, ...args) {
      if (event === 'gameOver') {
        const sorted = args[0]?.sorted;
        // Use setImmediate so the original emit fires first
        setImmediate(() => checkTournamentGameOver(roomId, sorted));
      }
      return _origEmit(event, ...args);
    };
    return socket;
  };
})();

// FIX #3: Patch hangman — zapis wynikow do leaderboardu po zakonczeniu gry
// Usunieto martwy kod (origEmit, patchedIo, origTo) — nigdy nie byl uzywany
if (GAMES.hangman) {
  const origOnEvent = GAMES.hangman.onEvent.bind(GAMES.hangman);
  GAMES.hangman.onEvent = function(ctx) {
    const { room } = ctx;
    origOnEvent(ctx);
    // Zapisz wyniki dokladnie raz po zakonczeniu gry
    if (room.status === 'finished' && room._lbRecorded !== room.id + room.players.map(p=>p.score).join()) {
      room._lbRecorded = room.id + room.players.map(p=>p.score).join();
      room.players.forEach(p => recordScore('hangman', p.name, p.score, { category: room.config?.category, difficulty: room.config?.difficulty }));
    }
  };
}
