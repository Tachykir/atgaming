// ══════════════════════════════════════════════════════════════
//  KASYNO AT$ — RDZEŃ: stan, lobby, helpery UI, wejście/wyjście ze stołów
// ══════════════════════════════════════════════════════════════

let casinoWallet      = null;   // { balance, globalName, ... }
let casinoDiscordId   = null;
let casinoSocketToken = null;   // token do autoryzacji socketów kasyna
let casinoTableId     = null;   // aktywny stół
let casinoTable       = null;   // dane aktywnego stołu (z /api/casino/tables/:id)
let casinoMyHand      = [];
let casinoTableData   = null;   // ostatni stan stołu (poker/BJ)
let casinoIsObserver  = false;
let casinoLobbyTab    = 'all';
let casinoTablesCache = [];

// ── Katalog gier ──────────────────────────────────────────────
const CX_GAMES = [
  { id: 'slots',            name: 'Lucky Fruits',     cat: 'slots', icon: '🍀', g1: '#3a1450', g2: '#160822', ga: '#ff7ad9', tags: ['20 linii', 'Free Spiny ×3'], desc: 'Klasyczne owocówki z Wildami i Scatterami. 3+ 💫 = do 25 darmowych spinów z mnożnikiem ×3.' },
  { id: 'path_of_gambling', name: 'Path of Gambling', cat: 'slots', icon: '<img src="/images/slots/poelogo.png" alt="">', g1: '#3b2208', g2: '#140b03', ga: '#ffb347', tags: ['5×5', 'Pit Meter', 'Valdo ×100'], desc: 'Orby z Wraeclast. Pit Meter co 300 spinów, sticky Locki i skrzynki Valdo z mnożnikami.' },
  { id: 'jackpot_frenzy',   name: 'Jackpot Frenzy',   cat: 'slots', icon: '🏆', g1: '#3d0d1d', g2: '#16050b', ga: '#ff6b81', tags: ['Cluster Pays', '5 Jackpotów'], hot: true, desc: 'Napełniaj kociołki coinami: mnożniki, progresywne jackpoty i Dublet na planszy 10×10.' },
  { id: 'dragon_hoard',     name: 'Dragon Hoard',     cat: 'slots', icon: '🐉', g1: '#40160a', g2: '#170804', ga: '#ff8a3d', tags: ['Hold & Win', 'Grand ×1000'], isNew: true, desc: 'Rozszerzające się smoki i Hold & Win: 6+ gemów zostaje na planszy. Zapełnij wszystko = GRAND.' },
  { id: 'arcane_academy',   name: 'Arcane Academy',   cat: 'slots', icon: '🔮', g1: '#1f1450', g2: '#0b0820', ga: '#a78bfa', tags: ['Kaskady', 'Mnożnik do ×10', 'Bonus Pick'], isNew: true, desc: 'Klastry znikają, symbole spadają, a mnożnik rośnie z każdą kaskadą. Księgi otwierają Bonus Pick.' },
  { id: 'dual_blades',      name: 'Dual Blades',      cat: 'slots', icon: '⚔️', g1: '#10203d', g2: '#060b16', ga: '#60a5fa', tags: ['2 plansze', 'Sync ×2'], isNew: true, desc: 'Dwie plansze naraz. Shadow Blade przenosi wilda na drugą stronę, a podwójna wygrana daje Sync ×2.' },
  { id: 'neon_racer',       name: 'Neon Racer',       cat: 'slots', icon: '🏎️', g1: '#0b3329', g2: '#04140f', ga: '#34f5c5', tags: ['Both Ways', 'Turbo ×3'], isNew: true, desc: 'Wygrane w obie strony, rozszerzające się reflektory i Speed Meter odpalający Turbo ×3.' },
  { id: 'candy_tumble',     name: 'Candy Tumble',     cat: 'slots', icon: '🍭', g1: '#4a1040', g2: '#1c0618', ga: '#ff7ad9', tags: ['Pay Anywhere', 'Bomby ×100'], isNew: true, hot: true, desc: 'Słodycze spadają kaskadami — 8+ takich samych gdziekolwiek wygrywa. W Free Spinach bomby mnożą wygrane nawet ×100.' },
  { id: 'book_pharaoh',     name: 'Księga Faraona',   cat: 'slots', icon: '📖', g1: '#3d2a08', g2: '#140d02', ga: '#ffd36b', tags: ['10 linii', 'Rozszerzający symbol'], isNew: true, desc: 'Klasyk z Egiptu. Księga to Wild i Scatter, a w Free Spinach wybrany symbol rozszerza się na całe bębny.' },
  { id: 'hot_777',          name: 'Hot 777',          cat: 'slots', icon: '🔥', g1: '#40100a', g2: '#170503', ga: '#ff5a3b', tags: ['3×3', 'Fire Respin', 'Koło ×10'], isNew: true, desc: 'Ognisty klasyk 3×3. Dwa pełne bębny odpalają Fire Respin, a pełny ekran kręci kołem mnożników do ×10.' },
  { id: 'crash',            name: 'Crash',            cat: 'quick', icon: '🚀', g1: '#1d1240', g2: '#090616', ga: '#8b6cff', tags: ['Multiplayer', 'Auto cash-out'], hot: true, desc: 'Rakieta leci, mnożnik rośnie. Wypłać zanim wybuchnie — albo ustaw automatyczny cash-out.' },
  { id: 'roulette',         name: 'Ruletka',          cat: 'quick', icon: '🎡', g1: '#0e3a26', g2: '#05160e', ga: '#3ff2a3', tags: ['Europejska', 'Multiplayer'], desc: 'Klasyczna ruletka z jednym zerem. Stawiaj żetony na planszy razem z innymi graczami.' },
  { id: 'pachinko',         name: 'Pachinko',         cat: 'quick', icon: '🎯', g1: '#2a1040', g2: '#0e0618', ga: '#f472b6', tags: ['Plinko', 'do ×1000'], desc: 'Kulka odbija się od kołków i ląduje w mnożniku. Trzy poziomy ryzyka, do 10 kulek naraz.' },
  { id: 'coinflip',         name: 'Coinflip',         cat: 'quick', icon: '🪙', g1: '#3a2c0a', g2: '#151004', ga: '#ffd36b', tags: ['PvP', 'Solo ×1.96'], desc: 'Rzuć wyzwanie innym graczom albo zagraj solo przeciwko kasynu.' },
  { id: 'poker',            name: "Texas Hold'em",    cat: 'tables', icon: '🃏', g1: '#0e3a26', g2: '#05160e', ga: '#3ff2a3', tags: ['2–8 graczy'], desc: 'Poker przy prawdziwym stole: blindy, side-poty, timer tury.' },
  { id: 'blackjack',        name: 'Blackjack',        cat: 'tables', icon: '♠️', g1: '#3d0f22', g2: '#160610', ga: '#ff6f8a', tags: ['3:2', 'Split', 'Double'], desc: 'Pokonaj krupiera. Split, double, krupier stoi na soft 17.' },
];
const CX_GAME = Object.fromEntries(CX_GAMES.map(g => [g.id, g]));
const CX_LEVEL_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

