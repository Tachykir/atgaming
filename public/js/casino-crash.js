// ══════════════════════════════════════════════════════════════
//  CRASH — multiplayer, wykres na canvasie, auto cash-out
// ══════════════════════════════════════════════════════════════
let cr = null;

function initCrashUI(table) {
  if (cr?.raf) cancelAnimationFrame(cr.raf);
  const chips = cxChipValues(table.config.minBet, table.config.maxBet, 6);
  let bet = chips[0];
  try { const s = Number(localStorage.getItem('cr_bet_' + table.id)); if (s >= table.config.minBet && s <= table.config.maxBet) bet = s; } catch (e) {}
  cr = { table, state: null, bet, auto: '', queued: false, myBet: null, startLocal: 0, growth: 0.07, crashedAt: null, raf: null, stars: Array.from({ length: 60 }, () => [Math.random(), Math.random(), Math.random()]) };
  try { cr.auto = localStorage.getItem('cr_auto') || ''; } catch (e) {}
  const scr = cxScreen('casino-crash');
  scr.innerHTML = `<div class="cx-shell">
    ${cxTopbar({ icon: '🚀', title: table.name, sub: `Zakład ${cxShort(table.config.minBet)}–${cxShort(table.config.maxBet)} AT$ · RTP 96%`, info: 'crInfo()' })}
    <div class="cx-panel" style="padding:10px 14px"><div class="cr-history" id="cr-history"></div></div>
    <div class="cr-wrap">
      <div class="cr-stage"><canvas id="cr-canvas"></canvas><div class="cr-mult" id="cr-mult">1.00×</div><div class="cr-sub" id="cr-sub">Łączenie…</div></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="cx-panel">
          <h4>Twój zakład</h4>
          <div class="cx-row"><input class="cx-input cx-grow" id="cr-bet" type="number" min="${table.config.minBet}" max="${table.config.maxBet}" value="${cr.bet}">
            <button class="cx-btn sm" onclick="crBetMul(.5)">½</button><button class="cx-btn sm" onclick="crBetMul(2)">2×</button></div>
          <div id="cr-chips" style="margin:10px 0"></div>
          <div class="cx-row" style="margin-bottom:12px"><span style="font-size:12px;color:var(--muted);font-weight:700">AUTO CASH-OUT</span><input class="cx-input" id="cr-auto" type="number" min="1.01" step="0.01" placeholder="np. 2.00" value="${cxEsc(cr.auto)}" style="width:100px"><span style="font-size:12px;color:var(--muted)">×</span></div>
          <button class="cx-btn gold lg cr-main-btn" id="cr-main" onclick="crMain()">Postaw</button>
          <div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center" id="cr-hint">Spacja = postaw / wypłać</div>
        </div>
        <div class="cx-panel"><h4>Gracze w rundzie <span id="cr-count"></span></h4><div class="cr-bets" id="cr-bets"><div style="color:var(--muted);font-size:12px">Brak zakładów</div></div></div>
      </div>
    </div>
  </div>`;
  cxChips('cr-chips', chips, v => { document.getElementById('cr-bet').value = v; crSaveBet(); }, cr.bet);
  document.getElementById('cr-bet').onchange = crSaveBet;
  document.getElementById('cr-auto').onchange = e => { cr.auto = e.target.value; try { localStorage.setItem('cr_auto', cr.auto); } catch (er) {} };
  crResize();
  crLoop();
}
function crInfo() {
  cxModal(`<h3>🚀 Crash</h3><div class="cx-rules"><ul>
    <li>Postaw zakład w czasie odliczania. Po starcie mnożnik rośnie od 1.00×.</li>
    <li>Kliknij <b>Wypłać</b>, aby zgarnąć stawka × aktualny mnożnik. Jeśli rakieta wybuchnie przed wypłatą — tracisz stawkę.</li>
    <li><b>Auto cash-out</b>: wpisz mnożnik (np. 2.00), a serwer wypłaci Cię automatycznie, gdy zostanie osiągnięty.</li>
    <li>Możesz kliknąć <b>Postaw</b> w trakcie lotu — zakład trafi do następnej rundy.</li>
    <li>Punkt wybuchu jest losowany na starcie rundy: P(≥ x) = 0,96 / x (RTP 96%). Max ×1000.</li></ul></div>`);
}
function crSaveBet() { const v = Number(document.getElementById('cr-bet').value); if (v) { cr.bet = v; try { localStorage.setItem('cr_bet_' + cr.table.id, v); } catch (e) {} } }
function crBetMul(m) {
  const cfg = cr.table.config;
  const inp = document.getElementById('cr-bet');
  inp.value = Math.max(cfg.minBet, Math.min(cfg.maxBet, Math.floor((Number(inp.value) || cfg.minBet) * m)));
  crSaveBet();
}

