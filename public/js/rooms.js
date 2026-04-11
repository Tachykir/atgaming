// rooms.js — pokoje i gry


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

configSchemas = {};
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

function renderHangman(room, mask, isMyTurn, playerLives, playerEliminated) {
  renderLiveScores(room, 'hangman-scores');
  const gs = room.gameState || {};
  const maxWrong = H.maxWrong || gs.maxWrong || 6;
  const totalRounds = H.totalRounds || gs.totalRounds || 1;
  const currentRound = H.currentRound || (gs.currentRound || 0) + 1;

  // Round info
  const ri = document.getElementById('hangman-round-info');
  if (ri && totalRounds > 1) ri.innerHTML = `<span class="round-badge">Słowo ${currentRound} / ${totalRounds}</span>`;
  else if (ri) ri.innerHTML = '';

  // Turn indicator
  const ind = document.getElementById('turn-indicator');
  if (S.isGM) { ind.textContent = '🎭 Obserwujesz jako Game Master'; ind.className = 'turn-indicator gm-view'; }
  else if (playerEliminated?.[S.playerId]) { ind.textContent = '💀 Zostałeś wyeliminowany!'; ind.className = 'turn-indicator wait'; }
  else if (isMyTurn) { ind.textContent = '🎯 Twoja kolej!'; ind.className = 'turn-indicator your-turn'; }
  else { const cp = room.players.find(p => p.id === gs.currentTurn); ind.textContent = `⏳ Kolej: ${cp?.name||'...'}`;ind.className='turn-indicator wait'; }

  // Per-player lives
  const livesEl = document.getElementById('player-lives-display');
  if (livesEl && playerLives) {
    livesEl.innerHTML = room.players.map(p => {
      const wrong = playerLives[p.id] || 0;
      const elim = playerEliminated?.[p.id];
      const isActive = gs.currentTurn === p.id;
      const hearts = Array.from({length: maxWrong}, (_, i) =>
        i < (maxWrong - wrong) ? '❤️' : '🖤'
      ).join('');
      return `<div class="player-life-card ${elim?'eliminated':''} ${isActive?'active-turn':''}">
        <div class="player-life-name">${escHtml(p.name)}</div>
        <div class="player-life-hearts">${hearts}</div>
        ${elim ? '<div class="player-life-badge">WYELIMINOWANY</div>' : ''}
      </div>`;
    }).join('');
  }

  // Scaffold — show based on CURRENT player's wrong count
  const myWrong = playerLives?.[S.playerId] || 0;
  SCAFFOLD.forEach((id,i) => document.getElementById(id).style.display = i < myWrong ? 'block' : 'none');

  // Word display
  document.getElementById('word-display').innerHTML = mask.replace(/ /g,'').split('').map(l => `<div class="letter-box ${l!=='_'?'revealed':''}">${l!=='_'?l:''}</div>`).join('');

  // Keyboard
  const guessed = [...(gs.guessed||[])].map(l=>l.toUpperCase());
  const revealedLetters = new Set((mask||'').replace(/ /g,'').split('').filter(l=>l!=='_').map(l=>l.toUpperCase()));
  const myElim = playerEliminated?.[S.playerId];
  const canPlay = isMyTurn && !S.isGM && !myElim;
  document.getElementById('keyboard').innerHTML = LETTERS.map(letter => {
    const up = letter.toUpperCase();
    const isGuessed = guessed.includes(up);
    const isInWord = revealedLetters.has(up);
    const cls = isGuessed ? (isInWord ? 'correct' : 'wrong') : '';
    return `<button class="key-btn ${cls}" onclick="guessLetter('${letter.toLowerCase()}')" ${(isGuessed||!canPlay)?'disabled':''}>${letter}</button>`;
  }).join('');
}
function guessLetter(l) { socket.emit('guessLetter', { roomId: S.roomId, letter: l }); }

// ── QUIZ ───────────────────────────────────────────────────────
function renderQuizQuestion(data) {
  document.getElementById('q-num').textContent = data.questionIndex + 1;
  document.getElementById('q-total').textContent = data.total;
  document.getElementById('q-points').textContent = data.points;
  document.getElementById('quiz-question').textContent = data.question;
  document.getElementById('answered-count').textContent = '0';
  document.getElementById('total-count').textContent = S.room?.players.length || 0;
  document.getElementById('quiz-answers').innerHTML = data.answers.map((a,i) =>
    `<button class="answer-btn" onclick="answerQuiz(${i})">${a}</button>`).join('');
  startTimer(data.timeLimit);
}
function answerQuiz(i) {
  if (selectedAnswer !== null) return;
  selectedAnswer = i;
  document.querySelectorAll('.answer-btn').forEach((b,j) => { b.disabled=true; if(j===i) b.classList.add('selected'); });
  socket.emit('quizAnswer', { roomId: S.roomId, answerIndex: i });
}
function startTimer(seconds) {
  clearInterval(timerInterval);
  const bar = document.getElementById('timer-bar');
  let left = seconds; bar.style.width='100%'; bar.className='quiz-timer-bar';
  timerInterval = setInterval(() => {
    left--; const pct=(left/seconds)*100; bar.style.width=pct+'%';
    if(pct<40) bar.classList.add('warning'); if(pct<20) bar.classList.add('danger');
    if(left<=0) clearInterval(timerInterval);
  }, 1000);
}

// ── WORD RACE ──────────────────────────────────────────────────
function renderWordRace(data) {
  document.getElementById('wr-round').textContent = data.roundIndex + 1;
  document.getElementById('wr-total').textContent = data.total;
  document.getElementById('wr-clue').textContent = data.clue;
  document.getElementById('wr-answer').value = '';
  document.getElementById('wr-answer').disabled = false;
  document.getElementById('wr-feedback').textContent = '';
  document.getElementById('wr-answer').focus();
  renderLiveScores(data.room, 'wr-scores');
  startWrTimer(data.timeLimit);
}
function startWrTimer(seconds) {
  clearInterval(wrTimerInterval);
  const fill = document.getElementById('wr-timer-fill');
  let left = seconds; fill.style.width='100%'; fill.style.background='var(--warning)';
  wrTimerInterval = setInterval(() => {
    left--; const pct=(left/seconds)*100; fill.style.width=pct+'%';
    if(pct<30) fill.style.background='var(--error)';
    if(left<=0) clearInterval(wrTimerInterval);
  }, 1000);
}
function submitWordRace() {
  const answer = document.getElementById('wr-answer').value.trim();
  if (!answer) return;
  socket.emit('wordRaceAnswer', { roomId: S.roomId, answer });
}

// ── SHARED ────────────────────────────────────────────────────
function renderLiveScores(room, id) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = [...room.players].sort((a,b) => b.score-a.score).map(p =>
    `<div class="live-score-chip">${p.name} <span>${p.score}</span></div>`).join('');
}

function showGameOver(data) {
  clearInterval(timerInterval); clearInterval(wrTimerInterval);
  const sorted = data.sorted || [...data.room.players].sort((a,b) => b.score-a.score);
  const ranks = ['🥇','🥈','🥉'];
  const banner = document.getElementById('result-banner');
  if (data.room.gameType === 'hangman') {
    banner.className = data.won ? 'result-banner win' : 'result-banner lose';
    document.getElementById('result-emoji').textContent = data.won ? '🎉' : '💀';
    document.getElementById('result-title').textContent = data.won ? 'Słowo odgadnięte!' : 'Wisielec umarł!';
    document.getElementById('result-subtitle').textContent = `Słowo: ${(data.word||'').toUpperCase()}`;
  } else {
    const meta = games.find(g => g.id === data.room.gameType) || {};
    banner.className = 'result-banner win';
    document.getElementById('result-emoji').textContent = '🏆';
    document.getElementById('result-title').textContent = `Koniec — ${meta.name||data.room.gameType}!`;
    document.getElementById('result-subtitle').textContent = sorted[0] ? `Wygrywa ${sorted[0].name}!` : '';
  }
  document.getElementById('final-scores').innerHTML = sorted.map((p,i) =>
    `<div class="score-item ${i===0?'first':i===1?'second':i===2?'third':''}">
      <div class="score-rank">${ranks[i]||(i+1)}</div>
      <div class="score-name">${p.name}${p.id===S.playerId?' <span style="color:var(--accent);font-size:12px">(ty)</span>':''}</div>
      <div class="score-points">${p.score}</div>
    </div>`).join('');
  if (S.isHost || S.isGM) document.getElementById('play-again-btn').style.display = 'inline-flex';
  showScreen('gameover');
}

// ── LEADERBOARD ────────────────────────────────────────────────
async function showLeaderboard() {
  await loadLeaderboard();
  showScreen('leaderboard');
}

async function loadLeaderboard() {
  const r = await fetch('/api/leaderboard');
  const lb = await r.json();
  const tabsEl = document.getElementById('lb-tabs');

  // Build tabs from loaded games + any keys in lb
  const allIds = [...new Set([...games.map(g=>g.id), ...Object.keys(lb)])];
  if (!activeLbTab || !allIds.includes(activeLbTab)) activeLbTab = allIds[0];

  tabsEl.innerHTML = allIds.map(id => {
    const meta = games.find(g => g.id === id) || {};
    const count = lb[id]?.length || 0;
    return `<button class="lb-tab ${id===activeLbTab?'active':''}" onclick="lbTab('${id}')">${meta.icon||'🎮'} ${meta.name||id} <span style="opacity:.6;font-size:11px">(${count})</span></button>`;
  }).join('');

  renderLbContent(lb[activeLbTab] || []);
}

function lbTab(id) {
  activeLbTab = id;
  loadLeaderboard();
}

