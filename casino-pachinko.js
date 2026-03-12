/**
 * 🎯 PACHINKO — japońska gra kulkowa
 * Kulka spada przez planszę pełną pinów i ląduje w kieszeni
 * Wypłata zależy od kieszeni (od środka = więcej)
 */
'use strict';

// Kieszenie (11 slotów, od lewej do prawej)
// Indeksy: 0..10, środkowy = 5 (najwyższa wypłata)
const POCKETS = [
  { label:'0',   payout: 0   },
  { label:'1x',  payout: 1   },
  { label:'2x',  payout: 2   },
  { label:'3x',  payout: 3   },
  { label:'5x',  payout: 5   },
  { label:'10x', payout: 10  },  // środkowy
  { label:'5x',  payout: 5   },
  { label:'3x',  payout: 3   },
  { label:'2x',  payout: 2   },
  { label:'1x',  payout: 1   },
  { label:'0',   payout: 0   },
];

// Symulacja fizyki — kulka w każdym rzędzie odbija się w lewo lub prawo
// 12 rzędów pinów → 13 możliwych pozycji → mapujemy na 11 kieszeni
const ROWS = 12;

function dropBall(risk = 'medium') {
  // risk: low (bardziej ku środkowi), medium, high (bardziej na boki)
  const biases = { low: 0.45, medium: 0.5, high: 0.55 }; // prob przejścia w prawo
  const bias = biases[risk] ?? 0.5;

  let pos = 0; // zaczyna od 0, max = ROWS
  const path = [0];

  for (let i = 0; i < ROWS; i++) {
    pos += Math.random() < bias ? 1 : 0;
    path.push(pos);
  }

  // pos jest w zakresie 0..ROWS (12), mapujemy na 0..10 (11 kieszeni)
  const pocket = Math.round((pos / ROWS) * (POCKETS.length - 1));
  return { pocket, path, payout: POCKETS[pocket].payout };
}

function handlePachinkoSession(socket, io, casino) {
  socket.on('casinoPachinkoDrop', async ({ bet, risk }) => {
    const discordUser = socket.discordUser;
    if (!discordUser) return socket.emit('casinoError', { message: 'Musisz być zalogowany!' });

    const betAmount = Math.max(10, Math.min(5000, Number(bet) || 50));
    const riskLevel = ['low','medium','high'].includes(risk) ? risk : 'medium';

    const wallet = await casino.ensureWallet(discordUser);
    if (wallet.balance < betAmount) return socket.emit('pachinkoResult', { error: 'Za mało AT$!' });

    await casino.updateBalance(discordUser.id, -betAmount);

    const { pocket, path, payout } = dropBall(riskLevel);
    const win = betAmount * payout;

    if (win > 0) await casino.updateBalance(discordUser.id, win);
    await casino.recordGame(discordUser.id);

    const newWallet = await casino.getWallet(discordUser.id);

    socket.emit('pachinkoResult', {
      bet: betAmount,
      pocket,
      payout,
      win,
      path,
      pockets: POCKETS,
      balance: newWallet?.balance ?? (wallet.balance - betAmount + win),
    });
  });
}

module.exports = { handlePachinkoSession, POCKETS };
