// ── ACTIVE ROOMS ──────────────────────────────────────────────
async function loadActiveRooms() {
  try {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    const el = document.getElementById('active-rooms-list');
    if (!rooms.length) {
      el.innerHTML = '<div class="ar-empty">🎮 Brak aktywnych gier.<br><span style="font-size:13px">Stwórz pokój i zaproś znajomych!</span></div>';
      return;
    }
    el.innerHTML = rooms.map(r => {
      const statusLabel = { waiting: 'Czeka', playing: 'W grze', finished: 'Zakończona' }[r.status] || r.status;
      const canJoin = r.status === 'waiting' && r.playerCount < r.maxPlayers;
      const canObserve = r.status === 'playing' || r.status === 'waiting';
      return `<div class="active-room-card">
        <div class="ar-icon">${r.gameIcon}</div>
        <div class="ar-info">
          <div class="ar-game">${escHtml(r.gameName)}</div>
          <div class="ar-meta">
            Kod: <strong style="color:var(--accent3);font-family:'DM Mono',monospace">${r.id}</strong> ·
            ${r.playerCount}/${r.maxPlayers} graczy
            ${r.hostName ? '· Host: ' + escHtml(r.hostName) : ''}
          </div>
        </div>
        <span class="ar-status ${r.status}">${statusLabel}</span>
        <div class="ar-actions">
          ${canJoin ? `<button class="btn btn-primary btn-sm" onclick="quickJoin('${r.id}')">Dołącz</button>` : ''}
          ${canObserve ? `<button class="btn btn-secondary btn-sm" onclick="startObserve('${r.id}')">👁️ Obserwuj</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    document.getElementById('active-rooms-list').innerHTML = '<div class="ar-empty">Błąd ładowania pokojów.</div>';
  }
}

function quickJoin(roomId) {
  document.getElementById('join-code').value = roomId;
  showScreen('join');
}

function startObserve(roomId) {
  const name = prompt('Twój nick (obserwator):') || 'Obserwator';
  S.playerName = name;
  S.roomId = roomId;
  S.isObserver = true;
  socket.emit('observeRoom', { roomId, observerName: name });
}
