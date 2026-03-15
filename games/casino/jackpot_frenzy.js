/**
 * JACKPOT FRENZY — AT Gaming Casino
 * Siatka 5×10 (5 kolumn × 10 rzędów), Cluster Pays
 * Dublet: rozszerza do 10×10
 *
 * Kociołki:
 *  - Zielony  (MNOŻNIKI):  zbierasz z zielonych coinów → 10 FS + sticky srebrne monety (wildy) → sumowane mnożniki x2-x1000
 *  - Czerwony (JACKPOTY):  zbierasz z czerwonych coinów → 10 FS + sticky złote monety (wildy) → Mini/Minor/Major/Mega/Grand
 *  - Niebieski (DUBLET):   zbierasz z niebieskich coinów → plansza 5×10 → 10×10 + sticky srebrne monety
 *
 * Każdy coin na bębnie daje 2-5 pkt do odpowiedniego kociołka.
 * Kociołek pełny (500 pkt) → aktywuje mini-grę + 20% szansa na włączenie pozostałych.
 * Mini-gry mogą działać jednocześnie. Wygrane sumują się, mnożniki i jackpoty aplikowane po końcu mini-gier.
 *
 * Jackpoty: progresywne + bazowe zależnie od stołu (low/medium/high)
 * Cluster Pays: min. 5 sąsiadujących symboli = wygrana
 */
'use strict';

// ─── KONFIGURACJA ─────────────────────────────────────────────────────────────
const CAULDRON_MAX      = 2000; // punkty do napełnienia kociołka
const CAULDRON_CHAIN    = 0.20; // 20% szansa na włączenie pozostałych kociołków
const MINI_FREE_SPINS   = 10;
const CLUSTER_MIN       = 5;    // minimalna liczba sąsiadów dla wygranej

const COLS_NORMAL = 5;
const ROWS        = 10;
const COLS_DUBLET = 10;

// ─── SYMBOLE ──────────────────────────────────────────────────────────────────
// Standardowe symbole kasynowe
const SYMS = [
  { id:'seven',   n:'7',       e:'7️⃣',  w:2,  p:[0,0,0,0,0,10,20,40,100,200,500] },
  { id:'bar3',    n:'BAR BAR BAR', e:'🎰', w:3,  p:[0,0,0,0,0,6,12,25,60,120,300] },
  { id:'bar2',    n:'BAR BAR',     e:'🎲', w:5,  p:[0,0,0,0,0,4,8,15,35,70,150]  },
  { id:'bar',     n:'BAR',         e:'📊', w:7,  p:[0,0,0,0,0,3,5,10,20,40,80]   },
  { id:'bell',    n:'Dzwonek',     e:'🔔', w:9,  p:[0,0,0,0,0,2,4,7,15,28,55]   },
  { id:'grape',   n:'Winogrona',   e:'🍇', w:11, p:[0,0,0,0,0,2,3,5,10,20,40]   },
  { id:'orange',  n:'Pomarańcza',  e:'🍊', w:13, p:[0,0,0,0,0,1,2,4,8,15,28]    },
  { id:'cherry',  n:'Wiśnia',      e:'🍒', w:16, p:[0,0,0,0,0,1,2,3,6,10,18]    },
  // COINY — pojawiają się w normalnych spinach
  { id:'coin_g',  n:'Zielony Coin',  e:'🟢', w:4,  coin:'green',  coinVal:[2,3,4,5] },
  { id:'coin_r',  n:'Czerwony Coin', e:'🔴', w:4,  coin:'red',    coinVal:[2,3,4,5] },
  { id:'coin_b',  n:'Niebieski Coin',e:'🔵', w:4,  coin:'blue',   coinVal:[2,3,4,5] },
  // BRĄZOWY COIN — wild podczas Dubletu (normalny spin)
  { id:'coin_br', n:'Brązowy Coin',   e:'🟤', w:4,  coin:'bronze', coinVal:[2,3,4,5], wild:true },
  // STICKY MONETY — pojawiają się podczas mini-gier
  { id:'silver',  n:'Srebrna Moneta', e:'🥈', w:0, sticky:true, wild:true, silver:true },
  { id:'gold',    n:'Złota Moneta',   e:'🥇', w:0, sticky:true, wild:true, gold:true   },
];

