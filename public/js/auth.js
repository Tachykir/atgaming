// auth.js — Discord auth, nick, profil, panel online

function saveNick(val) {
  if (val.trim()) {
    try { localStorage.setItem('atgaming_nick', val.trim()); } catch(e){}
  }
}
function loadSavedNick() {
  try {
    const n = localStorage.getItem('atgaming_nick');
    if (n) {
      const cn = document.getElementById('create-name');
      const jn = document.getElementById('join-name');
      if (cn) { cn.value = n; document.getElementById('nick-saved-create').style.display='block'; }
      if (jn) { jn.value = n; document.getElementById('nick-saved-join').style.display='block'; }
    }
  } catch(e){}
}

// ── DISCORD AUTH ──────────────────────────────────────────────
let discordUser = null;
let discordEnabled = false;

const DISCORD_ICON = `<svg width="20" height="15" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.7a40.6 40.6 0 0 0-1.8 3.7 54.1 54.1 0 0 0-16.3 0A38.9 38.9 0 0 0 25.6.7 58.4 58.4 0 0 0 11 4.9C1.6 18.7-1 32.2.3 45.5a59 59 0 0 0 18 9.1 44.7 44.7 0 0 0 3.9-6.3 38.3 38.3 0 0 1-6.1-2.9l1.5-1.1a42.2 42.2 0 0 0 36 0l1.5 1.1a38.3 38.3 0 0 1-6.1 2.9 44.8 44.8 0 0 0 3.9 6.3 58.8 58.8 0 0 0 18-9.1c1.5-15.5-2.6-28.9-10.8-40.6ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.5 3.2 6.4 7.2c0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.5 3.2 6.4 7.2c0 4-2.8 7.2-6.4 7.2Z"/></svg>`;

async function initDiscordAuth() {
  try {
    const res = await fetch('/auth/discord/status');
    const data = await res.json();
    discordEnabled = data.enabled;
    discordUser = data.user;

    // Zawsze ustaw casinoDiscordId i pobierz socket token jeśli zalogowany
    if (data.user) {
      casinoDiscordId = data.user.id;
      fetch('/auth/socket-token').then(r=>r.json()).then(d=>{ if(d.token){ casinoSocketToken=d.token; tryRegisterOnline(); } }).catch(()=>{});
    }

    // Check URL params after OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('discord_login') === '1') {
      window.history.replaceState({}, '', '/');
    }
    if (params.get('error')) {
      const msgs = {
        discord_not_configured: 'Discord OAuth nie jest skonfigurowane.',
        discord_denied: 'Anulowano logowanie przez Discord.',
        discord_token: 'Błąd tokenu Discord — spróbuj ponownie.',
        discord_user: 'Nie udało się pobrać danych z Discord.',
        discord_error: 'Błąd logowania Discord.',
      };
      showToast(msgs[params.get('error')] || 'Błąd Discord.', 'error');
      window.history.replaceState({}, '', '/');
    }

    renderDiscordBlocks();
    renderProfileBtn();

    // If logged in via Discord, auto-fill nick
    if (discordUser) {
      const nick = discordUser.globalName || discordUser.username;
      ['create-name','join-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = nick; el.readOnly = true; }
      });
      document.getElementById('nick-saved-create')?.style && (document.getElementById('nick-saved-create').style.display = 'none');
      document.getElementById('nick-saved-join')?.style && (document.getElementById('nick-saved-join').style.display = 'none');
    }
  } catch(e) {
    console.warn('Discord auth check failed:', e);
  }
}

