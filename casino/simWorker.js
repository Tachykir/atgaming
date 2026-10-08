/**
 * Symulacja RTP automatu w osobnym wątku (nie blokuje serwera).
 * workerData: { game, spins, scale, factors? }
 */
'use strict';
const { parentPort, workerData } = require('worker_threads');
const { SLOTS } = require('./games');
const E = require('../games/casino/slot_engine');

const { game, spins, scale, factors, precise } = workerData;
const m = SLOTS[game];
const t0 = Date.now();
if (precise) {
  // Paczki po `spins`, aż błąd standardowy RTP < 1% (maks. 4 mln spinów) — do korekty RTP po zmianie szans symboli
  let n = 0, sum = 0, sq = 0, hit = 0, max = 0, k = 0;
  do {
    const r = E.simulate(m.def, spins, 1000, m.autoBonus, factors || null);
    k++; n += spins; sum += r.rtp; sq += r.sd * r.sd; hit += r.hitRate; max = Math.max(max, r.maxMult);
    var rtp = sum / k, se = Math.sqrt(sq / k) / Math.sqrt(n);
  } while (se / Math.max(rtp, 0.01) > 0.01 && n < 4_000_000);
  parentPort.postMessage({ game, spins: n, baseRtp: rtp, rtp: rtp * scale, se, hitRate: hit / k, maxMult: max * scale, ms: Date.now() - t0 });
} else {
  const r = E.simulate(m.def, spins, 1000, m.autoBonus, factors || null);
  parentPort.postMessage({ game, spins, baseRtp: r.rtp, rtp: r.rtp * scale, hitRate: r.hitRate, maxMult: r.maxMult * scale, ms: Date.now() - t0 });
}