const IDX = Object.fromEntries(SYMS.map((s,i) => [s.id, i]));
const DRUM_W   = SYMS.map(s => s.w);
const DRUM_TOT = DRUM_W.reduce((a,b)=>a+b,0);

// Wagi podczas mini-gry srebrnej (Silver sticky)
const SILVER_W   = [...DRUM_W]; SILVER_W[IDX.silver] = 6;
const SILVER_TOT = SILVER_W.reduce((a,b)=>a+b,0);

// Wagi podczas mini-gry złotej (Gold sticky)
const GOLD_W   = [...DRUM_W]; GOLD_W[IDX.gold] = 6;
const GOLD_TOT = GOLD_W.reduce((a,b)=>a+b,0);

// ─── JACKPOTY ─────────────────────────────────────────────────────────────────
const JP_TIERS = ['mini','minor','major','mega','grand'];

// Bazowe jackpoty per tier per stół
const JP_BASE = {
  low:    { mini:500,   minor:2000,   major:10000,  mega:50000,   grand:200000  },
  medium: { mini:2000,  minor:8000,   major:40000,  mega:200000,  grand:1000000 },
  high:   { mini:10000, minor:40000,  major:200000, mega:1000000, grand:5000000 },
};

// Progresywne jackpoty — globalnie per stołowy tier
const progressiveJP = { low:{}, medium:{}, high:{} };
for (const tier of Object.keys(JP_BASE)) {
  for (const jp of JP_TIERS) {
    progressiveJP[tier][jp] = JP_BASE[tier][jp]; // start = bazowe
  }
}

// Przyrost jackpotów — per spin płatny
function tickProgressiveJP(tableLevel, totBet) {
  const jp = progressiveJP[tableLevel];
  jp.mini  += Math.round(totBet * 0.001);
  jp.minor += Math.round(totBet * 0.002);
  jp.major += Math.round(totBet * 0.005);
  jp.mega  += Math.round(totBet * 0.010);
  jp.grand += Math.round(totBet * 0.020);
}

function resetJP(tableLevel, jpName) {
  progressiveJP[tableLevel][jpName] = JP_BASE[tableLevel][jpName];
}

// Losuj jackpot dla złotej monety
function rollGoldJP() {
  const r = Math.random();
  if (r < 0.001) return 'grand';
  if (r < 0.005) return 'mega';
  if (r < 0.02)  return 'major';
  if (r < 0.08)  return 'minor';
  return 'mini';
}

// Losuj mnożnik dla srebrnej monety
function rollSilverMult() {
  const r = Math.random();
  if (r < 0.001) return 1000;
  if (r < 0.005) return 100;
  if (r < 0.02)  return 20;
  if (r < 0.06)  return 10;
  if (r < 0.15)  return 5;
  if (r < 0.35)  return 3;
  return 2;
}

// ─── CLUSTER PAYS ─────────────────────────────────────────────────────────────
function getNeighbors(col, row, cols) {
  const n = [];
  if (col > 0)      n.push([col-1, row]);
  if (col < cols-1) n.push([col+1, row]);
  if (row > 0)      n.push([col, row-1]);
  if (row < ROWS-1) n.push([col, row+1]);
  return n;
}

