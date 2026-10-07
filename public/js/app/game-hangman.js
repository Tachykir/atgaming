// ── HANGMAN ────────────────────────────────────────────────────
const LETTERS = ['A','Ą','B','C','Ć','D','E','Ę','F','G','H','I','J','K','L','Ł','M','N','Ń','O','Ó','P','R','S','Ś','T','U','W','Y','Z','Ź','Ż'];
const SCAFFOLD = ['h-head','h-body','h-arm-l','h-arm-r','h-leg-l','h-leg-r'];

let H = { maxWrong: 6, totalRounds: 1, currentRound: 1 };

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
