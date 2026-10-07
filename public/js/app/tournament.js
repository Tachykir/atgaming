// ══ TURNIEJ ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// TURNIEJ — CLIENT
// ══════════════════════════════════════════════════════════════
let TM = {
  current: null,       // aktualny obiekt turnieju
  isHost: false,
  myId: null,          // S.playerId alias
  pendingJoinCode: null,
};

// ── Helpers ────────────────────────────────────────────────────

function tmMyId() { return S.playerId || TM.myId; }

function tmIsHost() {
  return TM.current && TM.current.hostId === tmMyId();
}

function tmOpenList() {
  socket.emit('tournamentGetList');
  showScreen('tournament-list');
}

function tmCreate() {
  const name = S.playerName || prompt('Twoja nazwa gracza:');
  if (!name) return;
  S.playerName = name;
  socket.emit('tournamentCreate', { playerName: name });
}

function tmJoinByCode() {
  const code = document.getElementById('tm-join-code-input')?.value?.trim().toUpperCase();
  if (!code) return showToast('Wpisz kod turnieju', 'error');
  const name = S.playerName || prompt('Twoja nazwa gracza:');
  if (!name) return;
  S.playerName = name;
  socket.emit('tournamentJoin', { tournamentId: code, playerName: name });
}

function tmLeave() {
  if (TM.current) {
    socket.emit('tournamentLeave', { tournamentId: TM.current.id });
    TM.current = null;
  }
  showScreen('tournament-list');
}

function tmStart() {
  if (!TM.current) return;
  socket.emit('tournamentStart', { tournamentId: TM.current.id });
}

function tmPickGame(gameType) {
  if (!TM.current) return;
  socket.emit('tournamentPickGame', { tournamentId: TM.current.id, gameType });
}

function tmSetAdvancers(n) {
  if (!TM.current) return;
  socket.emit('tournamentSetAdvancers', { tournamentId: TM.current.id, count: n });
}

// ── Render lobby ───────────────────────────────────────────────

