/**
 * Trwałe obiekty aplikacji (leaderboard gier, treści z panelu admina) zapisywane
 * w tabeli ustawień bazy. Zapis odroczony (wiele zmian = jeden zapis), flushAll() przy zamykaniu.
 */
'use strict';
const store = require('../casino/store');

const all = [];

function persisted(key, getValue, { delay = 800 } = {}) {
  let timer = null, dirty = false;
  const flush = async () => {
    clearTimeout(timer); timer = null;
    if (!dirty) return;
    dirty = false;
    try { await store.setSetting(key, getValue()); }
    catch (e) { dirty = true; console.error(`Zapis "${key}" nieudany:`, e.message); }
  };
  const p = {
    key,
    async load() { await store.whenReady(); return store.getSetting(key); },
    save() { dirty = true; if (!timer) timer = setTimeout(flush, delay); },
    flush,
  };
  all.push(p);
  return p;
}

async function flushAll() { await Promise.all(all.map(p => p.flush())); }

module.exports = { persisted, flushAll };