function crMain() {
  const st = cr.state;
  if (!st) return;
  const mine = st.bets?.[casinoDiscordId];
  if (st.phase === 'running' && mine && !mine.cashedOut) {
    socket.emit('casinoCrashCashOut', cxAuth());
    return;
  }
  if (st.phase === 'betting' && !mine) return crSendBet();
  // W trakcie lotu / po crashu — kolejka na następną rundę
  cr.queued = !cr.queued;
  crUpdateButton();
}
function crSendBet() {
  crSaveBet();
  const auto = Number(document.getElementById('cr-auto').value);
  if (cxBalance() < cr.bet) return cxToast('Za mało AT$!', 'error');
  cxSound.play('chip');
  socket.emit('casinoCrashBet', cxAuth({ bet: cr.bet, autoCashout: auto >= 1.01 ? auto : null }));
  cr.queued = false;
}

function crUpdateButton() {
  const btn = document.getElementById('cr-main');
  if (!btn || !cr.state) return;
  const st = cr.state, mine = st.bets?.[casinoDiscordId];
  btn.disabled = false;
  if (st.phase === 'running' && mine && !mine.cashedOut) {
    const m = crLocalMult();
    btn.className = 'cx-btn green lg cr-main-btn';
    btn.innerHTML = `💰 Wypłać ${cxFmt(mine.amount * m)} AT$`;
  } else if (st.phase === 'betting' && mine) {
    btn.className = 'cx-btn lg cr-main-btn'; btn.disabled = true;
    btn.innerHTML = `✓ Postawiono ${cxFmt(mine.amount)}${mine.autoCashout ? ` · auto ${mine.autoCashout.toFixed(2)}×` : ''}`;
  } else if (st.phase === 'betting') {
    btn.className = 'cx-btn gold lg cr-main-btn'; btn.innerHTML = `🚀 Postaw ${cxFmt(Number(document.getElementById('cr-bet').value) || cr.bet)} AT$`;
  } else if (cr.queued) {
    btn.className = 'cx-btn purple lg cr-main-btn'; btn.innerHTML = '⏳ W kolejce — anuluj';
  } else {
    btn.className = 'cx-btn lg cr-main-btn'; btn.innerHTML = mine?.cashedOut ? `✅ Wypłacono ${cxFmt(mine.winAmount)}` : '⏭️ Postaw w następnej rundzie';
  }
}

function crLocalMult() {
  if (!cr.state) return 1;
  if (cr.state.phase === 'crashed') return cr.state.crashPoint || cr.state.currentMultiplier;
  if (cr.state.phase !== 'running') return 1;
  const t = (performance.now() - cr.startLocal) / 1000;
  return Math.max(1, Math.floor(Math.exp(cr.growth * t) * 100) / 100);
}

