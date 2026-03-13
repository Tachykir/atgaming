/**
 * RULETKA EUROPEJSKA — AT Gaming Casino
 * Gracze obstawiają przez betting window (30s), potem obrót koła
 */
'use strict';

// 0-36, europejska
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getColor(n) {
  if (n===0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

const BETS = {
  straight: { match: (n,v) => n===Number(v),                 payout: 35 },
  red:      { match: (n)   => RED.has(n),                    payout: 1  },
  black:    { match: (n)   => n>0 && !RED.has(n),            payout: 1  },
  even:     { match: (n)   => n>0 && n%2===0,                payout: 1  },
  odd:      { match: (n)   => n%2===1,                       payout: 1  },
  low:      { match: (n)   => n>=1&&n<=18,                   payout: 1  },
  high:     { match: (n)   => n>=19&&n<=36,                  payout: 1  },
  dozen1:   { match: (n)   => n>=1&&n<=12,                   payout: 2  },
  dozen2:   { match: (n)   => n>=13&&n<=24,                  payout: 2  },
  dozen3:   { match: (n)   => n>=25&&n<=36,                  payout: 2  },
  col1:     { match: (n)   => n%3===1&&n>0,                  payout: 2  },
  col2:     { match: (n)   => n%3===2&&n>0,                  payout: 2  },
  col3:     { match: (n)   => n%3===0&&n>0,                  payout: 2  },
  split:    { match: (n,v) => v.split('-').map(Number).includes(n), payout: 17 },
};

const BETTING_TIME = 30000;  // 30s
const SPIN_TIME    = 6000;   // 6s animacja

function createGameState() {
  return {
    phase: 'betting',    // betting | spinning | results
    bets: {},            // discordId -> [{type, value, amount}]
    result: null,
    countdown: BETTING_TIME/1000,
    timer: null,
    spinTimer: null,
  };
}

function broadcastState(table, io, gs) {
  const payload = {
    tableId: table.id,
    phase:   gs.phase,
    countdown: gs.countdown,
    result:  gs.result,
    players: table.players.map(p=>({
      name: p.name, avatar: p.avatar, discordId: p.discordId,
      bets: gs.bets[p.discordId] || [],
      totalBet: (gs.bets[p.discordId]||[]).reduce((s,b)=>s+b.amount,0),
    })),
  };
  io.to('casino:'+table.id).emit('casinoRouletteState', payload);
}

function startRound(table, io, casino) {
  const gs = createGameState();
  table.gameState = gs;
  table.status = 'playing';
  broadcastState(table, io, gs);

  let cd = BETTING_TIME/1000;
  const tick = setInterval(()=>{
    cd--;
    gs.countdown = cd;
    broadcastState(table, io, gs);
    if (cd <= 0) {
      clearInterval(tick);
      doSpin(table, io, casino, gs);
    }
  }, 1000);
  gs.timer = tick;
}

async function doSpin(table, io, casino, gs) {
  gs.phase = 'spinning';
  const result = Math.floor(Math.random() * 37);  // 0-36
  gs.result = { number: result, color: getColor(result) };
  broadcastState(table, io, gs);

  await new Promise(r => setTimeout(r, SPIN_TIME));

  // Rozlicz zakłady
  gs.phase = 'results';
  const results = [];
  for (const [discordId, bets] of Object.entries(gs.bets)) {
    let net = -bets.reduce((s,b)=>s+b.amount,0);
    const wins = [];
    for (const b of bets) {
      const def = BETS[b.type];
      if (def && def.match(result, b.value)) {
        const win = b.amount * (def.payout+1);
        net += win;
        wins.push({type:b.type, win});
      }
    }
    if (net !== 0) await casino.updateBalance(discordId, net).catch(()=>{});
    await casino.recordGame(discordId).catch(()=>{});
    results.push({ discordId, net, wins });
  }
  gs.results = results;
  broadcastState(table, io, gs);

  table.round++;
  await new Promise(r => setTimeout(r, 5000));

  // Następna runda jeśli ktoś siedzi
  gs.bets = {};
  if (table.players.length > 0) startRound(table, io, casino);
  else { table.status='open'; table.gameState=null; }
}

function registerHandlers(socket, io, casino) {
  // Dołącz do stołu ruletki
  socket.on('casinoRouletteJoin', async (data) => {
    const { tableId } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game!=='roulette') return;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return socket.emit('casinoError',{message:'Wymagane logowanie Discord!'});

    const already = table.players.find(p=>p.discordId===discordUser.id);
    if (!already) {
      const wallet = await casino.ensureWallet(discordUser);
      table.players.push({ socketId:socket.id, discordId:discordUser.id, name:discordUser.globalName||discordUser.username, avatar:discordUser.avatar });
    } else {
      already.socketId = socket.id; // odśwież socket po reconnect
    }
    socket.join('casino:'+tableId);
    socket.casinoTableId = tableId;

    if (!table.gameState && table.players.length >= 1) startRound(table, io, casino);
    else if (table.gameState) {
      broadcastState(table, io, table.gameState);
      // Przy reconnect: jeśli gracz miał zakłady i runda jest w toku — poinformuj o stanie
      const gs = table.gameState;
      if (gs.bets[discordUser.id]?.length > 0) {
        socket.emit('casinoRouletteMyBets', {
          tableId,
          bets: gs.bets[discordUser.id],
          total: gs.bets[discordUser.id].reduce((s,b)=>s+b.amount, 0),
        });
      }
    }
  });

  // Postaw zakład
  socket.on('casinoRouletteBet', async (data) => {
    const { tableId, type, value, amount } = data;
    const table = casino.casinoTables[tableId];
    if (!table || !table.gameState || table.gameState.phase !== 'betting') return;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;

    const cfg = table.config;
    const maxAllowed = cfg.maxBet || 100000;
    const betAmt = Math.max(cfg.minBet || 1, Math.min(maxAllowed, Number(amount)||cfg.minBet));
    const wallet = await casino.getWallet(discordUser.id);
    if (!wallet || wallet.balance < betAmt) return socket.emit('casinoError',{message:'Za mało AT$!'});

    // Rezerwacja (zakład jest rozliczany przy spinie)
    await casino.updateBalance(discordUser.id, -betAmt);

    const gs = table.gameState;
    if (!gs.bets[discordUser.id]) gs.bets[discordUser.id]=[];
    gs.bets[discordUser.id].push({type, value, amount:betAmt});

    broadcastState(table, io, gs);
  });

  // Opuść stół ruletki — zwróć AT$ jeśli gracz miał zakłady w fazie betting
  socket.on('casinoRouletteLeave', async (data) => {
    const { tableId } = data;
    const table = casino.casinoTables[tableId];
    if (!table) return;
    const discordUser = socket.getDiscordUser(data);
    if (!discordUser) return;

    const gs = table.gameState;
    // Zwróć zakłady tylko jeśli runda jest w fazie betting (spin jeszcze nie nastąpił)
    if (gs && gs.phase === 'betting' && gs.bets[discordUser.id]?.length > 0) {
      const refund = gs.bets[discordUser.id].reduce((s,b)=>s+b.amount, 0);
      await casino.updateBalance(discordUser.id, refund).catch(()=>{});
      delete gs.bets[discordUser.id];
      broadcastState(table, io, gs);
    }

    // Usuń gracza ze stołu
    table.players = table.players.filter(p=>p.discordId!==discordUser.id);
    socket.leave('casino:'+tableId);
  });
}

module.exports = { registerHandlers, BETS, getColor };
