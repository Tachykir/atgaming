const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const fs       = require('fs');
const discordAuth  = require('./discord-auth');
const casino        = require('./casino');
const casinoPoker   = require('./games/casino/poker');
const casinoBJ      = require('./games/casino/blackjack');
const casinoSlots   = require('./games/casino/slots');
const casinoRoulette = require('./games/casino/roulette');
const casinoPachinko = require('./games/casino/pachinko');
const casinoCrash    = require('./games/casino/crash');
const casinoCoinflip = require('./games/casino/coinflip');
const casinoPath     = require('./games/casino/path_of_gambling');

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
    secret: process.env.SESSION_SECRET || 'atgaming-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: (process.env.DISCORD_REDIRECT_URI || '').startsWith('https'),
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };
  _sessionMiddleware = session(cfg);
  app.set('trust proxy', 1);
  app.use(_sessionMiddleware);
};
discordAuth.setupSession(app); // wywołujemy już nadpisaną wersję

app.use(express.static(path.join(__dirname, 'public')));

// ── DISCORD ROUTES ────────────────────────────────────────────
discordAuth.setupRoutes(app);

// Endpoint zwracający token do autoryzacji socketów
app.get('/auth/socket-token', (req, res) => {
  const user = req.session?.discordUser;
  if (!user) return res.status(401).json({ error: 'not logged in' });
  const token = createSocketToken(user);
  res.json({ token });
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  UWAGA: ADMIN_PASSWORD nie jest ustawiony w env! Używam domyślnego hasła "admin123" — zmień to w produkcji!');
}

// ─── LEADERBOARD (persystentny - zapisywany do pliku JSON) ───
// Structure: { gameId: [ { name, score, date, category, difficulty } ] }
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard_data.json');
const LEADERBOARD_MAX = 100; // max entries per game

let leaderboard = {};
try {
  if (fs.existsSync(LEADERBOARD_FILE)) {
    leaderboard = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
    console.log(`📊 Leaderboard wczytany (${Object.keys(leaderboard).length} gier)`);
  }
} catch(e) {
  console.error('Błąd wczytywania leaderboard:', e.message);
}

function saveLeaderboard() {
  try { fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2)); }
  catch(e) { console.error('Błąd zapisu leaderboard:', e.message); }
}

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
Object.values(casino.casinoTables).forEach(t => { t._casino = casino; });