function renderLbContent(entries) {
  const el = document.getElementById('lb-content');
  if (!entries.length) { el.innerHTML = '<div class="lb-empty">Brak wyników. Zagraj pierwszą grę! 🎮</div>'; return; }
  const diffLabel = {easy:'Łatwy',medium:'Średni',hard:'Trudny'};
  el.innerHTML = `<table class="lb-table">
    <thead><tr><th>#</th><th>Gracz</th><th>Wynik</th><th>Kategoria</th><th>Data</th></tr></thead>
    <tbody>${entries.slice(0, 50).map((e, i) => {
      const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
      const rank = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
      const date = new Date(e.date).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      return `<tr>
        <td><span class="lb-rank ${rankClass}">${rank}</span></td>
        <td style="font-weight:700">${escHtml(e.name)}</td>
        <td><span class="lb-score">${e.score}</span></td>
        <td><span class="lb-meta">${e.category||'—'} · ${diffLabel[e.difficulty]||e.difficulty||'—'}</span></td>
        <td class="lb-date">${date}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ── SOCKET EVENTS ──────────────────────────────────────────────
socket.on('connect', () => { S.playerId = socket.id; });
socket.on('error', ({message}) => showToast(message, 'error'));

socket.on('roomCreated', ({roomId, room}) => {
  S.roomId=roomId; S.isHost=true; S.room=room; renderLobby(room); showChat(); showScreen('lobby');
});
socket.on('roomJoined', ({roomId, room}) => {
  S.roomId = roomId;
  S.isHost = room.hostId === S.playerId;
  S.room   = room;
  // Jeśli to pokój meczu turniejowego — nie pokazuj lobby, gra zaraz się auto-wystartuje
  if (room.config?._tournamentId) {
    showToast(`⚔️ Mecz turniejowy: ${room.players.map(p=>p.name).join(' vs ')}`, 'info');
    // Poczekalnia na start gry (auto-start nastąpi max 5s)
    showScreen('tournament-wait');
    document.getElementById('tm-wait-title').textContent = '⚔️ Mecz zaraz się zaczyna…';
    document.getElementById('tm-wait-sub').textContent = room.players.map(p=>p.name).join(' vs ') + ' • ' + room.gameType;
    return;
  }
  renderLobby(room); showChat(); showScreen('lobby');
});
socket.on('playerJoined', ({room}) => {
  S.room=room; renderLobby(room);
  showToast(`👋 ${room.players[room.players.length-1].name} dołączył!`);
});
socket.on('playerLeft', ({room, playerName}) => {
  S.room=room; if(S.roomId) renderLobby(room); showToast(`${playerName} opuścił pokój`,'error');
});
socket.on('gameStarted', ({room,mask,wordLength,round,totalRounds,maxWrong,playerLives}) => {
  S.room=room;
  if(room.gameType==='hangman'){
    H = { maxWrong: maxWrong||6, totalRounds: totalRounds||1, currentRound: round||1 };
    renderHangman(room, mask||Array(wordLength).fill('_').join(' '), room.gameState?.currentTurn===S.playerId, playerLives||{}, {});
    showScreen('hangman');
  }
  else if(room.gameType==='quiz'){ showScreen('quiz'); }
  else if(room.gameType==='wordrace'){ showScreen('wordrace'); }
  else if(room.gameType==='jeopardy'){
    jeopardyCats = content.jeopardy || {};
    showScreen('jeopardy');
  }
  else if(room.gameType==='familyfeud'){ showScreen('familyfeud'); }
  else if(room.gameType==='kalambury'){ initKalamburyCanvas(); showScreen('kalambury'); }
  else if(room.gameType==='highlow'){ showScreen('highlow'); }
  else if(room.gameType==='pincracker'){ showScreen('pincracker'); }
});
socket.on('letterGuessed', ({room,letter,correct,mask,currentTurn,playerLives,playerEliminated}) => {
  S.room=room;
  if(room.gameState) room.gameState.currentTurn = currentTurn;
  renderHangman(room, mask, currentTurn===S.playerId, playerLives||{}, playerEliminated||{});
  showToast(correct?`✅ Litera "${letter.toUpperCase()}" jest!`:`❌ Brak litery "${letter.toUpperCase()}"`,correct?'success':'error');
});
socket.on('hangmanRoundEnd', ({room, word, won, mask, round, totalRounds, playerLives, playerEliminated}) => {
  S.room=room;
  H.currentRound = round + 1;
  showToast(won ? `✅ Słowo: "${word.toUpperCase()}" — Runda ${round}/${totalRounds}!` : `💀 Słowo: "${word.toUpperCase()}" — wszyscy wyeliminowani!`, won?'success':'error');
});
socket.on('quizQuestion', (data) => { selectedAnswer=null; renderQuizQuestion(data); if(S.room) renderLiveScores(S.room,'quiz-scores'); showScreen('quiz'); });
socket.on('answerResult', ({correct,points}) => {
  const btns=document.querySelectorAll('.answer-btn');
  if(correct){if(selectedAnswer!==null)btns[selectedAnswer].classList.add('correct');showToast(`✅ Poprawnie! +${points} pkt`,'success');}
  else{if(selectedAnswer!==null)btns[selectedAnswer].classList.add('wrong');showToast('❌ Błędna odpowiedź','error');}
});
socket.on('quizReveal', ({correctIndex,room}) => {
  S.room=room; clearInterval(timerInterval);
  const btns=document.querySelectorAll('.answer-btn');
  if(btns[correctIndex])btns[correctIndex].classList.add('correct');
  btns.forEach(b=>b.disabled=true); renderLiveScores(room,'quiz-scores');
});
socket.on('playerAnswered', ({answeredCount,totalPlayers}) => {
  document.getElementById('answered-count').textContent=answeredCount;
  document.getElementById('total-count').textContent=totalPlayers;
});
socket.on('wordRaceRound', (data) => { S.room=data.room; renderWordRace(data); showScreen('wordrace'); });
socket.on('wordRaceCorrect', ({playerName,answer,points,room}) => {
  S.room=room; clearInterval(wrTimerInterval);
  const isMe=room.players.find(p=>p.id===S.playerId)?.name===playerName;
  const el=document.getElementById('wr-feedback');
  el.style.color='var(--success)'; el.textContent=isMe?`✅ Poprawnie! +${points} pkt`:`✅ ${playerName}: ${answer.toUpperCase()}`;
  document.getElementById('wr-answer').disabled=true; renderLiveScores(room,'wr-scores');
});
socket.on('wordRaceWrong', () => {
  const el=document.getElementById('wr-feedback'); el.style.color='var(--error)'; el.textContent='❌ Nie to słowo...';
  setTimeout(()=>el.textContent='',1500);
});
socket.on('wordRaceTimeout', ({answer,room}) => {
  S.room=room; clearInterval(wrTimerInterval);
  const el=document.getElementById('wr-feedback'); el.style.color='var(--warning)'; el.textContent=`⏰ Czas! Słowo: ${answer.toUpperCase()}`;
  document.getElementById('wr-answer').disabled=true; renderLiveScores(room,'wr-scores');
});
socket.on('gameOver', (data) => {
  S.room = data.room;
  // Obsługa meczu turniejowego — nie pokazuj ekranu gameOver, wróć do drabinki
  if (S._inTournamentMatch) {
    S._inTournamentMatch = false;
    const tid = S._tournamentId;
    S._tournamentId = null;
    // Krótki toast z wynikiem meczu
    const winner = data.sorted?.[0];
    if (winner) {
      const isMe = winner.id === S.playerId;
      showToast(isMe ? '🏆 Wygrałeś mecz!' : `😔 Przegrałeś mecz z ${winner.name}`, isMe ? 'success' : 'error');
    }
    // Po 2s pokaż aktualną drabinkę turnieju
    setTimeout(() => {
      if (tid) {
        socket.emit('tournamentGet', { tournamentId: tid });
        if (TM.current) tmRenderBracket(TM.current);
        else showScreen('tournament-bracket');
      }
    }, 2000);
    return;
  }
  showGameOver(data);
});
socket.on('gameReset', ({room}) => {
  S.room=room; S.isHost=room.hostId===S.playerId; renderLobby(room);
  document.getElementById('play-again-btn').style.display='none'; showScreen('lobby');
});
socket.on('chatMessage', (msg) => { appendChatMsg(msg); });

// ── JEOPARDY ───────────────────────────────────────────────────
let jeopardyTimerInterval = null;
let jeopardyCats = {};

function renderJeopardyBoard(board, currentPicker, room) {
  S.room && renderLiveScores(S.room, 'jeopardy-scores');
  const amIPicker = currentPicker === S.playerId;
  const pickerName = S.room?.players.find(p => p.id === currentPicker)?.name || '?';
  const sb = document.getElementById('jeopardy-status-bar');
  if (sb) sb.innerHTML = amIPicker
    ? '🎯 Twoja kolej — wybierz pytanie!'
    : `⏳ Wybiera: <strong>${escHtml(pickerName)}</strong>`;

  const catKeys = Object.keys(board);
  const allValues = [100,200,300,400,500];
  const tableHTML = `<div style="overflow-x:auto"><table class="jeopardy-board">
    <thead><tr>${catKeys.map(k => `<th>${escHtml(jeopardyCats[k]?.label || k)}</th>`).join('')}</tr></thead>
    <tbody>
      ${allValues.map(val => `<tr>${catKeys.map(k => {
        const answered = board[k]?.[val] === true;
        const canClick = amIPicker && !answered && !S.isGM;
        return `<td class="${answered?'answered':''} ${!canClick&&!answered?'not-your-pick':''}"
          onclick="${canClick ? `pickJeopardy('${k}',${val})` : ''}">
          ${answered ? '✓' : '$'+val}
        </td>`;
      }).join('')}</tr>`).join('')}
    </tbody>
  </table></div>`;
  document.getElementById('jeopardy-content').innerHTML = tableHTML;
  document.getElementById('jeopardy-timer-wrap').style.display = 'none';
  document.getElementById('jeopardy-gm-judge').style.display = 'none';
  clearInterval(jeopardyTimerInterval);
}

function startJeopardyTimer(seconds, type) {
  clearInterval(jeopardyTimerInterval);
  const wrap = document.getElementById('jeopardy-timer-wrap');
  const fill = document.getElementById('jeop-timer-fill');
  if (!wrap || !fill) return;
  wrap.style.display = 'block';
  const start = Date.now();
  const end = start + seconds * 1000;
  function tick() {
    const remaining = Math.max(0, end - Date.now());
    const pct = (remaining / (seconds * 1000)) * 100;
    fill.style.width = pct + '%';
    fill.className = 'jeop-timer-fill' + (pct < 33 ? ' danger' : pct < 60 ? ' warning' : '');
    if (remaining <= 0) clearInterval(jeopardyTimerInterval);
  }
  tick();
  jeopardyTimerInterval = setInterval(tick, 100);
}

function pickJeopardy(catKey, value) {
  socket.emit('jeopardyPick', { roomId: S.roomId, catKey, value });
}
function buzzJeopardy() {
  const btn = document.getElementById('buzz-btn-el');
  if (btn) btn.disabled = true;
  socket.emit('jeopardyBuzz', { roomId: S.roomId });
}
function submitJeopardyAnswer() {
  const a = document.getElementById('jeopardy-ans-input');
  if (!a || !a.value.trim()) return;
  socket.emit('jeopardyAnswer', { roomId: S.roomId, answer: a.value.trim() });
  a.value = '';
}
function judgeAnswer(correct) {
  socket.emit('jeopardyJudge', { roomId: S.roomId, correct });
  document.getElementById('jeopardy-gm-judge').style.display = 'none';
}

socket.on('jeopardyBoard', ({board, currentPicker, room}) => {
  S.room = room || S.room;
  jeopardyCats = content[S.room?.gameType] || content.jeopardy || {};
  renderJeopardyBoard(board, currentPicker, S.room);
});

socket.on('jeopardyQuestion', ({catKey, value, clue, timeLimit, room}) => {
  S.room = room || S.room;
  clearInterval(jeopardyTimerInterval);
  document.getElementById('jeopardy-status-bar').innerHTML = 'Kto pierwszy wciśnie <strong>BUZZ</strong>?';
  document.getElementById('jeopardy-gm-judge').style.display = 'none';
  const alreadyBuzzed = false;
  document.getElementById('jeopardy-content').innerHTML = `
    <div class="jeopardy-question-box">
      <div class="value">$${value}</div>
      <div class="clue">${escHtml(clue)}</div>
    </div>
    <div class="jeopardy-buzz-wrap">
      ${!S.isGM ? `<button class="buzz-btn" id="buzz-btn-el" onclick="buzzJeopardy()">🔔 BUZZ!</button>` : '<div class="jeop-awaiting">🎭 Obserwujesz jako Game Master</div>'}
    </div>`;
  startJeopardyTimer(timeLimit || 20, 'question');
});

socket.on('jeopardyBuzzed', ({playerId, playerName, timeLimit}) => {
  clearInterval(jeopardyTimerInterval);
  const isMe = playerId === S.playerId;
  const sb = document.getElementById('jeopardy-status-bar');
  if (sb) sb.innerHTML = isMe ? '🎙️ <strong>Twoja odpowiedź!</strong>' : `🎙️ Odpowiada: <strong>${escHtml(playerName)}</strong>`;

  const buzzWrap = document.querySelector('.jeopardy-buzz-wrap');
  if (buzzWrap) buzzWrap.innerHTML = isMe
    ? `<div style="display:flex;gap:10px;width:100%;max-width:500px">
        <input class="input" id="jeopardy-ans-input" placeholder="Twoja odpowiedź..." style="flex:1" onkeydown="if(event.key==='Enter')submitJeopardyAnswer()">
        <button class="btn btn-primary" onclick="submitJeopardyAnswer()">→</button>
       </div>`
    : `<div class="jeop-awaiting">⌛ Czekam na odpowiedź ${escHtml(playerName)}...</div>`;

  if (isMe) { setTimeout(() => document.getElementById('jeopardy-ans-input')?.focus(), 50); }
  startJeopardyTimer(timeLimit || 10, 'buzz');
});

socket.on('jeopardyAwaitingJudge', ({playerName, answer}) => {
  const sb = document.getElementById('jeopardy-status-bar');
  if (sb) sb.innerHTML = `⚖️ Odpowiedź <strong>${escHtml(playerName)}</strong>: "<em>${escHtml(answer)}</em>" — czekam na ocenę GM`;
  clearInterval(jeopardyTimerInterval);
});

socket.on('jeopardyJudgeRequest', ({playerName, answer, correctAnswer}) => {
  // Only GM receives this
  const panel = document.getElementById('jeopardy-gm-judge');
  const info  = document.getElementById('gm-judge-info');
  if (panel && info) {
    info.innerHTML = `<strong>${escHtml(playerName)}</strong> odpowiedział: "<em>${escHtml(answer)}</em>"<br><span style="color:var(--muted);font-size:12px">Oczekiwana: ${escHtml(correctAnswer)}</span>`;
    panel.style.display = 'block';
  }
});

socket.on('jeopardyAnswerResult', ({correct, answer, correctAnswer, board, currentPicker, remainingBuzzers, room}) => {
  S.room = room || S.room;
  clearInterval(jeopardyTimerInterval);
  document.getElementById('jeopardy-gm-judge').style.display = 'none';
  if (correctAnswer) {
    showToast(correct ? `✅ Poprawnie!` : `❌ Błąd! Odpowiedź: ${correctAnswer}`, correct?'success':'error');
    renderJeopardyBoard(board, currentPicker, S.room);
  } else if (remainingBuzzers?.length) {
    const sb = document.getElementById('jeopardy-status-bar');
    if (sb) sb.innerHTML = `❌ Błąd! Mogą jeszcze buzzować: ${remainingBuzzers.map(escHtml).join(', ')}`;
    const buzzWrap = document.querySelector('.jeopardy-buzz-wrap');
    if (buzzWrap) buzzWrap.innerHTML = `<button class="buzz-btn" id="buzz-btn-el" onclick="buzzJeopardy()">🔔 BUZZ!</button>`;
    startJeopardyTimer(S.room?.gameState?.questionTime || 20, 'question');
  }
  if (S.room) renderLiveScores(S.room, 'jeopardy-scores');
});

socket.on('jeopardyTimeout', ({answer, board, currentPicker, room}) => {
  S.room = room || S.room;
  clearInterval(jeopardyTimerInterval);
  showToast(`⏰ Czas! Odpowiedź: ${answer}`, 'error');
  renderJeopardyBoard(board, currentPicker, S.room);
});

// ── FAMILY FEUD ────────────────────────────────────────────────
let feudCurrentResponder = null;
let feudStrikesPerPlayer = 3;
let feudAnswerCount = 0;
let feudRevealedAnswers = [];

function submitFeudAnswer() {
  const inp = document.getElementById('feud-answer');
  if (!inp || !inp.value.trim()) return;
  socket.emit('familyFeudAnswer', { roomId: S.roomId, answer: inp.value.trim() });
  inp.value = '';
}

function renderFeudBoard(count, revealed, answers) {
  const n = answers?.length || count || feudAnswerCount;
  feudRevealedAnswers = revealed || feudRevealedAnswers;
  const slots = [];
  for (let i = 0; i < n; i++) {
    const isRevealed = feudRevealedAnswers.includes(i);
    const ans = answers?.[i];
    slots.push(`<div class="feud-answer-slot ${isRevealed?'revealed':''}">
      <div class="feud-rank">${i+1}</div>
      <div style="flex:1">${isRevealed ? escHtml(ans?.text||'') : '?????'}</div>
      ${isRevealed ? `<div class="feud-pts">${ans?.points||0} pkt</div>` : ''}
    </div>`);
  }
  document.getElementById('feud-board').innerHTML = slots.join('');
}

function renderFeudResponderBar(responderId, responderName) {
  feudCurrentResponder = responderId;
  const isMe = responderId === S.playerId;
  const bar = document.getElementById('feud-responder-bar');
  if (bar) bar.innerHTML = isMe
    ? '🎯 <strong>Twoja kolej — wpisz odpowiedź!</strong>'
    : `⏳ Odpowiada: <strong>${escHtml(responderName || '')}</strong>`;
  const inp = document.getElementById('feud-answer');
  const btn = document.getElementById('feud-submit-btn');
  if (inp) inp.disabled = !isMe;
  if (btn) btn.disabled = !isMe;
  if (isMe && inp) inp.focus();
}

function renderFeudPlayerStrikes(room, playerStrikes, playerEliminated, responderId) {
  const container = document.getElementById('feud-players-strikes');
  if (!container || !room) return;
  container.innerHTML = room.players.map(p => {
    const strikes = playerStrikes?.[p.id] || 0;
    const elim = playerEliminated?.[p.id];
    const isActive = p.id === responderId;
    const hearts = Array.from({length: feudStrikesPerPlayer}, (_,i) =>
      i < (feudStrikesPerPlayer - strikes) ? '❤️' : '💔'
    ).join('');
    return `<div class="feud-player-strike-card ${isActive?'active':''} ${elim?'eliminated':''}">
      <div class="feud-player-name">${escHtml(p.name)}</div>
      <div class="feud-player-hearts">${hearts}</div>
    </div>`;
  }).join('');
}

socket.on('familyFeudQuestion', ({questionIndex, total, question, answerCount, currentResponder, responderName, strikesPerPlayer, room}) => {
  S.room = room;
  feudAnswerCount = answerCount;
  feudStrikesPerPlayer = strikesPerPlayer || 3;
  feudRevealedAnswers = [];
  document.getElementById('feud-q-num').textContent = questionIndex + 1;
  document.getElementById('feud-q-total').textContent = total;
  document.getElementById('feud-question').textContent = question;
  renderFeudBoard(answerCount, [], null);
  renderFeudResponderBar(currentResponder, responderName);
  renderFeudPlayerStrikes(room, {}, {}, currentResponder);
  renderLiveScores(room, 'feud-scores');
  document.getElementById('feud-feedback').textContent = '';
});

socket.on('familyFeudCorrect', ({playerName, answerIndex, answer, points, revealedAnswers, room}) => {
  S.room = room;
  feudRevealedAnswers = revealedAnswers;
  const slots = document.querySelectorAll('.feud-answer-slot');
  if (slots[answerIndex]) {
    slots[answerIndex].classList.add('revealed', 'reveal-anim');
    slots[answerIndex].innerHTML = `<div class="feud-rank">${answerIndex+1}</div><div style="flex:1">${escHtml(answer)}</div><div class="feud-pts">${points} pkt</div>`;
  }
  const isMe = room.players.find(p=>p.id===S.playerId)?.name === playerName;
  const fb = document.getElementById('feud-feedback');
  fb.style.color = 'var(--success)';
  fb.textContent = isMe ? `✅ Dobrze! +${points} pkt` : `✅ ${escHtml(playerName)}: ${escHtml(answer)} (+${points})`;
  setTimeout(() => { if(fb) fb.textContent=''; }, 2500);
  renderLiveScores(room, 'feud-scores');
});

socket.on('familyFeudWrong', ({playerId, playerName, strikes, strikesPerPlayer, eliminated, playerStrikes, playerEliminated}) => {
  const isMe = playerId === S.playerId;
  const fb = document.getElementById('feud-feedback');
  fb.style.color = 'var(--error)';
  fb.textContent = eliminated
    ? `💀 ${escHtml(playerName)} wyeliminowany! (${strikes}/${strikesPerPlayer} błędów)`
    : `❌ ${escHtml(playerName)}: nie ma takiej odpowiedzi (${strikes}/${strikesPerPlayer})`;
  setTimeout(() => { if(fb) fb.textContent=''; }, 2500);
  if (S.room) renderFeudPlayerStrikes(S.room, playerStrikes, playerEliminated, feudCurrentResponder);
});

socket.on('familyFeudNextResponder', ({currentResponder, responderName, playerStrikes, playerEliminated}) => {
  renderFeudResponderBar(currentResponder, responderName);
  if (S.room) renderFeudPlayerStrikes(S.room, playerStrikes, playerEliminated, currentResponder);
});

socket.on('feudNotYourTurn', ({currentResponder}) => {
  const respName = S.room?.players.find(p=>p.id===currentResponder)?.name || '?';
  showToast(`Teraz odpowiada ${respName}!`, 'error');
});

socket.on('feudAlreadyRevealed', ({answer}) => {
  showToast(`"${answer}" jest już odkryta!`, 'error');
});

socket.on('familyFeudRevealAll', ({answers, room}) => {
  S.room = room;
  const slots = document.querySelectorAll('.feud-answer-slot');
  answers.forEach((ans, i) => {
    if (slots[i] && !slots[i].classList.contains('revealed')) {
      slots[i].classList.add('revealed', 'reveal-anim');
      slots[i].innerHTML = `<div class="feud-rank">${i+1}</div><div style="flex:1">${escHtml(ans.text)}</div><div class="feud-pts">${ans.points} pkt</div>`;
    }
  });
  const inp = document.getElementById('feud-answer');
  const btn = document.getElementById('feud-submit-btn');
  if (inp) inp.disabled = true;
  if (btn) btn.disabled = true;
  renderLiveScores(room, 'feud-scores');
});

// ── KALAMBURY ─────────────────────────────────────────────────
let canvas, ctx, drawing = false, currentColor = '#000000', currentSize = 4, isDrawer = false;
const COLORS = ['#000000','#ffffff','#ff4757','#ffa502','#2ed573','#1e90ff','#a55eea','#ff6b9d','#eccc68','#747d8c'];

function initKalamburyCanvas() {
  canvas = document.getElementById('drawing-canvas');
  ctx = canvas.getContext('2d');

  // Set canvas resolution
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(600, rect.width - 20);
  canvas.height = Math.floor(canvas.width * 3/4);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Color palette
  document.getElementById('color-palette').innerHTML = COLORS.map(c =>
    `<div class="color-btn ${c===currentColor?'active':''}" style="background:${c}" onclick="setColor('${c}',this)"></div>`
  ).join('');

  // Size palette
  document.getElementById('size-palette').innerHTML = [2,5,10,20].map(s =>
    `<button class="size-btn ${s===currentSize?'active':''}" onclick="setSize(${s},this)">${s}px</button>`
  ).join('');

  // Mouse events
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);
  // Touch
  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(e.touches[0]); }, {passive:false});
  canvas.addEventListener('touchmove', e => { e.preventDefault(); draw(e.touches[0]); }, {passive:false});
  canvas.addEventListener('touchend', stopDraw);
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function startDraw(e) {
  if (!isDrawer) return;
  drawing = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!drawing || !isDrawer) return;
  const pos = getPos(e);
  ctx.lineWidth = currentSize;
  ctx.strokeStyle = currentColor;
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  socket.emit('kalamburyDraw', { roomId: S.roomId, drawData: { x: pos.x, y: pos.y, color: currentColor, size: currentSize, type: 'draw' } });
}

