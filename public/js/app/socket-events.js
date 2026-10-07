// ── SOCKET EVENTS ──────────────────────────────────────────────
socket.on('connect', () => { S.playerId = socket.id; });
socket.on('error', ({message}) => showToast(message, 'error'));

socket.on('roomCreated', ({roomId, room}) => {
  S.roomId=roomId; S.isHost=true; S.room=room; renderLobby(room); showChat(); showScreen('lobby');
});
socket.on('roomJoined', ({roomId, room}) => {
  S.roomId=roomId; S.isHost=false; S.room=room; renderLobby(room); showChat(); showScreen('lobby');
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
});
socket.on('letterGuessed', ({room,letter,correct,mask,currentTurn,playerLives,playerEliminated}) => {
  S.room=room;
  if(room.gameState) room.gameState.currentTurn = currentTurn;
  renderHangman(room, mask, currentTurn===S.playerId, playerLives||{}, playerEliminated||{});
  if (letter) showToast(correct?`✅ Litera "${letter.toUpperCase()}" jest!`:`❌ Brak litery "${letter.toUpperCase()}"`,correct?'success':'error');
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
socket.on('gameOver', (data) => { S.room=data.room; showGameOver(data); });
socket.on('gameReset', ({room}) => {
  S.room=room; S.isHost=room.hostId===S.playerId; renderLobby(room);
  document.getElementById('play-again-btn').style.display='none'; showScreen('lobby');
});
socket.on('chatMessage', (msg) => { appendChatMsg(msg); });
