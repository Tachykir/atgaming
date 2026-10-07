/**
 * Serializacja pokoju gry dla klientów:
 *  - bez timerów (setTimeout/setInterval w stanie gry) — socket.io wpadało na nich w nieskończoną rekurencję,
 *  - bez danych prywatnych (_content, pola z "_") i tajnych pól stanu gry (hasła, odpowiedzi, PIN-y).
 */
'use strict';

// Serializacja pokoju bez timerów (setTimeout/setInterval w stanie gry) — inaczej socket.io
// wpada w nieskończoną rekurencję na cyklicznych obiektach Timeout i cały serwer pada
const TIMER_TYPES = new Set(['Timeout', 'Immediate']);
// Siatka bezpieczeństwa: timer wysłany w dowolnym obiekcie serializuje się jako nic
for (const t of [setTimeout(() => {}, 0), setImmediate(() => {})]) {
  const proto = Object.getPrototypeOf(t);
  if (!proto.toJSON) Object.defineProperty(proto, 'toJSON', { value() { return undefined; }, configurable: true });
  clearTimeout(t); clearImmediate(t);
}
function plainClone(v, seen = new WeakSet()) {
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (TIMER_TYPES.has(v.constructor?.name) || seen.has(v)) return undefined;
  seen.add(v);
  let out;
  if (Array.isArray(v)) out = v.map(x => plainClone(x, seen));
  else if (v instanceof Set) out = [...v].map(x => plainClone(x, seen));
  else if (v instanceof Map) out = Object.fromEntries([...v].map(([k, x]) => [k, plainClone(x, seen)]));
  else if (v instanceof Date || Buffer.isBuffer(v)) out = v;
  else { out = {}; for (const k of Object.keys(v)) { const c = plainClone(v[k], seen); if (c !== undefined) out[k] = c; } }
  seen.delete(v);
  return out;
}

// Tajne pola stanu gry — nigdy nie trafiają do klientów (hasła, odpowiedzi, PIN-y, ukryte liczby).
// Klienci dostają potrzebne im informacje osobnymi zdarzeniami.
const SECRET_STATE = {
  hangman: ['word', 'wordsUsed'], quiz: ['questions'], wordrace: ['rounds'], familyfeud: ['questions'],
  jeopardy: ['activeQuestion'], kalambury: ['currentWord', 'rounds', 'words'], pincracker: ['pins'], highlow: ['secrets'],
};
function publicRoom(room) {
  const out = {};
  for (const k of Object.keys(room)) if (!k.startsWith('_')) out[k] = room[k]; // _content itp. — dane wewnętrzne serwera
  const pub = plainClone(out);
  if (pub.gameState) {
    for (const f of SECRET_STATE[room.gameType] || []) delete pub.gameState[f];
    for (const k of Object.keys(pub.gameState)) if (k.startsWith('_')) delete pub.gameState[k];
  }
  if (pub.wl && pub.wl.phase !== 'reveal') delete pub.wl.targetZone; // Wavelength: cel ujawniany dopiero po rundzie
  return pub;
}

module.exports = { publicRoom, plainClone, SECRET_STATE };
