// ══════════════════════════════════════════════════════════════
//  BLACKJACK — stół z miejscami, split/double, timer tury
// ══════════════════════════════════════════════════════════════
let bj = null;
const BJ_RESULT = { blackjack: ['BLACKJACK!', 'var(--cx-gold)'], win: ['WYGRANA', 'var(--cx-win)'], push: ['REMIS', '#7aa7ff'], lose: ['PRZEGRANA', 'var(--cx-lose)'], bust: ['FURA', 'var(--cx-lose)'] };

function initBJUI(table) {
  clearInterval(bj?.timer);
  const c = table.config;
  const chips = cxChipValues(c.minBet, c.maxBet, 6);
  bj = { table, state: null, bet: chips[0], chips, timer: null, lastRound: null };
  const scr = cxScreen('casino-blackjack');
  scr.innerHTML = `<div class="cx-shell">
    ${cxTopbar({ icon: '♠️', title: table.name, sub: `Zakład ${cxShort(c.minBet)}–${cxShort(c.maxBet)} AT$ · BJ 3:2 · krupier stoi na 17`, info: 'bjInfo()' })}
    <div class="cx-felt bj" id="bj-felt" style="min-height:440px;max-width:1040px;width:100%;margin:0 auto;padding:22px 16px 26px;display:flex;flex-direction:column;align-items:center;gap:18px">
      <div style="text-align:center"><div style="font-size:11px;letter-spacing:.2em;color:rgba(255,255,255,.5);font-weight:800">KRUPIER</div>
        <div class="cx-cards" id="bj-dealer" style="margin-top:8px"></div>
        <div id="bj-dealer-val" style="margin-top:6px;font-weight:800"></div></div>
      <div style="font-size:12px;letter-spacing:.25em;color:rgba(255,211,107,.45);font-weight:800;text-align:center">BLACKJACK PŁACI 3:2 · UBEZPIECZENIA BRAK</div>
      <div id="bj-seats" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;width:100%"></div>
    </div>
    <div class="cx-countdown" id="bj-cd" style="display:none"><span id="bj-cd-txt"></span><div class="cx-bar"><i id="bj-cd-bar"></i></div></div>
    <div class="cx-actionbar" id="bj-bet" style="display:none">
      <span style="font-size:12px;color:var(--muted);font-weight:700">ZAKŁAD</span><div id="bj-chips"></div>
      <input class="cx-input" id="bj-bet-amt" type="number" value="${bj.bet}" min="${c.minBet}" max="${c.maxBet}" style="width:110px">
      <button class="cx-btn gold" onclick="bjPlaceBet()">Postaw</button>
    </div>
    <div class="cx-actionbar" id="bj-actions" style="display:none"></div>
    <div class="cx-status-line" id="bj-status"></div>
    <div style="text-align:center" id="bj-seatbtn"></div>
  </div>`;
  cxChips('bj-chips', chips, v => { document.getElementById('bj-bet-amt').value = v; }, bj.bet);
  bj.timer = setInterval(bjTick, 100);
}
function bjInfo() {
  cxModal(`<h3>♠️ Blackjack</h3><div class="cx-rules"><ul>
    <li>Cel: zbliż się do 21 bardziej niż krupier, nie przekraczając 21. Figury = 10, As = 1 lub 11.</li>
    <li>Blackjack (As + 10 na start) płaci 3:2. Zwykła wygrana 1:1, remis zwraca stawkę.</li>
    <li><b>Double</b> — podwajasz stawkę na pierwszych dwóch kartach i dostajesz dokładnie jedną kartę.</li>
    <li><b>Split</b> — parę dzielisz na dwie ręce (druga stawka). Asy po splicie dostają po jednej karcie; 21 po splicie to nie blackjack.</li>
    <li>Krupier sprawdza blackjacka przy Asie/10 i dobiera do 17 (stoi na soft 17). 6 talii.</li>
    <li>Na ruch masz 20 s — po czasie automatyczny stand.</li></ul></div>`);
}
function bjSit() {
  const c = bj.table.config;
  cxBuyIn({ min: c.minBet * 10, max: c.maxBet * 20, title: '♠️ Buy-in', onOk: v => cxJoinSeat(v) });
}
function bjPlaceBet() {
  const v = Math.floor(Number(document.getElementById('bj-bet-amt').value) || 0);
  cxSound.play('chip');
  socket.emit('casinoBJBet', cxAuth({ amount: v }));
}
function bjAct(a) {
  socket.emit({ hit: 'casinoBJHit', stand: 'casinoBJStand', double: 'casinoBJDouble', split: 'casinoBJSplit' }[a], cxAuth());
  document.getElementById('bj-actions').style.display = 'none';
}
function casinoBJAction(type) { bjAct(type); }

