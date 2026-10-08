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
  await assert.rejects(() => rtp.set('slots', 2.5));
  await assert.rejects(() => rtp.set('roulette', 0.9));
  await rtp.set('slots', 0.8);
  assert.ok(Math.abs(rtp.scale('slots') - 0.8 / 0.95) < 1e-9);
  await rtp.resetAll();
  assert.strictEqual(rtp.scale('slots'), 1);
});

test('dzienny bonus: raz dziennie, seria rośnie', async () => {
  const progress = require('../casino/progress');
  await store.ensureWallet(user('d1'));
  const first = await progress.claimDaily('d1');
  assert.ok(first.ok);
  assert.strictEqual(first.amount, progress.DAILY[0]);
  assert.strictEqual(first.streak, 1);
  const again = await progress.claimDaily('d1');
  assert.ok(again.error);
  assert.strictEqual((await store.getWallet('d1')).balance, store.START_BALANCE + progress.DAILY[0]);
});

test('osiągnięcia: pierwsza wygrana i high roller przyznają nagrody raz', async () => {
  const progress = require('../casino/progress');
  await store.ensureWallet(user('a1'));
  await progress.recordRound('a1', { game: 'slots', bet: 100_000, win: 50, balance: 1 });
  await progress.recordRound('a1', { game: 'slots', bet: 100_000, win: 50, balance: 1 });
  const list = await progress.achievementsFor('a1');
  const on = list.filter(a => a.unlocked).map(a => a.id).sort();
  assert.deepStrictEqual(on, ['first_win', 'high_roller']);
  const reward = list.filter(a => a.unlocked).reduce((s, a) => s + a.reward, 0);
  assert.strictEqual((await store.getWallet('a1')).balance, store.START_BALANCE + reward);
  const hist = await progress.history('a1', 10);
  assert.ok(hist.some(h => h.kind === 'achievement'));
});

test('VIP: 1 XP za spin, progi 1000 / +500, mnożnik 1 + 0,01 × poziom', async () => {
  const progress = require('../casino/progress');
  assert.deepStrictEqual([1, 2, 3, 100].map(progress.vipTotal), [1000, 2500, 4500, 2_575_000]);
  assert.strictEqual(progress.vipLevel(999), 0);
  assert.strictEqual(progress.vipLevel(1000), 1);
  assert.strictEqual(progress.vipLevel(1e12), progress.VIP_MAX);
  assert.strictEqual(progress.vipStatus(2500).mult, 1.02);
  await store.ensureWallet(user('v1'));
  const events = [];
  progress.setIo({ to: () => ({ emit: (ev, d) => events.push([ev, d]) }) });
  for (let i = 0; i < 999; i++) await progress.recordRound('v1', { game: 'hot_777', bet: 10, win: 0, balance: 1, kind: i % 2 ? 'free' : 'round', history: false });
  await progress.recordRound('v1', { game: 'pachinko', bet: 10, win: 0, balance: 1 });   // nie automat — bez XP
  assert.strictEqual(await progress.vipMultFor('v1'), 1);
  await progress.recordRound('v1', { game: 'hot_777', bet: 10, win: 0, balance: 1, kind: 'round', history: false });
  assert.strictEqual(await progress.vipMultFor('v1'), 1.01);
  const ups = events.filter(([ev, d]) => ev === 'casinoVip' && d.levelUp);
  assert.strictEqual(ups.length, 1);
  assert.strictEqual(ups[0][1].level, 1);
  progress.setIo(null);
});
