'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { publicRoom } = require('../lib/roomSerialize');

test('pokój bez timerów i danych prywatnych', () => {
  const t = setTimeout(() => {}, 10_000);
  const room = { id: 'R', gameType: 'quiz', _content: { big: true }, players: [{ id: 'a' }], gameState: { currentQuestion: 1, questions: [{ correct: 2 }], questionTimer: t, _internal: 1 } };
  const pub = publicRoom(room);
  clearTimeout(t);
  assert.deepStrictEqual(pub, { id: 'R', gameType: 'quiz', players: [{ id: 'a' }], gameState: { currentQuestion: 1 } });
  assert.doesNotThrow(() => JSON.stringify(pub));
});

test('tajne pola różnych gier', () => {
  assert.strictEqual(publicRoom({ gameType: 'hangman', gameState: { word: 'kot', guessed: [] } }).gameState.word, undefined);
  assert.strictEqual(publicRoom({ gameType: 'pincracker', gameState: { pins: { a: '1234' } } }).gameState.pins, undefined);
  assert.strictEqual(publicRoom({ gameType: 'wavelength', wl: { phase: 'clue', targetZone: 40 } }).wl.targetZone, undefined);
  assert.strictEqual(publicRoom({ gameType: 'wavelength', wl: { phase: 'reveal', targetZone: 40 } }).wl.targetZone, 40);
});

test('cykliczne referencje nie wywracają serializacji', () => {
  const gs = { a: 1 }; gs.self = gs;
  assert.doesNotThrow(() => JSON.stringify(publicRoom({ gameType: 'chess', gameState: gs })));
});
