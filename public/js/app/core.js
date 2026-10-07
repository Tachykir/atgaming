// ── STATE ──────────────────────────────────────────────────────
const socket = io();
let S = { roomId:null, playerId:null, playerName:null, isHost:false, isGM:false, gameType:null, room:null, selectedGame:null };
let adminPwd = '';
let content = {};
let games = [];
let timerInterval = null;
let wrTimerInterval = null;
let kalamTimer = null;
let selectedAnswer = null;
let chatOpen = false;
let chatUnread = 0;
let activeAdminTab = null;
let activeLbTab = null;

// ── NICK LOCALSTORAGE ─────────────────────────────────────────
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

function selectGame(id, el) {
  S.selectedGame = id;
  document.querySelectorAll('.game-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function onGameChange() {
  const gameId = document.getElementById('create-game').value;
  const meta = games.find(g => g.id === gameId);
  const cats = content[gameId] || {};
  document.getElementById('create-category').innerHTML = Object.entries(cats)
    .map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('');
  const gt = document.getElementById('gm-toggle');
  if (meta?.supportsGameMaster) {
    gt.style.display = 'flex';
    document.getElementById('gm-hint').textContent = meta.gameMasterHint || 'Zarządzasz grą, nie grasz';
  } else {
    gt.style.display = 'none';
    document.getElementById('gm-checkbox').checked = false;
  }
  // Render dynamic config fields from schema
  renderConfigSchema(gameId, configSchemas[gameId] || {});
}

let configSchemas = {};

function renderConfigSchema(gameId, schema) {
  const container = document.getElementById('dynamic-config');
  if (!container) return;
  const entries = Object.entries(schema);
  if (!entries.length) { container.innerHTML = ''; return; }

  const html = entries
    .filter(([k]) => k !== 'maxPlayers' || true) // always show maxPlayers
    .map(([key, cfg]) => {
      const val = cfg.default;
      return `<div class="input-group" style="flex:1;min-width:120px">
        <label>${cfg.label}</label>
        <input class="input" type="number" id="cfg-${key}"
          min="${cfg.min}" max="${cfg.max}" value="${val}"
          style="padding:10px 12px;font-size:14px">
      </div>`;
    });

  container.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap">${html.join('')}</div>`;
}

// ── ROOM ───────────────────────────────────────────────────────
function createRoom() {
  const name = document.getElementById('create-name').value.trim();
  if (!name) return showToast('Wpisz nick!', 'error');
  S.playerName = name;
  S.gameType   = document.getElementById('create-game').value;
  S.isGM       = document.getElementById('gm-checkbox').checked;

  // Collect base config
  const config = {
    category:   document.getElementById('create-category').value,
    difficulty: document.getElementById('create-difficulty').value,
  };

  // Collect dynamic schema fields
  const schema = configSchemas[S.gameType] || {};
  for (const [key, cfg] of Object.entries(schema)) {
    const el = document.getElementById(`cfg-${key}`);
    if (el) {
      const v = Number(el.value);
      config[key] = Math.max(cfg.min, Math.min(cfg.max, isNaN(v) ? cfg.default : v));
    }
  }

  socket.emit('createRoom', {
    gameType: S.gameType, playerName: name, isGameMaster: S.isGM, config,
  });
}

function joinRoom() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!name) return showToast('Wpisz nick!', 'error');
  if (code.length !== 5) return showToast('Wpisz 5-literowy kod!', 'error');
  S.playerName = name;
  socket.emit('joinRoom', { roomId: code, playerName: name });
}

function startGame() {
  socket.emit('startGame', { roomId: S.roomId, customWord: document.getElementById('gm-custom-word')?.value.trim() || '' });
}
function playAgain() { socket.emit('playAgain', { roomId: S.roomId }); }

