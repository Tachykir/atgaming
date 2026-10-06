// ══════════════════════════════════════════════════════════════
//  TEXAS HOLD'EM — owalny stół, timer tury, suwak raise, buy-in
// ══════════════════════════════════════════════════════════════
let pkr = null;

// Pozycje miejsc wokół owalu (% szerokości/wysokości stołu), indeks 0 = dół-środek (Ty)
const PKR_SEATS = [[50, 100], [12, 88], [-2, 50], [12, 12], [50, 0], [88, 12], [102, 50], [88, 88]];

// Okno buy-in (wspólne dla pokera i blackjacka)
function cxBuyIn({ min, max, title, onOk }) {
  const bal = cxBalance();
  const hi = Math.min(max, bal);
  if (hi < min) return cxToast(`Potrzebujesz co najmniej ${cxFmt(min)} AT$`, 'error');
  const start = Math.min(hi, Math.max(min, Math.round((min + hi) / 2 / 10) * 10));
  const m = cxModal(`<h3>${title}</h3><p class="cx-rules">Wybierz, ile AT$ zamieniasz na żetony. Niewykorzystane żetony wracają do portfela, gdy wstajesz od stołu.</p>
    <div style="text-align:center;margin:16px 0"><b class="cx-mono" style="font-size:30px;color:var(--cx-gold)" id="bi-val">${cxFmt(start)}</b> <span style="color:var(--muted)">AT$</span></div>
    <input type="range" id="bi-range" min="${min}" max="${hi}" step="${Math.max(1, Math.round((hi - min) / 100))}" value="${start}" style="width:100%;accent-color:#ffd36b">
    <div class="cx-row" style="justify-content:space-between;font-size:11px;color:var(--muted)"><span>min ${cxShort(min)}</span><span>max ${cxShort(hi)}</span></div>
    <div class="cx-row" style="margin-top:16px;justify-content:flex-end"><button class="cx-btn" id="bi-cancel">Tylko obserwuję</button><button class="cx-btn gold" id="bi-ok">Usiądź do stołu</button></div>`);
  m.el.querySelector('.cx-modal-box').style.maxWidth = '440px';
  const r = m.el.querySelector('#bi-range');
  r.oninput = () => m.el.querySelector('#bi-val').textContent = cxFmt(r.value);
  m.el.querySelector('#bi-cancel').onclick = m.close;
  m.el.querySelector('#bi-ok').onclick = () => { m.close(); onOk(Number(r.value)); };
}

function initPokerUI(table) {
  clearInterval(pkr?.timer);
  pkr = { table, state: null, actions: {}, phase: null, lastActAt: 0, cd: null, timer: null, myHand: null };
  const c = table.config;
  const scr = cxScreen('casino-poker');
  scr.innerHTML = `<div class="cx-shell">
    ${cxTopbar({ icon: '🃏', title: table.name, sub: `Blindy ${cxShort(c.blindAmount)}/${cxShort(c.blindAmount * 2)} · Buy-in ${cxShort(c.minBuyIn)}–${cxShort(c.maxBuyIn)} · do ${c.maxPlayers} graczy`, info: 'pkrInfo()' })}
    <div style="padding:46px 70px 56px">
      <div class="cx-felt" id="pkr-felt" style="aspect-ratio:2.4/1;max-width:920px;margin:0 auto">
        <div class="cx-felt-logo">AT Casino · Texas Hold'em</div>
        <div class="cx-board" id="pkr-board"></div>
        <div class="cx-pot" id="pkr-pot">Pula: 0</div>
        <div id="pkr-seats"></div>
      </div>
    </div>
    <div class="cx-countdown" id="pkr-cd" style="display:none"><span id="pkr-cd-txt"></span><div class="cx-bar"><i id="pkr-cd-bar"></i></div></div>
    <div class="cx-actionbar" id="pkr-actions" style="display:none"></div>
    <div class="cx-panel" id="pkr-me" style="display:none;text-align:center">
      <div class="cx-row" style="justify-content:center;gap:20px">
        <div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Twoje karty</div><div class="cx-cards" id="pkr-myhand" style="margin-top:6px"></div><div id="pkr-myname" style="font-weight:800;color:var(--cx-gold);margin-top:6px;min-height:20px"></div></div>
        <div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Żetony</div><b class="cx-mono" id="pkr-mychips" style="font-size:24px;color:var(--cx-gold)">—</b></div>
      </div>
    </div>
    <div class="cx-status-line" id="pkr-status"></div>
    <div style="text-align:center" id="pkr-seatbtn"></div>
  </div>`;
  pkr.timer = setInterval(pkrTick, 100);
}
function pkrInfo() {
  cxModal(`<h3>🃏 Texas Hold'em</h3><div class="cx-rules"><ul>
    <li>Każdy dostaje 2 karty, na stół trafia 5 kart wspólnych (flop, turn, river). Wygrywa najlepszy układ 5 kart.</li>
    <li>Kolejność układów: Poker królewski › Poker › Kareta › Full House › Kolor › Strit › Trójka › Dwie pary › Para › Wysoka karta.</li>
    <li>Na ruch masz 30 sekund — po czasie automatycznie check (jeśli możliwy) albo fold.</li>
    <li>Minimalne podbicie = ostatnie podbicie (co najmniej big blind). All-in zawsze dozwolony; side-poty liczone automatycznie.</li>
    <li>Wyjście w trakcie rozdania = fold. Żetony wracają do portfela po wstaniu od stołu.</li></ul></div>`);
}