function stopDraw() {
  if (!drawing) return;
  drawing = false;
  ctx.beginPath();
  socket.emit('kalamburyDraw', { roomId: S.roomId, drawData: { type: 'end' } });
}

function setColor(c, el) {
  currentColor = c;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function setSize(s, el) {
  currentSize = s;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function clearCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  socket.emit('kalamburyClearCanvas', { roomId: S.roomId });
}

function submitKalamGuess() {
  const inp = document.getElementById('kalam-guess');
  if (!inp || !inp.value.trim()) return;
  socket.emit('kalamburyGuess', { roomId: S.roomId, guess: inp.value.trim() });
  inp.value = '';
}

let kalamDrawing = false;

socket.on('kalamburyRound', ({roundIndex, total, drawerId, drawerName, room}) => {
  S.room = room;
  isDrawer = drawerId === S.playerId;
  document.getElementById('kalam-round').textContent = roundIndex + 1;
  document.getElementById('kalam-total').textContent = total;
  document.getElementById('kalam-drawer-info').textContent = isDrawer ? '✏️ Ty rysujesz!' : `✏️ Rysuje: ${drawerName}`;
  document.getElementById('clear-canvas-btn').style.display = isDrawer ? 'inline-flex' : 'none';
  document.getElementById('kalam-guess-area').style.display = isDrawer ? 'none' : 'block';
  document.getElementById('kalam-word-box').style.display = 'none';
  document.getElementById('kalam-chat').innerHTML = '';
  // clear canvas
  if (ctx) { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); }
  renderLiveScores(room, 'kalam-scores');
  // Start timer
  let t = 60;
  clearInterval(kalamTimer);
  kalamTimer = setInterval(() => {
    t--;
    const el = document.getElementById('kalam-timer');
    if (el) el.textContent = t;
    if (el) el.style.color = t < 15 ? 'var(--error)' : t < 30 ? 'var(--warning)' : 'var(--text)';
    if (t <= 0) clearInterval(kalamTimer);
  }, 1000);
});

