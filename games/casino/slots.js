/**
 * AUTOMATY (SLOTS) — AT Gaming Casino
 * Każdy gracz gra niezależnie (nie ma "stołu" wspólnego)
 * Wywołanie: socket.emit('casinoSlotsSpin', { tableId, bet })
 */
'use strict';

const SYMBOLS = ['🍒','🍋','🍊','🍇','⭐','💎','7️⃣','🔔'];
const WEIGHTS  = [30,  25,  20,  12,   7,   4,   2,   0.5]; // % szans
const TOTAL_W  = WEIGHTS.reduce((a,b)=>a+b,0);

// Mnożniki za trzy jednakie (lub specjalne układy)
const PAYOUTS = {
  '🍒🍒🍒': 2,
  '🍋🍋🍋': 3,
  '🍊🍊🍊': 4,
  '🍇🍇🍇': 6,
  '⭐⭐⭐': 10,
  '💎💎💎': 20,
  '7️⃣7️⃣7️⃣': 50,
  '🔔🔔🔔': 100,
  // Dwie jednakie = zwrot zakładu
  '__TWO__': 1,
  // Trzy różne = 0
};

function pickSymbol() {
  let r = Math.random() * TOTAL_W;
  for (let i=0; i<SYMBOLS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

function spin() {
  return [pickSymbol(), pickSymbol(), pickSymbol()];
}

function calcPayout(reels, bet) {
  const key = reels.join('');
  if (PAYOUTS[key]) return { multiplier: PAYOUTS[key], label: key };
  if (reels[0]===reels[1] || reels[1]===reels[2] || reels[0]===reels[2]) {
    return { multiplier: PAYOUTS['__TWO__'], label: 'dwie takie' };
  }
  return { multiplier: 0, label: 'pudło' };
}

function registerHandlers(socket, io, casino) {
  socket.on('casinoSlotsSpin', async (data) => {
    const { tableId, bet } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'slots') return socket.emit('casinoError',{message:'Zły stół'});

    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError',{message:'Musisz być zalogowany przez Discord!'});

    const betAmt = Math.max(table.config.minBet, Math.min(table.config.maxBet, Number(bet)||table.config.minBet));
    const wallet = await casino.ensureWallet(discordUser);
    if (wallet.balance < betAmt) return socket.emit('casinoError',{message:`Za mało AT$! Masz ${wallet.balance} AT$`});

    // Odejmij zakład
    await casino.updateBalance(discordUser.id, -betAmt);

    const reels = spin();
    const {multiplier, label} = calcPayout(reels, betAmt);
    const winAmount = Math.floor(betAmt * multiplier);
    if (winAmount > 0) await casino.updateBalance(discordUser.id, winAmount);
    await casino.recordGame(discordUser.id);

    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;

    socket.emit('casinoSlotsResult', {
      reels, multiplier, winAmount, bet: betAmt,
      net: winAmount - betAmt,
      balance: newBalance,
      label,
    });
  });
}

module.exports = { registerHandlers, SYMBOLS, PAYOUTS };