function renderDiscordBlocks() {
  ['create','join'].forEach(ctx => {
    const el = document.getElementById(`discord-block-${ctx}`);
    if (!el) return;

    if (discordUser) {
      // Logged in — show user bar
      el.innerHTML = `
        <div class="discord-user-bar">
          <img class="discord-avatar" src="${discordUser.avatar}" alt="avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
          <div class="discord-user-info">
            <div class="discord-user-name">${escHtml(discordUser.globalName || discordUser.username)}</div>
            <div class="discord-user-tag"><span class="discord-badge">${DISCORD_ICON} Discord</span></div>
          </div>
          <button class="discord-logout" onclick="discordLogout()">Wyloguj</button>
        </div>`;
    } else if (discordEnabled) {
      // Discord available — show button + divider
      el.innerHTML = `
        <button class="discord-btn" onclick="loginWithDiscord()">
          ${DISCORD_ICON} Zaloguj przez Discord
        </button>
        <div class="discord-divider">lub wpisz nick ręcznie</div>`;
    } else {
      // Discord not configured — show nothing
      el.innerHTML = '';
    }
  });
}

function loginWithDiscord() {
  // Save current page state
  try { sessionStorage.setItem('discord_return', window.location.href); } catch(e){}
  window.location.href = '/auth/discord';
}

async function discordLogout() {
  try {
    await fetch('/auth/discord/logout', { method: 'POST' });
    discordUser = null;
    casinoWallet = null;
    ['create-name','join-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; el.readOnly = false; }
    });
    renderDiscordBlocks();
    renderProfileBtn();
    closeProfileModal();
    loadSavedNick();
    showToast('Wylogowano z Discord', 'success');
  } catch(e) {
    showToast('Błąd wylogowania', 'error');
  }
}

// ── PANEL PROFILU ──────────────────────────────────────────────

let profileModalOpen = false;

