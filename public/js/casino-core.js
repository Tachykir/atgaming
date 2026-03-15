// casino-core.js — kasyno: portfel, lobby, tabele, wspólne eventy

function renderCasinoWallet() {
  // Sync casinoDiscordId z discordUser jeśli jeszcze nie ustawione
  if (!casinoDiscordId && discordUser) casinoDiscordId = discordUser.id;
  const w = casinoWallet;
  if (!w) return renderCasinoNoDiscord();
  const profit = w.totalWon - w.totalLost;
  document.getElementById('casino-wallet-area').innerHTML = `
    <div class="casino-wallet-bar">
      ${w.avatar ? `<img class="casino-wallet-avatar" src="${w.avatar}" alt="avatar">` : ''}
      <div class="casino-wallet-info">
        <div class="casino-wallet-label">Twój portfel</div>
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${escHtml(w.globalName)}</div>
        <div class="casino-wallet-meta">Zarobki netto: <span style="color:${profit>=0?'var(--success)':'var(--error)'}">${profit>=0?'+':''}${profit.toLocaleString('pl-PL')} AT$</span> · Rozegrane: ${w.gamesPlayed}</div>
      </div>
      <div style="text-align:right">
        <div class="casino-wallet-label">Saldo</div>
        <div class="casino-wallet-amount">${w.balance.toLocaleString('pl-PL')} AT$</div>
      </div>
    </div>`;
}

function renderCasinoNoDiscord() {
  // Jeśli user jest zalogowany przez Discord ale wallet jeszcze nie załadowany
  if (discordUser) {
    document.getElementById('casino-wallet-area').innerHTML = `
      <div class="casino-wallet-bar" style="justify-content:center;gap:16px">
        ${discordUser.avatar ? `<img class="casino-wallet-avatar" src="${discordUser.avatar}" alt="avatar">` : ''}
        <div class="casino-wallet-info">
          <div class="casino-wallet-label">Zalogowany jako</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(discordUser.globalName || discordUser.username)}</div>
          <div class="casino-wallet-meta" id="casino-wallet-loading">⏳ Ładowanie portfela AT$...</div>
        </div>
      </div>`;
    // Spróbuj załadować portfel ponownie po chwili
    setTimeout(() => loadCasinoWalletOnly(), 800);
    return;
  }
  document.getElementById('casino-wallet-area').innerHTML = `
    <div class="casino-no-discord">
      <div style="font-size:28px;margin-bottom:10px">🎰</div>
      <div style="font-weight:700;margin-bottom:8px">Zaloguj się przez Discord, żeby grać!</div>
      <div style="color:var(--muted);font-size:14px;margin-bottom:16px">Potrzebujesz konta Discord, żeby zarządzać AT$ i grać w kasynie.</div>
      <button class="btn btn-primary" onclick="loginWithDiscord()">Zaloguj przez Discord</button>
    </div>`;
}

async function loadCasinoWalletOnly() {
  try {
    const res = await fetch('/api/casino/wallet');
    if (res.ok) {
      const d = await res.json();
      casinoWallet    = d.wallet;
      casinoDiscordId = d.discordId;
      renderCasinoWallet();
      // Odśwież przyciski tworzenia stołów
      const tables = await (await fetch('/api/casino/tables')).json();
      renderCasinoTables(tables);
    }
  } catch(e) {}
}

function renderCasinoLB(lb) {
  const myId = casinoDiscordId;
  const rows = lb.map((p, i) => {
    const rankCls = i===0?'gold':i===1?'silver':i===2?'bronze':'';
    const isMine  = p.discordId === myId;
    const profit  = p.profit || 0;
    return `<tr class="${isMine?'casino-me-row':''}">
      <td class="casino-lb-rank ${rankCls}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
      <td><img class="casino-lb-avatar" src="${p.avatar||'https://cdn.discordapp.com/embed/avatars/0.png'}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">${escHtml(p.globalName)}${isMine?' 👈':''}</td>
      <td class="casino-lb-balance">${p.balance.toLocaleString('pl-PL')}</td>
      <td class="casino-lb-profit ${profit>=0?'pos':'neg'}">${profit>=0?'+':''}${profit.toLocaleString('pl-PL')}</td>
      <td style="color:var(--muted)">${p.gamesPlayed}</td>
    </tr>`;
  }).join('');
  document.getElementById('casino-lb-body').innerHTML = rows || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">Brak danych</td></tr>';
}

