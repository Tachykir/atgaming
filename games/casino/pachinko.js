/**
 * PACHINKO (Plinko) — AT Gaming Casino
 * Kulka spada przez N rzędów kołków; w każdym rzędzie odbija się w lewo/prawo (50/50).
 * Pole końcowe = liczba odbić w prawo → rozkład dwumianowy, RTP liczone dokładnie (~96%).
 * Poziomy ryzyka: low (8 rzędów), medium (12), high (16).
 */
'use strict';

const RISK_CONFIGS = {
  low:    { rows: 8,  mults: [5.6, 2.1, 1.1, 1, 0.4, 1, 1.1, 2.1, 5.6] },
  medium: { rows: 12, mults: [33, 11, 4, 2, 1.1, 0.6, 0.17, 0.6, 1.1, 2, 4, 11, 33] },
  high:   { rows: 16, mults: [1000, 130, 26, 9, 4, 2, 0.16, 0.16, 0.16, 0.16, 0.16, 2, 4, 9, 26, 130, 1000] },
};
const MAX_BALLS = 10;

function rtpOf(cfg) {
  const n = cfg.rows;
  const C = k => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
  return cfg.mults.reduce((s, m, i) => s + m * C(i) / 2 ** n, 0);
}

// Mnożniki przeskalowane do docelowego RTP ustawionego w panelu admina
function riskConfigs(scale = 1) {
  const out = {};
  for (const [k, rc] of Object.entries(RISK_CONFIGS))
    out[k] = { rows: rc.rows, mults: rc.mults.map(m => Math.round(m * scale * 100) / 100) };
  return out;
}

function dropBall(rows) {
  const path = [];
  let pos = 0;
  for (let r = 0; r < rows; r++) {
    const right = Math.random() < 0.5;
    if (right) pos++;
    path.push(right ? 'R' : 'L');
  }
  return { path, slot: pos };
}

function registerHandlers(socket, io, casino) {
  socket.on('casinoPachinkoDrop', async (data) => {
    const table = casino.casinoTables[data?.tableId];
    if (!table || table.game !== 'pachinko') return socket.emit('casinoError', { message: 'Zły stół' });
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError', { message: 'Wymagane logowanie Discord!' });

    const cfg = table.config;
    const risk = RISK_CONFIGS[data.risk] ? data.risk : 'medium';
    const rc = riskConfigs(casino.rtp ? casino.rtp.scale('pachinko') : 1)[risk];
    const bet = Math.floor(Number(data.bet) || 0);
    const balls = Math.max(1, Math.min(MAX_BALLS, Math.floor(Number(data.balls) || 1)));
    if (bet < cfg.minBet || bet > cfg.maxBet)
      return socket.emit('casinoError', { message: `Stawka musi być w zakresie ${cfg.minBet.toLocaleString('pl-PL')}–${cfg.maxBet.toLocaleString('pl-PL')} AT$` });

    await casino.exclusive('pachinko:' + discordUser.id, async () => {
      await casino.ensureWallet(discordUser);
      const total = bet * balls;
      if (await casino.debit(discordUser.id, total) === null) return socket.emit('casinoError', { message: 'Za mało AT$!' });
      const results = [];
      let winAmount = 0;
      for (let i = 0; i < balls; i++) {
        const { path, slot } = dropBall(rc.rows);
        const mult = rc.mults[slot];
        const win = Math.floor(bet * mult);
        winAmount += win;
        results.push({ path, slot, mult, win });
      }
      if (winAmount > 0) await casino.updateBalance(discordUser.id, winAmount);
      casino.tracker?.track('pachinko', { wagered: total, returned: winAmount, rounds: balls });
      await casino.recordGame(discordUser.id);
      await casino.updateSlotStats(discordUser.id, 'pachinko', { spins: balls, spent: total, won: winAmount, bestWin: Math.max(...results.map(r => r.win)) });
      const balance = (await casino.getWallet(discordUser.id))?.balance ?? 0;
      socket.emit('casinoPachinkoResult', { risk, rows: rc.rows, mults: rc.mults, bet, balls: results, totalBet: total, winAmount, net: winAmount - total, balance });
    });
  });
}

module.exports = { registerHandlers, RISK_CONFIGS, riskConfigs, rtpOf, MAX_BALLS };
