// ══ LINK DO POKOJU ════════════════════════════════════════════
function copyRoomLink(e) {
  if (e) e.preventDefault();
  const link = document.getElementById('lobby-join-link');
  if (!link) return;
  const url = link.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showToast('🔗 Link skopiowany!', 'success'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = url; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('🔗 Link skopiowany!', 'success');
  }
}

function shareRoomLink() {
  const link = document.getElementById('lobby-join-link');
  if (!link) return;
  const url = link.href;
  const code = S.roomId || '';
  const game = (S.room && S.room.gameType) ? S.room.gameType : 'grę';
  if (navigator.share) {
    navigator.share({ title: 'AT Gaming — dołącz do pokoju', text: `Dołącz do pokoju ${code}!`, url })
      .catch(() => {});
  } else {
    copyRoomLink(null);
  }
}

// ── AUTO-JOIN z URL ?join=XXXXX ─────────────────────────────────
function checkUrlJoin() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('join');
  if (!code || code.length !== 5) return;
  // Uzupełnij kod w polu i otwórz ekran dołączania
  const joinInput = document.getElementById('join-code');
  if (joinInput) joinInput.value = code.toUpperCase();
  // Jeśli nick jest zapamiętany — dołącz od razu, inaczej pokaż ekran join
  try {
    const savedNick = localStorage.getItem('atgaming_nick');
    if (savedNick) {
      S.playerName = savedNick;
      const nameInput = document.getElementById('join-name');
      if (nameInput) nameInput.value = savedNick;
      socket.emit('joinRoom', { roomId: code.toUpperCase(), playerName: savedNick });
      return;
    }
  } catch(e) {}
  showScreen('join');
}
