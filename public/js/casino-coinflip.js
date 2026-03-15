// casino-coinflip.js

function initCoinflipUI(table) {
  document.getElementById('casino-coinflip-balance').textContent = casinoWallet ? casinoWallet.balance.toLocaleString('pl-PL') + ' AT$' : '—';
  const chips = [table.config.minBet, table.config.minBet*5, table.config.minBet*20, 1000, 5000, 10000, 50000];
  renderChipBtns('coinflip-chip-btns', [...new Set(chips)], 'coinflip-bet-input');
  document.getElementById('coinflip-bet-input').value = table.config.minBet;
  coinflipSide = 'heads';
  document.getElementById('cf-heads-btn').className = 'btn btn-primary';
  document.getElementById('cf-tails-btn').className = 'btn';
  document.getElementById('coinflip-result-msg').textContent = '';
}

function setCoinflipSide(side) {
  coinflipSide = side;
  document.getElementById('cf-heads-btn').className = side === 'heads' ? 'btn btn-primary' : 'btn';
  document.getElementById('cf-tails-btn').className = side === 'tails' ? 'btn btn-primary' : 'btn';
  document.getElementById('cf-heads-btn').style.borderColor = side === 'heads' ? '' : 'var(--border)';
  document.getElementById('cf-tails-btn').style.borderColor = side === 'tails' ? 'var(--accent)' : 'var(--border)';
}

function casinoCoinflipCreate() {
  const bet = parseInt(document.getElementById('coinflip-bet-input').value) || 0;
  if (!bet) return showToast('Ustaw kwotę!', 'error');
  socket.emit('casinoCoinflipCreate', { tableId: casinoTableId, bet, side: coinflipSide, discordId: casinoDiscordId, socketToken: casinoSocketToken });
}

socket.on('casinoCoinflipState', ({ challenges }) => {
  const el = document.getElementById('coinflip-challenges');
  if (!el) return;
  if (!challenges?.length) {
    el.innerHTML = '<p style="color:var(--muted);text-align:center;font-size:13px">Brak aktywnych wyzwań</p>';
    return;
  }
  el.innerHTML = challenges.map(c => {
    const isOwn = c.creator.id === casinoDiscordId;
    const sideLabel = c.side === 'heads' ? '👑 Orzeł' : '🦅 Reszka';
    const oppSide = c.side === 'heads' ? '🦅 Reszka' : '👑 Orzeł';
    if (c.status === 'flipping') {
      return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px">
        <span style="font-size:28px" class="coin-spinning">🪙</span>
        <span>${escHtml(c.creator.name)} vs ${escHtml(c.opponent?.name||'?')} — <b>${c.bet.toLocaleString('pl-PL')} AT$</b> — rzut w toku…</span>
      </div>`;
    }
    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div>
        <span style="font-weight:700">${escHtml(c.creator.name)}</span>
        <span style="color:var(--muted);font-size:12px"> stawia ${c.bet.toLocaleString('pl-PL')} AT$ na <b>${sideLabel}</b></span>
      </div>
      <div style="display:flex;gap:6px">
        ${isOwn
          ? `<button class="btn btn-danger btn-sm" onclick="casinoCoinflipCancel('${c.id}')">Anuluj</button>`
          : `<button class="btn btn-primary btn-sm" onclick="casinoCoinflipAccept('${c.id}')">Przyjmij (${oppSide})</button>`
        }
      </div>
    </div>`;
  }).join('');
});

socket.on('casinoCoinflipResult', ({ challengeId, result, winner, loser, bet, totalPot, creatorSide, creatorBalance, opponentBalance }) => {
  const resultEmoji = result === 'heads' ? '👑 Orzeł' : '🦅 Reszka';
  const coin = document.getElementById('coinflip-coin');
  if (coin) {
    coin.classList.add('coin-spinning');
    setTimeout(() => { coin.classList.remove('coin-spinning'); coin.textContent = result === 'heads' ? '👑' : '🦅'; setTimeout(() => { coin.textContent = '🪙'; }, 3000); }, 1200);
  }
  const isWinner = winner.id === casinoDiscordId;
  const resultEl = document.getElementById('coinflip-result-msg');
  if (resultEl) {
    if (isWinner) {
      const newBalance = winner.id === casinoDiscordId ? creatorBalance : opponentBalance;
      resultEl.innerHTML = `<span style="color:#00c853" class="result-pop">🎉 Wygrałeś! ${resultEmoji} — +${bet.toLocaleString('pl-PL')} AT$</span>`;
      spawnCoinFloat(totalPot);
      document.getElementById('casino-coinflip-balance').textContent = newBalance.toLocaleString('pl-PL') + ' AT$';
      if (casinoWallet) casinoWallet.balance = newBalance;
    } else if (loser.id === casinoDiscordId) {
      resultEl.innerHTML = `<span style="color:var(--error)" class="result-pop">💀 Przegrałeś. ${resultEmoji} — wygrał ${escHtml(winner.name)}</span>`;
      const newBalance = loser.id === casinoDiscordId ? (winner.id === casinoDiscordId ? opponentBalance : creatorBalance) : creatorBalance;
      document.getElementById('casino-coinflip-balance').textContent = newBalance.toLocaleString('pl-PL') + ' AT$';
      if (casinoWallet) casinoWallet.balance = newBalance;
    }
  }
});

function casinoCoinflipAccept(challengeId) {
  socket.emit('casinoCoinflipAccept', { tableId: casinoTableId, challengeId, discordId: casinoDiscordId, socketToken: casinoSocketToken });
}
function casinoCoinflipCancel(challengeId) {
  socket.emit('casinoCoinflipCancel', { tableId: casinoTableId, challengeId, discordId: casinoDiscordId, socketToken: casinoSocketToken });
}
socket.on('casinoCoinflipCancelled', ({ challengeId, refund }) => {
  showToast(`↩️ Wyzwanie anulowane, zwrócono ${refund.toLocaleString('pl-PL')} AT$`, 'success');
});

// ══ PATH OF GAMBLING — AUTOMAT 5×5 ════════════════════════════
const PG_COLS = 5, PG_ROWS = 5;
const PG_LINE_COLORS = ['#E24B4A','#185FA5','#3B6D11','#BA7517','#533AB7','#0F6E56','#993C1D','#D4537E','#639922','#5F5E5A','#a855f7','#06b6d4','#f59e0b','#10b981','#ef4444'];
let pgSpinning = false, pgAuto = false, pgAutoT = null, pgWinCb = null, pgWinTimer = null;
let pgBet = 10, pgLines = 50, pgFreeSpins = 0, pgPitMeter = 0, pgFreeMode = null;
let pgStatSpins = 0, pgStatPaid = 0, pgBestWin = 0, pgStatSpent = 0;
let pgStickyValdos = [];
let pgSyms = [], pgLinesDef = [], pgStickyLocks = [];
let pgTable = null;