function pkrSeatOrder(players) {
  const meIdx = players.findIndex(p => p.socketId === socket.id);
  if (meIdx < 0) return players.map((p, i) => ({ p, pos: i }));
  return players.map((p, i) => ({ p, pos: (i - meIdx + players.length) % players.length }));
}
function pkrPosFor(pos, n) {
  // rozłóż równomiernie po dostępnych pozycjach owalu
  const idx = n <= 1 ? 0 : Math.round(pos * PKR_SEATS.length / Math.max(n, 2)) % PKR_SEATS.length;
  return PKR_SEATS[idx];
}

function renderCasinoPokerState(state) {
  if (!pkr) return;
  pkr.state = state;
  const t = state.table, players = t.players;
  if (state.phase !== 'idle') { const cd = document.getElementById('pkr-cd'); if (cd) cd.style.display = 'none'; }
  const me = players.find(p => p.socketId === socket.id);
  casinoIsObserver = !me;
  if (state.phase !== pkr.phase) { pkr.actions = {}; pkr.phase = state.phase; }
  if (state.lastAction && state.lastAction.at !== pkr.lastActAt) {
    pkr.lastActAt = state.lastAction.at;
    pkr.actions[state.lastAction.sid] = state.lastAction.label;
    cxSound.play(/Fold/.test(state.lastAction.label) ? 'click' : 'chip');
  }
  const inHand = new Set(state.inHand || []);
  const showdown = state.phase === 'showdown';
  // Karty wspólne
  const comm = state.community || [];
  document.getElementById('pkr-board').innerHTML = Array.from({ length: 5 }, (_, i) => comm[i]
    ? cxCard(comm[i], { cls: showdown && state.winners?.some(w => state.bestCards?.[w]?.includes(comm[i])) ? 'glow' : '' })
    : '<div class="slot"></div>').join('');
  document.getElementById('pkr-pot').textContent = state.pot ? `Pula: ${cxFmt(state.pot)} AT$` : (state.phase === 'idle' ? 'Oczekiwanie na graczy' : '');
  // Miejsca
  const order = pkrSeatOrder(players);
  document.getElementById('pkr-seats').innerHTML = order.map(({ p, pos }) => {
    const [x, y] = pkrPosFor(pos, players.length);
    const sid = p.socketId;
    const isMe = sid === socket.id;
    const folded = state.folded?.[sid], allin = state.allIn?.[sid];
    const acting = state.actingPlayer === sid;
    const winner = showdown && state.winners?.includes(sid);
    const shown = state.showHands?.[sid];
    const cards = !inHand.has(sid) ? '' : shown ? shown.map(c => cxCard(c, { small: true, cls: winner && state.bestCards?.[sid]?.includes(c) ? 'glow' : '' })).join('')
      : isMe ? '' : folded ? '' : cxCard('??', { small: true }) + cxCard('??', { small: true });
    const tag = state.dealer === sid ? '<span class="tag d">D</span>' : state.smallBlind === sid ? '<span class="tag sb">SB</span>' : state.bigBlind === sid ? '<span class="tag bb">BB</span>' : '';
    const bet = state.currentBet?.[sid] || 0;
    const act = winner ? `🏆 +${cxShort(state.winAmounts?.[sid] || 0)}` : allin ? 'ALL-IN' : pkr.actions[sid] || (folded ? 'Fold' : '');
    return `<div class="cx-seat ${isMe ? 'me' : ''} ${acting ? 'acting' : ''} ${folded ? 'folded' : ''} ${winner ? 'winner' : ''}" style="left:${x}%;top:${y}%">
      ${y > 50 ? '' : `<div class="cx-cards overlap" style="min-height:0">${cards}</div>`}
      <div class="cx-seat-box">${tag}${cxAvatar(p.avatar, p.name)}<div style="min-width:0"><div class="nm">${cxEsc(p.name)}${isMe ? ' (Ty)' : ''}</div><div class="ch">${cxFmt(p.sessionChips)}</div></div>
        ${acting ? `<div class="timer"><i data-pkr-timer></i></div>` : ''}</div>
      ${act ? `<div class="act" style="${winner ? 'background:rgba(63,242,163,.25);color:var(--cx-win)' : ''}">${act}</div>` : ''}
      ${bet ? `<div class="bet">${cxFmt(bet)}</div>` : ''}
      ${y > 50 ? `<div class="cx-cards overlap" style="min-height:0">${cards}</div>` : ''}
      ${showdown && shown && state.handNames?.[sid] ? `<div class="act">${cxEsc(state.handNames[sid])}</div>` : ''}
    </div>`;
  }).join('') + (players.length === 0 ? '<div class="cx-seat" style="left:50%;top:50%"><div class="cx-seat-empty">?</div></div>' : '');
  // Moje karty / żetony
  const meBox = document.getElementById('pkr-me');
  meBox.style.display = me ? '' : 'none';
  if (me) {
    document.getElementById('pkr-mychips').textContent = cxFmt(me.sessionChips);
    const myCards = state.showHands?.[socket.id] || (inHand.has(socket.id) ? casinoMyHand : []);
    document.getElementById('pkr-myhand').innerHTML = myCards.length ? myCards.map(c => cxCard(c, { cls: state.folded?.[socket.id] ? 'dim' : '' })).join('') : '<span style="color:var(--muted);font-size:13px;align-self:center">czekasz na rozdanie</span>';
    document.getElementById('pkr-myname').textContent = (inHand.has(socket.id) && pkr.myHand) ? pkr.myHand : '';
  }
  // Status
  const st = document.getElementById('pkr-status');
  if (showdown) {
    const names = (state.winners || []).map(w => `${cxEsc(players.find(p => p.socketId === w)?.name || '?')} (+${cxFmt(state.winAmounts?.[w] || 0)})`).join(', ');
    st.innerHTML = `🏆 Wygrywa: <b style="color:var(--cx-win)">${names}</b>`;
    if (state.winners?.includes(socket.id) && pkr.wonShown !== state.pot + ':' + t.round) { pkr.wonShown = state.pot + ':' + t.round; cxSound.play('win'); cxFloat(state.winAmounts[socket.id], document.getElementById('pkr-mychips')); }
  } else if (state.phase === 'idle') st.textContent = players.length < 2 ? '⏳ Czekamy na co najmniej 2 graczy…' : '⏳ Rozdanie za chwilę…';
  else if (state.actingPlayer && state.actingPlayer !== socket.id) st.textContent = `⏳ Ruch: ${players.find(p => p.socketId === state.actingPlayer)?.name || '…'}`;
  else st.textContent = '';
  // Akcje
  pkrRenderActions(state, me);
  // Przycisk usiądź / wstań
  document.getElementById('pkr-seatbtn').innerHTML = me ? `<button class="cx-btn sm" onclick="leaveCasinoTable()">Wstań od stołu</button>`
    : players.length >= t.config.maxPlayers ? '<span class="cx-pill">Stół pełny — obserwujesz</span>'
    : t.status === 'playing' ? '<span class="cx-pill">Rozdanie w toku — usiądziesz po jego zakończeniu</span>'
    : `<button class="cx-btn gold lg" onclick="pkrSit()">🪑 Usiądź do stołu</button>`;
}