function findClusters(grid, cols) {
  const visited = Array.from({length:cols}, ()=>Array(ROWS).fill(false));
  const clusters = [];

  for (let c=0; c<cols; c++) for (let r=0; r<ROWS; r++) {
    if (visited[c][r]) continue;
    const symIdx = grid[c][r];
    const sym = SYMS[symIdx];
    // Pomiń: kolorowe coiny (nie-wild), sticky monety, ORAZ wildy (coin_br).
    // Wildy NIE startują własnego BFS — tylko dołączają do klastrów innych symboli.
    // Gdyby wild startował BFS, ustawiałby visited=true na swoich polach zanim
    // normalny symbol zdąży je "wchłonąć" — tracilibyśmy wild z klastra.
    if ((sym.coin && !sym.wild) || sym.sticky || sym.wild) {
      visited[c][r] = true; continue;
    }

    // BFS od normalnego symbolu
    const queue = [[c,r]];
    const cells = [];
    visited[c][r] = true;
    while (queue.length) {
      const [cc,rr] = queue.shift();
      cells.push([cc,rr]);
      for (const [nc,nr] of getNeighbors(cc,rr,cols)) {
        if (visited[nc][nr]) continue;
        const ni = grid[nc][nr];
        // Ten sam symbol LUB wild (coin_br, silver, gold) dołącza do klastra
        if (ni === symIdx || SYMS[ni].wild) {
          visited[nc][nr] = true; queue.push([nc,nr]);
        }
      }
    }
    if (cells.length >= CLUSTER_MIN) {
      const pay = sym.p?.[Math.min(cells.length, sym.p.length-1)] || 0;
      if (pay > 0) clusters.push({ symIdx, cells, pay });
    }
  }
  return clusters;
}

// ─── DRUM ──────────────────────────────────────────────────────────────────────
function drumRnd(weights, total) {
  let r = Math.random() * total;
  for (let i=0; i<SYMS.length; i++) { r-=weights[i]; if (r<=0) return i; }
  return SYMS.length-1;
}

function buildGrid(cols, state) {
  const hasSilver = state.miniGames.multiplier || state.miniGames.dublet;
  const hasGold   = state.miniGames.jackpot;
  const w   = hasSilver ? SILVER_W : hasGold ? GOLD_W : DRUM_W;
  const tot = hasSilver ? SILVER_TOT : hasGold ? GOLD_TOT : DRUM_TOT;

  const grid = Array.from({length:cols}, ()=>Array(ROWS).fill(0));
  const stickyAll = [...state.stickyCoins];

  for (let c=0; c<cols; c++) {
    for (let r=0; r<ROWS; r++) {
      const sticky = stickyAll.find(s=>s.col===c&&s.row===r);
      if (sticky) { grid[c][r] = sticky.type==='silver'?IDX.silver:IDX.gold; continue; }
      grid[c][r] = drumRnd(w, tot);
    }
  }
  return grid;
}

// ─── STAN GRACZY ──────────────────────────────────────────────────────────────
const playerState = new Map();

function getState(userId) {
  if (!playerState.has(userId)) {
    playerState.set(userId, {
      // Kociołki
      cauldron: { green:0, red:0, blue:0 },
      // Aktywne mini-gry
      miniGames: { multiplier:false, jackpot:false, dublet:false },
      miniSpins:  0,        // pozostałe spiny mini-gry
      // Sticky coiny
      stickyCoins: [],      // [{col,row,type:'silver'|'gold',mult?,jp?}]
      // Suma wygranych podczas mini-gry
      miniWinSum:  0,
      // Czy gramy na podwójnej planszy (dublet)
      dublet:      false,
      // Free spin state
      betPerLine:  0,
      activeLines: 1,
      // Poziom stołu
      tableLevel:  'low',
    });
  }
  return playerState.get(userId);
}