function tmRenderLobby(t) {
  TM.current = t;
  TM.isHost = tmIsHost();
  showScreen('tournament-lobby');

  document.getElementById('tm-id-badge').textContent = t.id;
  document.getElementById('tm-join-code').textContent = t.id;
  document.getElementById('tm-player-count').textContent = t.players.length;

  const subtitle = `Host: ${t.hostName} • Faza grupowa → Eliminacje`;
  document.getElementById('tm-lobby-subtitle').textContent = subtitle;

  // Gracze
  const playersEl = document.getElementById('tm-lobby-players');
  playersEl.innerHTML = t.players.map(p => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg);border-radius:8px">
      <span style="font-size:16px">${p.id === t.hostId ? '👑' : '👤'}</span>
      <span style="font-weight:${p.id === tmMyId() ? '800' : '600'}">${p.name}${p.id === tmMyId() ? ' (Ty)' : ''}</span>
      ${p.id === t.hostId ? '<span style="font-size:11px;color:var(--muted)">host</span>' : ''}
    </div>
  `).join('');

  // Ustawienia hosta
  const settingsEl = document.getElementById('tm-host-settings');
  const startBtn   = document.getElementById('tm-start-btn');
  const waitMsg    = document.getElementById('tm-waiting-msg');

  if (TM.isHost) {
    settingsEl.style.display = '';
    startBtn.style.display = '';
    waitMsg.textContent = t.players.length < 3 ? `⚠️ Potrzeba min. 3 graczy (masz ${t.players.length})` : '';
    startBtn.disabled = t.players.length < 3;

    // Przyciski liczby awansujących
    const maxAdv = Math.max(2, t.players.length - 1);
    const advBtns = document.getElementById('tm-adv-buttons');
    advBtns.innerHTML = Array.from({length: maxAdv - 1}, (_, i) => i + 2).map(n => `
      <button onclick="tmSetAdvancers(${n})"
        style="padding:4px 12px;border-radius:8px;border:2px solid ${n === t.playoffAdvancers ? 'var(--accent)' : 'var(--border)'};
               background:${n === t.playoffAdvancers ? 'var(--accent)' : 'var(--card)'};
               color:${n === t.playoffAdvancers ? '#fff' : 'var(--text)'};cursor:pointer;font-weight:700">
        ${n}
      </button>
    `).join('');
    document.getElementById('tm-adv-hint').textContent =
      `Top ${t.playoffAdvancers} z fazy grupowej awansuje do eliminacji`;
  } else {
    settingsEl.style.display = 'none';
    startBtn.style.display = 'none';
    waitMsg.textContent = `⏳ Czekaj aż host (${t.hostName}) rozpocznie turniej`;
  }
}

// ── Render bracket/standings ────────────────────────────────────

function tmRenderBracket(t) {
  TM.current = t;
  showScreen('tournament-bracket');

  const titleEl = document.getElementById('tm-bracket-title');
  const phaseEl = document.getElementById('tm-bracket-phase');
  titleEl.textContent = `🏆 Turniej ${t.id}`;

  const phaseNames = { group: '📊 Faza grupowa', playoff: '⚡ Faza eliminacji', finished: '🏁 Zakończony' };
  phaseEl.textContent = phaseNames[t.status] || t.status;

  // Standings
  const standEl = document.getElementById('tm-standings-section');
  if (t.groupStandings && t.status !== 'lobby') {
    standEl.style.display = '';
    const rows = Object.entries(t.groupStandings)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins);
    const advIds = new Set(
      t.status === 'playoff' || t.status === 'finished'
        ? t.players.filter(p => !p.eliminated || t.status === 'finished').map(p => p.id)
        : []
    );
    document.getElementById('tm-standings-table').innerHTML =
      rows.map((r, i) => `
        <div class="tm-standings-row">
          <span style="width:22px;color:var(--muted);font-weight:700">${i+1}.</span>
          <span style="flex:1;font-weight:${r.id === tmMyId() ? '800' : '600'}">${r.name}${r.id === tmMyId() ? ' 👤' : ''}</span>
          <span style="color:#2ecc71;font-weight:700;min-width:30px">${r.wins}W</span>
          <span style="color:#e74c3c;font-weight:700;min-width:30px">${r.losses}L</span>
          <span style="color:var(--accent);font-weight:700;min-width:40px">${r.points}pkt</span>
          ${advIds.has(r.id) && t.status !== 'lobby' && t.status !== 'group' ? '<span class="tm-adv-badge">✅ awans</span>' : ''}
        </div>
      `).join('');
  } else {
    standEl.style.display = 'none';
  }

  // Mecze grupowe
  const groupEl = document.getElementById('tm-group-matches-section');
  const groupMatches = t.matches.filter(m => m.phase === 'group');
  if (groupMatches.length) {
    groupEl.style.display = '';
    document.getElementById('tm-group-matches-list').innerHTML = groupMatches.map(m => tmMatchCard(m, t)).join('');
  } else {
    groupEl.style.display = 'none';
  }

  // Playoff
  const playoffEl = document.getElementById('tm-playoff-section');
  const playoffMatches = t.matches.filter(m => m.phase === 'playoff');
  if (playoffMatches.length) {
    playoffEl.style.display = '';
    const rounds = [...new Set(playoffMatches.map(m => m.playoffRound))].sort();
    document.getElementById('tm-playoff-bracket').innerHTML = rounds.map(r => {
      const rMatches = playoffMatches.filter(m => m.playoffRound === r);
      const rName = rMatches.length === 1 ? 'Finał' : rMatches.length === 2 ? 'Półfinał' : `Runda ${r}`;
      return `<div style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${rName}</div>
        ${rMatches.map(m => tmMatchCard(m, t)).join('')}
      </div>`;
    }).join('');
  } else {
    playoffEl.style.display = 'none';
  }

  // Mistrz
  const champEl = document.getElementById('tm-champion-section');
  if (t.status === 'finished' && t.champion) {
    champEl.style.display = '';
    document.getElementById('tm-champion-name').textContent = t.champion.name;
  } else {
    champEl.style.display = 'none';
  }
}

function tmMatchCard(m, t) {
  const gameIcon = m.gameType ? (tmGetGameIcon(m.gameType) + ' ' + m.gameType) : '';
  const statusLabel = { pending: 'oczekuje', picking: '🎮 wybór gry', playing: '▶️ gra trwa', done: '✓', bye: 'bye' }[m.status] || m.status;

  const p1cls = m.status === 'done' ? (m.winner?.id === m.p1?.id ? 'winner' : 'loser') : (m.status === 'playing' ? 'active' : '');
  const p2cls = m.status === 'done' ? (m.winner?.id === m.p2?.id ? 'winner' : 'loser') : (m.status === 'playing' ? 'active' : '');

  return `<div class="tm-match-card ${m.status}">
    <div class="tm-player-pill ${p1cls}">${m.p1?.name || 'BYE'}</div>
    <div class="tm-vs">VS</div>
    <div class="tm-player-pill ${p2cls}">${m.p2?.name || 'BYE'}</div>
    <div style="font-size:11px;color:var(--muted);min-width:70px;text-align:right">${m.status === 'done' && gameIcon ? gameIcon : statusLabel}</div>
  </div>`;
}

function tmGetGameIcon(gameType) {
  const icons = { tictactoe:'⭕', chess:'♟️', highlow:'🔢', pincracker:'🔑', hangman:'🪢', quiz:'❓', wordrace:'🏃', kalambury:'🎨', familyfeud:'👪', jeopardy:'📺', wavelength:'📡' };
  return icons[gameType] || '🎮';
}

// ── Render pick-game screen ─────────────────────────────────────

function tmRenderPickGame(t, match) {
  TM.current = t;
  if (!match) return;

  const p1 = match.p1?.name || '?';
  const p2 = match.p2?.name || '?';
  document.getElementById('tm-pick-match-info').textContent = `${p1} vs ${p2}`;

  // Only 2-player games
  const eligible = (window._availableGames || window.games || []).filter(g =>
    g.maxPlayers === 2 && g.minPlayers === 2 && !['chess','poker','blackjack'].includes(g.id)
  );

  document.getElementById('tm-pick-games').innerHTML = eligible.map(g => `
    <div class="tm-game-pick-btn" onclick="tmPickGame('${g.id}')">
      <div style="font-size:28px;margin-bottom:4px">${g.icon || '🎮'}</div>
      <div style="font-weight:700;font-size:14px">${g.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${g.description || ''}</div>
    </div>
  `).join('') || '<div style="color:var(--muted)">Brak dostępnych gier dla 2 graczy</div>';

  showScreen('tournament-pick');
}

// ── Render wait screen ─────────────────────────────────────────

function tmRenderWait(t, msg, sub) {
  TM.current = t;
  document.getElementById('tm-wait-title').textContent = msg || 'Czekaj na swój mecz…';
  document.getElementById('tm-wait-sub').textContent = sub || '';

  // Mini bracket w poczekalni
  if (t) {
    const currentMatch = t.matches.find(m => m.id === t.currentMatchId);
    if (currentMatch) {
      document.getElementById('tm-wait-bracket').innerHTML = `
        <div style="background:var(--card);border-radius:10px;padding:12px;font-size:13px">
          <div style="color:var(--muted);margin-bottom:6px">Aktualny mecz:</div>
          ${tmMatchCard(currentMatch, t)}
        </div>`;
    }
  }
  showScreen('tournament-wait');
}

// ── Socket events ──────────────────────────────────────────────

socket.on('tournamentList', (list) => {
  const el = document.getElementById('tm-list-items');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:14px">Brak aktywnych turniejów</div>';
    return;
  }
  const nameInput = document.getElementById('player-name-input')?.value || S.playerName || '';
  el.innerHTML = list.map(t => `
    <div style="background:var(--card);border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <div style="font-weight:700">${t.hostName}'s turniej <span style="color:var(--muted);font-weight:400;font-size:12px">${t.id}</span></div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">${t.players.length} graczy • ${t.status === 'lobby' ? 'Lobby' : t.status === 'group' ? 'Faza grupowa' : 'Eliminacje'}</div>
      </div>
      ${t.status === 'lobby' ? `<button class="btn btn-primary" style="padding:6px 16px;font-size:13px" onclick="tmJoinExisting('${t.id}')">Dołącz</button>` : '<span style="color:var(--muted);font-size:12px">W toku</span>'}
    </div>
  `).join('') + `
    <div style="margin-top:12px">
      <div style="font-size:13px;color:var(--muted);margin-bottom:6px">Masz kod turnieju?</div>
      <div style="display:flex;gap:8px">
        <input id="tm-join-code-input" class="input" placeholder="Kod turnieju (np. TABC)" style="flex:1;text-transform:uppercase" maxlength="6">
        <button class="btn btn-secondary" onclick="tmJoinByCode()">Dołącz</button>
      </div>
    </div>
  `;
});

function tmJoinExisting(id) {
  const name = S.playerName || prompt('Twoja nazwa:');
  if (!name) return;
  S.playerName = name;
  socket.emit('tournamentJoin', { tournamentId: id, playerName: name });
}

socket.on('tournamentCreated', ({ tournament }) => {
  TM.current = tournament;
  TM.isHost = true;
  tmRenderLobby(tournament);
});

socket.on('tournamentJoined', ({ tournament }) => {
  TM.current = tournament;
  TM.isHost = false;
  tmRenderLobby(tournament);
});

socket.on('tournamentUpdate', ({ tournament }) => {
  TM.current = tournament;
  const screen = document.querySelector('.screen.active')?.id;

  if (tournament.status === 'lobby') {
    // Odśwież lobby jeśli jesteś w nim lub dopiero dołączyłeś
    if (!screen || screen === 'screen-tournament-lobby' || screen === 'screen-home') {
      tmRenderLobby(tournament);
    }
  } else if (screen && screen.startsWith('screen-tournament')) {
    if (screen === 'screen-tournament-bracket') tmRenderBracket(tournament);
    else if (screen === 'screen-tournament-lobby') tmRenderLobby(tournament);
    // Na wait/pick — zaktualizuj tylko TM.current, render zrobi odpowiedni event
  }
  // Jeśli nie jesteśmy na żadnym ekranie turniejowym ale jesteśmy w turnieju
  // (np. wróciliśmy z meczu), pokaż bracket
  else if (TM.current && tournament.status !== 'lobby') {
    const isInTournament = tournament.players.some(p => p.id === tmMyId());
    if (isInTournament && screen === 'screen-gameover') {
      tmRenderBracket(tournament);
    }
  }
});

socket.on('tournamentPickGame', ({ tournament, match }) => {
  TM.current = tournament;
  if (tmIsHost()) {
    tmRenderPickGame(tournament, match);
  } else {
    // Sprawdź czy to mój mecz
    const myId = tmMyId();
    const isMyMatch = match.p1?.id === myId || match.p2?.id === myId;
    if (isMyMatch) {
      tmRenderWait(tournament, '⏳ Host wybiera grę dla Twojego meczu…', `${match.p1?.name} vs ${match.p2?.name}`);
    } else {
      tmRenderWait(tournament, '⏳ Czekaj na swój mecz', `Trwa mecz: ${match.p1?.name} vs ${match.p2?.name}`);
    }
  }
});

socket.on('tournamentMatchReady', ({ tournament, match, roomId }) => {
  TM.current = tournament;
  const myId = tmMyId();
  const isMyMatch = match.p1?.id === myId || match.p2?.id === myId;

  // Zaktualizuj bracket dla wszystkich
  if (document.querySelector('.screen.active')?.id === 'screen-tournament-bracket') {
    tmRenderBracket(tournament);
  }

  if (isMyMatch) {
    showToast(`🎮 Twój mecz: ${match.p1.name} vs ${match.p2.name} — ${match.gameType}!`, 'success');
    // Dołącz do pokoju
    socket.emit('joinRoom', { roomId, playerName: S.playerName });
    // Ustaw flagę żeby po gameOver wrócić do brackettu
    S._inTournamentMatch = true;
    S._tournamentId = tournament.id;
  } else {
    // Obserwuj / czekaj
    tmRenderWait(tournament,
      '⏳ Inny mecz trwa…',
      `${match.p1?.name} vs ${match.p2?.name} (${match.gameType})`
    );
  }
});

socket.on('tournamentPhaseChange', ({ phase, advancers, tournament }) => {
  TM.current = tournament;
  if (phase === 'playoff') {
    const myId = tmMyId();
    const imIn = advancers.some(a => a.id === myId);
    showToast(imIn ? '🎉 Awansujesz do fazy eliminacji!' : '😔 Nie awansujesz do playoff', imIn ? 'success' : 'error');
  }
  tmRenderBracket(tournament);
});

socket.on('tournamentFinished', ({ tournament }) => {
  TM.current = tournament;
  const isChamp = tournament.champion?.id === tmMyId();
  showToast(isChamp ? '🏆 Jesteś mistrzem turnieju!' : `🏆 Mistrz: ${tournament.champion?.name}`, isChamp ? 'success' : 'info');
  tmRenderBracket(tournament);
});

socket.on('tournamentHostChanged', ({ newHostId }) => {
  if (TM.current) {
    TM.current.hostId = newHostId;
    TM.isHost = newHostId === tmMyId();
    if (TM.isHost) showToast('👑 Zostałeś nowym hostem turnieju!', 'info');
    if (document.querySelector('.screen.active')?.id === 'screen-tournament-lobby') {
      tmRenderLobby(TM.current);
    }
  }
});

socket.on('tournamentError', ({ message }) => {
  showToast('❌ ' + message, 'error');
});

// Tournament gameOver — handled in main gameOver handler above

// ── Cache listy gier dla ekranu wyboru ─────────────────────────
// Request on load
// _availableGames is populated by utils.js init() via window.games
