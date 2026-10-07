// ══ HIGH LOW ══════════════════════════════════════════════
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