function renderCasinoTables(tables) {
  const poker    = tables.filter(t => t.game === 'poker');
  const bj       = tables.filter(t => t.game === 'blackjack');
  const slots    = tables.filter(t => t.game === 'slots');
  const roulette = tables.filter(t => t.game === 'roulette');
  const pachinko  = tables.filter(t => t.game === 'pachinko');
  const crash     = tables.filter(t => t.game === 'crash');
  const coinflip  = tables.filter(t => t.game === 'coinflip');
  const path      = tables.filter(t => t.game === 'path_of_gambling');

  const el = id => document.getElementById(id);
  el('casino-poker-tables').innerHTML    = poker.length    ? poker.map(t=>renderTableCard(t)).join('') : '<div style="color:var(--muted);padding:8px">Brak stołów — utwórz pierwszy!</div>';
  el('casino-bj-tables').innerHTML       = bj.length       ? bj.map(t=>renderTableCard(t)).join('')    : '<div style="color:var(--muted);padding:8px">Brak stołów — utwórz pierwszy!</div>';
  el('casino-slots-tables').innerHTML    = slots.map(t=>renderTableCard(t)).join('');
  el('casino-roulette-tables').innerHTML = roulette.map(t=>renderTableCard(t)).join('');
  el('casino-pachinko-tables').innerHTML  = pachinko.map(t=>renderTableCard(t)).join('');
  if (el('casino-crash-tables'))    el('casino-crash-tables').innerHTML    = crash.map(t=>renderTableCard(t)).join('');
  if (el('casino-coinflip-tables')) el('casino-coinflip-tables').innerHTML = coinflip.map(t=>renderTableCard(t)).join('');
  if (el('casino-path-tables'))     el('casino-path-tables').innerHTML     = path.map(t=>renderTableCard(t)).join('');
  const jf = tables.filter(t=>t.game==='jackpot_frenzy');
  if (el('casino-jf-tables'))       el('casino-jf-tables').innerHTML       = jf.map(t=>renderTableCard(t)).join('');

  // Pokaż przyciski tworzenia stołów jeśli zalogowany
  const hasDiscord = !!casinoWallet;
  ['create-poker-btn','create-bj-btn','create-coinflip-btn'].forEach(id => {
    const btn = el(id);
    if (btn) btn.style.display = hasDiscord ? 'inline-flex' : 'none';
  });
}

function renderTableCard(t) {
  const statusLabels = { open:'Otwarty', betting:'Zakłady', playing:'Gra', results:'Wyniki', showdown:'Showdown', spinning:'Obrót' };
  const gameIcons = { poker:'🃏', blackjack:'🃏', slots:'🎰', roulette:'🎡', pachinko:'🎯', crash:'🚀', coinflip:'🪙', path_of_gambling:'⚗️', jackpot_frenzy:'🏆' };
  const gameColors = { poker:'', blackjack:'bj', slots:'slots', roulette:'roulette', pachinko:'pachinko', crash:'crash', coinflip:'coinflip', path_of_gambling:'slots' };

  const seats = t.maxPlayers < 50 ? Array(Math.min(t.maxPlayers,8)).fill(0).map((_, i) => {
    const p = t.players[i];
    if (p) return `<div class="t-seat occupied">${p.avatar ? `<img src="${p.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : p.name[0].toUpperCase()}</div>`;
    return `<div class="t-seat" style="color:var(--muted)">·</div>`;
  }).join('') : '';

  let stakes = '';
  if (t.game==='poker')    stakes = `Blindy: ${t.config.blindAmount}/${t.config.blindAmount*2} AT$ · Buy-in: ${t.config.minBuyIn}–${t.config.maxBuyIn}`;
  else if (t.config.minBet) stakes = `Zakład: min ${t.config.minBet} AT$`;

  const canDelete = t.createdBy?.id === casinoDiscordId;
  const deleteBtn = canDelete && t.playerCount===0 ? `<button class="btn btn-secondary btn-sm" style="background:rgba(200,50,50,.15);border-color:rgba(200,50,50,.3)" onclick="event.stopPropagation();deleteCasinoTable('${t.id}')">🗑️</button>` : '';

  return `<div class="casino-table-card ${gameColors[t.game]||''}" onclick="openCasinoTable('${t.id}')">
    <span class="casino-table-status ${t.status}">${statusLabels[t.status]||t.status}</span>
    ${canDelete ? `<div style="position:absolute;top:12px;right:12px">${deleteBtn}</div>` : ''}
    <div class="t-game">${t.game==='path_of_gambling' ? '<img src="/images/slots/poelogo.png" style="width:44px;height:44px;object-fit:contain">' : (gameIcons[t.game]||'🎰')}</div>
    <div class="t-name">${escHtml(t.name)}</div>
    ${stakes ? `<div class="t-stakes">${stakes}</div>` : ''}
    ${seats ? `<div class="t-players">${seats} <span style="color:var(--muted)">${t.playerCount}/${t.maxPlayers}</span></div>` : `<div class="t-stakes">${t.playerCount} graczy online</div>`}
    <button class="btn btn-secondary btn-sm" style="width:100%">${t.status==='playing'||t.status==='spinning'?'👁️ Obserwuj':'→ Zagraj'}</button>
  </div>`;
}

