// ══════════════════════════════════════════════════════════════
//  COINFLIP — moneta 3D, wyzwania PvP i gra solo vs kasyno
// ══════════════════════════════════════════════════════════════
let cf = null;
const CF_FACE = { heads: '👑', tails: '🦅' };
const CF_NAME = { heads: 'Orzeł', tails: 'Reszka' };

function initCoinflipUI(table) {
  const max = table.config.maxBet || table.config.minBet * 10000;
  const chips = cxChipValues(table.config.minBet, max, 6);
  cf = { table, side: 'heads', bet: chips[0], state: null, flipping: false, rot: 0 };
  const scr = cxScreen('casino-coinflip');
  scr.innerHTML = `<div class="cx-shell">
    ${cxTopbar({ icon: '🪙', title: table.name, sub: 'PvP 50/50 · Solo ×1,96', info: 'cfInfo()' })}
    <div class="cf-wrap">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="cx-panel" style="padding:0;overflow:hidden">
          <div class="cf-stage"><div class="cf-coin" id="cf-coin"><div class="face heads">👑</div><div class="face tails">🦅</div></div></div>
          <div class="cx-status-line" id="cf-msg" style="padding:0 12px 14px">Wybierz stronę i stawkę</div>
        </div>
        <div class="cx-panel">
          <h4>Strona</h4>
          <div class="cf-side"><button class="cx-btn gold active" data-s="heads" onclick="cfSetSide('heads')">👑 Orzeł</button><button class="cx-btn blue" data-s="tails" onclick="cfSetSide('tails')">🦅 Reszka</button></div>
          <h4 style="margin-top:14px">Stawka</h4>
          <input class="cx-input" id="cf-bet" type="number" value="${cf.bet}" min="${table.config.minBet}" style="width:100%">
          <div id="cf-chips" style="margin-top:10px"></div>
          <div class="cx-row" style="margin-top:14px">
            <button class="cx-btn green cx-grow" onclick="cfSolo()">🎲 Rzuć solo (×1,96)</button>
            <button class="cx-btn purple cx-grow" onclick="cfCreate()">⚔️ Wyzwij graczy</button>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="cx-panel"><h4>Otwarte wyzwania</h4><div class="cf-list" id="cf-list"></div></div>
        <div class="cx-panel"><h4>Ostatnie rzuty</h4><div class="cf-hist" id="cf-hist"></div></div>
      </div>
    </div>
  </div>`;
  cxChips('cf-chips', chips, v => { document.getElementById('cf-bet').value = v; }, cf.bet);
  cfRender();
}
function cfInfo() {
  cxModal(`<h3>🪙 Coinflip</h3><div class="cx-rules"><ul>
    <li><b>Solo</b>: wybierz stronę i rzuć przeciwko kasynu. Trafienie wypłaca 1,96× stawki.</li>
    <li><b>PvP</b>: wystaw wyzwanie — inny gracz przyjmuje je, stawiając tyle samo na przeciwną stronę. Zwycięzca zabiera całą pulę (50/50, bez prowizji).</li>
    <li>Możesz mieć do 3 otwartych wyzwań. Nieprzyjęte wyzwanie możesz anulować — stawka wraca.</li></ul></div>`);
}
function cfSetSide(s) {
  cf.side = s;
  document.querySelectorAll('.cf-side button').forEach(b => b.classList.toggle('active', b.dataset.s === s));
  cxSound.play('click');
}
function cfBet() { return Math.floor(Number(document.getElementById('cf-bet').value) || 0); }
function cfSolo() {
  if (cf.flipping) return;
  const bet = cfBet();
  if (cxBalance() < bet) return cxToast('Za mało AT$!', 'error');
  cf.flipping = true;
  cxSetBalance(cxBalance() - bet, false);
  socket.emit('casinoCoinflipSolo', cxAuth({ bet, side: cf.side }));
  setTimeout(() => { if (cf) cf.flipping = false; }, 6000);
}
function cfCreate() {
  const bet = cfBet();
  if (cxBalance() < bet) return cxToast('Za mało AT$!', 'error');
  socket.emit('casinoCoinflipCreate', cxAuth({ bet, side: cf.side }));
}
function cfAccept(id) { socket.emit('casinoCoinflipAccept', cxAuth({ challengeId: id })); }
function cfCancel(id) { socket.emit('casinoCoinflipCancel', cxAuth({ challengeId: id })); }

function cfAnimate(result, dur = 1800) {
  return new Promise(res => {
    const coin = document.getElementById('cf-coin');
    if (!coin) return res();
    const base = Math.ceil(cf.rot / 360) * 360;
    const end = base + 360 * 6 + (result === 'tails' ? 180 : 0);
    coin.style.setProperty('--mid', (base + 360 * 3) + 'deg');
    coin.style.setProperty('--end', end + 'deg');
    coin.style.setProperty('--dur', dur + 'ms');
    coin.classList.remove('flip'); void coin.offsetWidth; coin.classList.add('flip');
    cf.rot = end;
    cxSound.play('chip');
    setTimeout(() => { coin.classList.remove('flip'); coin.style.transform = `rotateY(${end}deg)`; cxSound.play('stop'); res(); }, dur);
  });
}