// ── Helpery ───────────────────────────────────────────────────
function cxEsc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function cxFmt(n) { return Math.floor(Number(n) || 0).toLocaleString('pl-PL'); }
function cxShort(v) {
  v = Number(v) || 0;
  if (v >= 1e9) return (v / 1e9).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + 'B';
  if (v >= 1e6) return (v / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + 'M';
  if (v >= 1e3) return (v / 1e3).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + 'k';
  return String(Math.floor(v));
}
function fmtChip(v) { return cxShort(v); }
function cxLevelOf(t) { return t.config?.level || (t.config?.minBet >= 1e6 ? 'high' : t.config?.minBet >= 1e4 ? 'medium' : 'low'); }
function cxAvatar(url, name) {
  const letter = cxEsc((name || '?')[0].toUpperCase());
  return url ? `<img src="${cxEsc(url)}" alt="" onerror="this.outerHTML='<div class=&quot;av&quot;>${letter}</div>'">` : `<div class="av">${letter}</div>`;
}

// Stawki 1-2-5 w zakresie stołu
function cxBetSteps(min, max) {
  const steps = new Set([min]);
  let base = Math.pow(10, Math.floor(Math.log10(Math.max(1, min))));
  for (let i = 0; i < 40; i++) {
    for (const m of [1, 2, 5]) { const v = base * m; if (v > min && v < max) steps.add(v); }
    base *= 10;
    if (base > max) break;
  }
  steps.add(max);
  return [...steps].sort((a, b) => a - b);
}

// Saldo: aktualizuje portfel i wszystkie widoczne liczniki salda
function cxSetBalance(bal, flash = true) {
  if (bal === null || bal === undefined || isNaN(bal)) return;
  const prev = casinoWallet ? casinoWallet.balance : bal;
  if (casinoWallet) casinoWallet.balance = bal;
  document.querySelectorAll('[data-cx-balance]').forEach(el => {
    el.textContent = cxFmt(bal) + ' AT$';
    if (flash && bal !== prev) {
      el.classList.remove('up', 'down'); void el.offsetWidth;
      el.classList.add(bal > prev ? 'up' : 'down');
      setTimeout(() => el.classList.remove('up', 'down'), 900);
    }
  });
}
function cxBalance() { return casinoWallet ? casinoWallet.balance : 0; }

function cxToast(msg, type = '') { if (typeof showToast === 'function') showToast(msg, type); }

// Pływające kwoty
function cxFloat(amount, anchor) {
  const el = document.createElement('div');
  el.className = 'cx-float' + (amount < 0 ? ' neg' : '');
  el.textContent = (amount >= 0 ? '+' : '') + cxFmt(amount) + ' AT$';
  let x = window.innerWidth / 2, y = window.innerHeight / 2;
  if (anchor) { const r = anchor.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
  el.style.left = (x - 60) + 'px'; el.style.top = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function cxCoinRain(n = 30, emojis = ['🪙', '💰', '✨']) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'cx-coin-rain';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.fontSize = (18 + Math.random() * 22) + 'px';
    el.style.animationDuration = (1.8 + Math.random() * 2.2) + 's';
    el.style.animationDelay = (Math.random() * 1.2) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5200);
  }
}