// ── TWORZENIE STOŁU ───────────────────────────────────────────
let _createTableGame = null;
function showCreateTableDialog(game) {
  if (!casinoWallet && !discordUser) return showToast('Wymagane logowanie Discord!', 'error');
  if (!casinoDiscordId && discordUser) casinoDiscordId = discordUser.id;
  _createTableGame = game;
  const el = document.getElementById('modal-create-table');
  document.getElementById('create-table-title').textContent = game==='poker' ? '🃏 Utwórz stół pokera' : game==='coinflip' ? '🪙 Utwórz stół Coinflip' : '🎰 Utwórz stół Blackjacka';
  const form = document.getElementById('create-table-form');
  if (game==='coinflip') {
    form.innerHTML = `
      <div class="create-table-input-group"><label>Nazwa stołu</label><input class="input" id="ct-name" placeholder="np. Mój Coinflip" maxlength="40" value="Stół coinflip"></div>
      <div class="create-table-input-group"><label>Min zakład (AT$)</label><input class="input" id="ct-minbet" type="number" value="100" min="10"></div>`;
    document.getElementById('modal-create-table').style.display = 'flex';
    return;
  }
  if (game==='poker') {
    form.innerHTML = `
      <div class="create-table-input-group"><label>Nazwa stołu</label><input class="input" id="ct-name" placeholder="np. Stół VIP" maxlength="40" value="Stół pokera"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="create-table-input-group"><label>Blind (AT$)</label><input class="input" id="ct-blind" type="number" value="50" min="5" max="1000"></div>
        <div class="create-table-input-group"><label>Maks graczy</label><input class="input" id="ct-maxp" type="number" value="6" min="2" max="8"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="create-table-input-group"><label>Min buy-in (AT$)</label><input class="input" id="ct-minbi" type="number" value="1000" min="100"></div>
        <div class="create-table-input-group"><label>Maks buy-in (AT$)</label><input class="input" id="ct-maxbi" type="number" value="5000" min="500"></div>
      </div>`;
  } else {
    form.innerHTML = `
      <div class="create-table-input-group"><label>Nazwa stołu</label><input class="input" id="ct-name" placeholder="np. VIP Blackjack" maxlength="40" value="Stół blackjacka"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="create-table-input-group"><label>Min zakład (AT$)</label><input class="input" id="ct-minbet" type="number" value="50" min="10"></div>
        <div class="create-table-input-group"><label>Maks zakład (AT$)</label><input class="input" id="ct-maxbet" type="number" value="500" min="50"></div>
      </div>
      <div class="create-table-input-group"><label>Maks graczy</label><input class="input" id="ct-maxp" type="number" value="5" min="1" max="7"></div>`;
  }
  el.style.display = 'flex';
}
function closeCreateTableDialog() {
  document.getElementById('modal-create-table').style.display = 'none';
}
async function submitCreateTable() {
  const game = _createTableGame;
  const name = document.getElementById('ct-name')?.value?.trim() || '';
  let config = {};
  if (game==='poker') {
    config = { blindAmount:Number(document.getElementById('ct-blind')?.value)||50, minBuyIn:Number(document.getElementById('ct-minbi')?.value)||1000, maxBuyIn:Number(document.getElementById('ct-maxbi')?.value)||5000, maxPlayers:Number(document.getElementById('ct-maxp')?.value)||6 };
  } else if (game==='coinflip') {
    config = { minBet:Number(document.getElementById('ct-minbet')?.value)||100 };
  } else {
    config = { minBet:Number(document.getElementById('ct-minbet')?.value)||50, maxBet:Number(document.getElementById('ct-maxbet')?.value)||500, maxPlayers:Number(document.getElementById('ct-maxp')?.value)||5 };
  }
  try {
    const res = await fetch('/api/casino/tables', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({game,name,config}) });
    const data = await res.json();
    if (data.error) return showToast(data.error,'error');
    closeCreateTableDialog();
    showToast(`✅ Stół "${data.table.name}" utworzony!`,'success');
    loadCasinoLobby();
    setTimeout(()=>openCasinoTable(data.table.id),300);
  } catch(e) { showToast('Błąd tworzenia stołu','error'); }
}
async function deleteCasinoTable(tableId) {
  if (!confirm('Usunąć ten stół?')) return;
  try {
    const r = await fetch(`/api/casino/tables/${tableId}`,{method:'DELETE'});
    const d = await r.json();
    if (d.error) showToast(d.error,'error');
    else { showToast('Stół usunięty','success'); loadCasinoLobby(); }
  } catch(e) { showToast('Błąd','error'); }
}

