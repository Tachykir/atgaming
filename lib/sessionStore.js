/**
 * Magazyn sesji express-session w bazie (PostgreSQL lub JSON — przez casino/store).
 * Dzięki temu restart / deploy serwera nie wylogowuje graczy.
 */
'use strict';
const session = require('express-session');
const store = require('../casino/store');

const DAY = 24 * 60 * 60 * 1000;
const expiry = sess => sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + DAY;
const cb = (fn, done) => Promise.resolve().then(() => store.whenReady()).then(fn).then(r => done?.(null, r), e => done?.(e));

class DbSessionStore extends session.Store {
  constructor() {
    super();
    // Sprzątanie wygasłych sesji co godzinę
    this.pruneTimer = setInterval(() => store.whenReady().then(store.pruneSessions).catch(() => {}), 60 * 60 * 1000);
    this.pruneTimer.unref?.();
  }
  get(sid, done) { cb(() => store.sessionGet(sid), done); }
  set(sid, sess, done) { cb(() => store.sessionSet(sid, sess, expiry(sess)), done); }
  touch(sid, sess, done) { cb(() => store.sessionTouch(sid, expiry(sess)), done); }
  destroy(sid, done) { cb(() => store.sessionDestroy(sid), done); }
}

module.exports = { DbSessionStore };
