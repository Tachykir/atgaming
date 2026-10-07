// ── KÓŁKO I KRZYŻYK ──────────────────────────────────────────
let tttGs = null;

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