socket.on('casinoCrashState', st => {
  if (!cr || st.tableId !== casinoTableId) return;
  const prev = cr.state;
  cr.state = st;
  cr.growth = st.growth || 0.07;
  if (st.phase === 'running' && prev?.phase !== 'running') cr.startLocal = performance.now() - (st.elapsedMs || 0);
  if (st.phase === 'crashed' && prev?.phase !== 'crashed') {
    cr.crashedAt = performance.now();
    cxSound.play('crash');
    const mine = st.bets?.[casinoDiscordId];
    if (mine && !mine.cashedOut) cxFloat(-mine.amount, document.getElementById('cr-mult'));
  }
  if (st.phase === 'betting' && prev?.phase !== 'betting') {
    cr.crashedAt = null;
    if (cr.queued) setTimeout(crSendBet, 200);
  }
  if (st.phase === 'betting' && st.bettingTimeLeft <= 3 && st.bettingTimeLeft > 0) cxSound.play('tick');
  // Historia
  document.getElementById('cr-history').innerHTML = (st.history || []).map(h => {
    const x = h.crashPoint, cls = x < 1.5 ? 'low' : x < 3 ? 'mid' : x < 10 ? 'high' : 'moon';
    return `<span class="cr-h ${cls}">${x.toFixed(2)}×</span>`;
  }).join('') || '<span style="color:var(--muted);font-size:12px">Brak historii</span>';
  // Lista graczy
  const bets = Object.entries(st.bets || {}).sort((a, b) => b[1].amount - a[1].amount);
  document.getElementById('cr-count').textContent = bets.length ? `(${bets.length})` : '';
  document.getElementById('cr-bets').innerHTML = bets.map(([id, b]) => {
    const lost = st.phase === 'crashed' && !b.cashedOut;
    return `<div class="cr-bet ${b.cashedOut ? 'out' : ''} ${lost ? 'lost' : ''}">${b.avatar ? `<img src="${cxEsc(b.avatar)}" alt="" onerror="this.style.display='none'">` : ''}<span>${cxEsc(b.name)}${id === casinoDiscordId ? ' (Ty)' : ''}</span>
      <span class="r">${cxShort(b.amount)} ${b.cashedOut ? `<b class="cx-pos">@${b.cashOutAt.toFixed(2)}× +${cxShort(b.winAmount)}</b>` : lost ? '<b class="cx-neg">💥</b>' : b.autoCashout ? `<span style="color:var(--muted)">auto ${b.autoCashout.toFixed(2)}×</span>` : ''}</span></div>`;
  }).join('') || '<div style="color:var(--muted);font-size:12px">Brak zakładów</div>';
  crUpdateButton();
});
socket.on('casinoCrashBetPlaced', d => { if (cr && d.tableId === casinoTableId) cxSetBalance(d.balance); });
socket.on('casinoCrashCashedOut', d => {
  if (!cr || d.tableId !== casinoTableId) return;
  cxSetBalance(d.balance);
  cxSound.play(d.multiplier >= 5 ? 'bigwin' : 'win');
  cxFloat(d.winAmount, document.getElementById('cr-mult'));
  cxToast(`💰 Wypłacono przy ${d.multiplier.toFixed(2)}× — +${cxFmt(d.winAmount)} AT$`, 'success');
  if (d.multiplier >= 10) cxBigWin({ amount: d.winAmount, bet: d.winAmount / d.multiplier, tier: d.multiplier >= 50 ? 'giga' : 'huge', title: `🚀 ${d.multiplier.toFixed(2)}×` });
});
socket.on('casinoCrashTick', () => {});

function crResize() {
  const cv = document.getElementById('cr-canvas');
  if (!cv) return;
  const r = cv.getBoundingClientRect();
  cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio;
}
window.addEventListener('resize', () => { if (cr) crResize(); });

