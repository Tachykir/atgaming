/**
 * Uwierzytelnianie panelu admina.
 *  - logowanie hasłem ustawia flagę w sesji (hasło nie jest już wysyłane z każdym żądaniem),
 *  - porównanie hasła odporne na timing, blokada IP po 5 nieudanych próbach (10 min),
 *  - w produkcji (NODE_ENV=production) bez ADMIN_PASSWORD panel jest wyłączony.
 *  Dla zgodności wstecznej żądania z polem `password` w body nadal są akceptowane.
 */
'use strict';
const crypto = require('crypto');

const { isProduction } = require('./env');
const PASSWORD = process.env.ADMIN_PASSWORD || (isProduction ? null : 'admin123');
if (!process.env.ADMIN_PASSWORD) {
  console.warn(PASSWORD
    ? '⚠️  ADMIN_PASSWORD nie jest ustawiony — używam domyślnego "admin123" (tylko dev!)'
    : '⚠️  ADMIN_PASSWORD nie jest ustawiony — panel admina WYŁĄCZONY (produkcja)');
}

const failures = new Map(); // ip → { count, until }
const MAX_FAILS = 5, LOCK_MS = 10 * 60_000;

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function passwordOk(pw) { return !!PASSWORD && typeof pw === 'string' && safeEqual(pw, PASSWORD); }
function ipOf(req) { return req.ip || req.socket?.remoteAddress || '?'; }

function isAdmin(req) {
  return !!req.session?.isAdmin || passwordOk(req.body?.password);
}

function login(req, res) {
  const ip = ipOf(req);
  const f = failures.get(ip);
  if (f && f.until > Date.now()) return res.status(429).json({ ok: false, error: 'Zbyt wiele prób — spróbuj za kilka minut' });
  if (!PASSWORD) return res.status(503).json({ ok: false, error: 'Panel admina jest wyłączony (brak ADMIN_PASSWORD)' });
  if (!passwordOk(req.body?.password)) {
    const n = (f?.count || 0) + 1;
    failures.set(ip, { count: n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    return res.status(401).json({ ok: false, error: 'Nieprawidłowe hasło' });
  }
  failures.delete(ip);
  if (req.session) {
    req.session.isAdmin = true;
    req.session.save?.(() => res.json({ ok: true }));
    if (!req.session.save) res.json({ ok: true });
  } else res.json({ ok: true });
}

function logout(req, res) {
  if (req.session) req.session.isAdmin = false;
  res.json({ ok: true });
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(403).json({ error: 'Brak dostępu' });
}

module.exports = { isAdmin, login, logout, requireAdmin };
