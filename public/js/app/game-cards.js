// ── POKER ─────────────────────────────────────────────────────
let pokerState = null;

function renderPoker(ps) {
  pokerState = ps;
  const myId = S.playerId;
  const room = ps.room;

  // Chips
  const chips = ps.chips || {};
  document.getElementById('poker-chips').innerHTML = room.players.map(p =>
    `<div class="live-score-chip">${escHtml(p.name)} <span>${chips[p.id]||0} 🪙</span></div>`
  ).join('');

  // Community cards
  document.getElementById('poker-community').innerHTML = renderCards(ps.community || []);
  document.getElementById('poker-pot').textContent = `Pula: ${ps.pot || 0} 🪙`;
  document.getElementById('poker-phase').textContent = { preflop:'Pre-flop',flop:'Flop',turn:'Turn',river:'River',showdown:'Showdown' }[ps.phase] || ps.phase;

  // My hole cards (server sends _privateHands)
  const myCards = ps._privateHands?.[myId] || ps.hands?.[myId] || [];
  document.getElementById('poker-hole-cards').innerHTML = renderCards(myCards);

  // Players
  document.getElementById('poker-players-row').innerHTML = room.players.map(p => {
    const isActing = p.id === ps.actingPlayer;
    const folded = ps.folded?.[p.id];
    return `<div class="poker-player-panel ${isActing?'acting':''} ${folded?'folded':''}">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">${escHtml(p.name)}${p.id===myId?' (Ty)':''}</div>
      <div class="chips">${chips[p.id]||0} 🪙</div>
      ${ps.currentBet?.[p.id] ? `<div style="font-size:12px;color:var(--warning)">Bet: ${ps.currentBet[p.id]}</div>` : ''}
      ${folded ? '<div style="font-size:12px;color:var(--muted)">Fold</div>' : ''}
      ${ps.allIn?.[p.id] ? '<div style="font-size:12px;color:var(--accent2)">All-In</div>' : ''}
    </div>`;
  }).join('');

  // Actions
  const isMyTurn = ps.actingPlayer === myId;
  const actionsEl = document.getElementById('poker-actions');
  const waitingEl = document.getElementById('poker-waiting');
  if (isMyTurn && !S.isObserver) {
    actionsEl.style.display = 'block';
    waitingEl.style.display = 'none';
    const toCall = (ps.callAmount||0) - (ps.currentBet?.[myId]||0);
    document.getElementById('poker-call-btn').textContent = `Call ${toCall > 0 ? toCall : ''}`;
    document.getElementById('poker-check-btn').style.display = toCall > 0 ? 'none' : '';
    document.getElementById('poker-call-btn').style.display = toCall > 0 ? '' : 'none';
    document.getElementById('poker-turn-info').textContent = `Twoja kolejka! Pula do wyrównania: ${toCall}`;
  } else {
    actionsEl.style.display = 'none';
    waitingEl.style.display = 'block';
    const actingPlayer = room.players.find(p => p.id === ps.actingPlayer);
    waitingEl.textContent = actingPlayer ? `Czeka na: ${escHtml(actingPlayer.name)}` : '';
  }
}

function pokerAction(type) {
  if (type === 'raise') {
    const amount = parseInt(document.getElementById('poker-raise-amount').value);
    if (!amount) return showToast('Wpisz kwotę!', 'error');
    socket.emit('pokerRaise', { roomId: S.roomId, amount });
    document.getElementById('poker-raise-row').style.display = 'none';
  } else if (type === 'fold') {
    socket.emit('pokerFold', { roomId: S.roomId });
  } else if (type === 'check') {
    socket.emit('pokerCheck', { roomId: S.roomId });
  } else if (type === 'call') {
    socket.emit('pokerCall', { roomId: S.roomId });
  }
}

function pokerShowRaise() {
  const row = document.getElementById('poker-raise-row');
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  if (pokerState) document.getElementById('poker-raise-amount').value = (pokerState.callAmount || 0) * 2;
}

socket.on('pokerState', (ps) => {
  S.room = ps.room;
  showScreen('poker');
  renderPoker(ps);
});

socket.on('pokerRoundEnd', ({ winners, pot, showHands, community, chips, handNames, room }) => {
  S.room = room;
  const myId = S.playerId;
  const iWon = winners.includes(myId);
  showToast(iWon ? `🏆 Wygrałeś pulę ${pot}!` : '💔 Nie tym razem...', iWon ? 'success' : '');
  // Show all hands
  const holeEl = document.getElementById('poker-hole-cards');
  if (showHands && showHands[myId]) {
    holeEl.innerHTML = renderCards(showHands[myId]);
  }
});

// ── BLACKJACK ─────────────────────────────────────────────────
let bjGs = null;

