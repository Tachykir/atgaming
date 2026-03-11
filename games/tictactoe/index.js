/**
 * MODUŁ GRY: KÓŁKO I KRZYŻYK
 * 2 graczy, klasyczna gra 3x3
 */

function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a,b,c] };
    }
  }
  if (board.every(c => c)) return { winner: 'draw', line: [] };
  return null;
}

module.exports = {
  meta: {
    id: 'tictactoe',
    name: 'Kółko i Krzyżyk',
    icon: '⭕',
    description: 'Klasyczna gra 3x3 dla 2 graczy',
    color: '#fc5c7d',
    minPlayers: 2,
    maxPlayers: 2,
    supportsGameMaster: false,
    configSchema: {
      rounds: { type: 'number', label: 'Liczba rund', min: 1, max: 10, default: 3 },
    },
  },

  defaultContent: {},

  createState(config) {
    return {
      board: Array(9).fill(null),
      currentTurn: null, // socket id
      symbols: {},       // socketId -> 'X'|'O'
      roundsTotal: Number(config.rounds) || 3,
      roundCurrent: 1,
      wins: {},          // socketId -> count
    };
  },

  onStart({ room, io }) {
    const gs = room.gameState;
    const [p1, p2] = room.players;
    gs.symbols[p1.id] = 'X';
    gs.symbols[p2.id] = 'O';
    gs.currentTurn = p1.id;
    gs.wins[p1.id] = 0;
    gs.wins[p2.id] = 0;
    gs.board = Array(9).fill(null);
    io.to(room.id).emit('tttState', { gs, room });
  },

  onEvent({ event, data, socket, room, io }) {
    if (event !== 'tttMove') return;
    const gs = room.gameState;
    const { index } = data;

    if (socket.id !== gs.currentTurn) return;
    if (gs.board[index]) return;

    const sym = gs.symbols[socket.id];
    gs.board[index] = sym;

    const result = checkWinner(gs.board);
    if (result) {
      if (result.winner !== 'draw') {
        gs.wins[socket.id] = (gs.wins[socket.id] || 0) + 1;
      }
      io.to(room.id).emit('tttRoundEnd', { gs, result, room });

      if (gs.roundCurrent >= gs.roundsTotal) {
        room.status = 'finished';
        const sorted = room.players
          .map(p => ({ ...p, score: gs.wins[p.id] || 0 }))
          .sort((a,b) => b.score - a.score);
        room.players = sorted;
        setTimeout(() => io.to(room.id).emit('gameOver', { room, sorted }), 2000);
      } else {
        gs.roundCurrent++;
        setTimeout(() => {
          gs.board = Array(9).fill(null);
          // Swap who starts next round
          const ids = room.players.map(p => p.id);
          gs.currentTurn = ids[(gs.roundCurrent - 1) % 2];
          io.to(room.id).emit('tttState', { gs, room });
        }, 2500);
      }
    } else {
      // Switch turn
      const ids = room.players.map(p => p.id);
      gs.currentTurn = ids.find(id => id !== socket.id);
      io.to(room.id).emit('tttState', { gs, room });
    }
  },
};
