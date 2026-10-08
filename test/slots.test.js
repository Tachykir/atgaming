'use strict';
// RTP automatów z symulacji Monte Carlo — chroni przed przypadkowym rozkalibrowaniem gier
const test = require('node:test');
const assert = require('node:assert');
const E = require('../games/casino/slot_engine');
const { SLOTS } = require('../casino/games');
const rtp = require('../casino/rtp');

const SPINS = Number(process.env.RTP_SPINS) || 150_000;

for (const [id, m] of Object.entries(SLOTS)) {
  test(`RTP ${id} blisko wartości bazowej`, () => {
    const r = E.simulate(m.def, SPINS, 1000, m.autoBonus);
    const base = rtp.GAMES[id].base;
    // Margines statystyczny: 5 błędów standardowych (gry bardzo zmienne mają szerszy), min. ±0,05.
    // W dół szerzej: przy ciężkim ogonie (rzadkie ogromne wygrane) próbka bez trafienia ogona zaniża średnią
    // i niedoszacowuje odchylenie — to nie jest rozkalibrowanie.
    const se = r.sd / Math.sqrt(SPINS);
    const tolUp = Math.max(0.05, 5 * se), tolDown = Math.max(0.15, 7 * se);
    assert.ok(r.rtp - base < tolUp && base - r.rtp < tolDown, `${id}: RTP ${r.rtp.toFixed(4)} vs bazowe ${base} (+${tolUp.toFixed(3)} / −${tolDown.toFixed(3)})`);
    assert.ok(base > 0.93 && base < 0.97, `${id}: bazowe RTP ${base} poza zakresem kalibracji`);
    assert.ok(r.hitRate > 0.05 && r.hitRate < 0.9, `${id}: trafienia ${r.hitRate}`);
  });
}

test('getTier: progi wygranych', () => {
  assert.strictEqual(E.getTier(0).tier, 'none');
  assert.strictEqual(E.getTier(1).tier, 'win');
  assert.strictEqual(E.getTier(8).tier, 'mega');
  assert.strictEqual(E.getTier(300).tier, 'frito');
});

test('scaleMoney: skaluje tylko kwoty', () => {
  const out = E.scaleMoney({ payout: 100, grid: [[1, 2]], winLines: [{ win: 10, count: 3 }], progressiveJP: { mini: 50 }, fsSummary: { total: 10, win: 300 } }, 0.5);
  assert.deepStrictEqual(out, { payout: 50, grid: [[1, 2]], winLines: [{ win: 5, count: 3 }], progressiveJP: { mini: 25 }, fsSummary: { total: 10, win: 150 } });
});

test('evalLines: wild uzupełnia linię', () => {
  const syms = [{ p: [0, 0, 0, 5, 10, 20] }, { p: [0, 0, 0, 2, 4, 8] }, { wild: true, p: [0, 0, 0, 0, 0, 0] }];
  const grid = [[0], [2], [0], [1], [1]];
  const wins = E.evalLines(grid, [[0, 0, 0, 0, 0]], syms, 1);
  assert.strictEqual(wins.length, 1);
  assert.strictEqual(wins[0].count, 3);
  assert.strictEqual(wins[0].win, 5);
});

test('szanse symboli: mnożniki z panelu zmieniają losowanie tylko w kontekście gry', () => {
  const pick = E.symPicker([1, 1, 1]);
  const count = f => { const c = [0, 0, 0]; E.withSymFactors(f, () => { for (let i = 0; i < 30000; i++) c[pick()]++; }); return c; };
  const off = count([0, 1, 1]);
  assert.strictEqual(off[0], 0);
  const boosted = count([4, 1, 1]);
  assert.ok(boosted[0] / 30000 > 0.6 && boosted[0] / 30000 < 0.73, String(boosted));
  const plain = count(null);
  assert.ok(Math.abs(plain[0] / 30000 - 1 / 3) < 0.03);
  assert.ok(Math.abs(count([1, 1]).reduce((a, b) => a + b) - 30000) === 0);   // zła długość → ignorowane
});
