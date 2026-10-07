'use strict';
const test = require('node:test');
const assert = require('node:assert');
const pachinko = require('../games/casino/pachinko');
const crash = require('../games/casino/crash');

test('Pachinko: RTP każdego poziomu ryzyka ≈ 96%', () => {
  for (const [risk, cfg] of Object.entries(pachinko.RISK_CONFIGS)) {
    const r = pachinko.rtpOf(cfg);
    assert.ok(r > 0.95 && r < 0.97, `${risk}: ${r}`);
  }
});

test('Pachinko: skalowanie mnożników zmienia RTP proporcjonalnie', () => {
  const scaled = pachinko.riskConfigs(0.8);
  for (const [risk, cfg] of Object.entries(scaled)) {
    const want = pachinko.rtpOf(pachinko.RISK_CONFIGS[risk]) * 0.8;
    assert.ok(Math.abs(pachinko.rtpOf(cfg) - want) < 0.01, risk);
  }
});

test('Crash: P(wybuch ≥ 2×) ≈ RTP / 2', () => {
  for (const target of [0.96, 0.8]) {
    let n = 0; const N = 200_000;
    for (let i = 0; i < N; i++) if (crash.generateCrashPoint(target) >= 2) n++;
    assert.ok(Math.abs(n / N - target / 2) < 0.01, `${target}: ${n / N}`);
  }
});
