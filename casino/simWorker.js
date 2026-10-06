/**
 * Symulacja RTP automatu w osobnym wątku (nie blokuje serwera).
 * workerData: { game, spins, scale }
 */
'use strict';
const { parentPort, workerData } = require('worker_threads');
const { SLOTS } = require('./games');
const E = require('../games/casino/slot_engine');

const { game, spins, scale } = workerData;
const m = SLOTS[game];
const t0 = Date.now();
const r = E.simulate(m.def, spins, 1000, m.autoBonus);
parentPort.postMessage({ game, spins, baseRtp: r.rtp, rtp: r.rtp * scale, hitRate: r.hitRate, maxMult: r.maxMult * scale, ms: Date.now() - t0 });
