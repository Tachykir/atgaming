// ── SZACHY ────────────────────────────────────────────────────
let chessGs = null;
let chessSelected = null;
let chessLegal = [];

const CHESS_UNICODE = {
  'K':'♔','Q':'♕','R':'♖','B':'♗','N':'♘','P':'♙',
  'k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟'
};

function renderChessBoard(gs, room) {
  chessGs = gs;
  const board = gs.board;
  const myId = S.playerId;
  const isWhite = gs.whiteId === myId;
  const flipped = !isWhite && !S.isObserver;

  const statusEl = document.getElementById('chess-status');
  if (gs.status === 'checkmate') {
    const winner = room.players.find(p => p.id === (gs.result==='white'?gs.whiteId:gs.blackId));
    statusEl.className = 'turn-indicator your-turn';
    statusEl.textContent = `♟ Mat! Wygrywa ${winner ? escHtml(winner.name) : gs.result}`;
  } else if (gs.status === 'stalemate') {
    statusEl.className = 'turn-indicator wait';
    statusEl.textContent = '🤝 Pat — remis!';
  } else if (gs.whiteTurn) {
    const wp = room.players.find(p => p.id === gs.whiteId);
    const mine = gs.whiteId === myId;
    statusEl.className = mine ? 'turn-indicator your-turn' : 'turn-indicator wait';
    statusEl.textContent = mine ? '♔ Twój ruch (białe)' : `♔ Ruch: ${escHtml(wp?.name||'Białe')}` + (gs.check?' — SZACH!':'');
  } else {
    const bp = room.players.find(p => p.id === gs.blackId);
    const mine = gs.blackId === myId;
    statusEl.className = mine ? 'turn-indicator your-turn' : 'turn-indicator wait';
    statusEl.textContent = mine ? '♚ Twój ruch (czarne)' : `♚ Ruch: ${escHtml(bp?.name||'Czarne')}` + (gs.check?' — SZACH!':'');
  }

  // Captured pieces
  document.getElementById('chess-captured-black').textContent = (gs.capturedBlack||[]).map(p=>CHESS_UNICODE[p]||p).join('');
  document.getElementById('chess-captured-white').textContent = (gs.capturedWhite||[]).map(p=>CHESS_UNICODE[p]||p).join('');

  const el = document.getElementById('chess-board');
  const rows = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
  const cols = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];

  let html = '';
  for (const r of rows) {
    for (const c of cols) {
      const light = (r + c) % 2 === 0;
      const piece = board[r][c];
      const isSelected = chessSelected && chessSelected[0]===r && chessSelected[1]===c;
      const isLegal = chessLegal.some(([lr,lc]) => lr===r && lc===c);
      const hasEnemy = isLegal && piece;
      // Find king in check
      const isKingInCheck = gs.check && piece && piece.toLowerCase()==='k' &&
        ((gs.whiteTurn && piece==='k') || (!gs.whiteTurn && piece==='K'));
      let cls = `chess-sq ${light?'light':'dark'}`;
      if (isSelected) cls += ' selected';
      if (isLegal && !hasEnemy) cls += ' legal-move';
      if (hasEnemy) cls += ' legal-capture';
      if (isKingInCheck) cls += ' in-check';
      html += `<div class="${cls}" onclick="chessClick(${r},${c})">${piece ? CHESS_UNICODE[piece]||piece : ''}</div>`;
    }
  }
  el.innerHTML = html;
}

function chessClick(r, c) {
  if (S.isObserver) return;
  const gs = chessGs;
  if (!gs) return;
  const myId = S.playerId;
  const isMyTurn = (gs.whiteTurn && gs.whiteId === myId) || (!gs.whiteTurn && gs.blackId === myId);
  if (!isMyTurn) return;

  if (chessSelected) {
    const isLegal = chessLegal.some(([lr,lc]) => lr===r && lc===c);
    if (isLegal) {
      socket.emit('chessMove', { roomId: S.roomId, from: { r: chessSelected[0], c: chessSelected[1] }, to: { r, c } });
      chessSelected = null;
      chessLegal = [];
      return;
    }
  }

  const piece = gs.board[r][c];
  const isWhite = p => p && p === p.toUpperCase();
  const myPiece = piece && ((gs.whiteTurn && isWhite(piece)) || (!gs.whiteTurn && !isWhite(piece)));

  if (myPiece) {
    chessSelected = [r, c];
    // Request legal moves from server? We compute client-side display only
    // For simplicity highlight all non-same-color squares as potential (server validates)
    chessLegal = [];
    socket.emit('chessRequestMoves', { roomId: S.roomId, from: { r, c } });
  } else {
    chessSelected = null;
    chessLegal = [];
  }
  if (chessGs) renderChessBoard(chessGs, S.room);
}

socket.on('chessState', ({ gs, room }) => {
  S.room = room;
  chessSelected = null;
  chessLegal = [];
  showScreen('chess');
  renderChessBoard(gs, room);
});

socket.on('chessLegalMoves', ({ moves }) => {
  chessLegal = moves || [];
  if (chessGs) renderChessBoard(chessGs, S.room);
});
