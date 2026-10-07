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