function renderProfileBtn() {
  const btn     = document.getElementById('profile-btn');
  const wrap    = document.getElementById('pb-avatar-wrap');
  const label   = document.getElementById('pb-label');
  const dot     = document.getElementById('pb-dot');
  if (!btn) return;

  if (discordUser) {
    const name = discordUser.globalName || discordUser.username;
    wrap.outerHTML.includes('pb-avatar-placeholder')
      ? wrap.replaceWith(Object.assign(document.createElement('img'), {
          className: 'pb-avatar', id: 'pb-avatar-wrap',
          src: discordUser.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png',
          alt: 'avatar',
        }))
      : (() => {
          const img = document.getElementById('pb-avatar-wrap');
          if (img) { img.src = discordUser.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'; img.className = 'pb-avatar'; }
        })();
    label.textContent = name;
    dot.className = 'pb-dot online';
  } else {
    const cur = document.getElementById('pb-avatar-wrap');
    if (cur && cur.tagName === 'IMG') {
      const div = document.createElement('div');
      div.className = 'pb-avatar-placeholder'; div.id = 'pb-avatar-wrap'; div.textContent = '👤';
      cur.replaceWith(div);
    }
    label.textContent = 'Zaloguj się';
    dot.className = 'pb-dot';
  }
}

function toggleProfileModal() {
  const modal = document.getElementById('profile-modal');
  profileModalOpen = !profileModalOpen;
  if (profileModalOpen) {
    modal.classList.add('open');
    renderProfileModal();
  } else {
    modal.classList.remove('open');
  }
}

function closeProfileModal() {
  profileModalOpen = false;
  document.getElementById('profile-modal')?.classList.remove('open');
}

async function renderProfileModal() {
  const content = document.getElementById('pm-content');
  if (!content) return;

  if (!discordUser) {
    content.innerHTML = `
      <div class="pm-no-login">
        <div class="pm-nl-icon">🎮</div>
        <div class="pm-nl-title">Witaj w AT Gaming!</div>
        <div class="pm-nl-desc">Zaloguj się przez Discord, żeby mieć dostęp do statystyk kasyna i portfela AT$.</div>
        ${discordEnabled
          ? `<button class="btn btn-primary" style="width:100%" onclick="loginWithDiscord()"><svg width="18" height="14" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.7a40.6 40.6 0 0 0-1.8 3.7 54.1 54.1 0 0 0-16.3 0A38.9 38.9 0 0 0 25.6.7 58.4 58.4 0 0 0 11 4.9C1.6 18.7-1 32.2.3 45.5a59 59 0 0 0 18 9.1 44.7 44.7 0 0 0 3.9-6.3 38.3 38.3 0 0 1-6.1-2.9l1.5-1.1a42.2 42.2 0 0 0 36 0l1.5 1.1a38.3 38.3 0 0 1-6.1 2.9 44.8 44.8 0 0 0 3.9 6.3 58.8 58.8 0 0 0 18-9.1c1.5-15.5-2.6-28.9-10.8-40.6ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.5 3.2 6.4 7.2c0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.5 3.2 6.4 7.2c0 4-2.8 7.2-6.4 7.2Z"/></svg> Zaloguj przez Discord</button>`
          : `<div style="color:var(--muted);font-size:13px">Discord OAuth nie jest skonfigurowane.</div>`
        }
      </div>`;
    return;
  }

  // Pokaż szkielet z danymi usera, załaduj wallet w tle
  const name = discordUser.globalName || discordUser.username;
  content.innerHTML = `
    <div class="pm-header">
      ${discordUser.avatar
        ? `<img class="pm-avatar" src="${escHtml(discordUser.avatar)}" alt="avatar" onerror="this.style.display='none'">`
        : `<div class="pm-avatar-placeholder">👤</div>`}
      <div>
        <div class="pm-name">${escHtml(name)}</div>
        <div class="pm-tag">
          <span class="discord-badge" style="font-size:10px">${DISCORD_ICON} Discord</span>
        </div>
      </div>
    </div>
    <div class="pm-body">
      <div id="pm-stats-area">
        <div style="text-align:center;color:var(--muted);font-size:13px;padding:12px 0">⏳ Ładowanie statystyk...</div>
      </div>
      <div class="pm-divider"></div>
      <div class="pm-actions">
        <button class="pm-action-btn pm-action-primary" onclick="closeProfileModal();showScreen('casino-lobby')">🎰 Kasyno</button>
        <button class="pm-action-btn pm-action-secondary" onclick="discordLogout()">Wyloguj</button>
      </div>
    </div>`;

  // Załaduj statystyki portfela
  try {
    const res = await fetch('/api/casino/wallet');
    const statsEl = document.getElementById('pm-stats-area');
    if (!statsEl) return;

    if (res.ok) {
      const d = await res.json();
      const w = d.wallet;
      casinoWallet = w;
      const profit = w.totalWon - w.totalLost;
      const winRate = w.gamesPlayed > 0 ? Math.round((w.totalWon / (w.totalWon + w.totalLost || 1)) * 100) : 0;

      statsEl.innerHTML = `
        <div class="pm-stats">
          <div class="pm-stat">
            <div class="pm-stat-val">${w.balance.toLocaleString('pl-PL')}</div>
            <div class="pm-stat-label">💰 Saldo AT$</div>
          </div>
          <div class="pm-stat">
            <div class="pm-stat-val">${w.gamesPlayed}</div>
            <div class="pm-stat-label">🎮 Rozegranych</div>
          </div>
          <div class="pm-stat">
            <div class="pm-stat-val ${profit >= 0 ? 'profit-pos' : 'profit-neg'}">${profit >= 0 ? '+' : ''}${profit.toLocaleString('pl-PL')}</div>
            <div class="pm-stat-label">📈 Zysk netto</div>
          </div>
          <div class="pm-stat">
            <div class="pm-stat-val">${w.totalWon.toLocaleString('pl-PL')}</div>
            <div class="pm-stat-label">🏆 Łącznie wygrań</div>
          </div>
        </div>`;
    } else {
      statsEl.innerHTML = `
        <div style="text-align:center;color:var(--muted);font-size:13px;padding:8px 0">
          Brak danych portfela — wejdź do kasyna żeby go założyć.
        </div>`;
    }
  } catch(e) {
    const statsEl = document.getElementById('pm-stats-area');
    if (statsEl) statsEl.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:8px 0">Błąd ładowania statystyk.</div>`;
  }
}