socket.on('kalamburyYourWord', ({word}) => {
  const box = document.getElementById('kalam-word-box');
  box.textContent = word.toUpperCase();
  box.style.display = 'block';
});

socket.on('kalamburyDrawUpdate', ({drawData}) => {
  if (!ctx) return;
  if (drawData.type === 'end') { ctx.beginPath(); return; }
  ctx.lineWidth = drawData.size || 4;
  ctx.strokeStyle = drawData.color || '#000';
  ctx.lineTo(drawData.x, drawData.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(drawData.x, drawData.y);
});

socket.on('kalamburyClearCanvas', () => {
  if (ctx) { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); }
});

socket.on('kalamburyGuessResult', ({playerName, guess, correct, playerId}) => {
  const chat = document.getElementById('kalam-chat');
  if (!chat) return;
  const div = document.createElement('div');
  div.className = `kalambury-guess-item ${correct?'correct':'wrong'}`;
  div.textContent = `${playerName}: ${guess}${correct?' ✅':''}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

socket.on('kalamburyCorrect', ({playerName, points, room}) => {
  S.room = room;
  renderLiveScores(room, 'kalam-scores');
});

socket.on('kalamburyReveal', ({word, room}) => {
  S.room = room;
  clearInterval(kalamTimer);
  document.getElementById('kalam-timer').textContent = '⏰';
  const box = document.getElementById('kalam-word-box');
  box.textContent = word.toUpperCase();
  box.style.display = 'block';
  box.style.background = 'var(--accent2)';
  renderLiveScores(room, 'kalam-scores');
});

// ── ADMIN ──────────────────────────────────────────────────────
async function adminLogin() {
  const pwd = document.getElementById('admin-password').value;
  const r = await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pwd})});
  const {ok} = await r.json();
  if (!ok) return showToast('Złe hasło!','error');
  adminPwd = pwd; await loadAdminContent(); showScreen('admin');
}
async function loadAdminContent() {
  const r = await fetch('/api/content'); content = await r.json();
  renderAdminTabs();
}

function renderTTT(gs, room) {
  tttGs = gs;
  const myId = S.playerId;
  const mySymbol = gs.symbols[myId];
  const isMyTurn = gs.currentTurn === myId;

  // Scores
  const scores = room.players.map(p => {
    const sym = gs.symbols[p.id] || '?';
    return `<div class="live-score-chip">${escHtml(p.name)} <span style="color:${sym==='X'?'var(--accent)':'var(--accent2)'};">${sym}</span> — <span>${gs.wins?.[p.id] || 0}</span></div>`;
  });
  document.getElementById('ttt-scores').innerHTML = scores.join('');
  document.getElementById('ttt-round-info').textContent = `Runda ${gs.roundCurrent || 1} / ${gs.roundsTotal || 3}`;

  const turnEl = document.getElementById('ttt-turn');
  if (S.isObserver) {
    turnEl.className = 'turn-indicator gm-view';
    const curPlayer = room.players.find(p => p.id === gs.currentTurn);
    turnEl.textContent = `Ruch: ${curPlayer ? escHtml(curPlayer.name) : ''}`;
  } else if (isMyTurn) {
    turnEl.className = 'turn-indicator your-turn';
    turnEl.textContent = `Twój ruch (${mySymbol})`;
  } else {
    turnEl.className = 'turn-indicator wait';
    const curPlayer = room.players.find(p => p.id === gs.currentTurn);
    turnEl.textContent = `Czeka na: ${curPlayer ? escHtml(curPlayer.name) : ''}`;
  }

  const board = document.getElementById('ttt-board');
  board.innerHTML = gs.board.map((cell, i) => {
    const clickable = isMyTurn && !cell && !S.isObserver ? `onclick="tttMove(${i})"` : '';
    return `<div class="ttt-cell ${cell || ''} ${cell ? 'filled' : ''}" ${clickable}>${cell ? (cell==='X'?'✕':'○') : ''}</div>`;
  }).join('');
  document.getElementById('ttt-result').textContent = '';
}

function tttMove(index) {
  socket.emit('tttMove', { roomId: S.roomId, index });
}

socket.on('tttState', ({ gs, room }) => {
  S.room = room;
  showScreen('tictactoe');
  renderTTT(gs, room);
});

socket.on('tttRoundEnd', ({ gs, result, room }) => {
  S.room = room;
  renderTTT(gs, room);
  const resEl = document.getElementById('ttt-result');
  // Highlight winning cells
  if (result.line?.length) {
    const cells = document.querySelectorAll('.ttt-cell');
    result.line.forEach(i => cells[i]?.classList.add('winner'));
  }
  if (result.winner === 'draw') resEl.textContent = '🤝 Remis!';
  else {
    const winner = room.players.find(p => gs.symbols[p.id] === result.winner);
    if (winner?.id === S.playerId) resEl.innerHTML = '<span style="color:var(--success)">🏆 Wygrałeś tę rundę!</span>';
    else resEl.innerHTML = `<span style="color:var(--error)">💀 Wygrywa ${escHtml(winner?.name || result.winner)}</span>`;
  }
});

// ── SZACHY ────────────────────────────────────────────────────
let chessGs = null;
let chessSelected = null;
let chessLegal = [];

const CHESS_UNICODE = {
  'K':'♔','Q':'♕','R':'♖','B':'♗','N':'♘','P':'♙',
  'k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟'
};

function renderChessBoard(gs, room) {
  chessGs = gs;
  const board = gs.board;
  const myId = S.playerId;
  const isWhite = gs.whiteId === myId;
  const flipped = !isWhite && !S.isObserver;

  const statusEl = document.getElementById('chess-status');
  if (gs.status === 'checkmate') {
    const winner = room.players.find(p => p.id === (gs.result==='white'?gs.whiteId:gs.blackId));
    statusEl.className = 'turn-indicator your-turn';
    statusEl.textContent = `♟ Mat! Wygrywa ${winner ? escHtml(winner.name) : gs.result}`;
  } else if (gs.status === 'stalemate') {
    statusEl.className = 'turn-indicator wait';
    statusEl.textContent = '🤝 Pat — remis!';
  } else if (gs.whiteTurn) {
    const wp = room.players.find(p => p.id === gs.whiteId);
    const mine = gs.whiteId === myId;
    statusEl.className = mine ? 'turn-indicator your-turn' : 'turn-indicator wait';
    statusEl.textContent = mine ? '♔ Twój ruch (białe)' : `♔ Ruch: ${escHtml(wp?.name||'Białe')}` + (gs.check?' — SZACH!':'');
  } else {
    const bp = room.players.find(p => p.id === gs.blackId);
    const mine = gs.blackId === myId;
    statusEl.className = mine ? 'turn-indicator your-turn' : 'turn-indicator wait';
    statusEl.textContent = mine ? '♚ Twój ruch (czarne)' : `♚ Ruch: ${escHtml(bp?.name||'Czarne')}` + (gs.check?' — SZACH!':'');
  }

  // Captured pieces
  document.getElementById('chess-captured-black').textContent = (gs.capturedBlack||[]).map(p=>CHESS_UNICODE[p]||p).join('');
  document.getElementById('chess-captured-white').textContent = (gs.capturedWhite||[]).map(p=>CHESS_UNICODE[p]||p).join('');

  const el = document.getElementById('chess-board');
  const rows = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
  const cols = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];

  let html = '';
  for (const r of rows) {
    for (const c of cols) {
      const light = (r + c) % 2 === 0;
      const piece = board[r][c];
      const isSelected = chessSelected && chessSelected[0]===r && chessSelected[1]===c;
      const isLegal = chessLegal.some(([lr,lc]) => lr===r && lc===c);
      const hasEnemy = isLegal && piece;
      // Find king in check
      const isKingInCheck = gs.check && piece && piece.toLowerCase()==='k' &&
        ((gs.whiteTurn && piece==='k') || (!gs.whiteTurn && piece==='K'));
      let cls = `chess-sq ${light?'light':'dark'}`;
      if (isSelected) cls += ' selected';
      if (isLegal && !hasEnemy) cls += ' legal-move';
      if (hasEnemy) cls += ' legal-capture';
      if (isKingInCheck) cls += ' in-check';
      html += `<div class="${cls}" onclick="chessClick(${r},${c})">${piece ? CHESS_UNICODE[piece]||piece : ''}</div>`;
    }
  }
  el.innerHTML = html;
}

function chessClick(r, c) {
  if (S.isObserver) return;
  const gs = chessGs;
  if (!gs) return;
  const myId = S.playerId;
  const isMyTurn = (gs.whiteTurn && gs.whiteId === myId) || (!gs.whiteTurn && gs.blackId === myId);
  if (!isMyTurn) return;

  if (chessSelected) {
    const isLegal = chessLegal.some(([lr,lc]) => lr===r && lc===c);
    if (isLegal) {
      socket.emit('chessMove', { roomId: S.roomId, from: { r: chessSelected[0], c: chessSelected[1] }, to: { r, c } });
      chessSelected = null;
      chessLegal = [];
      return;
    }
  }

  const piece = gs.board[r][c];
  const isWhite = p => p && p === p.toUpperCase();
  const myPiece = piece && ((gs.whiteTurn && isWhite(piece)) || (!gs.whiteTurn && !isWhite(piece)));

  if (myPiece) {
    chessSelected = [r, c];
    // Request legal moves from server? We compute client-side display only
    // For simplicity highlight all non-same-color squares as potential (server validates)
    chessLegal = [];
    socket.emit('chessRequestMoves', { roomId: S.roomId, from: { r, c } });
  } else {
    chessSelected = null;
    chessLegal = [];
  }
  if (chessGs) renderChessBoard(chessGs, S.room);
}

socket.on('chessState', ({ gs, room }) => {
  S.room = room;
  chessSelected = null;
  chessLegal = [];
  showScreen('chess');
  renderChessBoard(gs, room);
});

socket.on('chessLegalMoves', ({ moves }) => {
  chessLegal = moves || [];
  if (chessGs) renderChessBoard(chessGs, S.room);
});

// ── POKER ─────────────────────────────────────────────────────
let pokerState = null;

function renderPoker(ps) {
  pokerState = ps;
  const myId = S.playerId;
  const room = ps.room;

  // Chips
  const chips = ps.chips || {};
  document.getElementById('poker-chips').innerHTML = room.players.map(p =>
    `<div class="live-score-chip">${escHtml(p.name)} <span>${chips[p.id]||0} 🪙</span></div>`
  ).join('');

  // Community cards
  document.getElementById('poker-community').innerHTML = renderCards(ps.community || []);
  document.getElementById('poker-pot').textContent = `Pula: ${ps.pot || 0} 🪙`;
  document.getElementById('poker-phase').textContent = { preflop:'Pre-flop',flop:'Flop',turn:'Turn',river:'River',showdown:'Showdown' }[ps.phase] || ps.phase;

  // My hole cards (server sends _privateHands)
  const myCards = ps._privateHands?.[myId] || ps.hands?.[myId] || [];
  document.getElementById('poker-hole-cards').innerHTML = renderCards(myCards);

  // Players
  document.getElementById('poker-players-row').innerHTML = room.players.map(p => {
    const isActing = p.id === ps.actingPlayer;
    const folded = ps.folded?.[p.id];
    return `<div class="poker-player-panel ${isActing?'acting':''} ${folded?'folded':''}">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">${escHtml(p.name)}${p.id===myId?' (Ty)':''}</div>
      <div class="chips">${chips[p.id]||0} 🪙</div>
      ${ps.currentBet?.[p.id] ? `<div style="font-size:12px;color:var(--warning)">Bet: ${ps.currentBet[p.id]}</div>` : ''}
      ${folded ? '<div style="font-size:12px;color:var(--muted)">Fold</div>' : ''}
      ${ps.allIn?.[p.id] ? '<div style="font-size:12px;color:var(--accent2)">All-In</div>' : ''}
    </div>`;
  }).join('');

  // Actions
  const isMyTurn = ps.actingPlayer === myId;
  const actionsEl = document.getElementById('poker-actions');
  const waitingEl = document.getElementById('poker-waiting');
  if (isMyTurn && !S.isObserver) {
    actionsEl.style.display = 'block';
    waitingEl.style.display = 'none';
    const toCall = (ps.callAmount||0) - (ps.currentBet?.[myId]||0);
    document.getElementById('poker-call-btn').textContent = `Call ${toCall > 0 ? toCall : ''}`;
    document.getElementById('poker-check-btn').style.display = toCall > 0 ? 'none' : '';
    document.getElementById('poker-call-btn').style.display = toCall > 0 ? '' : 'none';
    document.getElementById('poker-turn-info').textContent = `Twoja kolejka! Pula do wyrównania: ${toCall}`;
  } else {
    actionsEl.style.display = 'none';
    waitingEl.style.display = 'block';
    const actingPlayer = room.players.find(p => p.id === ps.actingPlayer);
    waitingEl.textContent = actingPlayer ? `Czeka na: ${escHtml(actingPlayer.name)}` : '';
  }
}

function pokerAction(type) {
  if (type === 'raise') {
    const amount = parseInt(document.getElementById('poker-raise-amount').value);
    if (!amount) return showToast('Wpisz kwotę!', 'error');
    socket.emit('pokerRaise', { roomId: S.roomId, amount });
    document.getElementById('poker-raise-row').style.display = 'none';
  } else if (type === 'fold') {
    socket.emit('pokerFold', { roomId: S.roomId });
  } else if (type === 'check') {
    socket.emit('pokerCheck', { roomId: S.roomId });
  } else if (type === 'call') {
    socket.emit('pokerCall', { roomId: S.roomId });
  }
}

function pokerShowRaise() {
  const row = document.getElementById('poker-raise-row');
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  if (pokerState) document.getElementById('poker-raise-amount').value = (pokerState.callAmount || 0) * 2;
}

socket.on('pokerState', (ps) => {
  S.room = ps.room;
  showScreen('poker');
  renderPoker(ps);
});

socket.on('pokerRoundEnd', ({ winners, pot, showHands, community, chips, handNames, room }) => {
  S.room = room;
  const myId = S.playerId;
  const iWon = winners.includes(myId);
  showToast(iWon ? `🏆 Wygrałeś pulę ${pot}!` : '💔 Nie tym razem...', iWon ? 'success' : '');
  // Show all hands
  const holeEl = document.getElementById('poker-hole-cards');
  if (showHands && showHands[myId]) {
    holeEl.innerHTML = renderCards(showHands[myId]);
  }
});

// ── BLACKJACK ─────────────────────────────────────────────────
let bjGs = null;

function renderBJ(gs, room) {
  bjGs = gs;
  const myId = S.playerId;

  // Chips
  document.getElementById('bj-chips').innerHTML = room.players.map(p =>
    `<div class="live-score-chip">${escHtml(p.name)} <span>${gs.chips?.[p.id]||0} 🪙</span></div>`
  ).join('');

  // Dealer
  const dealerCards = gs.dealerHand || [];
  document.getElementById('bj-dealer-hand').innerHTML = renderCards(dealerCards);
  const dv = dealerCards.filter(c=>c!=='??').length ? handVal(dealerCards.filter(c=>c!=='??')) : '?';
  document.getElementById('bj-dealer-value').textContent = dv !== '?' ? `(${dv})` : '';

  // Players
  const playersArea = document.getElementById('bj-players-area');
  playersArea.innerHTML = room.players.map(p => {
    const hand = gs.hands?.[p.id] || [];
    const result = gs.results?.[p.id];
    const val = hand.length ? handVal(hand) : 0;
    const isBust = val > 21;
    const isActing = gs.actingPlayer === p.id;
    const isBJ = result === 'blackjack' || result === 'blackjack_pending';
    let cls = 'bj-player-panel';
    if (isActing) cls += ' acting';
    if (isBust && hand.length) cls += ' bust';
    if (isBJ) cls += ' blackjack';
    if (result === 'win') cls += ' win';
    let resultLabel = '';
    if (result && result !== 'blackjack_pending') {
      const labels = { win:'✅ WYGRANA', lose:'❌ PRZEGRANA', push:'🤝 REMIS', blackjack:'🃏 BLACKJACK!' };
      resultLabel = `<span class="bj-result-label ${result}">${labels[result]||result}</span>`;
    }
    return `<div class="${cls}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-weight:700">${escHtml(p.name)}${p.id===myId?' (Ty)':''}</span>
        ${hand.length ? `<span class="bj-hand-value">(${val})</span>` : ''}
        ${isBust && hand.length ? '<span style="color:var(--error);font-size:12px;font-weight:700">BUST</span>' : ''}
        ${resultLabel}
        ${gs.bets?.[p.id] ? `<span style="font-size:12px;color:var(--muted)">Zakład: ${gs.bets[p.id]}</span>` : ''}
      </div>
      <div class="card-row" style="justify-content:flex-start">${renderCards(hand)}</div>
    </div>`;
  }).join('');

  // Phase
  const phaseLabels = { betting:'🎲 Czas na zakłady!', playing:'🃏 Gra w toku', dealer:'🎩 Krupier gra...', results:'📊 Wyniki rundy' };
  document.getElementById('bj-phase-label').textContent = phaseLabels[gs.phase] || gs.phase;

  // Bet area
  const betArea = document.getElementById('bj-bet-area');
  const actArea = document.getElementById('bj-actions');
  const isMyTurn = gs.actingPlayer === myId;
  const myBet = gs.bets?.[myId];

  if (gs.phase === 'betting' && !S.isObserver) {
    betArea.style.display = 'block';
    actArea.style.display = 'none';
    const myChips = gs.chips?.[myId] || 0;
    document.getElementById('bj-bet-input').value = gs.minBet || 10;
    document.getElementById('bj-bet-input').max = Math.min(gs.maxBet||100, myChips);
    const betChips = document.getElementById('bj-bet-chips');
    betChips.innerHTML = [gs.minBet, Math.floor((gs.minBet+gs.maxBet)/2), gs.maxBet]
      .filter((v,i,a) => a.indexOf(v)===i)
      .map(v => `<button class="btn btn-secondary btn-sm" onclick="document.getElementById('bj-bet-input').value=${v}">${v}</button>`).join('');
    document.getElementById('bj-bet-status').textContent = myBet > 0 ? `✅ Zakład: ${myBet}` : `Twoje żetony: ${myChips}`;
  } else if (gs.phase === 'playing' && isMyTurn && !S.isObserver) {
    betArea.style.display = 'none';
    actArea.style.display = 'block';
    const myHand = gs.hands?.[myId] || [];
    document.getElementById('bj-double-btn').disabled = myHand.length !== 2;
    document.getElementById('bj-turn-info').textContent = 'Twoja kolej!';
  } else {
    betArea.style.display = 'none';
    actArea.style.display = 'none';
  }
}

function bjPlaceBet() {
  const amount = parseInt(document.getElementById('bj-bet-input').value);
  if (!amount || amount < (bjGs?.minBet||1)) return showToast('Nieprawidłowy zakład!', 'error');
  socket.emit('bjBet', { roomId: S.roomId, amount });
  document.getElementById('bj-bet-status').textContent = `✅ Zakład postawiony: ${amount}`;
}

function bjAction(type) {
  const events = { hit:'bjHit', stand:'bjStand', double:'bjDouble' };
  if (events[type]) socket.emit(events[type], { roomId: S.roomId });
}

socket.on('bjState', ({ gs, room }) => {
  S.room = room;
  showScreen('blackjack');
  renderBJ(gs, room);
});

socket.on('bjResults', ({ gs, room }) => {
  S.room = room;
  renderBJ(gs, room);
  const myId = S.playerId;
  const result = gs.results?.[myId];
  if (result === 'win') showToast('✅ Wygrałeś!', 'success');
  else if (result === 'blackjack') showToast('🃏 BLACKJACK! Wygrałeś!', 'success');
  else if (result === 'push') showToast('🤝 Remis!', '');
  else if (result === 'lose') showToast('❌ Przegrana', 'error');
});

// ── CARD HELPERS ──────────────────────────────────────────────
function renderCards(cards, animate=false) {
  if (!cards || !cards.length) return '<span style="color:var(--muted);font-size:13px">—</span>';
  return cards.map((card, i) => {
    if (card === '??') return '<div class="playing-card back">🂠</div>';
    const suit = card.slice(-1);
    const red = suit === '♥' || suit === '♦';
    const animStyle = animate ? `animation-delay:${i*80}ms` : '';
    return `<div class="playing-card ${red?'red':'black'}${animate?' card-deal-anim':''}" style="${animStyle}">${escHtml(card)}</div>`;
  }).join('');
}

function handVal(cards) {
  let v = 0, aces = 0;
  for (const c of cards) {
    if (c === '??') continue;
    const r = c.slice(0,-1);
    if (['J','Q','K'].includes(r)) v+=10;
    else if (r==='A') { v+=11; aces++; }
    else v += parseInt(r)||0;
  }
  while (v > 21 && aces > 0) { v -= 10; aces--; }
  return v;
}

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
    if (['tictactoe','chess','poker','blackjack','highlow','pincracker'].includes(gt)) {
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



// ══════════════════════════════════════════════════════════════
// HIGH LOW
// ══════════════════════════════════════════════════════════════
let hlGs = null;
let hlMySecretChosen = false;

function hlRenderScores(gs, room) {
  if (!room || !room.players) return;
  const scores = room.players.map(p => {
    const w = gs.wins[p.id] || 0;
    const isMe = p.id === S.playerId;
    return `<div class="score-item${isMe?' me':''}">
      <span class="score-name">${p.name}</span>
      <span class="score-val">${w}</span>
    </div>`;
  });
  document.getElementById('hl-scores').innerHTML = scores.join('');
}

function hlRenderGuessChip(g) {
  let color, icon;
  if (g.hint === 'correct') { color = '#2ecc71'; icon = '✅'; }
  else if (g.hint === 'higher') { color = '#e67e22'; icon = '⬆️'; }
  else { color = '#3498db'; icon = '⬇️'; }
  return `<span style="background:${color}22;border:1.5px solid ${color};border-radius:8px;padding:3px 10px;font-size:13px;font-weight:700;color:${color}">
    ${g.guess} ${icon}
  </span>`;
}

function hlRender(gs, room) {
  if (!gs || !room) return;
  hlGs = gs;
  showScreen('highlow');

  hlRenderScores(gs, room);
  document.getElementById('hl-round-info').textContent = `Runda ${gs.roundCurrent} / ${gs.roundsTotal}`;
  document.getElementById('hl-result').textContent = '';

  const me = room.players.find(p => p.id === S.playerId);
  const opp = room.players.find(p => p.id !== S.playerId);
  const myId = me?.id;
  const oppId = opp?.id;

  // Nazwy w polach historii
  const oppNameEl = document.getElementById('hl-opp-name');
  const oppNameEl2 = document.getElementById('hl-opp-name2');
  if (oppNameEl) oppNameEl.textContent = opp?.name || '?';
  if (oppNameEl2) oppNameEl2.textContent = opp?.name || '?';

  // Moja tajna liczba (widoczna tylko mnie)
  const mySecretDisplay = document.getElementById('hl-my-secret-display');
  if (mySecretDisplay) {
    mySecretDisplay.textContent = hlMySecretChosen ? `🔒` : '?';
  }

  if (gs.phase === 'choosing') {
    document.getElementById('hl-choose-panel').style.display = '';
    document.getElementById('hl-guess-panel').style.display = 'none';

    const alreadyChosen = gs.chosen && gs.chosen[myId];
    const secretInput = document.getElementById('hl-secret-input');
    const waitMsg = document.getElementById('hl-waiting-msg');
    const btn = document.querySelector('#hl-choose-panel .btn');

    if (alreadyChosen) {
      if (secretInput) secretInput.disabled = true;
      if (btn) btn.disabled = true;
      if (waitMsg) waitMsg.textContent = '✅ Wybrałeś/aś! Czekam na przeciwnika…';
      document.getElementById('hl-turn').textContent = '';
      document.getElementById('hl-turn').className = 'turn-indicator wait';
    } else {
      if (secretInput) secretInput.disabled = false;
      if (btn) btn.disabled = false;
      if (waitMsg) waitMsg.textContent = '';
      document.getElementById('hl-turn').textContent = '🔐 Wybierz swoją tajną liczbę!';
      document.getElementById('hl-turn').className = 'turn-indicator my-turn';
    }

    const oppChosen = gs.chosen && gs.chosen[oppId];
    if (alreadyChosen && !oppChosen) {
      if (waitMsg) waitMsg.textContent = `✅ Wybrałeś/aś! Czekam aż ${opp?.name} wybierze…`;
    } else if (!alreadyChosen && oppChosen) {
      if (waitMsg) waitMsg.textContent = `${opp?.name} już wybrał/a! Twoja kolej.`;
    }

  } else if (gs.phase === 'guessing' || gs.phase === 'roundEnd') {
    document.getElementById('hl-choose-panel').style.display = 'none';
    document.getElementById('hl-guess-panel').style.display = '';

    const isMyTurn = gs.currentTurn === myId;
    const turnEl = document.getElementById('hl-turn');
    const inputArea = document.getElementById('hl-guess-input-area');

    if (gs.phase === 'roundEnd') {
      turnEl.textContent = '';
      turnEl.className = 'turn-indicator wait';
      if (inputArea) inputArea.style.display = 'none';
    } else if (isMyTurn) {
      turnEl.textContent = '🎯 Twoja tura — zgaduj!';
      turnEl.className = 'turn-indicator my-turn';
      if (inputArea) inputArea.style.display = '';
      const gi = document.getElementById('hl-guess-input');
      if (gi) { gi.disabled = false; gi.value = ''; gi.focus(); }
    } else {
      turnEl.textContent = `⏳ Tura gracza ${opp?.name}…`;
      turnEl.className = 'turn-indicator wait';
      if (inputArea) inputArea.style.display = 'none';
    }

    // Historia moich prób
    const myHistory = (gs.guessHistory && gs.guessHistory[myId]) || [];
    document.getElementById('hl-my-guesses').innerHTML = myHistory.map(hlRenderGuessChip).join('') || '<span style="color:var(--muted);font-size:13px">brak prób</span>';

    // Historia prób przeciwnika
    const oppHistory = (gs.guessHistory && gs.guessHistory[oppId]) || [];
    document.getElementById('hl-opp-guesses').innerHTML = oppHistory.map(hlRenderGuessChip).join('') || '<span style="color:var(--muted);font-size:13px">brak prób</span>';
  }
}

function hlChoose() {
  const input = document.getElementById('hl-secret-input');
  const val = parseInt(input?.value);
  if (!val || val < 1 || val > 100) {
    showToast('Wpisz liczbę od 1 do 100!', 'error');
    return;
  }
  hlMySecretChosen = true;
  // Store locally so we can show it to ourselves
  const mySecretDisplay = document.getElementById('hl-my-secret-display');
  if (mySecretDisplay) mySecretDisplay.textContent = `🔒 ${val}`;
  socket.emit('highlowChoose', { roomId: S.roomId, number: val });
}

function hlGuess() {
  const input = document.getElementById('hl-guess-input');
  const val = parseInt(input?.value);
  if (!val || val < 1 || val > 100) {
    showToast('Wpisz liczbę od 1 do 100!', 'error');
    return;
  }
  input.disabled = true;
  socket.emit('highlowGuess', { roomId: S.roomId, guess: val });
}

socket.on('highlowState', ({ gs, room }) => {
  S.room = room;
  if (!hlMySecretChosen && gs.phase === 'choosing') {
    // reset per round
    hlMySecretChosen = !!(gs.chosen && S.playerId && gs.chosen[S.playerId]);
  }
  hlRender(gs, room);
});

socket.on('highlowHint', ({ gs, hint, guess, guesserId, room }) => {
  S.room = room;
  const guesserName = room.players.find(p => p.id === guesserId)?.name || '?';
  const hintText = hint === 'higher' ? '⬆️ Wyżej!' : '⬇️ Niżej!';
  showToast(`${guesserName} zgaduje ${guess} → ${hintText}`, hint === 'higher' ? 'info' : 'info');
  hlRender(gs, room);
});

socket.on('highlowRoundEnd', ({ gs, result, room }) => {
  S.room = room;
  const winnerName = room.players.find(p => p.id === result.winner)?.name || '?';
  const resEl = document.getElementById('hl-result');
  if (resEl) {
    resEl.textContent = `🏆 ${winnerName} zgadł/a! Liczba to ${result.secret}`;
    resEl.style.color = 'var(--accent)';
  }
  hlMySecretChosen = false;
  hlRender(gs, room);
  showToast(`🏆 ${winnerName} odgadł/a liczbę ${result.secret}!`, 'success');
});

// ══════════════════════════════════════════════════════════════
// PIN CRACKER
// ══════════════════════════════════════════════════════════════
let pcGs = null;
let pcMyPin = [];       // cyfry ustawianego PINu (faza choose)
let pcGuessPin = [];    // cyfry zgadywanego PINu (faza guess)
let pcMyChosenPin = []; // zapamiętany PIN gracza (tylko lokalnie)

// ── Klawiatura ustawiania PINu ─────────────────────────────────
function pcNumpad(d) {
  if (pcMyPin.length >= 4) return;
  pcMyPin.push(d);
  pcRenderChooseDots();
}
function pcDel() {
  pcMyPin.pop();
  pcRenderChooseDots();
}
function pcRenderChooseDots() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('pc-d' + i);
    if (!el) continue;
    if (i < pcMyPin.length) {
      el.textContent = '●';
      el.className = 'pc-digit-box active';
    } else {
      el.textContent = '_';
      el.className = 'pc-digit-box';
    }
  }
  const btn = document.getElementById('pc-confirm-btn');
  if (btn) btn.disabled = pcMyPin.length < 4;
}
function pcConfirm() {
  if (pcMyPin.length !== 4) return;
  pcMyChosenPin = [...pcMyPin];
  socket.emit('pincrackerChoose', { roomId: S.roomId, pin: pcMyPin.join('') });
  // Zablokuj UI
  document.getElementById('pc-confirm-btn').disabled = true;
  document.querySelectorAll('.pc-numpad-btn').forEach(b => b.disabled = true);
  document.getElementById('pc-choose-wait').textContent = '✅ PIN ustawiony! Czekam na przeciwnika…';
  // Pokaż PIN gwiazdkami
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('pc-d' + i);
    if (el) { el.textContent = '🔒'; el.className = 'pc-digit-box correct'; }
  }
}

// ── Klawiatura zgadywania PINu ─────────────────────────────────
function pcGuessNum(d) {
  if (pcGuessPin.length >= 4) return;
  pcGuessPin.push(d);
  pcRenderGuessDots();
}
function pcGuessDel() {
  pcGuessPin.pop();
  pcRenderGuessDots();
}
function pcRenderGuessDots() {
  // Uwzględnij już odkryte pozycje (locked)
  const opp = S.room?.players?.find(p => p.id !== S.playerId);
  const oppId = opp?.id;
  const revealed = pcGs?.revealed?.[oppId] || [null, null, null, null];
  let guessIdx = 0;

  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('pc-g' + i);
    if (!el) continue;
    if (revealed[i] === 'correct') {
      // Pozycja już odgadnięta — pokaż z historii ostatniej próby
      const hist = pcGs?.guessHistory?.[S.playerId] || [];
      const lastCorrect = hist.slice().reverse().find(h => h.result[i] === 'correct');
      el.textContent = lastCorrect ? lastCorrect.guess[i] : '?';
      el.className = 'pc-digit-box correct';
    } else {
      el.textContent = guessIdx < pcGuessPin.length ? pcGuessPin[guessIdx] : '_';
      el.className = 'pc-digit-box' + (guessIdx < pcGuessPin.length ? ' active' : '');
      guessIdx++;
    }
  }
  const btn = document.getElementById('pc-guess-ok');
  // Count non-revealed slots
  const revealed2 = pcGs?.revealed?.[oppId] || [null, null, null, null];
  const needed = revealed2.filter(r => !r).length;
  if (btn) btn.disabled = pcGuessPin.length < needed;
}

function pcGuessSubmit() {
  // Reconstruct full 4-digit guess merging revealed + new digits
  const opp = S.room?.players?.find(p => p.id !== S.playerId);
  const oppId = opp?.id;
  const revealed = pcGs?.revealed?.[oppId] || [null, null, null, null];
  const hist = pcGs?.guessHistory?.[S.playerId] || [];

  let full = [];
  let guessIdx = 0;
  for (let i = 0; i < 4; i++) {
    if (revealed[i] === 'correct') {
      const lastCorrect = hist.slice().reverse().find(h => h.result[i] === 'correct');
      full.push(lastCorrect ? lastCorrect.guess[i] : 0);
    } else {
      full.push(pcGuessPin[guessIdx++] ?? 0);
    }
  }

  const btn = document.getElementById('pc-guess-ok');
  if (btn) btn.disabled = true;
  pcGuessPin = [];
  socket.emit('pincrackerGuess', { roomId: S.roomId, pin: full.join('') });
}

// ── Render ─────────────────────────────────────────────────────
function pcRenderScores(gs, room) {
  if (!room?.players) return;
  const html = room.players.map(p => {
    const isMe = p.id === S.playerId;
    return `<div class="score-item${isMe?' me':''}">
      <span class="score-name">${p.name}</span>
      <span class="score-val">${gs.wins[p.id]||0}</span>
    </div>`;
  }).join('');
  document.getElementById('pc-scores').innerHTML = html;
}

function pcRenderAttemptRow(attempt) {
  return '<div class="pc-attempt-row">' +
    attempt.guess.map((d, i) => {
      const cls = attempt.result[i] === 'correct' ? 'correct' : 'wrong';
      return `<div class="pc-attempt-digit ${cls}">${d}</div>`;
    }).join('') +
  '</div>';
}

function pcRenderMyPinRevealed(gs, myId) {
  // Pokaż własny PIN z odkrytymi przez przeciwnika pozycjami
  const revealed = gs.revealed?.[myId] || [null, null, null, null];
  const oppHist = gs.guessHistory?.[
    S.room?.players?.find(p => p.id !== myId)?.id
  ] || [];

  const el = document.getElementById('pc-my-pin-revealed');
  if (!el) return;
  el.innerHTML = Array.from({length: 4}, (_, i) => {
    if (revealed[i] === 'correct') {
      // Znajdź jaka cyfra — z naszego zapamiętanego PINu
      const digit = pcMyChosenPin[i] ?? '?';
      return `<div class="pc-digit-box correct" style="width:36px;height:42px;font-size:20px">${digit}</div>`;
    } else {
      return `<div class="pc-digit-box" style="width:36px;height:42px;font-size:20px">?</div>`;
    }
  }).join('');
}

function pcRender(gs, room) {
  if (!gs || !room) return;
  pcGs = gs;
  showScreen('pincracker');

  pcRenderScores(gs, room);
  const maxA = gs.maxAttempts || 10;
  document.getElementById('pc-round-info').textContent =
    `Runda ${gs.roundCurrent} / ${gs.roundsTotal}  •  maks. ${maxA} prób`;
  document.getElementById('pc-result').textContent = '';

  const me = room.players.find(p => p.id === S.playerId);
  const opp = room.players.find(p => p.id !== S.playerId);
  const myId = me?.id;
  const oppId = opp?.id;

  // Nazwy
  document.querySelectorAll('.pc-opp-name').forEach(el => el.textContent = opp?.name || '?');

  if (gs.phase === 'choosing') {
    document.getElementById('pc-choose-panel').style.display = '';
    document.getElementById('pc-guess-panel').style.display = 'none';

    const alreadyChosen = gs.chosen?.[myId];
    const oppChosen = gs.chosen?.[oppId];
    const turnEl = document.getElementById('pc-turn');
    const waitEl = document.getElementById('pc-choose-wait');

    if (alreadyChosen) {
      turnEl.textContent = oppChosen ? '✅ Oboje gotowi! Zaczynamy…' : `Czekam na ${opp?.name}…`;
      turnEl.className = 'turn-indicator wait';
    } else {
      turnEl.textContent = oppChosen ? `${opp?.name} gotowy/a! Teraz Ty — ustaw PIN.` : '🔐 Ustaw swój tajny 4-cyfrowy PIN';
      turnEl.className = 'turn-indicator my-turn';
    }
    if (waitEl && !alreadyChosen) waitEl.textContent = '';

  } else if (gs.phase === 'guessing' || gs.phase === 'roundEnd') {
    document.getElementById('pc-choose-panel').style.display = 'none';
    document.getElementById('pc-guess-panel').style.display = '';

    const isMyTurn = gs.currentTurn === myId;
    const turnEl = document.getElementById('pc-turn');
    const inputArea = document.getElementById('pc-guess-input-area');

    if (gs.phase === 'roundEnd') {
      turnEl.textContent = '';
      turnEl.className = 'turn-indicator wait';
      if (inputArea) inputArea.style.display = 'none';
    } else if (isMyTurn) {
      const myAttemptsLeft = maxA - (gs.guessHistory?.[myId]?.length || 0);
      turnEl.textContent = `🎯 Twoja tura! Pozostało prób: ${myAttemptsLeft}`;
      turnEl.className = 'turn-indicator my-turn';
      if (inputArea) inputArea.style.display = '';
      // Reset guess input
      pcGuessPin = [];
      pcRenderGuessDots();
    } else {
      const oppAttemptsLeft = maxA - (gs.guessHistory?.[oppId]?.length || 0);
      turnEl.textContent = `⏳ Tura ${opp?.name}… (ma ${oppAttemptsLeft} prób)`;
      turnEl.className = 'turn-indicator wait';
      if (inputArea) inputArea.style.display = 'none';
    }

    // Historia moich ataków
    const myHist = gs.guessHistory?.[myId] || [];
    document.getElementById('pc-my-attempts').innerHTML =
      myHist.length ? myHist.map(pcRenderAttemptRow).join('') :
      '<span style="color:var(--muted);font-size:12px">brak prób</span>';

    // Mój PIN z odkrytymi cyfry
    pcRenderMyPinRevealed(gs, myId);

    // Historia ataków przeciwnika na mój PIN
    const oppHist = gs.guessHistory?.[oppId] || [];
    document.getElementById('pc-opp-attempts').innerHTML =
      oppHist.length ? oppHist.map(pcRenderAttemptRow).join('') :
      '<span style="color:var(--muted);font-size:12px">brak prób</span>';
  }
}

// ── Socket events ──────────────────────────────────────────────
socket.on('pincrackerState', ({ gs, room }) => {
  S.room = room;
  // Detect new round reset
  if (gs.phase === 'choosing' && !gs.chosen?.[S.playerId]) {
    pcMyPin = [];
    pcMyChosenPin = [];
    // Re-enable numpad
    document.querySelectorAll('#pc-choose-panel .pc-numpad-btn').forEach(b => b.disabled = false);
    const btn = document.getElementById('pc-confirm-btn');
    if (btn) btn.disabled = true;
    const waitEl = document.getElementById('pc-choose-wait');
    if (waitEl) waitEl.textContent = '';
    pcRenderChooseDots();
  }
  pcRender(gs, room);
});

socket.on('pincrackerRoundEnd', ({ gs, room, winner, revealedPins, attemptsUsed }) => {
  S.room = room;
  pcGs = gs;
  const resEl = document.getElementById('pc-result');
  if (winner) {
    const winnerName = room.players.find(p => p.id === winner)?.name || '?';
    const opp = room.players.find(p => p.id !== winner);
    const oppPin = revealedPins?.[opp?.id]?.join('') || '????';
    const isMe = winner === S.playerId;
    if (resEl) {
      resEl.textContent = isMe
        ? `🏆 Odgadłeś/aś PIN ${opp?.name}: ${oppPin}! (${attemptsUsed} prób)`
        : `💥 ${winnerName} złamał/a Twój PIN: ${revealedPins?.[S.playerId]?.join('')||'????'}!`;
      resEl.style.color = isMe ? '#2ecc71' : '#e74c3c';
    }
    showToast(isMe ? `🏆 Brawo! Odgadłeś/aś PIN!` : `💥 Twój PIN został złamany!`, isMe ? 'success' : 'error');
  } else {
    if (resEl) { resEl.textContent = '🤝 Remis! Nikt nie odgadł PINu w limicie prób.'; resEl.style.color = 'var(--muted)'; }
    showToast('🤝 Remis rundy!', 'info');
    // Reveal pins
    if (revealedPins) {
      const lines = room.players.map(p => `${p.name}: ${revealedPins[p.id]?.join('')||'????'}`);
      setTimeout(() => showToast('PIN: ' + lines.join(' | '), 'info'), 600);
    }
  }
  pcMyChosenPin = [];
  pcRender(gs, room);
});

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
