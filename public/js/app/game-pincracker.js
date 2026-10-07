// ══ PIN CRACKER ════════════════════════════════════════════
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
