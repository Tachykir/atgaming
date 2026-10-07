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
