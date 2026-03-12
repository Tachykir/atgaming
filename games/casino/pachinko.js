/**
 * PACHINKO — AT Gaming Casino
 * Uproszczone Pachinko: kulek wpada od góry przez pegsy, trafia w sloty
 * Poziomy ryzyka: low (9 pól), medium (15 pól), high (21 pól)
 */
'use strict';

// Definicje slotów per poziom ryzyka
// Zasada: najniższe wartości w środku, najwyższe na bokach
// Low risk: 9 pól
const SLOTS_LOW = [
  { label:'10×', mult:10  },
  { label:'3×',  mult:3   },
  { label:'1.5×',mult:1.5 },
  { label:'1×',  mult:1   },
  { label:'0.5×',mult:0.5 },
  { label:'1×',  mult:1   },
  { label:'1.5×',mult:1.5 },
  { label:'3×',  mult:3   },
  { label:'10×', mult:10  },
];

// Medium risk: 15 pól
const SLOTS_MEDIUM = [
  { label:'25×', mult:25  },
  { label:'5×',  mult:5   },
  { label:'3×',  mult:3   },
  { label:'2×',  mult:2   },
  { label:'1×',  mult:1   },
  { label:'0.5×',mult:0.5 },
  { label:'0.3×',mult:0.3 },
  { label:'0.1×',mult:0.1 },
  { label:'0.3×',mult:0.3 },
  { label:'0.5×',mult:0.5 },
  { label:'1×',  mult:1   },
  { label:'2×',  mult:2   },
  { label:'3×',  mult:3   },
  { label:'5×',  mult:5   },
  { label:'25×', mult:25  },
];

// High risk: 21 pól
const SLOTS_HIGH = [
  { label:'100×',mult:100 },
  { label:'20×', mult:20  },
  { label:'10×', mult:10  },
  { label:'5×',  mult:5   },
  { label:'3×',  mult:3   },
  { label:'2×',  mult:2   },
  { label:'1×',  mult:1   },
  { label:'0.5×',mult:0.5 },
  { label:'0.3×',mult:0.3 },
  { label:'0.2×',mult:0.2 },
  { label:'0.1×',mult:0.1 },
  { label:'0.2×',mult:0.2 },
  { label:'0.3×',mult:0.3 },
  { label:'0.5×',mult:0.5 },
  { label:'1×',  mult:1   },
  { label:'2×',  mult:2   },
  { label:'3×',  mult:3   },
  { label:'5×',  mult:5   },
  { label:'10×', mult:10  },
  { label:'20×', mult:20  },
  { label:'100×',mult:100 },
];

const RISK_CONFIGS = {
  low:    { slots: SLOTS_LOW,    rows: 8  },
  medium: { slots: SLOTS_MEDIUM, rows: 12 },
  high:   { slots: SLOTS_HIGH,   rows: 16 },
};

// Dla wstecznej kompatybilności (domyślny stary stół = medium)
const SLOTS = SLOTS_MEDIUM;

// Generuje ścieżkę kulki (seria L/R per rząd, dla animacji frontend)
function generatePath(rows=12, slotCount=15) {
  const path = [];
  let pos = Math.floor(slotCount/2);
  for (let r=0; r<rows; r++) {
    const intendedDir = Math.random()<0.5 ? -1 : 1;
    const prevPos = pos;
    pos = Math.max(0, Math.min(slotCount-1, pos+intendedDir));
    const actualDelta = pos - prevPos;
    const displayDir = actualDelta !== 0 ? (actualDelta > 0 ? 'R' : 'L') : (intendedDir > 0 ? 'R' : 'L');
    path.push({row:r, pos, dir: displayDir, bounced: actualDelta === 0});
  }
  return { path, finalSlot: pos };
}

function registerHandlers(socket, io, casino) {
  socket.on('casinoPachinkoDrop', async (data) => {
    const { tableId, bet, risk = 'medium' } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'pachinko') return socket.emit('casinoError',{message:'Zły stół'});
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError',{message:'Wymagane logowanie Discord!'});

    const cfg = table.config;
    const betAmt = Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(bet)||cfg.minBet));
    const wallet = await casino.ensureWallet(discordUser);
    if (wallet.balance < betAmt) return socket.emit('casinoError',{message:`Za mało AT$! Masz ${wallet.balance}`});

    await casino.updateBalance(discordUser.id, -betAmt);

    const riskCfg = RISK_CONFIGS[risk] || RISK_CONFIGS.medium;
    const {path, finalSlot} = generatePath(riskCfg.rows, riskCfg.slots.length);
    const slot = riskCfg.slots[finalSlot];
    const winAmount = Math.floor(betAmt * slot.mult);
    if (winAmount > 0) await casino.updateBalance(discordUser.id, winAmount);
    await casino.recordGame(discordUser.id);

    const newBalance = (await casino.getWallet(discordUser.id))?.balance ?? 0;

    socket.emit('casinoPachinkoResult', {
      path, finalSlot, slot,
      bet: betAmt, winAmount,
      net: winAmount - betAmt,
      balance: newBalance,
      risk,
      slots: riskCfg.slots,
      rows: riskCfg.rows,
    });
  });
}

module.exports = { registerHandlers, SLOTS, SLOTS_LOW, SLOTS_MEDIUM, SLOTS_HIGH, RISK_CONFIGS };