function crLoop() {
  const cv = document.getElementById('cr-canvas');
  if (!cv || !cr) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, d = devicePixelRatio;
  if (!W) { crResize(); cr.raf = requestAnimationFrame(crLoop); return; }
  ctx.clearRect(0, 0, W, H);
  const st = cr.state;
  const multEl = document.getElementById('cr-mult'), sub = document.getElementById('cr-sub');
  const now = performance.now();
  // gwiazdy (przesuwają się w trakcie lotu)
  const speed = st?.phase === 'running' ? Math.min(6, crLocalMult()) : .3;
  cr.stars.forEach(s => { s[0] -= .0006 * speed * (s[2] + .3); if (s[0] < 0) s[0] += 1; ctx.fillStyle = `rgba(255,255,255,${.15 + s[2] * .5})`; ctx.fillRect(s[0] * W, s[1] * H * .8, (1 + s[2] * 1.5) * d, (1 + s[2] * 1.5) * d); });

  if (st) {
    const pad = 40 * d;
    let tNow = 0, mNow = 1;
    if (st.phase === 'running') { tNow = (now - cr.startLocal) / 1000; mNow = crLocalMult(); }
    else if (st.phase === 'crashed') { mNow = st.crashPoint || 1; tNow = Math.log(Math.max(1, mNow)) / cr.growth; }
    if (st.phase !== 'betting') {
      const tMax = Math.max(8, tNow * 1.15), mMax = Math.max(2, mNow * 1.2);
      const X = t => pad + (t / tMax) * (W - pad * 2);
      const Y = m => H - pad - ((m - 1) / (mMax - 1)) * (H - pad * 2);
      // siatka
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = d; ctx.font = `${11 * d}px DM Mono, monospace`; ctx.fillStyle = 'rgba(255,255,255,.35)';
      const stepM = mMax > 20 ? 10 : mMax > 6 ? 2 : mMax > 3 ? 1 : .5;
      for (let m = 1; m <= mMax; m += stepM) { ctx.beginPath(); ctx.moveTo(pad, Y(m)); ctx.lineTo(W - pad, Y(m)); ctx.stroke(); ctx.fillText(m.toFixed(stepM < 1 ? 1 : 0) + '×', 6 * d, Y(m) + 4 * d); }
      // krzywa
      const crashed = st.phase === 'crashed';
      const grad = ctx.createLinearGradient(pad, 0, W - pad, 0);
      grad.addColorStop(0, crashed ? '#ff5c7a' : '#8b6cff'); grad.addColorStop(1, crashed ? '#ff9f43' : '#3ff2a3');
      ctx.beginPath(); ctx.moveTo(X(0), Y(1));
      const N = 80;
      for (let i = 1; i <= N; i++) { const t = tNow * i / N; ctx.lineTo(X(t), Y(Math.exp(cr.growth * t))); }
      ctx.strokeStyle = grad; ctx.lineWidth = 4 * d; ctx.shadowColor = crashed ? '#ff5c7a' : '#3ff2a3'; ctx.shadowBlur = 16 * d; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.lineTo(X(tNow), H - pad); ctx.lineTo(X(0), H - pad); ctx.closePath();
      const fill = ctx.createLinearGradient(0, 0, 0, H);
      fill.addColorStop(0, crashed ? 'rgba(255,92,122,.25)' : 'rgba(63,242,163,.22)'); fill.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fill; ctx.fill();
      // rakieta / eksplozja
      const rx = X(tNow), ry = Y(mNow);
      ctx.save(); ctx.translate(rx, ry);
      if (crashed) {
        const k = Math.min(1, (now - (cr.crashedAt || now)) / 600);
        ctx.font = `${(40 + k * 30) * d}px serif`; ctx.globalAlpha = 1 - k * .3; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💥', 0, 0);
      } else {
        const dt = .05, ang = Math.atan2(Y(Math.exp(cr.growth * (tNow + dt))) - ry, X(tNow + dt) - rx);
        ctx.rotate(ang + Math.PI / 4); ctx.font = `${34 * d}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🚀', 0, 0);
      }
      ctx.restore();
    }
    // tekst
    if (st.phase === 'betting') {
      multEl.className = 'cr-mult'; multEl.textContent = `${st.bettingTimeLeft}s`;
      sub.innerHTML = 'Start za chwilę — <b>postaw zakład!</b>';
    } else if (st.phase === 'running') {
      const mine = st.bets?.[casinoDiscordId];
      multEl.className = 'cr-mult' + (mine?.cashedOut ? ' cashed' : '');
      multEl.textContent = mNow.toFixed(2) + '×';
      sub.innerHTML = mine ? (mine.cashedOut ? `Wypłacono przy <b>${mine.cashOutAt.toFixed(2)}×</b>` : `Twój zakład: <b>${cxFmt(mine.amount)}</b> → <b style="color:var(--cx-win)">${cxFmt(mine.amount * mNow)}</b>`) : 'Lot trwa…';
      crUpdateButton();
    } else {
      multEl.className = 'cr-mult crashed'; multEl.textContent = (st.crashPoint || mNow).toFixed(2) + '×';
      sub.innerHTML = '💥 <b>CRASH!</b> Kolejna runda za chwilę';
    }
  }
  cr.raf = requestAnimationFrame(crLoop);
}

document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || !cr || !document.getElementById('screen-casino-crash')?.classList.contains('active')) return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.querySelector('.cx-modal')) return;
  e.preventDefault(); crMain();
});
document.addEventListener('cx-leave', e => { if (e.detail.game === 'crash' && cr) { cancelAnimationFrame(cr.raf); cr = null; } });