// Zainicjuj bazę danych (PG lub JSON) i dopiero potem uruchom serwer
const PORT = process.env.PORT || 3000;
casino.init().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 Serwer działa na porcie ${PORT}\n`);
  });
  casino.scheduleWeeklyTopup(io);

  // Uruchom pętlę Crash dla stałego stołu
  const crashTable = Object.values(casino.casinoTables).find(t => t.game === 'crash');
  if (crashTable) {
    crashTable._casino = casino;
    crashTable.gameState = { phase: 'betting', bets: {}, currentMultiplier: 1.00, crashPoint: null, history: [], bettingTimeLeft: 5 };
    casinoCrash.startCrashLoop(crashTable, io, casino);
    console.log('🚀 Crash loop uruchomiony');
  }
}).catch(err => {
  console.error('Błąd inicjalizacji kasyna:', err);
  process.exit(1);
});

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
function adminCheck(password, res) {
  if (password !== ADMIN_PASSWORD) { res.status(403).json({ error: 'Brak dostępu' }); return false; }
  return true;
}

// FIX #7: Zwroc 401 przy zlym hasle zamiast 200 z ok:false
app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Nieprawidlowe haslo' });
  }
});

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

// ─── KASYNO API ────────────────────────────────────────────────
// Portfel gracza (wymaga zalogowania przez Discord)
app.get('/api/casino/wallet', async (req, res) => {
  const user = req.session?.discordUser;
  if (!user) return res.status(401).json({ error: 'Wymagane logowanie przez Discord' });
  const wallet = await casino.ensureWallet(user);
  res.json({ wallet, discordId: user.id });
});

// Statystyki slotów per gracz
app.get('/api/casino/slot-stats/:gameId', async (req, res) => {
  const user = req.session?.discordUser;
  if (!user) return res.status(401).json({ error: 'Wymagane logowanie przez Discord' });
  try {
    const stats = await casino.getSlotStats(user.id, req.params.gameId);
    res.json(stats);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Ranking AT$
app.get('/api/casino/leaderboard', async (req, res) => {
  res.json(await casino.getLeaderboard(50));
});

// Lista stołów
app.get('/api/casino/tables', (req, res) => {
  res.json(Object.values(casino.casinoTables).map(t => casino.getTablePublic(t)));
});

// Info o stole
app.get('/api/casino/tables/:tableId', (req, res) => {
  const t = casino.casinoTables[req.params.tableId];
  if (!t) return res.status(404).json({ error: 'Stół nie istnieje' });
  res.json(casino.getTablePublic(t));
});

// Utwórz nowy stół przez HTTP
app.post('/api/casino/tables', async (req, res) => {
  const user = req.session?.discordUser;
  if (!user) return res.status(401).json({ error: 'Wymagane logowanie Discord' });
  const { game, name, config } = req.body;
  if (!['poker','blackjack','coinflip'].includes(game)) return res.status(400).json({ error: 'Nieprawidłowy typ gry' });
  const safeName = String(name||'').trim().slice(0,40) || `Stół ${user.globalName||user.username}`;
  let cfg = {};
  if (game === 'poker') {
    cfg = { blindAmount:Math.max(5,Math.min(1000,Number(config?.blindAmount)||50)), minBuyIn:Math.max(100,Math.min(50000,Number(config?.minBuyIn)||1000)), maxBuyIn:Math.max(500,Math.min(100000,Number(config?.maxBuyIn)||5000)), maxPlayers:Math.max(2,Math.min(8,Number(config?.maxPlayers)||6)) };
    cfg.minBuyIn = Math.min(cfg.minBuyIn, cfg.maxBuyIn);
  } else if (game === 'coinflip') {
    // FIX #2: spójny domyślny minBet 50 (był 100 tutaj, 50 w socket handler)
    cfg = { minBet: Math.max(10, Number(config?.minBet)||50) };
  } else {
    cfg = { minBet:Math.max(10,Math.min(5000,Number(config?.minBet)||50)), maxBet:Math.max(50,Math.min(50000,Number(config?.maxBet)||500)), maxPlayers:Math.max(1,Math.min(7,Number(config?.maxPlayers)||5)) };
    cfg.minBet = Math.min(cfg.minBet, cfg.maxBet);
  }
  const table = casino.createTable({ game, name: safeName, config: cfg });
  table.createdBy = { id: user.id, name: user.globalName||user.username };
  table._casino = casino;
  if (game === 'coinflip') table.gameState = { challenges: {} };
  io.emit('casinoTablesUpdated');
  res.json({ table: casino.getTablePublic(table) });
});

// Usuń stół przez HTTP
app.delete('/api/casino/tables/:tableId', (req, res) => {
  const user = req.session?.discordUser;
  if (!user) return res.status(401).json({ error: 'Wymagane logowanie Discord' });
  const t = casino.casinoTables[req.params.tableId];
  if (!t) return res.status(404).json({ error: 'Stół nie istnieje' });
  if (t.createdBy?.id !== user.id) return res.status(403).json({ error: 'Brak uprawnień' });
  // FIX #17: Wyczyść timery countdown przed usunięciem stołu
  clearTimeout(casinoPoker.countdownTimers[req.params.tableId]);
  clearTimeout(casinoBJ.countdownTimers[req.params.tableId]);
  if (casino.deleteTable(req.params.tableId)) { io.emit('casinoTablesUpdated'); res.json({ ok: true }); }
  else res.status(400).json({ error: 'Nie można usunąć stołu z graczami' });
});

// Admin: ręczne doładowanie (test)
app.post('/api/admin/casino/topup', async (req, res) => {
  const { password } = req.body;
  if (!adminCheck(password, res)) return;
  const topped = await casino.runWeeklyTopup();
  res.json({ ok: true, count: topped.length, players: topped });
});

// Admin: ustaw saldo użytkownika
app.post('/api/admin/casino/set-balance', async (req, res) => {
  const { password, discordId, amount } = req.body;
  if (!adminCheck(password, res)) return;
  const newAmt = parseInt(amount);
  if (!discordId || isNaN(newAmt) || newAmt < 0) return res.status(400).json({ error: 'Nieprawidlowe dane' });
  try {
    const ok = await casino.adminSetBalance(discordId, newAmt);
    if (!ok) return res.status(404).json({ error: 'Portfel nie istnieje' });
    res.json({ ok: true, discordId, newBalance: newAmt });
  } catch(e) {
    console.error('set-balance error:', e);
    res.status(500).json({ error: 'Błąd bazy danych' });
  }
});

// Admin: pobierz stan portfeli (pg + json)
// FIX #6: Zmieniono z GET (haslo w URL/logach) na POST (haslo w body)
app.post('/api/admin/casino/wallets', async (req, res) => {
  const { password } = req.body;
  if (!adminCheck(password, res)) return;
  try {
    const wallets = await casino.getAllWallets();
    res.json(wallets);
  } catch(e) {
    console.error('getAllWallets error:', e);
    res.status(500).json({ error: 'Blad bazy danych' });
  }
});

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

  // Rejestruj kasyno-stół w online map
  socket.on('casinoObserveTable', (data) => {
    if (onlineDiscord.has(socket.id) && data?.tableId) {
      const tbl = casino.casinoTables[data.tableId];
      if (tbl) onlineDiscord.get(socket.id).casino = tbl.name;
    }
  });

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

  // ═══════════════════════════════════════════════════════════════
  //  KASYNO SOCKETY
  // ═══════════════════════════════════════════════════════════════

  // Pobierz portfel (klient musi być zalogowany przez Discord)
  socket.on('casinoGetWallet', async (data, cb) => {
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return (cb || (() => {}))({ error: 'Brak sesji Discord' });
    const wallet = await casino.ensureWallet(discordUser);
    (cb || (() => {}))({ wallet });
  });

  // Dołącz do stołu kasyna
  socket.on('casinoJoinTable', async (data) => {
    const { tableId, buyIn } = data;
    const table = casino.casinoTables[tableId];
    if (!table) return socket.emit('casinoError', { message: 'Stół nie istnieje' });

    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord, żeby grać!' });

    // Sprawdź czy już siedzi
    const already = table.players.find(p => p.socketId === socket.id || p.discordId === discordUser.id);
    if (already) return socket.emit('casinoError', { message: 'Już siedzisz przy tym stole' });

    // Sprawdź limit graczy
    if (table.players.length >= table.config.maxPlayers) {
      return socket.emit('casinoError', { message: 'Stół pełny!' });
    }

    // Sprawdź status stołu — można dołączyć tylko przy betting/open
    if (table.status === 'playing') {
      return socket.emit('casinoError', { message: 'Runda w toku — poczekaj na kolejną' });
    }

    const wallet = await casino.ensureWallet(discordUser);

    // Buy-in
    const cfg = table.config;
    const minBI = cfg.minBuyIn || cfg.minBet * 10;
    const maxBI = cfg.maxBuyIn || cfg.maxBet * 20;
    const actualBuyIn = Math.max(minBI, Math.min(maxBI, Number(buyIn) || minBI));

    if (wallet.balance < actualBuyIn) {
      return socket.emit('casinoError', { message: `Za mało AT$! Potrzebujesz ${actualBuyIn} AT$, masz ${wallet.balance}` });
    }

    // Pobierz buy-in z portfela
    await casino.updateBalance(discordUser.id, -actualBuyIn);

    const seatIndex = table.players.length;
    table.players.push({
      socketId:     socket.id,
      discordId:    discordUser.id,
      name:         discordUser.globalName || discordUser.username,
      avatar:       discordUser.avatar,
      sessionChips: actualBuyIn,
      seatIndex,
    });

    socket.join('casino:' + tableId);
    socket.casinoTableId = tableId;
    socket.discordId     = discordUser.id;

    socket.emit('casinoJoined', {
      tableId,
      sessionChips: actualBuyIn,
      walletBalance: wallet.balance - actualBuyIn,
    });

    // Wyemituj nowy stan stołu
    const engine = table.game === 'poker' ? casinoPoker : casinoBJ;
    engine.emitTableState(table, io);

    // Jeśli to drugi gracz przy pokerze i stół idle → start countdown
    if (table.game === 'poker' && table.players.length >= 2 && table.status === 'open' && !table.gameState) {
      casinoPoker.startCountdown(table, io, 10);
    }
    // BJ: uruchom okno zakładów jeśli brak aktywnej sesji
    if (table.game === 'blackjack' && table.status === 'open' && !table.gameState) {
      casinoBJ.startBettingWindow(table, io);
    }
  });

  // Obserwuj stół
  socket.on('casinoObserveTable', ({ tableId }) => {
    const table = casino.casinoTables[tableId];
    if (!table) return socket.emit('casinoError', { message: 'Stół nie istnieje' });
    socket.join('casino:' + tableId);
    table.observers = table.observers || [];
    if (!table.observers.includes(socket.id)) table.observers.push(socket.id);
    socket.casinoObserving = tableId;
    if (table.game === 'poker')    casinoPoker.emitTableState(table, io);
    else if (table.game === 'blackjack') casinoBJ.emitTableState(table, io);
    else if (table.game === 'roulette' && table.gameState) io.to('casino:'+tableId).emit('casinoRouletteState', table.gameState);
  });

  // Utwórz nowy stół (poker lub blackjack)
  socket.on('casinoCreateTable', async (data) => {
    const { game, name, config } = data;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError',{message:'Wymagane logowanie Discord!'});

    // FIX #8: VALID_GAMES spójne — crash jest stałym stołem, nie tworzonym przez graczy
    const VALID_GAMES = ['poker','blackjack','coinflip'];
    if (!VALID_GAMES.includes(game)) return socket.emit('casinoError',{message:'Nieprawidłowy typ gry'});

    const safeName = String(name||'').trim().slice(0,40) || `Stół ${discordUser.globalName||discordUser.username}`;

    // Sanitize config
    let cfg = {};
    if (game === 'poker') {
      cfg = {
        blindAmount: Math.max(5, Math.min(1000, Number(config?.blindAmount)||50)),
        minBuyIn:    Math.max(100, Math.min(50000, Number(config?.minBuyIn)||1000)),
        maxBuyIn:    Math.max(500, Math.min(100000, Number(config?.maxBuyIn)||5000)),
        maxPlayers:  Math.max(2, Math.min(8, Number(config?.maxPlayers)||6)),
      };
      cfg.minBuyIn = Math.min(cfg.minBuyIn, cfg.maxBuyIn);
    } else if (game === 'coinflip') {
      // FIX #2: spójny domyślny minBet (50) — był 50 tutaj, 100 w HTTP endpoincie
      cfg = { minBet: Math.max(10, Number(config?.minBet)||50) };
    } else {
      cfg = {
        minBet:    Math.max(10, Math.min(5000, Number(config?.minBet)||50)),
        maxBet:    Math.max(50, Math.min(50000, Number(config?.maxBet)||500)),
        maxPlayers: Math.max(1, Math.min(7, Number(config?.maxPlayers)||5)),
      };
      cfg.minBet = Math.min(cfg.minBet, cfg.maxBet);
    }

    const table = casino.createTable({ game, name: safeName, config: cfg });
    table.createdBy = { id: discordUser.id, name: discordUser.globalName||discordUser.username };
    // Inject casino ref
    table._casino = casino;

    // Inicjalizuj gameState dla coinflip
    if (game === 'coinflip') {
      table.gameState = { challenges: {} };
    }

    socket.emit('casinoTableCreated', { table: casino.getTablePublic(table) });
    io.emit('casinoTablesUpdated'); // sygnał żeby wszyscy odświeżyli lobby
  });

  // Usuń stół (tylko twórca lub jeśli pusty)
  socket.on('casinoDeleteTable', (data) => {
    const { tableId } = data;
    const table = casino.casinoTables[tableId];
    if (!table) return;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;
    if (table.createdBy?.id !== discordUser.id) return socket.emit('casinoError',{message:'Możesz usunąć tylko własny stół'});
    // FIX #17: Wyczyść timery countdown przed usunięciem stołu
    clearTimeout(casinoPoker.countdownTimers[tableId]);
    clearTimeout(casinoBJ.countdownTimers[tableId]);
    if (casino.deleteTable(tableId)) io.emit('casinoTablesUpdated');
    else socket.emit('casinoError',{message:'Nie można usunąć stołu z graczami'});
  });

  // Opuść stół
  socket.on('casinoLeaveTable', ({ tableId }) => {
    handleCasinoLeave(socket, tableId);
  });

  // Akcje Pokera
  const POKER_EVENTS = ['casinoPokerFold','casinoPokerCheck','casinoPokerCall','casinoPokerRaise'];
  POKER_EVENTS.forEach(event => {
    socket.on(event, (data) => {
      const tId  = data?.tableId || socket.casinoTableId;
      const table = casino.casinoTables[tId];
      if (!table || table.game !== 'poker') return;
      casinoPoker.handleAction(table, socket.id, event, data, io);
    });
  });

  // Akcje Blackjacka
  const BJ_EVENTS = ['casinoBJBet','casinoBJHit','casinoBJStand','casinoBJDouble'];
  BJ_EVENTS.forEach(event => {
    socket.on(event, (data) => {
      const tId  = data?.tableId || socket.casinoTableId;
      const table = casino.casinoTables[tId];
      if (!table || table.game !== 'blackjack') return;
      casinoBJ.handleAction(table, socket.id, event, data, io);
    });
  });

  // Akcje Slotów, Ruletki, Pachinko
  casinoSlots.registerHandlers(socket, io, casino);
  casinoRoulette.registerHandlers(socket, io, casino);
  casinoPachinko.registerHandlers(socket, io, casino);
  casinoCrash.registerHandlers(socket, io, casino);
  casinoCoinflip.registerHandlers(socket, io, casino);
  casinoPath.registerHandlers(socket, io, casino);

  // ── Pomocnik opuszczania stołu ──
  function handleCasinoLeave(socket, tableId) {
    const table = casino.casinoTables[tableId];
    if (!table) return;

    // Usuń z obserwatorów
    table.observers = (table.observers || []).filter(id => id !== socket.id);

    const idx = table.players.findIndex(p => p.socketId === socket.id);
    if (idx === -1) return;

    const player = table.players[idx];

    // FIX #5: Zwróć zakłady ruletki jeśli gracz rozłączył się podczas fazy betting
    if (table.game === 'roulette' && player.discordId) {
      const gs = table.gameState;
      if (gs && gs.phase === 'betting' && gs.bets[player.discordId]?.length > 0) {
        const refund = gs.bets[player.discordId].reduce((s, b) => s + b.amount, 0);
        if (refund > 0) {
          casino.updateBalance(player.discordId, refund).catch(() => {});
          delete gs.bets[player.discordId];
        }
      }
    }

    // FIX #11: Poker — auto-fold gracza który wychodzi w środku ręki
    // Bez tego gra się zawiesza gdy aktywny gracz rozłącza się (jego socketId zostaje w actingQueue)
    if (table.game === 'poker') {
      const gs = table.gameState;
      if (gs && table.status === 'playing') {
        const sid = socket.id;
        // Oznacz jako sfoldowanego i usuń z kolejki
        // Wyjątek: all-in gracze nie są foldowani — ich ręka gra się do końca
        if (gs.folded && !gs.folded[sid] && !gs.allIn?.[sid]) {
          gs.folded[sid] = true;
          gs.actingQueue = (gs.actingQueue || []).filter(id => id !== sid);
          // Jeśli to był aktywny gracz — przekaż ruch następnemu
          if (gs.actingPlayer === sid) {
            if (gs.actingQueue.length > 0) {
              gs.actingPlayer = gs.actingQueue[0];
            } else {
              // Wszyscy wyrównali lub wszyscy spasowali — przejdź do następnej fazy
              // Usuwamy gracza z table.players PRZED wywołaniem nextPhase via emitTableState
              table.players.splice(idx, 1);
              socket.leave('casino:' + tableId);
              socket.casinoTableId = null;
              if (player.discordId && player.sessionChips > 0) {
                casino.updateBalance(player.discordId, player.sessionChips).catch(() => {});
              }
              casinoPoker.handleAction(table, sid, 'casinoPokerFold', {}, io);
              return;
            }
          }
        }
      }
    }

    // FIX #12: Blackjack — advance turn jeśli rozłączający się gracz był aktywnym graczem
    if (table.game === 'blackjack') {
      const gs = table.gameState;
      if (gs && gs.phase === 'playing' && gs.actingPlayer === socket.id) {
        if (player.discordId && player.sessionChips > 0) {
          casino.updateBalance(player.discordId, player.sessionChips).catch(() => {});
        }
        table.players.splice(idx, 1);
        socket.leave('casino:' + tableId);
        socket.casinoTableId = null;
        // advanceTurn robi shift() który usuwa aktywnego gracza z kolejki i przekazuje turę
        casinoBJ.advanceTurn(table, io);
        return;
      }
    }

    // Oddaj pozostałe żetony do portfela (poker/blackjack)
    if (player.discordId && player.sessionChips > 0) {
      casino.updateBalance(player.discordId, player.sessionChips).catch(() => {});
    }

    table.players.splice(idx, 1);
    socket.leave('casino:' + tableId);
    socket.casinoTableId = null;

    if (table.game==='poker') casinoPoker.emitTableState(table, io);
    else if (table.game==='blackjack') casinoBJ.emitTableState(table, io);

    // Jeśli za mało graczy → zatrzymaj
    if (table.game === 'poker' && table.players.length < 2) {
      clearTimeout(casinoPoker.countdownTimers[tableId]);
      table.status = 'open';
      table.gameState = null;
      casinoPoker.emitTableState(table, io);
    }

    // FIX #4: Ruletka — wyczyść timer odliczania gdy stół opustoszeje
    // Bez tego setInterval działa w nieskonczonosc i tworzy nowe rundy mimo braku graczy
    if (table.game === 'roulette' && table.players.length === 0 && table.gameState) {
      clearInterval(table.gameState.timer);
      clearTimeout(table.gameState.spinTimer);
      table.status = 'open';
      table.gameState = null;
    }
  }

  socket.on('disconnect', () => {
    onlineDiscord.delete(socket.id);
    // ── KASYNO: zwróć żetony i opuść stół ──
    if (socket.casinoTableId) {
      handleCasinoLeave(socket, socket.casinoTableId);
    }
    if (socket.casinoObserving) {
      const t = casino.casinoTables[socket.casinoObserving];
      if (t) t.observers = (t.observers || []).filter(id => id !== socket.id);
    }

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
