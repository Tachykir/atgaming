/**
 * PACHINKO — AT Gaming Casino
 * Uproszczone Pachinko: kulek wpada od góry przez pegsy, trafia w sloty
 */
'use strict';

// Sloty na dole z wypłatami (mnożniki ×zakład)
const SLOTS = [
  { label:'💀', mult:0   },
  { label:'1×', mult:1   },
  { label:'2×', mult:2   },
  { label:'💀', mult:0   },
  { label:'3×', mult:3   },
  { label:'1×', mult:1   },
  { label:'💀', mult:0   },
  { label:'5×', mult:5   },
  { label:'💀', mult:0   },
  { label:'2×', mult:2   },
  { label:'10×',mult:10  },
  { label:'2×', mult:2   },
  { label:'💀', mult:0   },
  { label:'1×', mult:1   },
  { label:'💀', mult:0   },
];

// Generuje ścieżkę kulki (seria L/R per rząd, dla animacji frontend)
// Zwraca rzeczywisty ruch kulki z uwzględnieniem odbicia od ścian planszy
function generatePath(rows=8) {
  const path = [];
  let pos = Math.floor(SLOTS.length/2);
  for (let r=0; r<rows; r++) {
    const intendedDir = Math.random()<0.5 ? -1 : 1;
    const prevPos = pos;
    pos = Math.max(0, Math.min(SLOTS.length-1, pos+intendedDir));
    // Rzeczywisty kierunek ruchu (0 jeśli odbiło od ściany i nie ruszyła)
    const actualDelta = pos - prevPos;
    // Dla animacji: jeśli kulka uderzyła w ścianę i nie ruszyła,
    // pokazujemy kierunek zamierzony (kulka "próbuje" wyjść ale wraca)
    const displayDir = actualDelta !== 0 ? (actualDelta > 0 ? 'R' : 'L') : (intendedDir > 0 ? 'R' : 'L');
    path.push({row:r, pos, dir: displayDir, bounced: actualDelta === 0});
  }
  return { path, finalSlot: pos };
}

function registerHandlers(socket, io, casino) {
  socket.on('casinoPachinkoDrop', async (data) => {
    const { tableId, bet } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'pachinko') return socket.emit('casinoError',{message:'Zły stół'});
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError',{message:'Wymagane logowanie Discord!'});

    const cfg = table.config;
    const betAmt = Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(bet)||cfg.minBet));
    const wallet = await casino.ensureWallet(discordUser);
    if (wallet.balance < betAmt) return socket.emit('casinoError',{message:`Za mało AT$! Masz ${wallet.balance}`});

    await casino.updateBalance(discordUser.id, -betAmt);

    const {path, finalSlot} = generatePath(8);
    const slot = SLOTS[finalSlot];
    const winAmount = Math.floor(betAmt * slot.mult);
    if (winAmount > 0) await casino.updateBalance(discordUser.id, winAmount);
    await casino.recordGame(discordUser.id);

    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;

    socket.emit('casinoPachinkoResult', {
      path, finalSlot, slot,
      bet: betAmt, winAmount,
      net: winAmount - betAmt,
      balance: newBalance,
    });
  });
}

module.exports = { registerHandlers, SLOTS };
