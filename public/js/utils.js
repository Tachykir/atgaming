// utils.js — funkcje pomocnicze


// ── SCREENS ────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
  if (id === 'active-rooms') loadActiveRooms();
  if (id === 'online-players') loadOnlinePlayers();
  if (id === 'casino-lobby') loadCasinoLobby();
  if (id === 'create' && S.selectedGame) {
    const sel = document.getElementById('create-game');
    if (sel) { sel.value = S.selectedGame; onGameChange(); }
  }
}
function goHome() { location.reload(); }

// ── INIT ───────────────────────────────────────────────────────
async function init() {
  const [gR, cR, sR] = await Promise.all([fetch('/api/games'), fetch('/api/content'), fetch('/api/config-schemas')]);
  games         = await gR.json();
  content       = await cR.json();
  configSchemas = await sR.json();

  const container = document.getElementById('game-cards-container');
  container.innerHTML = games.map((g, i) => `
    <div class="game-card ${i===0?'selected':''}" data-game="${g.id}" onclick="selectGame('${g.id}',this)">
      <div class="game-icon">${g.icon}</div>
      <div class="game-name">${g.name}</div>
      <div class="game-desc">${g.description}</div>
    </div>`).join('');
  if (games[0]) S.selectedGame = games[0].id;

  document.getElementById('create-game').innerHTML = games.map(g =>
    `<option value="${g.id}">${g.icon} ${g.name}</option>`).join('');
  onGameChange();
  loadSavedNick();
  initDraggableChat();
  await initDiscordAuth();
  checkUrlJoin();
  fetch('/api/version').then(r=>r.json()).then(d=>{
    const el = document.getElementById('at-version');
    if (!el) return;
    const year = new Date().getFullYear();
    el.textContent = d.version
      ? 'AT Gaming v' + d.version + ' · © ' + year
      : 'AT Gaming · © ' + year;
  }).catch(()=>{});
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── DRAGGABLE CHAT ─────────────────────────────────────────────
function initDraggableChat() {
  const panel = document.getElementById('chat-panel');
  const header = document.getElementById('chat-header');
  let isDragging = false, startX, startY, startLeft, startTop;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startLeft = rect.left; startTop = rect.top;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = startLeft + 'px';
    panel.style.top = startTop + 'px';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    const newLeft = Math.max(0, Math.min(window.innerWidth - 100, startLeft + dx));
    const newTop = Math.max(0, Math.min(window.innerHeight - 50, startTop + dy));
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });

  // Touch support
  header.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    startX = t.clientX; startY = t.clientY;
    startLeft = rect.left; startTop = rect.top;
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    panel.style.left = startLeft + 'px'; panel.style.top = startTop + 'px';
  }, {passive:true});

  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    const newLeft = Math.max(0, Math.min(window.innerWidth - 100, startLeft + t.clientX - startX));
    const newTop = Math.max(0, Math.min(window.innerHeight - 50, startTop + t.clientY - startY));
    panel.style.left = newLeft + 'px'; panel.style.top = newTop + 'px';
  }, {passive:true});

  document.addEventListener('touchend', () => { isDragging = false; });
}

// ── HANGMAN ────────────────────────────────────────────────────
const LETTERS = ['A','Ą','B','C','Ć','D','E','Ę','F','G','H','I','J','K','L','Ł','M','N','Ń','O','Ó','P','R','S','Ś','T','U','W','Y','Z','Ź','Ż'];
const SCAFFOLD = ['h-head','h-body','h-arm-l','h-arm-r','h-leg-l','h-leg-r'];

let H = { maxWrong: 6, totalRounds: 1, currentRound: 1 };

function showToast(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className=`toast show ${type}`;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3000);
}

// Persystentne powiadomienie kasyna — zostaje do ręcznego zamknięcia lub nowego powiadomienia
function showCasinoNotif(msg, type='cn-info', autoDismiss=0) {
  const area = document.getElementById('casino-notif-area');
  if (!area) return;
  const el = document.createElement('div');
  el.className = 'casino-notif ' + type;
  el.innerHTML = msg + ' <span style="cursor:pointer;opacity:.5;margin-left:8px" onclick="this.parentElement.remove()">✕</span>';
  area.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  // Usuń stare jeśli >5
  while (area.children.length > 5) area.removeChild(area.firstChild);
  if (autoDismiss > 0) setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, autoDismiss);
}

// ══════════════════════════════════════════════════════════════
//  KASYNO AT$ — JAVASCRIPT
// ══════════════════════════════════════════════════════════════

