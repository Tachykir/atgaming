// casino-roulette.js

function initRouletteUI(table) {
  document.getElementById('casino-roulette-balance').textContent = casinoWallet ? casinoWallet.balance.toLocaleString('pl-PL') + ' AT$' : '—';
  rouletteBetAmount = table.config.minBet;
  roulettePendingBets = [];
  const chips = [table.config.minBet, table.config.minBet*2, table.config.minBet*5, table.config.minBet*10];
  renderChipBtns('roulette-chip-btns', [...new Set(chips)], 'roulette-bet-input', v=>{ rouletteBetAmount=v; });
  document.getElementById('roulette-bet-input').value = rouletteBetAmount;
  document.getElementById('roulette-bet-input').oninput = e => rouletteBetAmount = parseInt(e.target.value)||rouletteBetAmount;
  buildRouletteGrid();
}

function buildRouletteGrid() {
  const grid = document.getElementById('roulette-grid');
  const outside = document.getElementById('roulette-outside');
  if (!grid) return;

  // Zero
  grid.innerHTML = `<div class="roulette-cell green" style="grid-column:1/3;grid-row:span 3;font-size:16px" onclick="placeRouletteBet('straight','0')">0</div>`;

  // Numbers 1-36, 3 rows
  for (let row=0; row<3; row++) {
    for (let col=0; col<12; col++) {
      const n = col*3 + (3-row);
      const color = ROULETTE_RED.has(n) ? 'red' : 'black';
      grid.innerHTML += `<div class="roulette-cell ${color}" onclick="placeRouletteBet('straight','${n}')" title="${n}">${n}</div>`;
    }
  }

  // Outside bets
  outside.innerHTML = `
    <div class="roulette-outside-btn red-bet"   onclick="placeRouletteBet('red')">Rouge 🔴</div>
    <div class="roulette-outside-btn black-bet" onclick="placeRouletteBet('black')">Noir ⚫</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('even')">Pair</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('odd')">Impair</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('low')">1–18</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('high')">19–36</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('dozen1')">1–12</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('dozen2')">13–24</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('dozen3')">25–36</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('col1')">Col 1</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('col2')">Col 2</div>
    <div class="roulette-outside-btn neutral-bet" onclick="placeRouletteBet('col3')">Col 3</div>`;
}

function placeRouletteBet(type, value) {
  if (!casinoTableId) return;
  const amount = parseInt(document.getElementById('roulette-bet-input')?.value) || rouletteBetAmount;
  socket.emit('casinoRouletteBet', { tableId: casinoTableId, type, value, amount , discordId: casinoDiscordId, socketToken: casinoSocketToken });
  roulettePendingBets.push({type, value, amount});
  const myBets = document.getElementById('roulette-my-bets');
  if (myBets) {
    const labels = {straight:`numer ${value}`,red:'rouge',black:'noir',even:'pair',odd:'impair',low:'1-18',high:'19-36',dozen1:'1-12',dozen2:'13-24',dozen3:'25-36',col1:'col1',col2:'col2',col3:'col3'};
    myBets.textContent = 'Twoje zakłady: ' + roulettePendingBets.map(b=>`${labels[b.type]||b.type} (${b.amount} AT$)`).join(', ');
  }
}