// Zamknij modal klikając poza nim
document.addEventListener('click', (e) => {
  if (!profileModalOpen) return;
  const modal = document.getElementById('profile-modal');
  const btn   = document.getElementById('profile-btn');
  if (modal && btn && !modal.contains(e.target) && !btn.contains(e.target)) {
    closeProfileModal();
  }
});

// Show Discord avatar in lobby / chat if logged in via Discord
function getPlayerAvatarHtml(playerName, color, size = 34) {
  if (discordUser && (discordUser.globalName === playerName || discordUser.username === playerName)) {
    return `<img src="${discordUser.avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="avatar" onerror="this.style.display='none'">`;
  }
  return `<div class="player-avatar" style="background:${color};width:${size}px;height:${size}px">${playerName[0].toUpperCase()}</div>`;
}

function openOnlinePanel() {
  _opOpen = true;
  document.getElementById('online-panel').classList.add('open');
  document.getElementById('op-overlay').classList.add('open');
  loadOnlinePlayers();
  _opRefreshTimer = setInterval(loadOnlinePlayers, 15000);
}
function closeOnlinePanel() {
  _opOpen = false;
  document.getElementById('online-panel').classList.remove('open');
  document.getElementById('op-overlay').classList.remove('open');
  if (_opRefreshTimer) { clearInterval(_opRefreshTimer); _opRefreshTimer = null; }
}
async function loadOnlinePlayers() {
  const body = document.getElementById('online-panel-body');
  if (!body) return;
  try {
    const [pRes, wRes] = await Promise.all([fetch('/api/online-players'), fetch('/api/casino/leaderboard?limit=200')]);
    const players = await pRes.json();
    const wallets = wRes.ok ? await wRes.json() : [];
    const wMap = {};
    wallets.forEach(function(w){ wMap[w.discordId] = w; });
    const cnt = players.length;
    ['op-count-badge','op-toggle-count'].forEach(function(id){ const el=document.getElementById(id); if(el) el.textContent=cnt; });
    if (!cnt) { body.innerHTML = '<div style="color:var(--muted);text-align:center;padding:32px 8px;font-size:13px">Brak graczy online</div>'; return; }
    body.innerHTML = players.map(function(p) {
      const bal = wMap[p.id] ? wMap[p.id].balance.toLocaleString('pl-PL') + ' AT$' : '-';
      const act = p.casino ? '<span class="op-badge casino">' + escHtml(p.casino) + '</span>' : (p.room ? '<span class="op-badge room">' + escHtml(p.room) + '</span>' : '');
      const initials = (p.globalName||p.username||'?')[0].toUpperCase();
      const av = p.avatar ? '<img class="op-avatar" src="' + p.avatar + '">' : '<div class="op-avatar-placeholder">' + initials + '</div>';
      return '<div class="op-player">' + av + '<div class="op-info"><div class="op-name">' + escHtml(p.globalName||p.username) + '</div><div class="op-bal">' + bal + '</div>' + (act ? '<div>' + act + '</div>' : '') + '</div><div class="op-dot"></div></div>';
    }).join('');
  } catch(e) {
    const b = document.getElementById('online-panel-body');
    if (b) b.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:32px">Blad ladowania</div>';
  }
}

// ── registerOnline — wysylaj gdy discord zalogowany ──────────────────────────
function tryRegisterOnline() {
  if (casinoSocketToken) socket.emit('registerOnline', { socketToken: casinoSocketToken });
  else socket.emit('registerOnline', {});
}

// ── WAVELENGTH ─────────────────────────────────────────────────────
let wlMyId = null;

function onWlSlider(val) {
  document.getElementById('wl-slider-val').textContent = val;
  const ind = document.getElementById('wl-indicator');
  if (ind) ind.style.left = val + '%';
  // Wyślij guess w czasie rzeczywistym
  if (wlState?.phase === 'guessing' && wlState?.psychic !== wlMyId) {
    socket.emit('wavelengthGuess', { roomId: S.roomId, value: parseInt(val) });
  }
}