let casinoWallet     = null;   // { balance, globalName, ... }
let casinoDiscordId  = null;
let casinoSocketToken = null; // token do autoryzacji socketów kasyna
let casinoTableId    = null;   // aktywny stół
let casinoMyHand     = [];
let casinoTableData  = null;   // ostatni stan stołu
let casinoCdMax      = 20;     // max sekund countdown
let casinoIsObserver = false;

// ── LOBBY ─────────────────────────────────────────────────────
async function loadCasinoLobby() {
  // 1. Portfel
  try {
    const res = await fetch('/api/casino/wallet');
    if (res.ok) {
      const d = await res.json();
      casinoWallet    = d.wallet;
      casinoDiscordId = d.discordId;
      renderCasinoWallet();
    } else {
      renderCasinoNoDiscord();
    }
  } catch(e) { renderCasinoNoDiscord(); }

  // 2. Ranking
  try {
    const lb = await (await fetch('/api/casino/leaderboard')).json();
    renderCasinoLB(lb);
  } catch(e) {}

  // 3. Stoły
  try {
    const tables = await (await fetch('/api/casino/tables')).json();
    renderCasinoTables(tables);
  } catch(e) {}
}

// ── Funkcja wyświetlania profit/loss ─────────────────────────────
function updateProfitDisplay(elId, spent, won) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (spent === 0) { el.textContent = '—'; el.className = 's5-stat-val profit-zero'; return; }
  const diff = won - spent;
  const pct  = ((diff / spent) * 100).toFixed(1);
  el.textContent = (diff >= 0 ? '+' : '') + pct + '%';
  el.className   = 's5-stat-val ' + (diff > 0 ? 'profit-pos' : diff < 0 ? 'profit-neg' : 'profit-zero');
}

// ── Ładuj statystyki slotów z bazy danych ────────────────────────
async function loadSlotStats(gameId, prefix) {
  try {
    const r = await fetch('/api/casino/slot-stats/' + gameId);
    if (!r.ok) return;
    const d = await r.json();
    const spinsEl  = document.getElementById(prefix + '-stat-spins');
    const paidEl   = document.getElementById(prefix + '-stat-paid');
    const bestEl   = document.getElementById(prefix + '-stat-best');
    const spentEl  = document.getElementById(prefix + '-stat-spent');
    if (spinsEl) spinsEl.textContent = d.spins.toLocaleString('pl-PL');
    if (paidEl)  paidEl.textContent  = d.won.toLocaleString('pl-PL') + ' AT$';
    if (bestEl)  bestEl.textContent  = d.bestWin > 0 ? d.bestWin.toLocaleString('pl-PL') + ' AT$' : '—';
    if (spentEl) spentEl.textContent = d.spent.toLocaleString('pl-PL') + ' AT$';
    updateProfitDisplay(prefix + '-stat-profit', d.spent, d.won);
    // Zapisz do zmiennych sesji żeby updateStats mogło je uwzględnić
    if (prefix === 's5') { s5StatSpins = d.spins; s5StatPaid = d.won; s5BestWin = d.bestWin; s5StatSpent = d.spent; }
    if (prefix === 'pg' && d.pitMeter > 0) pgUpdatePit(d.pitMeter);
    if (prefix === 'pg') { pgStatSpins = d.spins; pgStatPaid = d.won; pgBestWin = d.bestWin; pgStatSpent = d.spent; }
  } catch(e) {}
}

const S5_COLS = 5, S5_ROWS = 3;
const S5_LINE_COLORS = ['#E24B4A','#185FA5','#3B6D11','#BA7517','#533AB7','#0F6E56','#993C1D','#D4537E','#639922','#5F5E5A'];
let s5Spinning = false, s5Auto = false, s5AutoT = null, s5WinCb = null, s5WinTimer = null;
let s5Bet = 10, s5Lines = 50, s5FreeSpins = 0, s5PitPts = 0;
let s5StatSpins = 0, s5StatPaid = 0, s5BestWin = 0, s5StatSpent = 0;
let s5Syms = [], s5LinesDef = [];
// Dekoracyjne symbole do animacji kręcenia
const S5_SPIN_SYMS = ['🍒','🍋','🍊','🍇','⭐','💎','7️⃣','🔔','💫'];

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

// ── RULETKA ───────────────────────────────────────────────────
const ROULETTE_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
let rouletteBetAmount = 50;
let roulettePendingBets = [];