function pkrSit() {
  const c = pkr.table.config;
  cxBuyIn({ min: c.minBuyIn, max: c.maxBuyIn, title: '🃏 Buy-in', onOk: v => cxJoinSeat(v) });
}

function pkrRenderActions(state, me) {
  const bar = document.getElementById('pkr-actions');
  const myTurn = me && state.actingPlayer === socket.id && state.phase !== 'showdown';
  if (!myTurn) { bar.style.display = 'none'; bar.dataset.k = ''; return; }
  const key = state.lastAction?.at + ':' + state.phase + ':' + state.callAmount;
  if (bar.dataset.k === key) return;
  bar.dataset.k = key;
  bar.style.display = '';
  const myBet = state.currentBet?.[socket.id] || 0;
  const toCall = Math.max(0, (state.callAmount || 0) - myBet);
  const maxTotal = myBet + me.sessionChips;
  const minRaise = Math.min(maxTotal, (state.callAmount || 0) + (state.minRaise || pkr.table.config.blindAmount * 2));
  const canRaise = maxTotal > state.callAmount;
  const pot = state.pot || 0;
  cxSound.play('feature');
  bar.innerHTML = `
    <button class="cx-btn red" onclick="pkrAct('fold')">Fold</button>
    ${toCall === 0 ? `<button class="cx-btn blue" onclick="pkrAct('check')">Check</button>` : `<button class="cx-btn blue" onclick="pkrAct('call')">${toCall >= me.sessionChips ? 'All-in' : 'Call'} ${cxFmt(Math.min(toCall, me.sessionChips))}</button>`}
    ${canRaise ? `<div style="width:1px;height:34px;background:var(--cx-line2)"></div>
    <div class="cx-raise">
      <input type="range" id="pkr-raise" min="${minRaise}" max="${maxTotal}" step="${Math.max(1, Math.round(pkr.table.config.blindAmount / 2))}" value="${minRaise}" oninput="document.getElementById('pkr-rv').textContent=cxFmt(this.value)">
      <b class="cx-mono" id="pkr-rv" style="min-width:70px;color:var(--cx-gold)">${cxFmt(minRaise)}</b>
      <button class="cx-btn sm" onclick="pkrSetRaise(${Math.max(minRaise, Math.floor(state.callAmount + pot / 2))})">½ puli</button>
      <button class="cx-btn sm" onclick="pkrSetRaise(${Math.max(minRaise, Math.floor(state.callAmount + pot))})">Pula</button>
      <button class="cx-btn sm" onclick="pkrSetRaise(${maxTotal})">Max</button>
      <button class="cx-btn gold" onclick="pkrAct('raise')">${toCall ? 'Raise' : 'Bet'}</button>
    </div>` : ''}`;
}
function pkrSetRaise(v) {
  const r = document.getElementById('pkr-raise'); if (!r) return;
  r.value = Math.min(Number(r.max), Math.max(Number(r.min), v));
  document.getElementById('pkr-rv').textContent = cxFmt(r.value);
}
function pkrAct(type) {
  const ev = { fold: 'casinoPokerFold', check: 'casinoPokerCheck', call: 'casinoPokerCall', raise: 'casinoPokerRaise' }[type];
  const extra = type === 'raise' ? { amount: Number(document.getElementById('pkr-raise')?.value) } : {};
  socket.emit(ev, cxAuth(extra));
  const bar = document.getElementById('pkr-actions'); bar.style.display = 'none';
}
// legacy (stare przyciski)
function casinoPokerAction(type) { pkrAct(type); }