// ─── SOCKET HANDLER ───────────────────────────────────────────────────────────
function registerHandlers(socket, io, casino) {
  socket.on('casinoJFSpin', async (data) => {
    const { tableId, bet } = data;
    const table = casino.casinoTables[tableId];
    if (!table || table.game !== 'jackpot_frenzy')
      return socket.emit('casinoError', { message: 'Zły stół' });

    const discordUser = socket.getDiscordUser(data);
    if (!discordUser)
      return socket.emit('casinoError', { message: 'Musisz być zalogowany przez Discord!' });

    const state    = getState(discordUser.id);
    const cfg      = table.config;
    const isFree   = state.miniSpins > 0;
    const cols     = state.dublet ? COLS_DUBLET : COLS_NORMAL;
    const tableLevel = cfg.level || 'low';
    state.tableLevel = tableLevel;

    // ── Stawka ───────────────────────────────────────────────────────────────
    let totBet;
    if (isFree) {
      totBet = state.betPerLine;
    } else {
      totBet = Math.round(Math.max(cfg.minBet, Math.min(cfg.maxBet, Number(bet)||cfg.minBet)));
      const wallet = await casino.ensureWallet(discordUser);
      if (wallet.balance < totBet)
        return socket.emit('casinoError', { message:`Za mało AT$! Masz ${wallet.balance}, potrzebujesz ${totBet}` });
      await casino.updateBalance(discordUser.id, -totBet);
      state.betPerLine = totBet;
      tickProgressiveJP(tableLevel, totBet);
    }

    // ── Grid ─────────────────────────────────────────────────────────────────
    const grid = buildGrid(cols, state);

    // ── Coiny → kociołki (tylko poza mini-grą) ─────────────────────────────
    const coinEvents = [];
    if (!isFree) {
      for (let c=0; c<cols; c++) for (let r=0; r<ROWS; r++) {
        const sym = SYMS[grid[c][r]];
        if (!sym.coin) continue;
        const pts = sym.coinVal[Math.floor(Math.random()*sym.coinVal.length)];
        // Brązowy coin → kociołek niebieski (Dublet)
        const color = sym.coin === 'bronze' ? 'blue' : sym.coin;
        state.cauldron[color] = Math.min(CAULDRON_MAX, state.cauldron[color]+pts);
        coinEvents.push({col:c, row:r, color, pts, total:state.cauldron[color], isBronze: sym.coin==='bronze'});
      }
    }

    // ── Kociołki pełne? (tylko poza mini-grą) ───────────────────────────────
    const triggeredCauldrons = [];
    if (!isFree) for (const color of ['green','red','blue']) {
      if (state.cauldron[color] >= CAULDRON_MAX) {
        state.cauldron[color] = 0;
        triggeredCauldrons.push(color);
      }
    }

    // Chain: 20% szansa na włączenie pozostałych
    const chainTriggered = [];
    if (triggeredCauldrons.length > 0) {
      for (const color of ['green','red','blue']) {
        if (!triggeredCauldrons.includes(color) && Math.random()<CAULDRON_CHAIN) {
          state.cauldron[color] = 0;
          triggeredCauldrons.push(color);
          chainTriggered.push(color);
        }
      }
    }

    // Aktywuj mini-gry
    let miniStarted = false;
    for (const color of triggeredCauldrons) {
      if (color==='green')  { state.miniGames.multiplier = true; miniStarted=true; }
      if (color==='red')    { state.miniGames.jackpot    = true; miniStarted=true; }
      if (color==='blue')   { state.miniGames.dublet     = true; state.dublet=true; miniStarted=true; }
    }
    if (miniStarted && state.miniSpins === 0) {
      state.miniSpins = MINI_FREE_SPINS;
      state.miniWinSum = 0;
      // Wyczyść sticky coiny przy starcie nowej mini-gry
      state.stickyCoins = [];
    } else if (miniStarted && state.miniSpins > 0) {
      // Dodatkowe spiny jeśli mini-gra już trwa
      state.miniSpins += MINI_FREE_SPINS;
    }

    // ── Nowe sticky coiny ────────────────────────────────────────────────────
    const newSticky = [];
    if (isFree) {
      for (let c=0; c<cols; c++) for (let r=0; r<ROWS; r++) {
        const sym = SYMS[grid[c][r]];
        const exists = state.stickyCoins.find(s=>s.col===c&&s.row===r);
        if (sym.silver && !exists) {
          const mult = rollSilverMult();
          const sc = {col:c, row:r, type:'silver', mult};
          state.stickyCoins.push(sc);
          newSticky.push(sc);
        }
        if (sym.gold && !exists) {
          const jp = rollGoldJP();
          const sc = {col:c, row:r, type:'gold', jp};
          state.stickyCoins.push(sc);
          newSticky.push(sc);
        }
      }
    }

    // ── Cluster pays ─────────────────────────────────────────────────────────
    const clusters  = findClusters(grid, cols);
    const lineWins  = clusters.reduce((s,cl)=>s+cl.pay*totBet,0);

    // ── Wypłata ──────────────────────────────────────────────────────────────
    let payout = lineWins;
    let finalPayout = 0;
    let miniEnded = false;
    let multSum = 0;
    let jackpotWins = [];

    if (isFree) {
      state.miniSpins--;
      state.miniWinSum += lineWins;

      if (state.miniSpins <= 0) {
        // Mini-gra skończona — aplikuj mnożniki i jackpoty
        miniEnded = true;

        // Srebrne monety → sumuj mnożniki
        if (state.miniGames.multiplier || state.miniGames.dublet) {
          multSum = state.stickyCoins
            .filter(s=>s.type==='silver')
            .reduce((s,c)=>s+c.mult,0);
        }

        // Złote monety → jackpoty
        if (state.miniGames.jackpot) {
          for (const sc of state.stickyCoins.filter(s=>s.type==='gold')) {
            const jpAmt = progressiveJP[tableLevel][sc.jp];
            jackpotWins.push({jp:sc.jp, amount:jpAmt, col:sc.col, row:sc.row});
            resetJP(tableLevel, sc.jp);
          }
        }

        const jpTotal = jackpotWins.reduce((s,j)=>s+j.amount,0);
        finalPayout = state.miniWinSum * Math.max(1, multSum) + jpTotal;

        // Reset state
        state.miniGames = {multiplier:false, jackpot:false, dublet:false};
        state.stickyCoins = [];
        state.miniWinSum  = 0;
        state.dublet      = false;
        payout = finalPayout;
      }
    }

    if (payout > 0) await casino.updateBalance(discordUser.id, payout);
    await casino.recordGame(discordUser.id);
    await casino.updateSlotStats(discordUser.id, 'jackpot_frenzy', {
      spins:1, spent:isFree?0:totBet, won:payout, bestWin:payout
    });

    const newBalance = (await casino.getWallet(discordUser.id))?.balance??0;
    const mult2  = totBet>0?payout/totBet:0;
    const tier   = mult2>500?'frito':mult2>50?'giga':mult2>20?'huge':mult2>5?'mega':mult2>1.5?'big':mult2>0?'win':'none';

    socket.emit('casinoJFResult', {
      grid,
      clusters,
      payout,
      balance:     newBalance,
      totBet,
      isFree,
      miniSpins:   state.miniSpins,
      miniWinSum:  state.miniWinSum,
      miniGames:   {...state.miniGames},
      cauldron:    {...state.cauldron},
      cauldronMax: CAULDRON_MAX,
      coinEvents,
      triggeredCauldrons,
      chainTriggered,
      stickyCoins: [...state.stickyCoins],
      newSticky,
      miniEnded,
      multSum,
      jackpotWins,
      finalPayout,
      dublet:      state.dublet,
      cols,
      syms:        SYMS.map(s=>({id:s.id,n:s.n,e:s.e,coin:s.coin||null,sticky:!!s.sticky,wild:!!s.wild,silver:!!s.silver,gold:!!s.gold,bronze:s.id==='coin_br'})),
      progressiveJP: progressiveJP[tableLevel],
      tier,
    });
  });
}

module.exports = { registerHandlers, progressiveJP };
