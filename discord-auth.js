const fs   = require('fs');
const path = require('path');
/**
 * ═══════════════════════════════════════════
 *  DISCORD OAUTH2 — AT Gaming
 * ═══════════════════════════════════════════
 *
 *  Wymagane zmienne środowiskowe (.env lub process.env):
 *    DISCORD_CLIENT_ID     – Client ID z discord.com/developers
 *    DISCORD_CLIENT_SECRET – Client Secret
 *    DISCORD_REDIRECT_URI  – np. http://localhost:3000/auth/discord/callback
 *    SESSION_SECRET        – dowolny tajny ciąg znaków
 */

const fetch        = require('node-fetch');
const session      = require('express-session');

const DISCORD_API  = 'https://discord.com/api/v10';
const SCOPES       = 'identify';   // tylko podstawowe dane: nick + avatar

// ── KONFIGURACJA ─────────────────────────────────────────────
function getConfig() {
  return {
    clientId:     process.env.DISCORD_CLIENT_ID     || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    redirectUri:  process.env.DISCORD_REDIRECT_URI  || 'http://localhost:3000/auth/discord/callback',
    sessionSecret: process.env.SESSION_SECRET       || 'atgaming-secret-change-me',
  };
}

// ── MIDDLEWARE ────────────────────────────────────────────────
// ── PROSTY FILE SESSION STORE (bez zewnętrznych deps) ───────────
// Sesje przeżywają restart serwera, zapisywane do sessions.json
const { Store } = require('express-session');

class FileSessionStore extends Store {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.sessions = {};
    try {
      if (fs.existsSync(filePath)) {
        this.sessions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // Usuń wygasłe sesje przy starcie
        const now = Date.now();
        for (const [id, sess] of Object.entries(this.sessions)) {
          if (sess.cookie?.expires && new Date(sess.cookie.expires).getTime() < now) {
            delete this.sessions[id];
          }
        }
      }
    } catch(e) { this.sessions = {}; }
  }
  _save() {
    try {
      // BigInt nie jest serializowalny przez JSON.stringify — konwertuj do string
      const safe = JSON.stringify(this.sessions, (k, v) => typeof v === 'bigint' ? v.toString() : v);
      fs.writeFileSync(this.filePath, safe);
    } catch(e) { console.error('Session save error:', e.message); }
  }
  get(sid, cb) {
    const sess = this.sessions[sid];
    if (!sess) return cb(null, null);
    if (sess.cookie?.expires && new Date(sess.cookie.expires).getTime() < Date.now()) {
      delete this.sessions[sid];
      this._save();
      return cb(null, null);
    }
    cb(null, sess);
  }
  set(sid, session, cb) {
    this.sessions[sid] = session;
    this._save();
    cb(null);
  }
  destroy(sid, cb) {
    delete this.sessions[sid];
    this._save();
    if (cb) cb(null);
  }
  all(cb) { cb(null, Object.values(this.sessions)); }
  length(cb) { cb(null, Object.keys(this.sessions).length); }
  clear(cb) { this.sessions = {}; this._save(); if (cb) cb(null); }
}

function setupSession(app) {
  const cfg = getConfig();
  const sessionsFile = path.join(__dirname, 'sessions.json');
  const store = new FileSessionStore(sessionsFile);

  // Na Railway/Heroku jest reverse proxy — trzeba mu ufać
  app.set('trust proxy', 1);
  app.use(session({
    secret: cfg.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      secure: cfg.redirectUri.startsWith('https'),  // true na produkcji HTTPS
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000,  // permanentna (10 lat)
    },
  }));
}

// ── ROUTES ────────────────────────────────────────────────────
function setupRoutes(app) {
  const cfg = getConfig();
  const enabled = !!(cfg.clientId && cfg.clientSecret);

  // Informacja czy Discord OAuth jest skonfigurowane
  app.get('/auth/discord/status', (req, res) => {
    res.json({
      enabled,
      user: req.session?.discordUser || null,
    });
  });

  if (!enabled) {
    app.get('/auth/discord', (req, res) => {
      res.redirect('/?error=discord_not_configured');
    });
    console.log('⚠️  Discord OAuth: brak DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET — wyłączono');
    return;
  }

  // Krok 1 — przekieruj do Discord
  app.get('/auth/discord', (req, res) => {
    const params = new URLSearchParams({
      client_id:     cfg.clientId,
      redirect_uri:  cfg.redirectUri,
      response_type: 'code',
      scope:         SCOPES,
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  // Krok 2 — callback z Discord
  app.get('/auth/discord/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error || !code) {
      return res.redirect('/?error=discord_denied');
    }

    try {
      // Wymień code na access_token
      const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type:    'authorization_code',
          code,
          redirect_uri:  cfg.redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        console.error('Discord token error:', tokenData);
        return res.redirect('/?error=discord_token');
      }

      // Pobierz dane użytkownika
      const userRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const user = await userRes.json();

      if (!user.id) {
        return res.redirect('/?error=discord_user');
      }

      // Zapisz w sesji
      req.session.discordUser = {
        id:            user.id,
        username:      user.username,
        globalName:    user.global_name || user.username,
        discriminator: user.discriminator,
        avatar:        user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`,
        accessToken:   tokenData.access_token,
      };

      // Przekieruj z powrotem z nickiem w URL (dla łatwej inicjalizacji)
      const nick = encodeURIComponent(user.global_name || user.username);
      res.redirect(`/?discord_login=1&nick=${nick}`);

    } catch (err) {
      console.error('Discord OAuth error:', err);
      res.redirect('/?error=discord_error');
    }
  });

  // Wylogowanie
  app.post('/auth/discord/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  console.log('✅ Discord OAuth2 skonfigurowano');
}

module.exports = { setupSession, setupRoutes };
