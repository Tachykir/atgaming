/**
 * 🎰 AUTOMATY — jednorękibandyta 3×3
 * Nie wymaga innych graczy — grasz sam vs kasyno
 * Każda sesja jest niezależna (brak stołu wieloosobowego)
 */
'use strict';

const SYMBOLS = [
  { id:'🍒', name:'Wiśnia',   weight:30, payout:{ 2:2,  3:5   } },
  { id:'🍋', name:'Cytryna',  weight:25, payout:{ 2:3,  3:8   } },
  { id:'🍊', name:'Pomarańcz',weight:20, payout:{ 2:4,  3:12  } },
  { id:'🍇', name:'Winogrona',weight:12, payout:{ 2:6,  3:20  } },
  { id:'🔔', name:'Dzwonek',  weight:7,  payout:{ 2:10, 3:40  } },
  { id:'⭐', name:'Gwiazda',  weight:4,  payout:{ 2:15, 3:80  } },
  { id:'💎', name:'Diament',  weight:2,  payout:{ 2:25, 3:150 } },
  { id:'7️⃣', name:'Siódemka', weight:1,  payout:{ 2:50, 3:500 } },
];

// Ważona losowa kula
function weightedRandom() {
  const total = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
  let r = Math.random() * total;
  for (const sym of SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return SYMBOLS[0];
}

function spin() {
  // 3 bębny × 3 rzędy
  const reels = Array(3).fill(0).map(() => Array(3).fill(0).map(() => weightedRandom().id));
  return reels;
}

// Sprawdź wygrane linie (środkowa linia główna + opcjonalnie górna/dolna)
function checkWin(reels, bet) {
  const lines = [
    [reels[0][1], reels[1][1], reels[2][1]], // środkowa (główna)
    [reels[0][0], reels[1][0], reels[2][0]], // górna
    [reels[0][2], reels[1][2], reels[2][2]], // dolna
    [reels[0][0], reels[1][1], reels[2][2]], // diagonal ↘
    [reels[0][2], reels[1][1], reels[2][0]], // diagonal ↗
  ];

  let totalWin = 0;
  const winLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sym = SYMBOLS.find(s => s.id === line[0]);
    if (!sym) continue;

    const allSame = line.every(s => s === line[0]);
    const twoSame = line[0] === line[1] || line[1] === line[2];

    if (allSame) {
      const win = bet * sym.payout[3];
      totalWin += win;
      winLines.push({ lineIdx: i, symbols: line, multiplier: sym.payout[3], win });
    } else if (twoSame && sym.payout[2]) {
      const win = bet * sym.payout[2];
      totalWin += win;
      winLines.push({ lineIdx: i, symbols: line, multiplier: sym.payout[2], win });
    }
  }

  // Jackpot bonus — wszystkie 7s
  if (lines[0].every(s => s === '7️⃣')) {
    totalWin += bet * 1000; // Super jackpot!
    winLines.push({ jackpot: true, win: bet * 1000 });
  }

  return { totalWin, winLines };
}

// Socket handler — montowany bezpośrednio na socket
function handleSlotsSession(socket, io, casino) {
  socket.on('casinoSlotspin', async ({ bet }) => {
    const discordUser = socket.discordUser;
    if (!discordUser) return socket.emit('casinoError', { message: 'Musisz być zalogowany!' });

    const betAmount = Math.max(10, Math.min(10000, Number(bet) || 50));
    const wallet = await casino.ensureWallet(discordUser);

    if (wallet.balance < betAmount) {
      return socket.emit('slotResult', { error: 'Za mało AT$!' });
    }

    // Pobierz zakład
    await casino.updateBalance(discordUser.id, -betAmount);

    // Zakręć!
    const reels = spin();
    const { totalWin, winLines } = checkWin(reels, betAmount);

    if (totalWin > 0) {
      await casino.updateBalance(discordUser.id, totalWin);
    }
    await casino.recordGame(discordUser.id);

    const newWallet = await casino.getWallet(discordUser.id);

    socket.emit('slotResult', {
      reels,
      bet:      betAmount,
      win:      totalWin,
      winLines,
      balance:  newWallet?.balance ?? wallet.balance - betAmount + totalWin,
      symbols:  SYMBOLS.map(s => ({ id: s.id, name: s.name, payout3: s.payout[3] })),
    });
  });
}

module.exports = { handleSlotsSession, SYMBOLS };