socket.on('casinoRouletteState', (state) => {
  if (!casinoTableId || state.tableId !== casinoTableId) return;
  const numEl  = document.getElementById('roulette-number');
  const cdEl   = document.getElementById('roulette-countdown');
  const wheel  = document.getElementById('roulette-wheel');
  const orbit  = document.getElementById('roulette-ball-orbit');

  if (state.phase === 'betting') {
    cdEl && (cdEl.style.display = 'block');
    const cdText = document.getElementById('roulette-cd-text');
    const cdFill = document.getElementById('roulette-cd-fill');
    if (cdText) cdText.textContent = `🎲 Obstawiaj! ${state.countdown}s`;
    if (cdFill)  cdFill.style.width = (state.countdown/30*100) + '%';
    if (numEl) { numEl.textContent = '?'; numEl.style.color = 'white'; }
    // Zatrzymaj animacje
    if (wheel)  { wheel.classList.remove('spinning'); wheel.style.animation=''; }
    if (orbit)  { orbit.classList.remove('spinning','landing'); orbit.style.animation=''; }
    roulettePendingBets = [];
    const myBetsEl = document.getElementById('roulette-my-bets');
    if (myBetsEl) myBetsEl.textContent = '';
  } else if (state.phase === 'spinning') {
    if (cdEl) cdEl.style.display = 'none';
    if (numEl) numEl.textContent = '🎡';
    // Uruchom animację koła i kuli
    if (wheel) {
      wheel.style.animation = 'none'; void wheel.offsetWidth;
      wheel.style.animation = 'wheelSpin 4s cubic-bezier(.2,.8,.3,1) forwards';
    }
    if (orbit) {
      orbit.style.animation = 'none'; void orbit.offsetWidth;
      orbit.style.animation = 'ballOrbit 4s cubic-bezier(.2,.8,.3,1) forwards';
    }
  } else if (state.phase === 'results' && state.result) {
    const n = state.result.number;
    const color = state.result.color;
    // Zatrzymaj kulo w pozycji końcowej
    if (orbit) { orbit.classList.remove('spinning'); orbit.style.animation = ''; }
    if (wheel) { wheel.style.animation = ''; }
    if (numEl) {
      numEl.textContent = n;
      numEl.style.color = color==='red'?'#e74c3c':color==='black'?'#ccc':'#2ecc71';
      numEl.classList.add('result-pop'); setTimeout(()=>numEl.classList.remove('result-pop'),600);
    }
    // Sprawdź czy wygrałem
    const myResult = state.players?.find(p => p.discordId === casinoDiscordId);
    if (myResult) {
      if (myResult.net > 0) {
        showToast(`🎉 Wygrałeś +${myResult.net.toLocaleString('pl-PL')} AT$!`, 'success');
        spawnCoinFloat(myResult.net);
        if (casinoWallet) { casinoWallet.balance += myResult.net; document.getElementById('casino-roulette-balance').textContent = casinoWallet.balance.toLocaleString('pl-PL') + ' AT$'; }
      } else if (myResult.net < 0) {
        showToast(`Przegrałeś ${Math.abs(myResult.net).toLocaleString('pl-PL')} AT$`, 'error');
        if (casinoWallet) { casinoWallet.balance += myResult.net; document.getElementById('casino-roulette-balance').textContent = casinoWallet.balance.toLocaleString('pl-PL') + ' AT$'; }
      }
    }
  }

  const playersEl = document.getElementById('roulette-players');
  if (playersEl && state.players) playersEl.textContent = `👥 Gracze: ${state.players.length}`;
});

// ── PACHINKO ──────────────────────────────────────────────────
// Definicje slotów per poziom ryzyka (środek najniższy, boki najwyższe)
const PACHINKO_RISK_DATA = {
  low: {
    rows: 8,
    slots: [
      {label:'5×',mult:5},{label:'1.5×',mult:1.5},{label:'0.75×',mult:0.75},
      {label:'0.5×',mult:0.5},{label:'0.25×',mult:0.25},
      {label:'0.5×',mult:0.5},{label:'0.75×',mult:0.75},{label:'1.5×',mult:1.5},{label:'5×',mult:5}
    ]
  },
  medium: {
    rows: 12,
    slots: [
      {label:'25×',mult:25},{label:'5×',mult:5},{label:'3×',mult:3},{label:'2×',mult:2},
      {label:'1×',mult:1},{label:'0.5×',mult:0.5},{label:'0.3×',mult:0.3},{label:'0.1×',mult:0.1},
      {label:'0.3×',mult:0.3},{label:'0.5×',mult:0.5},{label:'1×',mult:1},{label:'2×',mult:2},
      {label:'3×',mult:3},{label:'5×',mult:5},{label:'25×',mult:25}
    ]
  },
  high: {
    rows: 16,
    slots: [
      {label:'100×',mult:100},{label:'20×',mult:20},{label:'10×',mult:10},{label:'5×',mult:5},
      {label:'3×',mult:3},{label:'2×',mult:2},{label:'1×',mult:1},{label:'0.5×',mult:0.5},
      {label:'0.3×',mult:0.3},{label:'0.2×',mult:0.2},{label:'0.1×',mult:0.1},
      {label:'0.2×',mult:0.2},{label:'0.3×',mult:0.3},{label:'0.5×',mult:0.5},
      {label:'1×',mult:1},{label:'2×',mult:2},{label:'3×',mult:3},{label:'5×',mult:5},
      {label:'10×',mult:10},{label:'20×',mult:20},{label:'100×',mult:100}
    ]
  }
};

let currentPachinkoRisk = 'low';
// Alias dla wstecznej kompatybilności
const PACHINKO_SLOTS_DATA = PACHINKO_RISK_DATA.medium.slots;
const PACHINKO_ROWS = 12;
const PACHINKO_COLS = 10;

function setPachinkoRisk(risk) {
  currentPachinkoRisk = risk;
  document.querySelectorAll('.risk-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.risk === risk);
  });
  buildPachinkoBoard();
  buildPachinkoSlots();
}

