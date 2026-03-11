/**
 * MODUŁ GRY: SZACHY
 * 2 graczy, pełna gra szachowa z walidacją ruchów
 * Używa uproszczonego silnika - wszystkie legalne ruchy
 */

const INITIAL_BOARD = [
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R'],
];

function deepCopy(b) { return b.map(r => [...r]); }

function isWhite(p) { return p && p === p.toUpperCase(); }
function isBlack(p) { return p && p === p.toLowerCase(); }
function sameColor(a, b) { return (isWhite(a) && isWhite(b)) || (isBlack(a) && isBlack(b)); }

function getPseudoMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const moves = [];
  const white = isWhite(piece);
  const type = piece.toLowerCase();
  const dir = white ? -1 : 1;

  const addIfValid = (tr, tc) => {
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;
    if (sameColor(piece, board[tr][tc])) return false;
    moves.push([tr, tc]);
    return !board[tr][tc]; // returns true if empty (continue sliding)
  };

  if (type === 'p') {
    // Forward
    if (!board[r + dir]?.[c]) {
      moves.push([r + dir, c]);
      // Double from start
      const startRow = white ? 6 : 1;
      if (r === startRow && !board[r + 2 * dir]?.[c]) moves.push([r + 2 * dir, c]);
    }
    // Captures
    for (const dc of [-1, 1]) {
      const tr = r + dir, tc = c + dc;
      if (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7 && board[tr][tc] && !sameColor(piece, board[tr][tc])) {
        moves.push([tr, tc]);
      }
    }
  } else if (type === 'r') {
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      let tr = r + dr, tc = c + dc;
      while (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        if (!addIfValid(tr, tc)) break;
        tr += dr; tc += dc;
      }
    }
  } else if (type === 'n') {
    for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
      addIfValid(r + dr, c + dc);
    }
  } else if (type === 'b') {
    for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
      let tr = r + dr, tc = c + dc;
      while (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        if (!addIfValid(tr, tc)) break;
        tr += dr; tc += dc;
      }
    }
  } else if (type === 'q') {
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      let tr = r + dr, tc = c + dc;
      while (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        if (!addIfValid(tr, tc)) break;
        tr += dr; tc += dc;
      }
    }
  } else if (type === 'k') {
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      addIfValid(r + dr, c + dc);
    }
  }
  return moves;
}

function findKing(board, white) {
  const king = white ? 'K' : 'k';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === king) return [r, c];
  return null;
}

function isInCheck(board, white) {
  const [kr, kc] = findKing(board, white) || [];
  if (kr === undefined) return false;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (white && isWhite(p)) continue;
      if (!white && isBlack(p)) continue;
      const moves = getPseudoMoves(board, r, c);
      if (moves.some(([mr, mc]) => mr === kr && mc === kc)) return true;
    }
  }
  return false;
}

function getLegalMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const white = isWhite(piece);
  const pseudo = getPseudoMoves(board, r, c);
  return pseudo.filter(([tr, tc]) => {
    const nb = deepCopy(board);
    nb[tr][tc] = piece;
    nb[r][c] = null;
    return !isInCheck(nb, white);
  });
}

function applyMove(board, fr, fc, tr, tc) {
  const nb = deepCopy(board);
  const piece = nb[fr][fc];
  nb[tr][tc] = piece;
  nb[fr][fc] = null;
  // Pawn promotion
  if (piece === 'P' && tr === 0) nb[tr][tc] = 'Q';
  if (piece === 'p' && tr === 7) nb[tr][tc] = 'q';
  return nb;
}

function hasAnyLegalMove(board, white) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (white !== isWhite(p)) continue;
      if (getLegalMoves(board, r, c).length > 0) return true;
    }
  }
  return false;
}

module.exports = {
  meta: {
    id: 'chess',
    name: 'Szachy',
    icon: '♟️',
    description: 'Klasyczna gra strategiczna dla 2 graczy',
    color: '#fcc05c',
    minPlayers: 2,
    maxPlayers: 2,
    supportsGameMaster: false,
    configSchema: {},
  },

  getLegalMoves,

  defaultContent: {},

  createState() {
    return {
      board: deepCopy(INITIAL_BOARD),
      whiteTurn: true,
      whiteId: null,
      blackId: null,
      selected: null,
      legalMoves: [],
      check: false,
      status: 'playing',
      result: null,
      moveHistory: [],
      capturedWhite: [],
      capturedBlack: [],
    };
  },

  onStart({ room, io }) {
    const gs = room.gameState;
    const [p1, p2] = room.players;
    gs.whiteId = p1.id;
    gs.blackId = p2.id;
    gs.whiteTurn = true;
    gs.board = deepCopy(INITIAL_BOARD);
    io.to(room.id).emit('chessState', { gs, room });
  },

  onEvent({ event, data, socket, room, io }) {
    if (event !== 'chessMove') return;
    const gs = room.gameState;
    const { from, to } = data; // {r,c}
    const isWhiteTurn = gs.whiteTurn;
    const playerId = socket.id;

    // Check it's this player's turn
    if (isWhiteTurn && playerId !== gs.whiteId) return;
    if (!isWhiteTurn && playerId !== gs.blackId) return;

    const piece = gs.board[from.r][from.c];
    if (!piece) return;
    if (isWhiteTurn !== isWhite(piece)) return;

    const legal = getLegalMoves(gs.board, from.r, from.c);
    const isLegal = legal.some(([r, c]) => r === to.r && c === to.c);
    if (!isLegal) {
      socket.emit('chessIllegal', { from, to });
      return;
    }

    // Capture tracking
    const captured = gs.board[to.r][to.c];
    if (captured) {
      if (isWhite(captured)) gs.capturedWhite.push(captured);
      else gs.capturedBlack.push(captured);
    }

    gs.board = applyMove(gs.board, from.r, from.c, to.r, to.c);
    gs.whiteTurn = !isWhiteTurn;
    gs.moveHistory.push({ from, to, piece });

    // Check / checkmate / stalemate
    const nextWhite = gs.whiteTurn;
    const inCheck = isInCheck(gs.board, nextWhite);
    const hasMove = hasAnyLegalMove(gs.board, nextWhite);

    if (!hasMove) {
      if (inCheck) {
        gs.result = isWhiteTurn ? 'white' : 'black'; // who gave checkmate
        gs.status = 'checkmate';
        room.status = 'finished';
        const winnerId = gs.result === 'white' ? gs.whiteId : gs.blackId;
        const sorted = room.players
          .map(p => ({ ...p, score: p.id === winnerId ? 1 : 0 }))
          .sort((a, b) => b.score - a.score);
        room.players = sorted;
        io.to(room.id).emit('chessState', { gs, room });
        setTimeout(() => io.to(room.id).emit('gameOver', { room, sorted }), 1500);
      } else {
        gs.status = 'stalemate';
        room.status = 'finished';
        const sorted = room.players.map(p => ({ ...p, score: 0 }));
        io.to(room.id).emit('chessState', { gs, room });
        setTimeout(() => io.to(room.id).emit('gameOver', { room, sorted }), 1500);
      }
    } else {
      gs.check = inCheck;
      io.to(room.id).emit('chessState', { gs, room });
    }
  },
};