function bjHandBox(h, active, showResult) {
  const v = cxHandValue(h.cards);
  const res = showResult && h.result ? BJ_RESULT[h.result] : null;
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border-radius:12px;${active ? 'background:rgba(255,211,107,.12);box-shadow:0 0 0 2px rgba(255,211,107,.6)' : ''}">
    <div class="cx-cards overlap" style="min-height:62px">${h.cards.map((c, i) => cxCard(c, { small: true, delay: i * 60 })).join('')}</div>
    <div style="font:800 13px 'DM Mono',monospace">${v}${h.doubled ? ' · ×2' : ''}</div>
    <div class="bet" style="font:700 11px 'DM Mono',monospace;color:var(--cx-gold)">${cxShort(h.bet)}</div>
    ${res ? `<div style="font-weight:800;font-size:11px;color:${res[1]}">${res[0]}</div>` : ''}
  </div>`;
}

function renderCasinoBJState(state) {
  if (!bj) return;
  bj.state = state;
  const t = state.table, players = t.players;
  if (state.phase !== 'betting') { const cd = document.getElementById('bj-cd'); if (cd) cd.style.display = 'none'; }
  const me = players.find(p => p.socketId === socket.id);
  casinoIsObserver = !me;
  // Krupier
  document.getElementById('bj-dealer').innerHTML = state.dealerHand?.length ? state.dealerHand.map((c, i) => cxCard(c, { delay: i * 80 })).join('') : '<div class="cx-card back" style="opacity:.25"></div><div class="cx-card back" style="opacity:.25"></div>';
  const dv = state.dealerValue;
  document.getElementById('bj-dealer-val').innerHTML = dv ? `<span class="cx-pill" style="color:${dv > 21 ? 'var(--cx-lose)' : '#fff'}">${dv > 21 ? 'Fura ' + dv : dv}</span>` : '';
  // Miejsca
  const results = state.phase === 'results';
  document.getElementById('bj-seats').innerHTML = players.map(p => {
    const sid = p.socketId, isMe = sid === socket.id;
    const hands = state.hands?.[sid] || [];
    const acting = state.actingPlayer === sid;
    const betNow = state.bets?.[sid];
    const payout = state.payouts?.[sid];
    return `<div class="cx-seat ${isMe ? 'me' : ''} ${acting ? 'acting' : ''} ${results && payout > 0 ? 'winner' : ''}" style="position:relative;transform:none;left:auto;top:auto;width:auto;min-width:150px">
      <div style="display:flex;gap:4px">${hands.length ? hands.map((h, i) => bjHandBox(h, acting && state.actingHand === i && hands.length > 1, results)).join('') : (betNow && state.phase === 'betting' ? `<div class="bet" style="font-size:13px">Zakład: ${cxFmt(betNow)}</div>` : '<div style="height:20px"></div>')}</div>
      <div class="cx-seat-box">${cxAvatar(p.avatar, p.name)}<div style="min-width:0"><div class="nm">${cxEsc(p.name)}${isMe ? ' (Ty)' : ''}</div><div class="ch">${cxFmt(p.sessionChips)}</div></div>
        ${acting ? '<div class="timer"><i data-bj-timer></i></div>' : ''}</div>
      ${results && payout !== undefined ? `<div class="act" style="color:${payout > 0 ? 'var(--cx-win)' : payout < 0 ? 'var(--cx-lose)' : '#fff'}">${payout > 0 ? '+' : ''}${cxFmt(payout)}</div>` : ''}
    </div>`;
  }).join('') || '<div class="cx-empty" style="background:rgba(0,0,0,.25)">Stół jest pusty — usiądź i zagraj!</div>';
  // Zakład
  const canBet = me && state.phase === 'betting' && !state.bets?.[socket.id];
  document.getElementById('bj-bet').style.display = canBet ? '' : 'none';
  // Akcje
  const bar = document.getElementById('bj-actions');
  if (me && state.phase === 'playing' && state.actingPlayer === socket.id) {
    const hands = state.hands[socket.id] || [];
    const h = hands[state.actingHand];
    if (h) {
      const two = h.cards.length === 2;
      const canDouble = two && me.sessionChips >= h.bet;
      const canSplit = two && hands.length === 1 && me.sessionChips >= h.bet && bjVal(h.cards[0]) === bjVal(h.cards[1]);
      const key = state.actingHand + ':' + h.cards.join(',');
      if (bar.dataset.k !== key) {
        bar.dataset.k = key;
        cxSound.play('feature');
        bar.innerHTML = `<b style="margin-right:6px">Twój ruch${hands.length > 1 ? ` (ręka ${state.actingHand + 1})` : ''} — ${cxHandValue(h.cards)}</b>
          <button class="cx-btn green" onclick="bjAct('hit')">🃏 Dobierz</button>
          <button class="cx-btn red" onclick="bjAct('stand')">✋ Stój</button>
          ${canDouble ? `<button class="cx-btn gold" onclick="bjAct('double')">×2 Double</button>` : ''}
          ${canSplit ? `<button class="cx-btn purple" onclick="bjAct('split')">✂️ Split</button>` : ''}`;
      }
      bar.style.display = '';
    }
  } else { bar.style.display = 'none'; bar.dataset.k = ''; }
  // Status
  const st = document.getElementById('bj-status');
  if (results && me && state.payouts?.[socket.id] !== undefined && bj.lastRound !== t.round) {
    bj.lastRound = t.round;
    const pay = state.payouts[socket.id];
    if (pay > 0) { cxSound.play('win'); cxFloat(pay, document.getElementById('bj-felt')); }
    else if (pay < 0) cxSound.play('lose');
  }
  st.textContent = state.phase === 'betting' ? (me ? (state.bets?.[socket.id] ? '✓ Zakład przyjęty — czekamy na pozostałych' : '💰 Postaw zakład') : 'Trwają zakłady')
    : state.phase === 'playing' ? (state.actingPlayer && state.actingPlayer !== socket.id ? `⏳ Ruch: ${players.find(p => p.socketId === state.actingPlayer)?.name || ''}` : '')
    : state.phase === 'dealer' ? '🎩 Krupier dobiera…' : results ? 'Wyniki rundy' : players.length ? '' : '';
  document.getElementById('bj-seatbtn').innerHTML = me ? `<button class="cx-btn sm" onclick="leaveCasinoTable()">Wstań od stołu</button>`
    : players.length >= t.config.maxPlayers ? '<span class="cx-pill">Stół pełny — obserwujesz</span>'
    : t.status === 'playing' ? '<span class="cx-pill">Runda w toku — dosiądziesz się za chwilę</span>'
    : `<button class="cx-btn gold lg" onclick="bjSit()">🪑 Usiądź do stołu</button>`;
}
function bjVal(c) { const r = c.slice(0, -1); return ['J', 'Q', 'K'].includes(r) ? 10 : r === 'A' ? 11 : parseInt(r); }
function bjTick() {
  if (!bj?.state) return;
  const el = document.querySelector('[data-bj-timer]');
  if (el && bj.state.turnDeadline) el.style.transform = `scaleX(${cxDeadlinePct(bj.state.turnDeadline, bj.state.serverNow, bj.state.turnSeconds || 20)})`;
}
document.addEventListener('cx-leave', e => { if (e.detail.game === 'blackjack' && bj) { clearInterval(bj.timer); bj = null; } });
