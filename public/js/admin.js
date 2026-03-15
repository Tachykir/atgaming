// admin.js — panel admin

}
function renderAdminTabs() {
  const ids = Object.keys(content);
  const allIds = [...ids, 'casino'];
  if (!activeAdminTab || !allIds.includes(activeAdminTab)) activeAdminTab = ids[0];
  document.getElementById('admin-tabs').innerHTML = ids.map(id => {
    const meta = games.find(g=>g.id===id)||{icon:'🎮',name:id};
    return `<button class="tab-btn ${id===activeAdminTab?'active':''}" onclick="adminTab('${id}')">${meta.icon} ${meta.name}</button>`;
  }).join('') + `<button class="tab-btn ${activeAdminTab==='casino'?'active':''}" onclick="adminTab('casino')">💰 Kasino AT$</button>`;
  renderAdminTabContent(activeAdminTab);
}
function adminTab(t) { activeAdminTab=t; renderAdminTabs(); }
function renderAdminTabContent(gameId) {
  const el = document.getElementById('admin-tab-content');
  const c = content[gameId]||{};
  if(gameId==='hangman') el.innerHTML=renderHangmanAdmin(c);
  else if(gameId==='quiz') el.innerHTML=renderQuizAdmin(c);
  else if(gameId==='wordrace') el.innerHTML=renderWordRaceAdmin(c);
  else if(gameId==='casino') { renderCasinoAdmin(); }
  else el.innerHTML='<p style="color:var(--muted)">Brak panelu admina dla tej gry.</p>';
}
function renderHangmanAdmin(c){
  return `<div class="admin-section"><h3>➕ Nowa kategoria</h3><div class="row">
    <div class="input-group"><label>Klucz</label><input class="input" id="h-new-cat-key" placeholder="np. movies"></div>
    <div class="input-group"><label>Nazwa</label><input class="input" id="h-new-cat-label" placeholder="np. 🎬 Filmy"></div>
    </div><button class="btn btn-secondary btn-sm" onclick="addHangmanCategory()">Dodaj</button></div>`
  +Object.entries(c).map(([ck,cat])=>`<div class="admin-section"><h3>${cat.label}</h3>
    ${['easy','medium','hard'].map(diff=>`<div style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${{easy:'😊 Łatwy',medium:'🔥 Średni',hard:'💀 Trudny'}[diff]}</div>
      <div class="word-chips">${(cat[diff]||[]).map(w=>`<div class="word-chip">${w}<button onclick="deleteHangmanWord('${ck}','${diff}','${w}')">×</button></div>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input class="input" id="new-word-${ck}-${diff}" placeholder="Nowe słowo..." style="max-width:200px;padding:8px 12px;font-size:13px">
        <button class="btn btn-secondary btn-sm" onclick="addHangmanWord('${ck}','${diff}')">Dodaj</button>
      </div></div>`).join('')}</div>`).join('');
}
function renderQuizAdmin(c){
  return `<div class="admin-section"><h3>➕ Nowa kategoria</h3><div class="row">
    <div class="input-group"><label>Klucz</label><input class="input" id="q-new-cat-key" placeholder="np. history"></div>
    <div class="input-group"><label>Nazwa</label><input class="input" id="q-new-cat-label" placeholder="np. 📜 Historia"></div>
    </div><button class="btn btn-secondary btn-sm" onclick="addQuizCategory()">Dodaj</button></div>`
  +Object.entries(c).map(([ck,cat])=>`<div class="admin-section"><h3>${cat.label}</h3>
    ${['easy','medium','hard'].map(diff=>`<div style="margin-bottom:18px">
      <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${{easy:'😊 Łatwy',medium:'🔥 Średni',hard:'💀 Trudny'}[diff]}</div>
      ${(cat[diff]||[]).map((q,qi)=>`<div class="question-item"><div class="q-text">${q.question}</div>
        <div class="q-answers">${q.answers.map((a,ai)=>`<span class="q-answer ${ai===q.correct?'correct':''}">${a}</span>`).join('')}</div>
        <div class="q-meta"><span class="q-points">💰 ${q.points} pkt</span><button class="delete-btn" onclick="deleteQuizQuestion('${ck}','${diff}',${qi})">×</button></div>
      </div>`).join('')}
      <div class="add-form"><h4>➕ Dodaj pytanie</h4>
        <div class="input-group"><label>Pytanie</label><input class="input" id="qtext-${ck}-${diff}" placeholder="Treść pytania..."></div>
        <div class="answers-grid">${[0,1,2,3].map(i=>`<input class="input" id="qans-${ck}-${diff}-${i}" placeholder="Odpowiedź ${i+1}">`).join('')}</div>
        <div class="row">
          <div class="input-group"><label>Poprawna</label><select class="input" id="qcorrect-${ck}-${diff}"><option value="0">1</option><option value="1">2</option><option value="2">3</option><option value="3">4</option></select></div>
          <div class="input-group"><label>Punkty</label><select class="input" id="qpoints-${ck}-${diff}"><option value="100">100</option><option value="200">200</option><option value="300">300</option></select></div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="addQuizQuestion('${ck}','${diff}')">Dodaj pytanie</button>
      </div></div>`).join('')}</div>`).join('');
}
function renderWordRaceAdmin(c){
  return `<div class="admin-section"><h3>➕ Nowa kategoria</h3><div class="row">
    <div class="input-group"><label>Klucz</label><input class="input" id="wr-new-cat-key" placeholder="np. history"></div>
    <div class="input-group"><label>Nazwa</label><input class="input" id="wr-new-cat-label" placeholder="np. 📜 Historia"></div>
    </div><button class="btn btn-secondary btn-sm" onclick="addWrCategory()">Dodaj</button></div>`
  +Object.entries(c).map(([ck,cat])=>`<div class="admin-section"><h3>${cat.label}</h3>
    ${['easy','medium','hard'].map(diff=>`<div style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${{easy:'😊 Łatwy',medium:'🔥 Średni',hard:'💀 Trudny'}[diff]}</div>
      ${(cat[diff]||[]).map((item,idx)=>`<div class="word-chip" style="margin-bottom:5px;width:fit-content">
        <span style="color:var(--muted)">${item.clue}</span><span style="margin:0 4px">→</span><strong>${item.answer}</strong>
        <button onclick="deleteWrWord('${ck}','${diff}',${idx})">×</button></div>`).join('')}
      <div class="add-form" style="margin-top:10px"><h4>➕ Dodaj</h4><div class="row">
        <div class="input-group"><label>Wskazówka</label><input class="input" id="wr-clue-${ck}-${diff}" placeholder="np. Stolica Niemiec"></div>
        <div class="input-group"><label>Odpowiedź</label><input class="input" id="wr-ans-${ck}-${diff}" placeholder="np. berlin"></div>
      </div><button class="btn btn-secondary btn-sm" onclick="addWrWord('${ck}','${diff}')">Dodaj</button></div>
      </div>`).join('')}</div>`).join('');
}

async function addHangmanCategory(){const key=document.getElementById('h-new-cat-key').value.trim().replace(/\s/g,'');const label=document.getElementById('h-new-cat-label').value.trim();if(!key||!label)return showToast('Wypełnij oba pola!','error');await fetch('/api/admin/hangman/category',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd,key,label})});await loadAdminContent();showToast('Dodano!','success');}
async function addHangmanWord(cat,diff){const word=document.getElementById(`new-word-${cat}-${diff}`).value.trim();if(!word)return showToast('Wpisz słowo!','error');await fetch('/api/admin/hangman/word',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd,category:cat,difficulty:diff,word})});await loadAdminContent();showToast(`"${word}" dodane!`,'success');}
async function deleteHangmanWord(cat,diff,word){await fetch('/api/admin/hangman/word',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd,category:cat,difficulty:diff,word})});await loadAdminContent();showToast('Usunięto','success');}
async function addQuizCategory(){const key=document.getElementById('q-new-cat-key').value.trim().replace(/\s/g,'');const label=document.getElementById('q-new-cat-label').value.trim();if(!key||!label)return showToast('Wypełnij oba pola!','error');await fetch('/api/admin/quiz/category',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd,key,label})});await loadAdminContent();showToast('Dodano!','success');}
async function addQuizQuestion(cat,diff){const question=document.getElementById(`qtext-${cat}-${diff}`).value.trim();const answers=[0,1,2,3].map(i=>document.getElementById(`qans-${cat}-${diff}-${i}`).value.trim());const correct=document.getElementById(`qcorrect-${cat}-${diff}`).value;const points=document.getElementById(`qpoints-${cat}-${diff}`).value;if(!question||answers.some(a=>!a))return showToast('Wypełnij wszystkie pola!','error');await fetch('/api/admin/quiz/question',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd,category:cat,difficulty:diff,question,answers,correct,points})});await loadAdminContent();showToast('Dodano!','success');}
async function deleteQuizQuestion(cat,diff,index){await fetch('/api/admin/quiz/question',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd,category:cat,difficulty:diff,index})});await loadAdminContent();showToast('Usunięto','success');}
async function addWrCategory(){const key=document.getElementById('wr-new-cat-key').value.trim().replace(/\s/g,'');const label=document.getElementById('wr-new-cat-label').value.trim();if(!key||!label)return showToast('Wypełnij oba pola!','error');await fetch('/api/admin/wordrace/category',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd,key,label})});await loadAdminContent();showToast('Dodano!','success');}
async function addWrWord(cat,diff){const clue=document.getElementById(`wr-clue-${cat}-${diff}`).value.trim();const answer=document.getElementById(`wr-ans-${cat}-${diff}`).value.trim();if(!clue||!answer)return showToast('Wypełnij wskazówkę i odpowiedź!','error');await fetch('/api/admin/wordrace/word',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd,category:cat,difficulty:diff,clue,answer})});await loadAdminContent();showToast('Dodano!','success');}
async function deleteWrWord(cat,diff,index){await fetch('/api/admin/wordrace/word',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd,category:cat,difficulty:diff,index})});await loadAdminContent();showToast('Usunięto','success');}

// ── CASINO ADMIN ──────────────────────────────────────────────
let casinoAdminWallets = [];

async function renderCasinoAdmin() {
  const el = document.getElementById('admin-tab-content');
  el.innerHTML = `
    <div class="admin-section">
      <h3>💰 Portfele graczy AT$</h3>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary btn-sm" onclick="casinoAdminLoadWallets()">🔄 Odśwież listę</button>
        <button class="btn btn-sm" onclick="casinoAdminTopup()" style="background:#0d2b1a;border:1px solid #27ae60;color:#2ecc71">📬 Tygodniowy doładunek</button>
      </div>
      <div id="casino-admin-wallets-list"><p style="color:var(--muted);font-size:13px">Kliknij "Odśwież listę" aby załadować portfele.</p></div>
    </div>
  `;
  casinoAdminLoadWallets();
}

async function casinoAdminLoadWallets() {
  const el = document.getElementById('casino-admin-wallets-list');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--muted);font-size:13px">⏳ Ładowanie...</p>';
  try {
    const r = await fetch('/api/admin/casino/wallets?password=' + encodeURIComponent(adminPwd));
    if (!r.ok) { el.innerHTML = '<p style="color:var(--error)">Błąd dostępu</p>'; return; }
    const wallets = await r.json();
    casinoAdminWallets = wallets;
    renderCasinoAdminWallets(wallets);
  } catch(e) { el.innerHTML = '<p style="color:var(--error)">Błąd połączenia</p>'; }
}

function renderCasinoAdminWallets(wallets) {
  const el = document.getElementById('casino-admin-wallets-list');
  if (!el) return;
  const entries = Object.entries(wallets);
  if (!entries.length) { el.innerHTML = '<p style="color:var(--muted)">Brak portfeli</p>'; return; }
  // Sort by balance desc
  entries.sort((a,b) => (b[1].balance||0) - (a[1].balance||0));
  el.innerHTML = `
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="color:var(--muted);text-align:left;border-bottom:1px solid var(--border)">
          <th style="padding:8px 6px">Gracz</th>
          <th style="padding:8px 6px;text-align:right">Saldo AT$</th>
          <th style="padding:8px 6px;text-align:right">Wygrane</th>
          <th style="padding:8px 6px;text-align:right">Przegrane</th>
          <th style="padding:8px 6px;text-align:right">Gry</th>
          <th style="padding:8px 6px;text-align:center">Zmień saldo</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(([id, w]) => `
          <tr style="border-bottom:1px solid var(--border);transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background=''">
            <td style="padding:8px 6px">
              ${w.avatar ? `<img src="${escHtml(w.avatar)}" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:6px">` : '👤 '}
              <span style="font-weight:600">${escHtml(w.globalName||w.username||id)}</span>
              <span style="color:var(--muted);font-size:11px;margin-left:4px">${escHtml(id.slice(0,8))}…</span>
            </td>
            <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--success)">${(w.balance||0).toLocaleString('pl-PL')}</td>
            <td style="padding:8px 6px;text-align:right;color:#2ecc71">+${(w.totalWon||0).toLocaleString('pl-PL')}</td>
            <td style="padding:8px 6px;text-align:right;color:var(--error)">-${(w.totalLost||0).toLocaleString('pl-PL')}</td>
            <td style="padding:8px 6px;text-align:right">${w.gamesPlayed||0}</td>
            <td style="padding:8px 6px;text-align:center">
              <div style="display:flex;gap:4px;justify-content:center;align-items:center">
                <input type="number" id="bal-${escHtml(id)}" value="${w.balance||0}" min="0" style="width:90px;padding:4px 6px;font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);text-align:right">
                <button class="btn btn-primary btn-sm" style="padding:4px 10px;font-size:12px" onclick="casinoAdminSetBalance('${escHtml(id)}')">✓</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
    <p style="color:var(--muted);font-size:11px;margin-top:8px">Łącznie graczy: ${entries.length} · Suma AT$: ${entries.reduce((s,[,w])=>s+(w.balance||0),0).toLocaleString('pl-PL')}</p>
  `;
}

async function casinoAdminSetBalance(discordId) {
  const input = document.getElementById('bal-' + discordId);
  if (!input) return;
  const amount = parseInt(input.value);
  if (isNaN(amount) || amount < 0) return showToast('Podaj prawidłową kwotę!', 'error');
  try {
    const r = await fetch('/api/admin/casino/set-balance', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ password: adminPwd, discordId, amount })
    });
    const d = await r.json();
    if (d.ok) {
      showToast(`✅ Saldo ustawione: ${amount.toLocaleString('pl-PL')} AT$`, 'success');
      casinoAdminLoadWallets();
    } else {
      showToast(d.error || 'Błąd', 'error');
    }
  } catch(e) { showToast('Błąd połączenia', 'error'); }
}

async function casinoAdminTopup() {
  if (!confirm('Uruchomić tygodniowy doładunek dla wszystkich graczy?')) return;
  const r = await fetch('/api/admin/casino/topup', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd})});
  const d = await r.json();
  if (d.ok) { showToast(`📬 Doładowano ${d.count} portfeli!`, 'success'); casinoAdminLoadWallets(); }
  else showToast('Błąd doładunku', 'error');
}

async function adminReset(){if(!confirm('Zresetować do domyślnych treści?'))return;await fetch('/api/admin/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd})});await loadAdminContent();showToast('Zresetowano!','success');}
async function adminResetLb(){if(!confirm('Wyczyścić cały leaderboard?'))return;await fetch('/api/admin/leaderboard',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPwd})});showToast('Leaderboard wyczyszczony!','success');}

// ── ACTIVE ROOMS ──────────────────────────────────────────────
async function loadActiveRooms() {
  try {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    const el = document.getElementById('active-rooms-list');
    if (!rooms.length) {
      el.innerHTML = '<div class="ar-empty">🎮 Brak aktywnych gier.<br><span style="font-size:13px">Stwórz pokój i zaproś znajomych!</span></div>';
      return;
    }
    el.innerHTML = rooms.map(r => {
      const statusLabel = { waiting: 'Czeka', playing: 'W grze', finished: 'Zakończona' }[r.status] || r.status;
      const canJoin = r.status === 'waiting' && r.playerCount < r.maxPlayers;
      const canObserve = r.status === 'playing' || r.status === 'waiting';
      return `<div class="active-room-card">
        <div class="ar-icon">${r.gameIcon}</div>
        <div class="ar-info">
          <div class="ar-game">${escHtml(r.gameName)}</div>
          <div class="ar-meta">
            Kod: <strong style="color:var(--accent3);font-family:'DM Mono',monospace">${r.id}</strong> ·
            ${r.playerCount}/${r.maxPlayers} graczy
            ${r.hostName ? '· Host: ' + escHtml(r.hostName) : ''}
          </div>
        </div>
        <span class="ar-status ${r.status}">${statusLabel}</span>
        <div class="ar-actions">
          ${canJoin ? `<button class="btn btn-primary btn-sm" onclick="quickJoin('${r.id}')">Dołącz</button>` : ''}
          ${canObserve ? `<button class="btn btn-secondary btn-sm" onclick="startObserve('${r.id}')">👁️ Obserwuj</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    document.getElementById('active-rooms-list').innerHTML = '<div class="ar-empty">Błąd ładowania pokojów.</div>';
  }
}

function quickJoin(roomId) {
  document.getElementById('join-code').value = roomId;
  showScreen('join');
}

function startObserve(roomId) {
  const name = prompt('Twój nick (obserwator):') || 'Obserwator';
  S.playerName = name;
  S.roomId = roomId;
  S.isObserver = true;
  socket.emit('observeRoom', { roomId, observerName: name });
}

// ── KÓŁKO I KRZYŻYK ──────────────────────────────────────────
let tttGs = null;