// Nasłuchuj na aktualizacje stołów (od innych graczy tworzących/usuwających)
socket.on('casinoTablesUpdated', () => {
  if (document.getElementById('screen-casino-lobby')?.classList.contains('active')) loadCasinoLobby();
});

// ── OTWÓRZ STÓŁ ───────────────────────────────────────────────
const GAME_SCREENS = { poker:'casino-poker', blackjack:'casino-blackjack', slots:'casino-slots', roulette:'casino-roulette', pachinko:'casino-pachinko', crash:'casino-crash', coinflip:'casino-coinflip', path_of_gambling:'casino-path', jackpot_frenzy:'casino-jf' };

async function openCasinoTable(tableId) {
  let table;
  try { table = await (await fetch(`/api/casino/tables/${tableId}`)).json(); }
  catch(e) { return showToast('Błąd połączenia z stołem', 'error'); }

  // Sprawdź logowanie
  if (!casinoDiscordId && discordUser) casinoDiscordId = discordUser.id;
  if (!casinoDiscordId) {
    showToast('Zaloguj się przez Discord, żeby grać!', 'error');
    return;
  }

  // Załaduj portfel jeśli jeszcze nie załadowany
  if (!casinoWallet) {
    try {
      const wr = await fetch('/api/casino/wallet');
      if (wr.ok) { const wd = await wr.json(); casinoWallet = wd.wallet; casinoDiscordId = wd.discordId || casinoDiscordId; }
    } catch(e) {}
  }

  // Pobierz socketToken jeśli brak
  if (!casinoSocketToken) {
    try {
      const tr = await fetch('/auth/socket-token');
      if (tr.ok) { const td = await tr.json(); casinoSocketToken = td.token; }
    } catch(e) {}
  }

  casinoTableId    = tableId;
  casinoIsObserver = false;
  casinoMyHand     = [];

  const game = table.game;

  // Poker: buy-in dialog
  if (game === 'poker' && casinoWallet) {
    const cfg = table.config;
    const minBI = cfg.minBuyIn;
    const maxBI = Math.min(cfg.maxBuyIn, casinoWallet.balance);
    const buyIn = prompt(`Buy-in (${minBI}–${maxBI} AT$, masz ${casinoWallet.balance} AT$):`, minBI);
    if (buyIn === null || buyIn === '') {
      // Tylko obserwuj
      casinoIsObserver = true;
    } else {
      socket.emit('casinoJoinTable', { tableId, buyIn: parseInt(buyIn)||minBI , discordId: casinoDiscordId, socketToken: casinoSocketToken });
    }
  }

  // Blackjack: dołącz od razu (zakład w grze)
  if (game === 'blackjack' && casinoWallet) {
    socket.emit('casinoJoinTable', { tableId, buyIn: casinoWallet ? casinoWallet.balance : table.config.minBet * 20 , discordId: casinoDiscordId, socketToken: casinoSocketToken });
  }

  // Ruletka: specjalny join
  if (game === 'roulette') {
    socket.emit('casinoRouletteJoin', { tableId , discordId: casinoDiscordId, socketToken: casinoSocketToken });
    initRouletteUI(table);
  }

  // Slots / Pachinko: solo gry, nie potrzeba join
  if (game === 'slots') initSlotsUI(table);
  if (game === 'path_of_gambling') initPathUI(table);
  if (game === 'jackpot_frenzy')  initJFUI(table);
  if (game === 'pachinko') initPachinkoUI(table);
  if (game === 'crash') initCrashUI(table);
  if (game === 'coinflip') initCoinflipUI(table);

  socket.emit('casinoObserveTable', { tableId , discordId: casinoDiscordId, socketToken: casinoSocketToken });
  showScreen(GAME_SCREENS[game] || 'casino-lobby');

  if (game === 'poker') {
    document.getElementById('casino-poker-table-name').textContent = `🃏 ${table.name}`;
    document.getElementById('casino-poker-round').textContent = `Runda ${table.round || 1}`;
  } else if (game === 'blackjack') {
    document.getElementById('casino-bj-table-name').textContent = `🎰 ${table.name}`;
    document.getElementById('casino-bj-round').textContent = `Runda ${table.round || 1}`;
  }
}

