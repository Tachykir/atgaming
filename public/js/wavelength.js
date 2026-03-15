// wavelength.js — gra Wavelength

function wlSubmitClue() {
  const clue = document.getElementById('wl-clue-input')?.value?.trim();
  if (!clue) return showToast('Wpisz wskazówkę!', 'error');
  socket.emit('wavelengthClue', { roomId: S.roomId, clue });
  document.getElementById('wl-psychic-actions').style.display = 'none';
}

function wlLock() {
  socket.emit('wavelengthLock', { roomId: S.roomId });
}

socket.on('wavelengthState', (state) => {
  wlState = state;
  wlMyId = S.myId || socket.id;
  const isPsychic = state.psychic === wlMyId;
  const psychicPlayer = state.players?.find(p => p.id === state.psychic);

  // Round info
  const ri = document.getElementById('wl-round-info');
  if (ri) ri.textContent = `Runda ${state.round} / ${state.maxRounds} · Psychic: ${psychicPlayer?.name || '?'}`;

  // Spektrum
  const specEl = document.getElementById('wl-spectrum');
  if (specEl && state.spectrum) {
    specEl.style.display = '';
    document.getElementById('wl-left-label').textContent = '← ' + state.spectrum[0];
    document.getElementById('wl-right-label').textContent = state.spectrum[1] + ' →';
  }

  // Target zone (tylko reveal)
  const tz = document.getElementById('wl-target-zone');
  const tm = document.getElementById('wl-target-marker');
  if (state.targetZone !== null && state.phase === 'reveal') {
    if (tz) { tz.style.display = ''; tz.style.left = Math.max(0, state.targetZone - 10) + '%'; tz.style.width = '20%'; }
    if (tm) { tm.style.display = ''; tm.style.left = state.targetZone + '%'; }
  } else {
    if (tz) tz.style.display = 'none';
    if (tm) tm.style.display = 'none';
  }

  // Slider
  const slider = document.getElementById('wl-slider');
  if (slider) {
    slider.disabled = isPsychic || state.phase !== 'guessing';
    if (state.phase === 'betting' || state.phase === 'clue') { slider.value = 50; document.getElementById('wl-indicator').style.left = '50%'; document.getElementById('wl-slider-val').textContent = '50'; }
  }

  // Team guess indicator
  if (state.teamGuess !== null) {
    const ind = document.getElementById('wl-indicator');
    if (ind) ind.style.left = state.teamGuess + '%';
  }

  // Clue display
  const cd = document.getElementById('wl-clue-display');
  const ch = document.getElementById('wl-clue-hint');
  if (state.phase === 'clue' && isPsychic) {
    if (cd) cd.textContent = '';
    if (ch) ch.textContent = 'Podaj wskazówkę — jedno słowo pasujące do punktu na skali';
    document.getElementById('wl-psychic-actions').style.display = '';
    document.getElementById('wl-lock-actions').style.display = 'none';
  } else if (state.clue) {
    if (cd) cd.textContent = '📡 ' + state.clue;
    if (ch) ch.textContent = state.phase === 'guessing' ? (isPsychic ? 'Czekaj aż drużyna ustawi wskaźnik' : 'Ustaw wskaźnik na skali') : '';
    document.getElementById('wl-psychic-actions').style.display = 'none';
    document.getElementById('wl-lock-actions').style.display = (isPsychic && state.phase === 'guessing') ? '' : 'none';
  } else {
    if (cd) cd.textContent = '';
    if (ch) ch.textContent = state.phase === 'clue' ? `Czekaj na wskazówkę od ${psychicPlayer?.name || '?'}…` : '';
    document.getElementById('wl-psychic-actions').style.display = 'none';
    document.getElementById('wl-lock-actions').style.display = 'none';
  }

  // Wyniki rundy
  if (state.phase !== 'reveal') document.getElementById('wl-round-result').textContent = '';

  // Scores
  const sc = document.getElementById('wl-scores');
  if (sc && state.scores) {
    sc.innerHTML = state.players?.map(p => `<div class="live-score-item"><span>${escHtml(p.name)}</span><span class="pts">${state.scores[p.id] || 0} pkt</span></div>`).join('') || '';
  }

  // Guesses list
  const pl = document.getElementById('wl-players-list');
  if (pl) {
    pl.innerHTML = state.players?.map(p => {
      const g = state.guesses?.[p.id];
      const mark = p.id === state.psychic ? '📡' : (g !== undefined ? `✅ ${g.value}` : '⏳');
      return `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:3px 8px;font-size:12px">${escHtml(p.name)} ${mark}</span>`;
    }).join('') || '';
  }
});

socket.on('wavelengthReveal', ({ targetZone, teamGuess, pts, dist }) => {
  const el = document.getElementById('wl-round-result');
  const emoji = pts >= 4 ? '🎯' : pts >= 3 ? '✅' : pts >= 2 ? '👍' : pts >= 1 ? '🤏' : '❌';
  if (el) el.innerHTML = `<span class="result-pop" style="color:${pts>=3?'#ffd200':'var(--muted)'}">${emoji} Cel: ${targetZone} · Drużyna: ${teamGuess} · Odległość: ${dist} → <b>+${pts} pkt</b></span>`;
});

// ── SOCKET EVENTS KASYNA ──────────────────────────────────────