// Duża wygrana — nakładka z eskalacją (Big → Mega → Huge → Giga → Frito),
// licznikiem kwoty i fontanną monet. Zwraca Promise (po zamknięciu).
const CX_TIER_ORDER = ['none', 'win', 'big', 'mega', 'huge', 'giga', 'frito'];
const CX_LADDER = [[0, 'BIG WIN', 'mega'], [15, 'MEGA WIN', 'mega'], [40, 'HUGE WIN', 'huge'], [100, 'GIGA WIN', 'giga'], [300, 'MEGA GIGA FRITO WIN', 'frito']];
function cxCoinFountain(canvas, getIntensity) {
  const ctx = canvas.getContext('2d');
  const coins = [];
  let raf, alive = true;
  const resize = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; };
  resize();
  const loop = () => {
    if (!alive) return;
    const W = canvas.width, H = canvas.height, d = devicePixelRatio;
    const k = getIntensity();
    for (let i = 0; i < k; i++) {
      const fromSide = Math.random() < .3;
      coins.push({ x: fromSide ? (Math.random() < .5 ? 0 : W) : W / 2 + (Math.random() - .5) * W * .2, y: H + 20 * d,
        vx: 0,
        vy: -(Math.random() * 14 + 16) * d, r: (10 + Math.random() * 10) * d, spin: Math.random() * 6, vs: .15 + Math.random() * .25, gem: Math.random() < .12 });
      const c = coins[coins.length - 1];
      c.vx = c.x === 0 ? (4 + Math.random() * 6) * d : c.x === W ? -(4 + Math.random() * 6) * d : (Math.random() - .5) * 14 * d;
    }
    ctx.clearRect(0, 0, W, H);
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.x += c.vx; c.y += c.vy; c.vy += .45 * d; c.spin += c.vs;
      if (c.y > H + 60 * d) { coins.splice(i, 1); continue; }
      const sx = Math.abs(Math.cos(c.spin));
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(Math.max(.12, sx), 1);
      if (c.gem) {
        ctx.rotate(.785); const g = ctx.createLinearGradient(-c.r, -c.r, c.r, c.r);
        g.addColorStop(0, '#e9fff4'); g.addColorStop(.5, '#3ff2a3'); g.addColorStop(1, '#0a6a3e');
        ctx.fillStyle = g; ctx.fillRect(-c.r * .7, -c.r * .7, c.r * 1.4, c.r * 1.4);
      } else {
        const g = ctx.createRadialGradient(-c.r * .3, -c.r * .3, c.r * .1, 0, 0, c.r);
        g.addColorStop(0, '#fff6d0'); g.addColorStop(.45, '#ffd36b'); g.addColorStop(.85, '#e09500'); g.addColorStop(1, '#8a5200');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(122,70,0,.7)'; ctx.lineWidth = c.r * .14; ctx.beginPath(); ctx.arc(0, 0, c.r * .72, 0, Math.PI * 2); ctx.stroke();
        if (sx > .45) { ctx.fillStyle = 'rgba(122,70,0,.85)'; ctx.font = `800 ${c.r}px Syne, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1); }
      }
      ctx.restore();
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => { alive = false; cancelAnimationFrame(raf); };
}
function cxBigWin({ amount, bet, tier, label, title }) {
  return new Promise(resolve => {
    const mult = bet ? amount / bet : 25;
    const steps = CX_LADDER.filter(s => s[0] <= mult);
    const ov = document.createElement('div');
    ov.className = 'cx-bigwin t-' + steps[0][2];
    ov.innerHTML = `<div class="bw-rays"></div><canvas></canvas>${title ? `<div class="bw-title">${cxEsc(title)}</div>` : ''}<div class="bw-label">${steps[0][1]}</div>
      <div class="bw-amt">0 AT$</div><div class="bw-bar"><i></i></div><div class="bw-mult">${bet ? mult.toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + '× stawki' : ''}</div>
      <div class="bw-hint">kliknij, aby pominąć</div>`;
    document.body.appendChild(ov);
    const amtEl = ov.querySelector('.bw-amt'), lbl = ov.querySelector('.bw-label'), bar = ov.querySelector('.bw-bar i');
    const dur = Math.min(7000, 1600 + steps.length * 1200);
    let stage = 0, counting = true, closed = false, autoClose = null;
    const stopCoins = cxCoinFountain(ov.querySelector('canvas'), () => counting ? 2 + stage * 2 : (Math.random() < .3 ? 1 : 0));
    cxSound.play('bigwin');
    const t0 = performance.now();
    const setStage = i => {
      if (i === stage) return;
      stage = i;
      ov.className = 'cx-bigwin t-' + steps[i][2];
      lbl.textContent = steps[i][1];
      lbl.classList.remove('bump'); void lbl.offsetWidth; lbl.classList.add('bump');
      cxSound.play('feature');
    };
    const close = () => {
      if (closed) return;
      closed = true; counting = false; clearTimeout(autoClose);
      ov.style.transition = 'opacity .3s'; ov.style.opacity = '0';
      setTimeout(() => { stopCoins(); ov.remove(); resolve(); }, 300);
    };
    const finish = () => {
      counting = false; setStage(steps.length - 1);
      amtEl.textContent = cxFmt(amount) + ' AT$'; bar.style.width = '100%';
      ov.querySelector('.bw-hint').textContent = 'kliknij, aby kontynuować';
      autoClose = setTimeout(close, 2200);
    };
    const step = now => {
      if (!counting) return;
      const p = Math.min(1, (now - t0) / dur);
      const cur = amount * (1 - Math.pow(1 - p, 2.2));
      amtEl.textContent = cxFmt(cur) + ' AT$';
      bar.style.width = (p * 100) + '%';
      const m = bet ? cur / bet : 0;
      let si = 0; steps.forEach((s, i) => { if (m >= s[0]) si = i; });
      setStage(si);
      if (Math.random() < .3) cxSound.play('tick');
      if (p < 1) requestAnimationFrame(step); else finish();
    };
    ov.addEventListener('click', () => { if (counting) finish(); else close(); });
    requestAnimationFrame(step);
  });
}
// Splash rozpoczęcia bonusu
function cxSplash({ title, sub, icon = '🎁', color = '#8b6cff', ms = 1900 }) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'cx-splash';
    ov.style.setProperty('--sp', color);
    ov.innerHTML = `<div class="sp-box"><div class="sp-ico">${icon}</div><div class="sp-title">${title}</div>${sub ? `<div class="sp-sub">${sub}</div>` : ''}</div>`;
    document.body.appendChild(ov);
    cxSound.play('feature');
    cxCoinRain(18, ['✨', '⭐', '💫']);
    let done = false;
    const close = () => { if (done) return; done = true; ov.style.transition = 'opacity .25s'; ov.style.opacity = '0'; setTimeout(() => { ov.remove(); resolve(); }, 250); };
    ov.onclick = close;
    setTimeout(close, ms);
  });
}

function cxModal(html, { onClose, wide } = {}) {
  const ov = document.createElement('div');
  ov.className = 'cx-modal';
  ov.innerHTML = `<div class="cx-modal-box" style="${wide ? 'max-width:900px' : ''}"><button class="cx-icon-btn cx-modal-close" aria-label="Zamknij">✕</button>${html}</div>`;
  const close = () => { ov.remove(); onClose && onClose(); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('.cx-modal-close').onclick = close;
  document.body.appendChild(ov);
  return { el: ov, close };
}

// ── Karty ─────────────────────────────────────────────────────
function cxCard(card, { small = false, cls = '', delay = 0 } = {}) {
  const st = delay ? ` style="animation-delay:${delay}ms"` : '';
  if (!card || card === '??') return `<div class="cx-card back${small ? ' sm' : ''} ${cls}"${st}><span></span></div>`;
  const suit = card.slice(-1), rank = card.slice(0, -1);
  const red = suit === '♥' || suit === '♦';
  return `<div class="cx-card${red ? ' red' : ''}${small ? ' sm' : ''} ${cls}"${st}><div class="r">${rank}<i>${suit}</i></div><div class="c">${suit}</div><div class="r b">${rank}<i>${suit}</i></div></div>`;
}
function cxHandValue(cards) {
  let v = 0, aces = 0;
  for (const c of cards || []) {
    if (!c || c === '??') continue;
    const r = c.slice(0, -1);
    if (['J', 'Q', 'K'].includes(r)) v += 10; else if (r === 'A') { v += 11; aces++; } else v += parseInt(r) || 0;
  }
  while (v > 21 && aces > 0) { v -= 10; aces--; }
  return v;
}

// ── Dźwięki (WebAudio, bez plików) ────────────────────────────
const cxSound = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('cx_muted') === '1'; } catch (e) {}
  const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } return ctx; };
  const tone = (freq, dur = .08, type = 'sine', vol = .06, when = 0) => {
    const a = ac(); if (!a || muted) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    const t = a.currentTime + when;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .02);
  };
  const sounds = {
    click: () => tone(900, .04, 'square', .03),
    chip: () => { tone(1400, .03, 'triangle', .05); tone(1900, .03, 'triangle', .03, .03); },
    stop: () => tone(180, .07, 'triangle', .07),
    win: () => [523, 659, 784].forEach((f, i) => tone(f, .14, 'sine', .06, i * .07)),
    bigwin: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .25, 'triangle', .07, i * .1)),
    feature: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'square', .04, i * .08)),
    lose: () => tone(160, .2, 'sawtooth', .03),
    tick: () => tone(1200, .02, 'square', .02),
    crash: () => { tone(120, .5, 'sawtooth', .07); tone(80, .6, 'square', .05, .05); },
  };
  return {
    play(name) { try { sounds[name] && sounds[name](); } catch (e) {} },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('cx_muted', muted ? '1' : '0'); } catch (e) {} return muted; },
  };
})();

// ── Powłoka ekranu gry (nagłówek) ─────────────────────────────
function cxTopbar({ icon, title, sub, info }) {
  return `<div class="cx-topbar">
    <button class="cx-back" onclick="leaveCasinoTable()">← Lobby</button>
    <div class="cx-title"><div class="cx-title-icon">${icon || '🎰'}</div><div style="min-width:0"><h2>${cxEsc(title)}</h2>${sub ? `<small>${sub}</small>` : ''}</div></div>
    ${info ? `<button class="cx-icon-btn" title="Zasady i wypłaty" onclick="${info}">ℹ️</button>` : ''}
    <button class="cx-icon-btn${cxSound.muted ? '' : ' on'}" title="Dźwięk" onclick="this.classList.toggle('on', !cxSound.toggle())">🔊</button>
    <div class="cx-balance"><span>Saldo</span><b data-cx-balance>${cxFmt(cxBalance())} AT$</b></div>
  </div>`;
}
function cxScreen(screenId) {
  const el = document.getElementById('screen-' + screenId);
  el.classList.add('cx-screen');
  return el;
}

// Żetony (szybki wybór stawki)
function cxChips(container, values, onSelect, activeValue) {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;
  container.classList.add('cx-chips');
  container.innerHTML = '';
  values.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cx-chip c' + (i % 7) + (v === activeValue ? ' active' : '');
    b.textContent = cxShort(v);
    b.dataset.value = v;
    b.onclick = () => {
      container.querySelectorAll('.cx-chip').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      cxSound.play('chip');
      onSelect && onSelect(v);
    };
    container.appendChild(b);
  });
}
// Zgodność wsteczna (stary kod)
function renderChipBtns(containerId, values, inputId, onSelect) {
  cxChips(containerId, values, v => { const inp = document.getElementById(inputId); if (inp) inp.value = v; onSelect && onSelect(v); });
}
// Typowe żetony dla stołu
function cxChipValues(min, max, n = 6) {
  const steps = cxBetSteps(min, max);
  if (steps.length <= n) return steps;
  const out = [];
  for (let i = 0; i < n; i++) out.push(steps[Math.round(i * (steps.length - 1) / (n - 1))]);
  return [...new Set(out)];
}

// Postęp do terminu z serwera (np. timer tury) — 1 → 0
function cxDeadlinePct(deadline, serverNow, totalSec) {
  if (!deadline) return 0;
  const skew = serverNow ? Date.now() - serverNow : 0;
  return Math.max(0, Math.min(1, (deadline - (Date.now() - skew)) / (totalSec * 1000)));
}

// ══ LOBBY ═════════════════════════════════════════════════════
async function loadCasinoLobby() {
  const root = document.getElementById('cx-lobby');
  if (!root) return;
  if (!root.dataset.built) { root.dataset.built = '1'; root.innerHTML = cxLobbySkeleton(); }
  try {
    const res = await fetch('/api/casino/wallet');
    if (res.ok) {
      const d = await res.json();
      casinoWallet = d.wallet;
      casinoDiscordId = d.discordId;
    } else casinoWallet = null;
  } catch (e) {}
  if (!casinoDiscordId && typeof discordUser !== 'undefined' && discordUser) casinoDiscordId = discordUser.id;
  if (casinoDiscordId && !casinoSocketToken) {
    try { const tr = await fetch('/auth/socket-token'); if (tr.ok) casinoSocketToken = (await tr.json()).token; } catch (e) {}
  }
  renderCasinoHero();
  try { casinoTablesCache = await (await fetch('/api/casino/tables')).json(); } catch (e) {}
  renderCasinoTables(casinoTablesCache);
  try { renderCasinoLB(await (await fetch('/api/casino/leaderboard')).json()); } catch (e) {}
}
// Zgodność: wywoływane z innych miejsc aplikacji
function renderCasinoWallet() { renderCasinoHero(); }
async function loadCasinoWalletOnly() { return loadCasinoLobby(); }

function cxLobbySkeleton() {
  const tabs = [['all', '✨ Wszystkie'], ['slots', '🎰 Automaty'], ['quick', '⚡ Szybkie gry'], ['tables', '🃏 Stoły'], ['ranking', '🏆 Ranking']];
  return `
    <div class="cx-row" style="justify-content:space-between">
      <button class="cx-back" onclick="goHome()">← Strona główna</button>
      <button class="cx-icon-btn" title="Odśwież" onclick="loadCasinoLobby()">🔄</button>
    </div>
    <div class="cx-hero" id="cx-hero"></div>
    <div class="cx-tabs" id="cx-tabs">${tabs.map(([k, l]) => `<button class="cx-tab${k === casinoLobbyTab ? ' active' : ''}" data-tab="${k}" onclick="cxSetLobbyTab('${k}')">${l}</button>`).join('')}</div>
    <div id="cx-sec-slots"><div class="cx-section-title"><h3>🎰 Automaty</h3></div><div class="cx-games" id="cx-slots-grid"></div></div>
    <div id="cx-sec-quick"><div class="cx-section-title"><h3>⚡ Szybkie gry</h3></div><div class="cx-games" id="cx-quick-grid"></div></div>
    <div id="cx-sec-tables">
      <div class="cx-section-title"><h3>🃏 Texas Hold'em</h3><button class="cx-btn green sm" data-needs-login onclick="showCreateTableDialog('poker')">+ Nowy stół</button></div>
      <div class="cx-tables" id="casino-poker-tables"></div>
      <div class="cx-section-title" style="margin-top:18px"><h3>♠️ Blackjack</h3><button class="cx-btn red sm" data-needs-login onclick="showCreateTableDialog('blackjack')">+ Nowy stół</button></div>
      <div class="cx-tables" id="casino-bj-tables"></div>
      <div class="cx-section-title" style="margin-top:18px"><h3>🪙 Stoły Coinflip graczy</h3><button class="cx-btn gold sm" data-needs-login onclick="showCreateTableDialog('coinflip')">+ Nowy stół</button></div>
      <div class="cx-tables" id="casino-coinflip-tables"></div>
    </div>
    <div id="cx-sec-ranking"><div class="cx-section-title"><h3>🏆 Ranking AT$</h3></div>
      <div class="cx-panel" style="overflow-x:auto"><table class="cx-lb"><thead><tr><th>#</th><th>Gracz</th><th>Saldo</th><th>Zysk</th><th>Gry</th></tr></thead><tbody id="casino-lb-body"><tr><td colspan="5" style="text-align:center;color:var(--muted)">Ładowanie…</td></tr></tbody></table></div>
    </div>
    <div class="cx-note">💡 Każdy gracz startuje z <b style="color:var(--cx-gold)">100 000 AT$</b>. Co niedzielę gracze poniżej 10 000 AT$ dostają doładowanie do 100 000 AT$. Automaty mają RTP ok. 95–96%, a wygrana jest dokładnie tym, co widać na planszy.</div>`;
}

function cxSetLobbyTab(tab) {
  casinoLobbyTab = tab;
  document.querySelectorAll('#cx-tabs .cx-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const show = { slots: ['all', 'slots'], quick: ['all', 'quick'], tables: ['all', 'tables'], ranking: ['all', 'ranking'] };
  for (const [sec, tabs] of Object.entries(show)) {
    const el = document.getElementById('cx-sec-' + sec);
    if (el) el.style.display = tabs.includes(tab) ? '' : 'none';
  }
}

function renderCasinoHero() {
  const el = document.getElementById('cx-hero');
  if (!el) return;
  const w = casinoWallet;
  const du = typeof discordUser !== 'undefined' ? discordUser : null;
  if (!w) {
    el.innerHTML = `<div><h1>AT Gaming <em>Casino</em></h1><p>Automaty, ruletka, crash, poker i blackjack — graj za wirtualne AT$ i wspinaj się w rankingu.</p>
      <div class="cx-hero-user">${du ? `<span class="cx-pill">⏳ Ładowanie portfela…</span>` : `<button class="cx-btn purple lg" onclick="loginWithDiscord()">Zaloguj przez Discord, aby grać</button>`}</div></div>
      <div class="cx-hero-wallet"><span>Saldo</span><b>— AT$</b></div>`;
    if (du) setTimeout(() => { if (!casinoWallet) loadCasinoLobby(); }, 1500);
  } else {
    const profit = (w.totalWon || 0) - (w.totalLost || 0);
    el.innerHTML = `<div><h1>Witaj w <em>AT Casino</em></h1><p>Wybierz grę poniżej. Stawki Low / Medium / High decydują o zakresie zakładów.</p>
      <div class="cx-hero-user">${w.avatar ? `<img src="${cxEsc(w.avatar)}" alt="" onerror="this.style.display='none'">` : ''}<div><div style="font-weight:800">${cxEsc(w.globalName)}</div>
        <div class="cx-hero-stats"><span class="cx-pill">Gry: <b>${cxFmt(w.gamesPlayed)}</b></span><span class="cx-pill">Bilans: <b class="${profit >= 0 ? 'cx-pos' : 'cx-neg'}">${profit >= 0 ? '+' : ''}${cxFmt(profit)}</b></span></div></div></div></div>
      <div class="cx-hero-wallet"><span>Twoje saldo</span><b data-cx-balance>${cxFmt(w.balance)} AT$</b></div>`;
  }
  document.querySelectorAll('[data-needs-login]').forEach(b => b.style.display = w ? '' : 'none');
}

function cxGameTile(g, tables) {
  const byLevel = {};
  tables.forEach(t => { byLevel[cxLevelOf(t)] = byLevel[cxLevelOf(t)] || t; });
  const levels = ['low', 'medium', 'high'].filter(l => byLevel[l]);
  const stakes = levels.length > 1
    ? `<div class="cx-stakes">${levels.map(l => { const t = byLevel[l]; return `<button class="cx-stake" onclick="openCasinoTable('${t.id}')">${CX_LEVEL_LABEL[l]}<small>${cxShort(t.config.minBet)}–${cxShort(t.config.maxBet)}</small></button>`; }).join('')}</div>`
    : tables[0] ? `<div class="cx-stakes"><button class="cx-stake" onclick="openCasinoTable('${tables[0].id}')">Zagraj<small>${cxShort(tables[0].config.minBet)}–${cxShort(tables[0].config.maxBet || tables[0].config.minBet * 1000)}</small></button></div>` : '';
  const online = tables.reduce((s, t) => s + (t.playerCount || 0), 0);
  return `<div class="cx-game" style="--g1:${g.g1};--g2:${g.g2};--ga:${g.ga}">
    <div class="cx-game-art">${g.icon}</div>
    <div class="cx-game-tags">${g.hot ? '<span class="cx-tag hot">🔥 Hot</span>' : ''}${g.isNew ? '<span class="cx-tag new">Nowość</span>' : ''}${g.tags.map(t => `<span class="cx-tag">${t}</span>`).join('')}</div>
    <h4>${g.name}</h4><p>${g.desc}</p>
    ${online ? `<div class="cx-online">● ${online} przy stole</div>` : ''}
    ${stakes}
  </div>`;
}

function renderCasinoTables(tables) {
  casinoTablesCache = tables || [];
  const by = id => casinoTablesCache.filter(t => t.game === id);
  const slots = document.getElementById('cx-slots-grid');
  if (slots) slots.innerHTML = CX_GAMES.filter(g => g.cat === 'slots').map(g => cxGameTile(g, by(g.id))).join('');
  const quick = document.getElementById('cx-quick-grid');
  if (quick) quick.innerHTML = CX_GAMES.filter(g => g.cat === 'quick').map(g => cxGameTile(g, by(g.id).filter(t => !t.createdBy))).join('');
  const listTables = (id, game, cls) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ts = by(game).filter(t => game !== 'coinflip' || t.createdBy);
    el.innerHTML = ts.length ? ts.map(t => renderTableCard(t, cls)).join('') : `<div class="cx-empty">Brak stołów — utwórz pierwszy!</div>`;
  };
  listTables('casino-poker-tables', 'poker', '');
  listTables('casino-bj-tables', 'blackjack', 'bj');
  listTables('casino-coinflip-tables', 'coinflip', 'cf');
  cxSetLobbyTab(casinoLobbyTab);
  document.querySelectorAll('[data-needs-login]').forEach(b => b.style.display = casinoWallet ? '' : 'none');
}

function renderTableCard(t, cls = '') {
  const statusLabels = { open: 'Wolny', betting: 'Zakłady', playing: 'W grze', results: 'Wyniki', showdown: 'Showdown', spinning: 'Obrót' };
  const seats = t.maxPlayers && t.maxPlayers <= 10 ? `<div class="cx-seats">${Array.from({ length: t.maxPlayers }, (_, i) => {
    const p = t.players[i];
    return p ? `<div class="cx-seat-dot on" title="${cxEsc(p.name)}">${p.avatar ? `<img src="${cxEsc(p.avatar)}" alt="">` : cxEsc(p.name[0])}</div>` : '<div class="cx-seat-dot"></div>';
  }).join('')}</div>` : '';
  let stakes = '';
  if (t.game === 'poker') stakes = `Blindy ${cxShort(t.config.blindAmount)}/${cxShort(t.config.blindAmount * 2)} · Buy-in ${cxShort(t.config.minBuyIn)}–${cxShort(t.config.maxBuyIn)}`;
  else if (t.game === 'blackjack') stakes = `Zakład ${cxShort(t.config.minBet)}–${cxShort(t.config.maxBet)} AT$`;
  else stakes = `Min. stawka ${cxShort(t.config.minBet)} AT$`;
  const mine = t.createdBy?.id && t.createdBy.id === casinoDiscordId;
  return `<div class="cx-table-card ${cls}" onclick="openCasinoTable('${t.id}')">
    <span class="cx-status ${t.status}">${statusLabels[t.status] || t.status}</span>
    <h5>${cxEsc(t.name)}</h5>
    <div style="font-size:12px;color:var(--muted)">${stakes}</div>
    ${seats}
    <div class="cx-row" style="justify-content:space-between"><span style="font-size:11px;color:var(--muted)">${t.createdBy ? 'Założył: ' + cxEsc(t.createdBy.name) : ''}</span>
    ${mine && t.playerCount === 0 ? `<button class="cx-btn sm red" onclick="event.stopPropagation();deleteCasinoTable('${t.id}')">Usuń</button>` : ''}</div>
  </div>`;
}

function renderCasinoLB(lb) {
  const body = document.getElementById('casino-lb-body');
  if (!body) return;
  body.innerHTML = (lb || []).map((p, i) => {
    const profit = Number(p.profit) || 0;
    return `<tr class="${p.discordId === casinoDiscordId ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td>
      <td><div class="who"><img src="${cxEsc(p.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png')}" onerror="this.style.visibility='hidden'" alt="">${cxEsc(p.globalName)}</div></td>
      <td class="num" style="color:var(--cx-gold)">${cxFmt(p.balance)}</td>
      <td class="num ${profit >= 0 ? 'cx-pos' : 'cx-neg'}">${profit >= 0 ? '+' : ''}${cxFmt(profit)}</td>
      <td class="num">${cxFmt(p.gamesPlayed)}</td></tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Brak danych</td></tr>';
}

// ── Tworzenie / usuwanie stołów ───────────────────────────────
let _createTableGame = null;
function showCreateTableDialog(game) {
  if (!casinoWallet) return cxToast('Wymagane logowanie Discord!', 'error');
  _createTableGame = game;
  const fields = game === 'poker' ? `
      <label>Nazwa stołu<input class="input" id="ct-name" maxlength="40" value="Stół pokera"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label>Small blind (AT$)<input class="input" id="ct-blind" type="number" value="50" min="5" max="1000"></label>
        <label>Maks. graczy<input class="input" id="ct-maxp" type="number" value="6" min="2" max="8"></label>
        <label>Min. buy-in<input class="input" id="ct-minbi" type="number" value="1000" min="100"></label>
        <label>Maks. buy-in<input class="input" id="ct-maxbi" type="number" value="5000" min="500"></label>
      </div>`
    : game === 'coinflip' ? `
      <label>Nazwa stołu<input class="input" id="ct-name" maxlength="40" value="Mój Coinflip"></label>
      <label>Min. stawka (AT$)<input class="input" id="ct-minbet" type="number" value="100" min="10"></label>`
    : `
      <label>Nazwa stołu<input class="input" id="ct-name" maxlength="40" value="Stół blackjacka"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label>Min. zakład<input class="input" id="ct-minbet" type="number" value="50" min="10"></label>
        <label>Maks. zakład<input class="input" id="ct-maxbet" type="number" value="500" min="50"></label>
        <label>Maks. graczy<input class="input" id="ct-maxp" type="number" value="5" min="1" max="7"></label>
      </div>`;
  const titles = { poker: "🃏 Nowy stół Texas Hold'em", blackjack: '♠️ Nowy stół Blackjacka', coinflip: '🪙 Nowy stół Coinflip' };
  const m = cxModal(`<h3>${titles[game]}</h3><div style="display:flex;flex-direction:column;gap:10px;font-size:12px;color:var(--muted)">${fields}</div>
    <div class="cx-row" style="margin-top:16px;justify-content:flex-end"><button class="cx-btn" id="ct-cancel">Anuluj</button><button class="cx-btn gold" id="ct-ok">Utwórz stół</button></div>`);
  m.el.querySelector('.cx-modal-box').style.maxWidth = '460px';
  m.el.querySelector('#ct-cancel').onclick = m.close;
  m.el.querySelector('#ct-ok').onclick = () => submitCreateTable(m.close);
}
function closeCreateTableDialog() { document.querySelector('.cx-modal')?.remove(); }
async function submitCreateTable(close) {
  const game = _createTableGame;
  const v = id => Number(document.getElementById(id)?.value);
  const name = document.getElementById('ct-name')?.value?.trim() || '';
  let config = {};
  if (game === 'poker') config = { blindAmount: v('ct-blind') || 50, minBuyIn: v('ct-minbi') || 1000, maxBuyIn: v('ct-maxbi') || 5000, maxPlayers: v('ct-maxp') || 6 };
  else if (game === 'coinflip') config = { minBet: v('ct-minbet') || 100 };
  else config = { minBet: v('ct-minbet') || 50, maxBet: v('ct-maxbet') || 500, maxPlayers: v('ct-maxp') || 5 };
  try {
    const res = await fetch('/api/casino/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game, name, config }) });
    const data = await res.json();
    if (data.error) return cxToast(data.error, 'error');
    close && close();
    cxToast(`✅ Stół "${data.table.name}" utworzony!`, 'success');
    openCasinoTable(data.table.id);
  } catch (e) { cxToast('Błąd tworzenia stołu', 'error'); }
}
async function deleteCasinoTable(tableId) {
  if (!confirm('Usunąć ten stół?')) return;
  try {
    const d = await (await fetch(`/api/casino/tables/${tableId}`, { method: 'DELETE' })).json();
    if (d.error) cxToast(d.error, 'error'); else { cxToast('Stół usunięty', 'success'); loadCasinoLobby(); }
  } catch (e) { cxToast('Błąd', 'error'); }
}

socket.on('casinoTablesUpdated', () => {
  if (document.getElementById('screen-casino-lobby')?.classList.contains('active')) loadCasinoLobby();
});

// ══ OTWIERANIE STOŁU ══════════════════════════════════════════
const GAME_SCREENS = { poker: 'casino-poker', blackjack: 'casino-blackjack', slots: 'casino-slots', roulette: 'casino-roulette', pachinko: 'casino-pachinko', crash: 'casino-crash', coinflip: 'casino-coinflip', path_of_gambling: 'casino-path', jackpot_frenzy: 'casino-jf', dragon_hoard: 'casino-dh', arcane_academy: 'casino-aa', dual_blades: 'casino-db', neon_racer: 'casino-nr', candy_tumble: 'casino-ct', book_pharaoh: 'casino-bp', hot_777: 'casino-h7' };
const GAME_INITS = { slots: 'initSlotsUI', path_of_gambling: 'initPathUI', jackpot_frenzy: 'initJFUI', dragon_hoard: 'initDHUI', arcane_academy: 'initAAUI', dual_blades: 'initDBUI', neon_racer: 'initNRUI', candy_tumble: 'initCTUI', book_pharaoh: 'initBPUI', hot_777: 'initH7UI', roulette: 'initRouletteUI', pachinko: 'initPachinkoUI', crash: 'initCrashUI', coinflip: 'initCoinflipUI', poker: 'initPokerUI', blackjack: 'initBJUI' };

function cxAuth(extra = {}) { return { tableId: casinoTableId, discordId: casinoDiscordId, socketToken: casinoSocketToken, ...extra }; }

async function openCasinoTable(tableId) {
  let table;
  try {
    const r = await fetch(`/api/casino/tables/${tableId}`);
    if (!r.ok) throw new Error();
    table = await r.json();
  } catch (e) { return cxToast('Stół nie istnieje lub brak połączenia', 'error'); }

  if (!casinoDiscordId && typeof discordUser !== 'undefined' && discordUser) casinoDiscordId = discordUser.id;
  if (!casinoDiscordId) return cxToast('Zaloguj się przez Discord, żeby grać!', 'error');
  if (!casinoWallet) {
    try { const wr = await fetch('/api/casino/wallet'); if (wr.ok) { const wd = await wr.json(); casinoWallet = wd.wallet; casinoDiscordId = wd.discordId || casinoDiscordId; } } catch (e) {}
  }
  if (!casinoSocketToken) {
    try { const tr = await fetch('/auth/socket-token'); if (tr.ok) casinoSocketToken = (await tr.json()).token; } catch (e) {}
  }
  if (casinoTableId && casinoTableId !== tableId) socket.emit('casinoLeaveTable', cxAuth());

  casinoTableId = tableId;
  casinoTable = table;
  casinoIsObserver = true;
  casinoMyHand = [];
  casinoTableData = null;

  const init = window[GAME_INITS[table.game]];
  if (typeof init === 'function') init(table);
  socket.emit('casinoObserveTable', cxAuth());
  showScreen(GAME_SCREENS[table.game] || 'casino-lobby');
  window.scrollTo(0, 0);
}

function cxJoinSeat(buyIn) { socket.emit('casinoJoinTable', cxAuth({ buyIn })); }

function leaveCasinoTable() {
  if (casinoTableId) socket.emit('casinoLeaveTable', cxAuth());
  document.dispatchEvent(new CustomEvent('cx-leave', { detail: { tableId: casinoTableId, game: casinoTable?.game } }));
  casinoTableId = null;
  casinoTable = null;
  showScreen('casino-lobby');
}

// ── Wspólne eventy ────────────────────────────────────────────
socket.on('casinoJoined', ({ tableId, sessionChips, walletBalance }) => {
  if (tableId !== casinoTableId) return;
  casinoIsObserver = false;
  cxSetBalance(walletBalance);
  cxToast(`✅ Siadasz do stołu z ${cxFmt(sessionChips)} AT$ w żetonach`, 'success');
});
socket.on('casinoError', ({ message }) => { cxToast('⚠️ ' + message, 'error'); document.dispatchEvent(new CustomEvent('cx-error', { detail: message })); });
socket.on('casinoBusted', ({ tableId, message }) => { if (tableId === casinoTableId) { casinoIsObserver = true; cxToast(message, 'error'); } });

socket.on('casinoTableState', (state) => {
  if (!state.table || state.table.id !== casinoTableId) return;
  casinoTableData = state;
  if (state.table.game === 'poker' && typeof renderCasinoPokerState === 'function') renderCasinoPokerState(state);
  else if (state.table.game === 'blackjack' && typeof renderCasinoBJState === 'function') renderCasinoBJState(state);
});
socket.on('casinoMyHand', (d) => {
  if (d.tableId !== casinoTableId) return;
  casinoMyHand = d.cards || [];
  if (typeof onPokerMyHand === 'function') onPokerMyHand(d);
});
socket.on('casinoCountdown', (d) => {
  if (d.tableId !== casinoTableId) return;
  if (typeof onTableCountdown === 'function') onTableCountdown(d);
});
socket.on('weeklyTopup', ({ message }) => {
  cxToast('🎉 ' + message, 'success');
  if (casinoWallet) loadCasinoWalletOnly();
});

async function cxLoadSlotStats(gameId) {
  try { const r = await fetch('/api/casino/slot-stats/' + gameId); if (r.ok) return await r.json(); } catch (e) {}
  return null;
}

// ── Zgodność: helpery używane przez Jackpot Frenzy ─────────────
function updateProfitDisplay(elId, spent, won) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (spent === 0) { el.textContent = '—'; el.className = 's5-stat-val profit-zero'; return; }
  const diff = won - spent;
  const pct  = ((diff / spent) * 100).toFixed(1);
  el.textContent = (diff >= 0 ? '+' : '') + pct + '%';
  el.className   = 's5-stat-val ' + (diff > 0 ? 'profit-pos' : diff < 0 ? 'profit-neg' : 'profit-zero');
}

function addRecentWin(listId, payout, tier) {
  var list = document.getElementById(listId); if (!list) return;
  if (payout <= 0) return;
  var item = document.createElement('span');
  item.className = 's5-recent-item ' + (tier || 'win');
  item.textContent = payout.toLocaleString('pl-PL') + ' AT$';
  if (list.querySelector('.s5-recent-item.none')) list.innerHTML = '';
  list.insertBefore(item, list.firstChild);
  while (list.children.length > 20) list.removeChild(list.lastChild);
}

function s5Fireworks(tier) {
  const cfg = {
    win:   { particles: 8,  rockets: 0, duration: 900,  emojis: ['🪙'],              colors: ['#ffd200','#fff'] },
    big:   { particles: 18, rockets: 1, duration: 1400, emojis: ['🪙','💰'],          colors: ['#ffd200','#60a5fa','#fff'] },
    mega:  { particles: 32, rockets: 2, duration: 2000, emojis: ['💰','⭐'],           colors: ['#a78bfa','#ffd200','#34d399','#fff'] },
    huge:  { particles: 50, rockets: 3, duration: 2800, emojis: ['💰','⭐','🎉'],      colors: ['#f9a8d4','#ffd200','#a78bfa','#34d399','#60a5fa'] },
    giga:  { particles: 80, rockets: 5, duration: 4000, emojis: ['💰','🎉','🌟','✨'], colors: ['#ffd200','#f9a8d4','#a78bfa','#34d399','#60a5fa','#fb923c'] },
    frito: { particles: 140,rockets: 10,duration: 7000, emojis: ['💰','🎉','🌟','✨','🍀','🔥'], colors: ['#ffd200','#f9a8d4','#a78bfa','#34d399','#60a5fa','#fb923c','#fff','#ff0','#0ff'] },
  };
  const c = cfg[tier] || cfg.win;

  // Cząsteczki rozpraszające od centrum
  for (let i = 0; i < c.particles; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;z-index:9999;pointer-events:none;font-size:${14 + Math.random()*14}px;left:${20+Math.random()*60}vw;top:${30+Math.random()*40}vh;animation:s5fw ${0.8+Math.random()*0.8}s ease-out forwards;--dx:${(Math.random()-0.5)*180}px;--dy:${-(40+Math.random()*160)}px`;
      el.textContent = c.emojis[Math.floor(Math.random() * c.emojis.length)];
      document.body.appendChild(el);
      setTimeout(() => el.remove(), c.duration);
    }, i * (c.duration / c.particles / 2));
  }

  // Rakiety — smugi lecące w górę i eksplodujące
  for (let ri = 0; ri < c.rockets; ri++) {
    setTimeout(() => {
      // Smuga rakiety
      const trail = document.createElement('div');
      const rx = 15 + Math.random() * 70;
      trail.style.cssText = `position:fixed;z-index:9998;pointer-events:none;width:3px;height:3px;border-radius:50%;background:#fff;left:${rx}vw;bottom:10vh;animation:s5rocket 0.6s ease-in forwards`;
      document.body.appendChild(trail);
      setTimeout(() => trail.remove(), 700);

      // Eksplozja
      setTimeout(() => {
        const burstCount = 12 + Math.floor(Math.random() * 10);
        for (let b = 0; b < burstCount; b++) {
          const spark = document.createElement('div');
          const angle = (b / burstCount) * Math.PI * 2;
          const dist  = 60 + Math.random() * 80;
          const col   = c.colors[Math.floor(Math.random() * c.colors.length)];
          spark.style.cssText = `position:fixed;z-index:9999;pointer-events:none;width:4px;height:4px;border-radius:50%;background:${col};left:${rx}vw;top:${15+Math.random()*25}vh;animation:s5spark 0.9s ease-out forwards;--sdx:${Math.cos(angle)*dist}px;--sdy:${Math.sin(angle)*dist}px`;
          document.body.appendChild(spark);
          setTimeout(() => spark.remove(), 1000);
        }
      }, 600);
    }, ri * (c.duration / c.rockets / 3) + Math.random() * 300);
  }
}

function spawnCoinFloat(amount) {
  const count = amount >= 5000 ? 6 : amount >= 1000 ? 4 : amount >= 500 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement('div'); el.className = 'coin-float';
      el.textContent = amount >= 5000 ? '💰' : '🪙';
      el.style.left  = (30 + Math.random() * 40) + 'vw';
      el.style.top   = (50 + Math.random() * 15) + 'vh';
      el.style.animationDelay = (Math.random() * 0.3) + 's';
      document.body.appendChild(el); setTimeout(() => el.remove(), 1600);
    }, i * 80);
  }
}
