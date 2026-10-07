// ── SHARED ────────────────────────────────────────────────────
function renderLiveScores(room, id) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = [...room.players].sort((a,b) => b.score-a.score).map(p =>
    `<div class="live-score-chip">${p.name} <span>${p.score}</span></div>`).join('');
}

function showGameOver(data) {
  clearInterval(timerInterval); clearInterval(wrTimerInterval);
  const sorted = data.sorted || [...data.room.players].sort((a,b) => b.score-a.score);
  const ranks = ['🥇','🥈','🥉'];
  const banner = document.getElementById('result-banner');
  if (data.room.gameType === 'hangman') {
    banner.className = data.won ? 'result-banner win' : 'result-banner lose';
    document.getElementById('result-emoji').textContent = data.won ? '🎉' : '💀';
    document.getElementById('result-title').textContent = data.won ? 'Słowo odgadnięte!' : 'Wisielec umarł!';
    document.getElementById('result-subtitle').textContent = `Słowo: ${(data.word||'').toUpperCase()}`;
  } else {
    const meta = games.find(g => g.id === data.room.gameType) || {};
    banner.className = 'result-banner win';
    document.getElementById('result-emoji').textContent = '🏆';
    document.getElementById('result-title').textContent = `Koniec — ${meta.name||data.room.gameType}!`;
    document.getElementById('result-subtitle').textContent = sorted[0] ? `Wygrywa ${sorted[0].name}!` : '';
  }
  document.getElementById('final-scores').innerHTML = sorted.map((p,i) =>
    `<div class="score-item ${i===0?'first':i===1?'second':i===2?'third':''}">
      <div class="score-rank">${ranks[i]||(i+1)}</div>
      <div class="score-name">${p.name}${p.id===S.playerId?' <span style="color:var(--accent);font-size:12px">(ty)</span>':''}</div>
      <div class="score-points">${p.score}</div>
    </div>`).join('');
  if (S.isHost || S.isGM) document.getElementById('play-again-btn').style.display = 'inline-flex';
  showScreen('gameover');
}

// ── LEADERBOARD ────────────────────────────────────────────────
async function showLeaderboard() {
  await loadLeaderboard();
  showScreen('leaderboard');
}

async function loadLeaderboard() {
  const r = await fetch('/api/leaderboard');
  const lb = await r.json();
  const tabsEl = document.getElementById('lb-tabs');

  // Build tabs from loaded games + any keys in lb
  const allIds = [...new Set([...games.map(g=>g.id), ...Object.keys(lb)])];
  if (!activeLbTab || !allIds.includes(activeLbTab)) activeLbTab = allIds[0];

  tabsEl.innerHTML = allIds.map(id => {
    const meta = games.find(g => g.id === id) || {};
    const count = lb[id]?.length || 0;
    return `<button class="lb-tab ${id===activeLbTab?'active':''}" onclick="lbTab('${id}')">${meta.icon||'🎮'} ${meta.name||id} <span style="opacity:.6;font-size:11px">(${count})</span></button>`;
  }).join('');

  renderLbContent(lb[activeLbTab] || []);
}

function lbTab(id) {
  activeLbTab = id;
  loadLeaderboard();
}

function renderLbContent(entries) {
  const el = document.getElementById('lb-content');
  if (!entries.length) { el.innerHTML = '<div class="lb-empty">Brak wyników. Zagraj pierwszą grę! 🎮</div>'; return; }
  const diffLabel = {easy:'Łatwy',medium:'Średni',hard:'Trudny'};
  el.innerHTML = `<table class="lb-table">
    <thead><tr><th>#</th><th>Gracz</th><th>Wynik</th><th>Kategoria</th><th>Data</th></tr></thead>
    <tbody>${entries.slice(0, 50).map((e, i) => {
      const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
      const rank = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
      const date = new Date(e.date).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      return `<tr>
        <td><span class="lb-rank ${rankClass}">${rank}</span></td>
        <td style="font-weight:700">${escHtml(e.name)}</td>
        <td><span class="lb-score">${e.score}</span></td>
        <td><span class="lb-meta">${e.category||'—'} · ${diffLabel[e.difficulty]||e.difficulty||'—'}</span></td>
        <td class="lb-date">${date}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}
