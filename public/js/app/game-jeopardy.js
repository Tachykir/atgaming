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
