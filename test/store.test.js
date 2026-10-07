'use strict';
// Warstwa danych w trybie JSON (bez DATABASE_URL) — ta sama logika API co w PostgreSQL
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const FILE = path.join(os.tmpdir(), `atg-test-${process.pid}.json`);
process.env.CASINO_DATA_FILE = FILE;
delete process.env.DATABASE_URL;
const store = require('../casino/store');

test.before(() => store.init());
test.after(async () => { await store.close(); fs.rmSync(FILE, { force: true }); fs.rmSync(FILE + '.tmp', { force: true }); });

const user = id => ({ id, username: id, globalName: id, avatar: null });

test('nowy portfel dostaje saldo startowe', async () => {
  const w = await store.ensureWallet(user('u1'));
  assert.strictEqual(w.balance, store.START_BALANCE);
});

test('debit: brak środków = odmowa, saldo nie spada poniżej zera', async () => {
  await store.ensureWallet(user('u2'));
  assert.strictEqual(await store.debit('u2', store.START_BALANCE + 1), null);
  const results = await Promise.all(Array.from({ length: 30 }, () => store.debit('u2', 10_000)));
  const ok = results.filter(r => r !== null).length;
  assert.strictEqual(ok, 10);
  assert.strictEqual((await store.getWallet('u2')).balance, 0);
});

test('updateBalance dodaje wygraną', async () => {
  await store.ensureWallet(user('u3'));
  await store.debit('u3', 500);
  await store.updateBalance('u3', 1500);
  assert.strictEqual((await store.getWallet('u3')).balance, store.START_BALANCE + 1000);
});

test('ustawienia: zapis i odczyt', async () => {
  await store.setSetting('k', { a: 1 });
  assert.deepStrictEqual(await store.getSetting('k'), { a: 1 });
  assert.strictEqual(await store.getSetting('brak'), null);
});

test('sesje: zapis, odczyt, wygasanie', async () => {
  await store.sessionSet('s1', { user: 'x' }, Date.now() + 60_000);
  assert.deepStrictEqual(await store.sessionGet('s1'), { user: 'x' });
  await store.sessionSet('s2', { user: 'y' }, Date.now() - 1);
  assert.strictEqual(await store.sessionGet('s2'), null);
  await store.sessionDestroy('s1');
  assert.strictEqual(await store.sessionGet('s1'), null);
});

test('RTP: walidacja zakresu i skala', async () => {
  const rtp = require('../casino/rtp');
  await rtp.load();
  await assert.rejects(() => rtp.set('slots', 1.5));
  await assert.rejects(() => rtp.set('roulette', 0.9));
  await rtp.set('slots', 0.8);
  assert.ok(Math.abs(rtp.scale('slots') - 0.8 / 0.95) < 1e-9);
  await rtp.resetAll();
  assert.strictEqual(rtp.scale('slots'), 1);
});
