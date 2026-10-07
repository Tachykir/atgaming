// ══ GRACZE ONLINE (Discord) ════════════════════════════════════

// ── OBSERVER EVENTS ───────────────────────────────────────────
socket.on('roomObserved', ({ roomId, room }) => {
  S.roomId = roomId;
  S.room = room;
  S.isHost = false;
  S.isGM = false;
  showToast('Obserwujesz grę!', 'success');
  // If game is already running, show appropriate screen
  if (room.status === 'playing') {
    const gt = room.gameType;
    if (['tictactoe','chess','poker','blackjack'].includes(gt)) {
      showScreen(gt);
    }
  } else {
    showScreen('lobby');
    renderLobby(room);
  }
});

socket.on('observerJoined', ({ observerName, room }) => {
  if (S.room && room) S.room = room;
});


let toastTimer = null;
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

// ══ PANEL GRACZE ONLINE ════════════════════════════════════════
let _opOpen = false, _opRefreshTimer = null;
function toggleOnlinePanel() { _opOpen ? closeOnlinePanel() : openOnlinePanel(); }
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