function onPokerMyHand(d) {
  if (!pkr) return;
  pkr.myHand = d.handName || null;
  if (pkr.state) renderCasinoPokerState(pkr.state);
}
function pkrTick() {
  if (!pkr?.state) return;
  const s = pkr.state;
  const el = document.querySelector('[data-pkr-timer]');
  if (el && s.turnDeadline) {
    const p = cxDeadlinePct(s.turnDeadline, s.serverNow, s.turnSeconds || 30);
    el.style.transform = `scaleX(${p})`;
  }
}
function onTableCountdown(d) {
  const game = casinoTable?.game;
  const pre = game === 'poker' ? 'pkr' : game === 'blackjack' ? 'bj' : null;
  if (!pre) return;
  const box = document.getElementById(pre + '-cd');
  if (!box) return;
  if (d.seconds < 0) { box.style.display = 'none'; return; }
  box.style.display = '';
  document.getElementById(pre + '-cd-txt').textContent = game === 'poker' ? `Nowe rozdanie za ${d.seconds}s` : `Zakłady: ${d.seconds}s`;
  document.getElementById(pre + '-cd-bar').style.width = (d.seconds / (d.max || 10) * 100) + '%';
  if (d.seconds <= 0) setTimeout(() => { box.style.display = 'none'; }, 700);
  else if (d.seconds <= 3) cxSound.play('tick');
}
document.addEventListener('cx-leave', e => { if (e.detail.game === 'poker' && pkr) { clearInterval(pkr.timer); pkr = null; } });