function cfRender() {
  const st = cf.state;
  const list = document.getElementById('cf-list');
  if (!list) return;
  const chs = st?.challenges || [];
  list.innerHTML = chs.map(c => {
    const mine = c.creator.id === casinoDiscordId;
    const opp = c.side === 'heads' ? 'tails' : 'heads';
    const action = c.status === 'flipping' ? `<span class="cx-pill">🪙 Rzut… vs ${cxEsc(c.opponent?.name || '?')}</span>`
      : mine ? `<button class="cx-btn sm red" onclick="cfCancel('${c.id}')">Anuluj</button>`
      : `<button class="cx-btn sm green" onclick="cfAccept('${c.id}')">Przyjmij ${CF_FACE[opp]}</button>`;
    return `<div class="cf-ch ${mine ? 'mine' : ''} ${c.status === 'flipping' ? 'flipping' : ''}">
      ${c.creator.avatar ? `<img src="${cxEsc(c.creator.avatar)}" alt="" onerror="this.style.display='none'">` : ''}
      <div class="grow"><div style="font-weight:800">${cxEsc(c.creator.name)}${mine ? ' (Ty)' : ''}</div><div style="font-size:12px;color:var(--muted)">stawia na ${CF_FACE[c.side]} ${CF_NAME[c.side]}</div></div>
      <span class="amt">${cxFmt(c.bet)} AT$</span>${action}</div>`;
  }).join('') || '<div class="cx-empty">Brak otwartych wyzwań — rzuć swoje!</div>';
  document.getElementById('cf-hist').innerHTML = (st?.history || []).map(h => `<div class="cf-h"><span>${CF_FACE[h.result]}</span><span class="cx-grow">${cxEsc(h.winner)} ${h.pvp ? 'pokonuje' : 'vs'} ${cxEsc(h.loser)}</span><b class="cx-mono">${cxShort(h.bet)}</b></div>`).join('') || '<div style="color:var(--muted);font-size:12px">Brak</div>';
}

socket.on('casinoCoinflipState', st => { if (cf && (!st.tableId || st.tableId === casinoTableId)) { cf.state = st; cfRender(); } });
socket.on('casinoCoinflipCreated', d => { if (cf) { cxSetBalance(d.balance); cxToast(`⚔️ Wyzwanie wystawione: ${cxFmt(d.bet)} AT$ na ${CF_NAME[d.side]}`, 'success'); } });
socket.on('casinoCoinflipCancelled', d => { if (cf) { cxSetBalance(d.balance); cxToast(`↩️ Wyzwanie anulowane — zwrot ${cxFmt(d.refund)} AT$`, 'success'); } });
socket.on('casinoCoinflipFlip', async d => {
  if (!cf || d.tableId !== casinoTableId) return;
  const involved = d.creator.id === casinoDiscordId || d.opponent.id === casinoDiscordId;
  document.getElementById('cf-msg').innerHTML = `⚔️ ${cxEsc(d.creator.name)} ${CF_FACE[d.side]} vs ${cxEsc(d.opponent.name)} — <b>${cxFmt(d.bet * 2)} AT$</b>`;
  if (involved) cfAnimate(d.result, d.durationMs);
});
socket.on('casinoCoinflipResult', d => {
  if (!cf || d.tableId !== casinoTableId) return;
  const win = d.winner.id === casinoDiscordId, lose = d.loser.id === casinoDiscordId;
  if (d.balances?.[casinoDiscordId] !== undefined) cxSetBalance(d.balances[casinoDiscordId]);
  if (win) { cxSound.play('win'); cxFloat(d.totalPot, document.getElementById('cf-coin')); document.getElementById('cf-msg').innerHTML = `🎉 ${CF_FACE[d.result]} ${CF_NAME[d.result]}! Wygrywasz <b class="cx-pos">${cxFmt(d.totalPot)} AT$</b>`; }
  else if (lose) { cxSound.play('lose'); document.getElementById('cf-msg').innerHTML = `💀 ${CF_FACE[d.result]} ${CF_NAME[d.result]} — wygrywa ${cxEsc(d.winner.name)}`; }
  else document.getElementById('cf-msg').innerHTML = `${CF_FACE[d.result]} — ${cxEsc(d.winner.name)} wygrywa ${cxFmt(d.totalPot)} AT$`;
});
socket.on('casinoCoinflipSoloResult', async d => {
  if (!cf || d.tableId !== casinoTableId) return;
  document.getElementById('cf-msg').textContent = '🪙 Moneta w powietrzu…';
  await cfAnimate(d.result, d.durationMs);
  cf.flipping = false;
  cxSetBalance(d.balance);
  if (d.win) { cxSound.play('win'); cxFloat(d.payout, document.getElementById('cf-coin')); document.getElementById('cf-msg').innerHTML = `🎉 ${CF_FACE[d.result]} ${CF_NAME[d.result]}! <b class="cx-pos">+${cxFmt(d.payout)} AT$</b>`; }
  else { cxSound.play('lose'); document.getElementById('cf-msg').innerHTML = `${CF_FACE[d.result]} ${CF_NAME[d.result]} — przegrywasz <b class="cx-neg">${cxFmt(d.bet)} AT$</b>`; }
});
document.addEventListener('cx-error', () => { if (cf) cf.flipping = false; });
document.addEventListener('cx-leave', e => { if (e.detail.game === 'coinflip') cf = null; });
