// casino-blackjack.js

function renderCasinoBJState(state) {
  const { table, phase, dealerHand, dealerValue, bets, hands, results, actingPlayer } = state;
  const mySocketId = socket.id;
  const myPlayer   = table.players.find(p => p.socketId === mySocketId);

  document.getElementById('casino-bj-round').textContent = `Runda ${table.round || 1}`;

  if (myPlayer) {
    document.getElementById('casino-bj-chips-val').textContent = myPlayer.sessionChips.toLocaleString('pl-PL') + ' AT$';
    casinoIsObserver = false;
  } else {
    document.getElementById('casino-bj-chips-val').textContent = '👁️ Obserwujesz';
    casinoIsObserver = true;
  }

  // Krupier
  document.getElementById('casino-bj-dealer-hand').innerHTML = renderCards(dealerHand || [], true);
  document.getElementById('casino-bj-dealer-value').textContent = dealerValue != null
    ? `Wartość: ${dealerValue}${dealerValue > 21 ? ' — BUST!' : dealerValue === 21 ? ' — BLACKJACK!' : ''}`
    : '';

  // Moje karty
  const myHand = hands?.[mySocketId] || [];
  document.getElementById('casino-bj-my-hand').innerHTML = renderCards(myHand);
  const myVal = myHand.length ? handVal(myHand) : 0;
  document.getElementById('casino-bj-my-value').textContent = myHand.length
    ? `${myVal}${myVal > 21 ? ' — BUST!' : myVal === 21 ? ' — 21!' : ''}`
    : '';

  // Siedzenia
  document.getElementById('casino-bj-seats').innerHTML = table.players.map(p => {
    const isActing = p.socketId === actingPlayer;
    const hand     = hands?.[p.socketId] || [];
    const val      = hand.length ? handVal(hand) : 0;
    const isBust   = val > 21 && hand.length;
    const isMe     = p.socketId === mySocketId;
    const res      = results?.[p.socketId];
    const bet      = bets?.[p.socketId] || 0;

    let seatResult = '';
    if (res && res !== 'blackjack_pending') {
      const rl = { win:'✅ WIN', lose:'✗ BUST', push:'= PUSH', blackjack:'🃏 BJ!' };
      const rc = { win:'win', lose:'lose', push:'push', blackjack:'blackjack' };
      seatResult = `<div class="seat-result ${rc[res]||''}">${rl[res]||res}</div>`;
    }

    return `<div class="casino-player-seat ${isActing?'acting':''} ${isBust?'busted':''}">
      ${seatResult}
      ${p.avatar ? `<img class="seat-avatar" src="${p.avatar}" onerror="this.style.display='none'">` : `<div class="seat-avatar" style="background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700">${p.name[0]}</div>`}
      <div class="seat-name">${escHtml(p.name)}${isMe?' (Ty)':''}</div>
      <div class="seat-chips">${p.sessionChips.toLocaleString('pl-PL')}</div>
      ${bet ? `<div class="seat-bet">Zakład: ${bet}</div>` : ''}
      ${val && hand.length ? `<div style="font-size:11px;color:var(--accent3)">${val}${isBust?' 💥':''}</div>` : ''}
    </div>`;
  }).join('');

  // Areas
  const betEl  = document.getElementById('casino-bj-bet-area');
  const actEl  = document.getElementById('casino-bj-actions');
  const waitEl = document.getElementById('casino-bj-waiting');
  const isMyTurn = actingPlayer === mySocketId && !casinoIsObserver;

  if (phase === 'betting' && !casinoIsObserver && myPlayer) {
    betEl.style.display  = 'block';
    actEl.style.display  = 'none';
    waitEl.style.display = 'none';
    // Chipy
    const cfg = table.config;
    const chips = [cfg.minBet, cfg.minBet*2, cfg.minBet*5, cfg.maxBet].filter((v,i,a)=>a.indexOf(v)===i && v<=myPlayer.sessionChips);
    document.getElementById('casino-bj-chip-btns').innerHTML = chips.map((v, i) => {
      const cls = ['c1','c5','c25','c100','c500','c1000'][Math.min(i, 5)];
      return `<div class="casino-chip-btn ${cls}" onclick="setCasinoBet(${v})">${v}</div>`;
    }).join('');
    document.getElementById('casino-bj-bet-input').max = Math.min(cfg.maxBet, myPlayer.sessionChips);
    document.getElementById('casino-bj-bet-input').min = cfg.minBet;
    const myBet = bets?.[mySocketId];
    document.getElementById('casino-bj-bet-status').textContent = myBet
      ? `✅ Zakład: ${myBet} AT$`
      : `Maks. zakład: ${cfg.maxBet} AT$`;
    if (!document.getElementById('casino-bj-bet-input').value) {
      document.getElementById('casino-bj-bet-input').value = cfg.minBet;
    }
  } else if (phase === 'playing' && isMyTurn) {
    betEl.style.display  = 'none';
    actEl.style.display  = 'block';
    waitEl.style.display = 'none';
    document.getElementById('cbj-double-btn').disabled = (hands?.[mySocketId]?.length !== 2);
    document.getElementById('casino-bj-turn-info').textContent = `Twoja kolej! Zakład: ${bets?.[mySocketId]||0} AT$`;
  } else {
    betEl.style.display  = 'none';
    actEl.style.display  = 'none';
    waitEl.style.display = 'block';
    if (phase === 'betting') waitEl.textContent = casinoIsObserver ? '👁️ Obserwujesz' : '⏳ Czekam na Twój zakład...';
    else if (phase === 'playing') {
      const ap = table.players.find(p => p.socketId === actingPlayer);
      waitEl.textContent = ap ? `⏳ Czeka na: ${ap.name}` : '';
    }
    else if (phase === 'results' || phase === 'dealer') waitEl.textContent = '📊 Wyniki rundy...';
    else waitEl.textContent = table.players.length === 0 ? '⏳ Czekam na graczy...' : '';
  }
}

// ── AKCJE POKER ───────────────────────────────────────────────
function casinoBJPlaceBet() {
  const amount = parseInt(document.getElementById('casino-bj-bet-input')?.value);
  if (!amount) return showToast('Podaj kwotę zakładu!', 'error');
  socket.emit('casinoBJBet', { tableId: casinoTableId, amount , discordId: casinoDiscordId, socketToken: casinoSocketToken });
  document.getElementById('casino-bj-bet-status').textContent = `✅ Zakład: ${amount} AT$`;
}

function casinoBJAction(type) {
  if (!casinoTableId) return;
  if      (type==='hit')    socket.emit('casinoBJHit',    { tableId: casinoTableId , discordId: casinoDiscordId, socketToken: casinoSocketToken });
  else if (type==='stand')  socket.emit('casinoBJStand',  { tableId: casinoTableId , discordId: casinoDiscordId, socketToken: casinoSocketToken });
  else if (type==='double') socket.emit('casinoBJDouble', { tableId: casinoTableId , discordId: casinoDiscordId, socketToken: casinoSocketToken });
}