function renderBJ(gs, room) {
  bjGs = gs;
  const myId = S.playerId;

  // Chips
  document.getElementById('bj-chips').innerHTML = room.players.map(p =>
    `<div class="live-score-chip">${escHtml(p.name)} <span>${gs.chips?.[p.id]||0} 🪙</span></div>`
  ).join('');

  // Dealer
  const dealerCards = gs.dealerHand || [];
  document.getElementById('bj-dealer-hand').innerHTML = renderCards(dealerCards);
  const dv = dealerCards.filter(c=>c!=='??').length ? handVal(dealerCards.filter(c=>c!=='??')) : '?';
  document.getElementById('bj-dealer-value').textContent = dv !== '?' ? `(${dv})` : '';

  // Players
  const playersArea = document.getElementById('bj-players-area');
  playersArea.innerHTML = room.players.map(p => {
    const hand = gs.hands?.[p.id] || [];
    const result = gs.results?.[p.id];
    const val = hand.length ? handVal(hand) : 0;
    const isBust = val > 21;
    const isActing = gs.actingPlayer === p.id;
    const isBJ = result === 'blackjack' || result === 'blackjack_pending';
    let cls = 'bj-player-panel';
    if (isActing) cls += ' acting';
    if (isBust && hand.length) cls += ' bust';
    if (isBJ) cls += ' blackjack';
    if (result === 'win') cls += ' win';
    let resultLabel = '';
    if (result && result !== 'blackjack_pending') {
      const labels = { win:'✅ WYGRANA', lose:'❌ PRZEGRANA', push:'🤝 REMIS', blackjack:'🃏 BLACKJACK!' };
      resultLabel = `<span class="bj-result-label ${result}">${labels[result]||result}</span>`;
    }
    return `<div class="${cls}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-weight:700">${escHtml(p.name)}${p.id===myId?' (Ty)':''}</span>
        ${hand.length ? `<span class="bj-hand-value">(${val})</span>` : ''}
        ${isBust && hand.length ? '<span style="color:var(--error);font-size:12px;font-weight:700">BUST</span>' : ''}
        ${resultLabel}
        ${gs.bets?.[p.id] ? `<span style="font-size:12px;color:var(--muted)">Zakład: ${gs.bets[p.id]}</span>` : ''}
      </div>
      <div class="card-row" style="justify-content:flex-start">${renderCards(hand)}</div>
    </div>`;
  }).join('');

  // Phase
  const phaseLabels = { betting:'🎲 Czas na zakłady!', playing:'🃏 Gra w toku', dealer:'🎩 Krupier gra...', results:'📊 Wyniki rundy' };
  document.getElementById('bj-phase-label').textContent = phaseLabels[gs.phase] || gs.phase;

  // Bet area
  const betArea = document.getElementById('bj-bet-area');
  const actArea = document.getElementById('bj-actions');
  const isMyTurn = gs.actingPlayer === myId;
  const myBet = gs.bets?.[myId];

  if (gs.phase === 'betting' && !S.isObserver) {
    betArea.style.display = 'block';
    actArea.style.display = 'none';
    const myChips = gs.chips?.[myId] || 0;
    document.getElementById('bj-bet-input').value = gs.minBet || 10;
    document.getElementById('bj-bet-input').max = Math.min(gs.maxBet||100, myChips);
    const betChips = document.getElementById('bj-bet-chips');
    betChips.innerHTML = [gs.minBet, Math.floor((gs.minBet+gs.maxBet)/2), gs.maxBet]
      .filter((v,i,a) => a.indexOf(v)===i)
      .map(v => `<button class="btn btn-secondary btn-sm" onclick="document.getElementById('bj-bet-input').value=${v}">${v}</button>`).join('');
    document.getElementById('bj-bet-status').textContent = myBet > 0 ? `✅ Zakład: ${myBet}` : `Twoje żetony: ${myChips}`;
  } else if (gs.phase === 'playing' && isMyTurn && !S.isObserver) {
    betArea.style.display = 'none';
    actArea.style.display = 'block';
    const myHand = gs.hands?.[myId] || [];
    document.getElementById('bj-double-btn').disabled = myHand.length !== 2;
    document.getElementById('bj-turn-info').textContent = 'Twoja kolej!';
  } else {
    betArea.style.display = 'none';
    actArea.style.display = 'none';
  }
}

function bjPlaceBet() {
  const amount = parseInt(document.getElementById('bj-bet-input').value);
  if (!amount || amount < (bjGs?.minBet||1)) return showToast('Nieprawidłowy zakład!', 'error');
  socket.emit('bjBet', { roomId: S.roomId, amount });
  document.getElementById('bj-bet-status').textContent = `✅ Zakład postawiony: ${amount}`;
}

function bjAction(type) {
  const events = { hit:'bjHit', stand:'bjStand', double:'bjDouble' };
  if (events[type]) socket.emit(events[type], { roomId: S.roomId });
}

socket.on('bjState', ({ gs, room }) => {
  S.room = room;
  showScreen('blackjack');
  renderBJ(gs, room);
});

socket.on('bjResults', ({ gs, room }) => {
  S.room = room;
  renderBJ(gs, room);
  const myId = S.playerId;
  const result = gs.results?.[myId];
  if (result === 'win') showToast('✅ Wygrałeś!', 'success');
  else if (result === 'blackjack') showToast('🃏 BLACKJACK! Wygrałeś!', 'success');
  else if (result === 'push') showToast('🤝 Remis!', '');
  else if (result === 'lose') showToast('❌ Przegrana', 'error');
});

// ── CARD HELPERS ──────────────────────────────────────────────
function renderCards(cards, animate=false) {
  if (!cards || !cards.length) return '<span style="color:var(--muted);font-size:13px">—</span>';
  return cards.map((card, i) => {
    if (card === '??') return '<div class="playing-card back">🂠</div>';
    const suit = card.slice(-1);
    const red = suit === '♥' || suit === '♦';
    const animStyle = animate ? `animation-delay:${i*80}ms` : '';
    return `<div class="playing-card ${red?'red':'black'}${animate?' card-deal-anim':''}" style="${animStyle}">${escHtml(card)}</div>`;
  }).join('');
}

function handVal(cards) {
  let v = 0, aces = 0;
  for (const c of cards) {
    if (c === '??') continue;
    const r = c.slice(0,-1);
    if (['J','Q','K'].includes(r)) v+=10;
    else if (r==='A') { v+=11; aces++; }
    else v += parseInt(r)||0;
  }
  while (v > 21 && aces > 0) { v -= 10; aces--; }
  return v;
}
