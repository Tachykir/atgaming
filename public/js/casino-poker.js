// casino-poker.js

function renderCasinoPokerState(state) {
  const { table, community, pot, phase, actingPlayer, callAmount, currentBet, folded, allIn, smallBlind, bigBlind, showHands, handNames, winners } = state;
  const mySocketId = socket.id;
  const myPlayer   = table.players.find(p => p.socketId === mySocketId);

  // Zaktualizuj round
  document.getElementById('casino-poker-round').textContent = `Runda ${table.round || 1}`;

  // Moje żetony
  if (myPlayer) {
    document.getElementById('casino-poker-chips-val').textContent = myPlayer.sessionChips.toLocaleString('pl-PL') + ' AT$';
    casinoIsObserver = false;
  } else {
    document.getElementById('casino-poker-chips-val').textContent = '👁️ Obserwujesz';
    casinoIsObserver = true;
  }

  // Miejsca graczy
  document.getElementById('casino-poker-seats').innerHTML = table.players.map(p => {
    const isActing = p.socketId === actingPlayer;
    const isFolded = folded?.[p.socketId];
    const isAllIn  = allIn?.[p.socketId];
    const bet      = currentBet?.[p.socketId] || 0;
    const isMe     = p.socketId === mySocketId;
    const isSB     = p.socketId === smallBlind;
    const isBB     = p.socketId === bigBlind;

    let seatResult = '';
    if (showHands && winners) {
      if (winners.includes(p.socketId)) seatResult = `<div class="seat-result win">🏆 WIN</div>`;
      else seatResult = `<div class="seat-result lose">✗</div>`;
    }

    return `<div class="casino-player-seat ${isActing?'acting':''} ${isFolded?'folded':''}">
      ${seatResult}
      ${p.avatar ? `<img class="seat-avatar" src="${p.avatar}" onerror="this.style.display='none'">` : `<div class="seat-avatar" style="background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700">${p.name[0]}</div>`}
      <div class="seat-name">${escHtml(p.name)}${isMe?' (Ty)':''}</div>
      <div class="seat-chips">${p.sessionChips.toLocaleString('pl-PL')}</div>
      ${bet ? `<div class="seat-bet">${bet} AT$</div>` : ''}
      ${isSB?'<div style="font-size:10px;color:var(--muted)">SB</div>':''}
      ${isBB?'<div style="font-size:10px;color:var(--muted)">BB</div>':''}
      ${isFolded?'<div style="font-size:10px;color:var(--muted)">Fold</div>':''}
      ${isAllIn?'<div style="font-size:10px;color:var(--accent2)">ALL-IN</div>':''}
      ${showHands?.[p.socketId]?`<div style="font-size:11px;color:var(--accent3)">${handNames?.[p.socketId]||''}</div>`:''}
    </div>`;
  }).join('');

  // Community cards (z animacją przy nowych kartach)
  document.getElementById('casino-poker-community').innerHTML = renderCards(community || [], true);
  document.getElementById('casino-poker-pot').textContent = `Pula: ${(pot||0).toLocaleString('pl-PL')} AT$`;
  const phaseNames = { preflop:'Pre-flop', flop:'Flop', turn:'Turn', river:'River', showdown:'Showdown' };
  document.getElementById('casino-poker-phase').textContent = phaseNames[phase] || phase || '';

  // Pokaż showdown hands
  if (showHands) {
    const myHand = showHands[mySocketId];
    if (myHand) document.getElementById('casino-poker-my-hand').innerHTML = renderCards(myHand);
  }

  // Akcje
  const isMyTurn = actingPlayer === mySocketId && !casinoIsObserver;
  const actEl    = document.getElementById('casino-poker-actions');
  const waitEl   = document.getElementById('casino-poker-waiting');

  if (isMyTurn && phase !== 'showdown') {
    actEl.style.display = 'block';
    waitEl.style.display = 'none';
    const toCall = (callAmount||0) - (currentBet?.[mySocketId]||0);
    document.getElementById('cp-call-btn').textContent = `Call ${toCall>0?toCall+' AT$':''}`;
    document.getElementById('cp-check-btn').style.display = toCall > 0 ? 'none' : 'inline-flex';
    document.getElementById('cp-call-btn').style.display  = toCall > 0 ? 'inline-flex' : 'none';
    document.getElementById('casino-poker-actions-title').textContent = `Twój ruch! Do wyrównania: ${toCall} AT$`;
    if (document.getElementById('cp-raise-input')) {
      document.getElementById('cp-raise-input').value = Math.min((callAmount||0) * 2, myPlayer?.sessionChips || 0);
    }
  } else {
    actEl.style.display  = 'none';
    waitEl.style.display = 'block';
    if (phase === 'showdown') {
      waitEl.innerHTML = winners?.length ? `🏆 Wygrywa: ${winners.map(sid => escHtml(table.players.find(p=>p.socketId===sid)?.name||sid)).join(', ')}` : '';
    } else if (actingPlayer) {
      const ap = table.players.find(p => p.socketId === actingPlayer);
      waitEl.textContent = ap ? `⏳ Czeka na: ${ap.name}` : '';
    } else if (table.status === 'open') {
      waitEl.textContent = table.players.length < 2 ? '⏳ Czekam na graczy...' : '⏳ Zaraz start...';
    } else {
      waitEl.textContent = '';
    }
  }
}

function casinoPokerAction(type) {
  if (!casinoTableId) return;
  if (type === 'fold')  socket.emit('casinoPokerFold',  { tableId: casinoTableId , discordId: casinoDiscordId, socketToken: casinoSocketToken });
  else if (type==='check') socket.emit('casinoPokerCheck', { tableId: casinoTableId , discordId: casinoDiscordId, socketToken: casinoSocketToken });
  else if (type==='call')  socket.emit('casinoPokerCall',  { tableId: casinoTableId , discordId: casinoDiscordId, socketToken: casinoSocketToken });
  else if (type==='raise') {
    const amt = parseInt(document.getElementById('cp-raise-input')?.value);
    if (!amt) return showToast('Podaj kwotę!', 'error');
    socket.emit('casinoPokerRaise', { tableId: casinoTableId, amount: amt , discordId: casinoDiscordId, socketToken: casinoSocketToken });
    document.getElementById('cp-raise-row').style.display = 'none';
  }
}

function casinoPokerShowRaise() {
  const row = document.getElementById('cp-raise-row');
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
}

function casinoPokerAllIn() {
  const gs = casinoTableData;
  if (!gs) return;
  const me = gs.table.players.find(p => p.socketId === socket.id);
  if (!me) return;
  socket.emit('casinoPokerRaise', { tableId: casinoTableId, amount: me.sessionChips + (gs.currentBet?.[socket.id]||0) , discordId: casinoDiscordId, socketToken: casinoSocketToken });
}

// ── AKCJE BLACKJACK ───────────────────────────────────────────
function setCasinoBet(amount) {
  document.getElementById('casino-bj-bet-input').value = amount;
}

function casinoBJMaxBet() {
  const gs = casinoTableData;
  if (!gs) return;
  const me = gs.table.players.find(p => p.socketId === socket.id);
  if (!me) return;
  const maxBet = Math.min(gs.table.config.maxBet, me.sessionChips);
  document.getElementById('casino-bj-bet-input').value = maxBet;
}