function leaveCasinoTable() {
  if (casinoTableId) {
    socket.emit('casinoLeaveTable', { tableId: casinoTableId , discordId: casinoDiscordId, socketToken: casinoSocketToken });
    casinoTableId = null;
  }
  showScreen('casino-lobby');
  loadCasinoLobby();
}

// ── AUTOMAT 5-BĘBNOWY (SLOTS) ──────────────────────────────────
socket.on('casinoJoined', ({ tableId, sessionChips, walletBalance }) => {
  showCasinoNotif(`✅ Dołączyłeś! Żetony: ${sessionChips.toLocaleString('pl-PL')} AT$`, 'cn-success');
  if (casinoWallet) casinoWallet.balance = walletBalance;
  casinoIsObserver = false;
});

socket.on('casinoError', ({ message }) => {
  showCasinoNotif(message, 'cn-error');
});

// Countdown
socket.on('casinoCountdown', ({ tableId, seconds }) => {
  if (tableId !== casinoTableId) return;
  const table = casinoTableData;
  const isPoker = table?.game === 'poker';
  const prefix  = isPoker ? 'casino-poker' : 'casino-bj';
  const cdEl    = document.getElementById(`${prefix}-countdown`);
  const cdText  = document.getElementById(`${prefix}-cd-text`);
  const cdFill  = document.getElementById(`${prefix}-cd-fill`);

  if (cdEl) {
    cdEl.style.display = 'block';
    cdText.textContent = seconds > 0
      ? `${isPoker ? '⏳ Nowa runda za' : '🎲 Zakłady — pozostało'} ${seconds}s`
      : 'Start!';
    const pct = Math.round((seconds / casinoCdMax) * 100);
    cdFill.style.width = pct + '%';
    if (seconds <= 0) setTimeout(() => { cdEl.style.display = 'none'; }, 1000);
  }

  // Aktualizuj też countdown w BJ bet area
  const bjBetCd = document.getElementById('casino-bj-bet-countdown');
  if (bjBetCd) bjBetCd.textContent = seconds;
});

// Stan stołu (poker i BJ)
socket.on('casinoTableState', (state) => {
  if (!state.table || state.table.id !== casinoTableId) return;
  casinoTableData = state;

  if (state.table.game === 'poker') renderCasinoPokerState(state);
  else                               renderCasinoBJState(state);
});

// Moje prywatne karty (poker)
socket.on('casinoMyHand', ({ tableId, cards }) => {
  if (tableId !== casinoTableId) return;
  casinoMyHand = cards;
  const el = document.getElementById('casino-poker-my-hand');
  if (el) el.innerHTML = renderCards(cards.length ? cards : []);
});

// Tygodniowe doładowanie
socket.on('weeklyTopup', ({ message }) => {
  showCasinoNotif('🎉 ' + message, 'cn-big');
  if (casinoWallet) loadCasinoLobby(); // odśwież saldo
});

// ── RENDER POKER ──────────────────────────────────────────────