function renderLobby(room) {
  document.getElementById('lobby-code').textContent = room.id;
  const joinUrl = window.location.origin + window.location.pathname + '?join=' + room.id;
  const linkEl  = document.getElementById('lobby-join-link');
  const linkTxt = document.getElementById('lobby-join-link-text');
  if (linkEl)  linkEl.href = joinUrl;
  if (linkTxt) linkTxt.textContent = joinUrl;
  document.getElementById('player-count').textContent = room.players.length;
  const meta = games.find(g => g.id === room.gameType) || {};
  const cats = content[room.gameType] || {};
  const diffMap = {easy:'😊 Łatwy',medium:'🔥 Średni',hard:'💀 Trudny'};
  const schema = configSchemas[room.gameType] || {};
  const maxP = room.config?.maxPlayers || meta.maxPlayers || '?';

  // Build extra config badges
  const extraBadges = Object.entries(schema)
    .filter(([k]) => k !== 'maxPlayers' && room.config?.[k] !== undefined)
    .map(([k, cfg]) => `<span class="badge" style="background:rgba(92,240,200,.08);color:var(--accent3);border:1px solid rgba(92,240,200,.2)">${cfg.label}: ${room.config[k]}</span>`)
    .join('');

  document.getElementById('lobby-badges').innerHTML = `
    <span class="badge badge-game">${meta.icon||''} ${meta.name||room.gameType}</span>
    <span class="badge badge-cat">${cats[room.config?.category]?.label||room.config?.category||'?'}</span>
    <span class="badge badge-diff">${diffMap[room.config?.difficulty]||''}</span>
    <span class="badge" style="background:rgba(124,92,252,.12);color:var(--accent);border:1px solid rgba(124,92,252,.3)">👥 Max: ${maxP}</span>
    ${extraBadges}
    ${room.isGameMaster?'<span class="badge badge-gm">🎭 Game Master</span>':''}`;
  const colors = ['#7c5cfc','#fc5c7d','#5cf0c8','#fcc05c','#5cb8fc','#e05cfc'];
  document.getElementById('players-container').innerHTML = [
    ...(room.isGameMaster?[{id:room.gameMasterId,name:room.gameMasterName,_gm:true}]:[]),
    ...room.players,
  ].map((p,i) => `
    <div class="player-item">
      ${getPlayerAvatarHtml(p.name, colors[i%colors.length])}
      <span>${p.name}</span>
      ${discordUser && (discordUser.globalName===p.name||discordUser.username===p.name) ? `<span class="discord-badge" style="margin-left:4px">${DISCORD_ICON}</span>` : ''}
      ${p._gm?'<span class="gm-badge-small">🎭 GM</span>':''}
      ${!p._gm&&p.id===room.hostId&&!room.isGameMaster?'<span class="player-host-badge">Host</span>':''}
    </div>`).join('');
  const isCtrl = S.isGM || (S.isHost && !room.isGameMaster);
  document.getElementById('start-btn-container').style.display = isCtrl ? 'block' : 'none';
  document.getElementById('waiting-msg').style.display = isCtrl ? 'none' : 'block';
  document.getElementById('gm-word-panel').style.display = (S.isGM && room.gameType === 'hangman') ? 'block' : 'none';
}

// ── CHAT ───────────────────────────────────────────────────────
function showChat() {
  document.getElementById('chat-toggle').style.display = 'flex';
  document.getElementById('chat-room-label').textContent = S.roomId || '';
}
function hideChat() {
  document.getElementById('chat-toggle').style.display = 'none';
  document.getElementById('chat-panel').classList.remove('open');
  chatOpen = false;
}
function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chat-panel').classList.toggle('open', chatOpen);
  if (chatOpen) {
    chatUnread = 0;
    updateChatBadge();
    const msgs = document.getElementById('chat-messages');
    msgs.scrollTop = msgs.scrollHeight;
    document.getElementById('chat-input').focus();
  }
}
function updateChatBadge() {
  const btn = document.getElementById('chat-toggle');
  if (chatUnread > 0) { btn.classList.add('has-unread'); btn.dataset.count = chatUnread; }
  else { btn.classList.remove('has-unread'); }
}
function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg || !S.roomId) return;
  socket.emit('chatMessage', { roomId: S.roomId, message: msg });
  input.value = '';
}
function appendChatMsg({ name, message, isGM, isSystem, time }) {
  const msgs = document.getElementById('chat-messages');
  const isMe = name === S.playerName && !isSystem;
  const div = document.createElement('div');
  div.className = `chat-msg${isMe?' mine':''}${isSystem?' system-msg':''}`;
  if (!isSystem) {
    const nameClass = isMe ? 'me' : isGM ? 'gm' : '';
    const avatarHtml = isMe && discordUser
      ? `<img src="${discordUser.avatar}" style="width:22px;height:22px;border-radius:50%;vertical-align:middle;margin-right:4px" alt="">`
      : '';
    div.innerHTML = `<div class="chat-msg-name ${nameClass}">${avatarHtml}${escHtml(name)}</div>
      <div class="chat-msg-bubble">${escHtml(message)}</div>
      <div class="chat-msg-time">${time}</div>`;
  } else {
    div.innerHTML = `<div class="chat-msg-bubble">${escHtml(message)}</div>`;
  }
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  if (!chatOpen) { chatUnread++; updateChatBadge(); }
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
