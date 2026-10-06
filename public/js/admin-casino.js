// ══════════════════════════════════════════════════════════════
//  PANEL ADMINA — KASYNO: RTP (zwroty), statystyki gier, symulacje
// ══════════════════════════════════════════════════════════════
let rtpAdmin = { data: null, sim: {}, busy: false };

const RTP_KIND = {
  slot:     { label: 'Automat',  hint: 'Wszystkie wypłaty (linie, scattery, bonusy, jackpoty) × współczynnik.' },
  pachinko: { label: 'Pachinko', hint: 'Mnożniki pól × współczynnik.' },
  crash:    { label: 'Crash',    hint: 'P(wybuch ≥ x) = RTP / x.' },
  coinflip: { label: 'Coinflip', hint: 'Wypłata solo = 2 × RTP (PvP bez prowizji).' },
  fixed:    { label: 'Stałe zasady', hint: 'Zasady gry wyznaczają RTP — tylko podgląd.' },
};

const rtpPct = (v, d = 1) => (v * 100).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const rtpNum = v => Math.round(Number(v) || 0).toLocaleString('pl-PL');

async function rtpApi(path, body = {}) {
  const r = await fetch('/api/admin/casino' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, password: adminPwd || undefined }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Błąd ' + r.status);
  return d;
}

async function renderCasinoRtpAdmin() {
  const el = document.getElementById('admin-tab-content');
  el.innerHTML = `<div class="admin-section"><p style="color:var(--muted)">⏳ Ładowanie…</p></div>`;
  try { rtpAdmin.data = await rtpApi('/rtp'); }
  catch (e) { el.innerHTML = `<div class="admin-section"><p style="color:var(--error)">${escHtml(e.message)}</p></div>`; return; }
  rtpDraw();
}

function rtpObserved(g) {
  const o = g.observed || {};
  return o.wagered > 0 ? o.returned / o.wagered : null;
}

function rtpDraw() {
  const el = document.getElementById('admin-tab-content');
  const d = rtpAdmin.data;
  if (!el || !d) return;
  const tot = d.games.reduce((a, g) => ({ w: a.w + (g.observed?.wagered || 0), r: a.r + (g.observed?.returned || 0), n: a.n + (g.observed?.rounds || 0) }), { w: 0, r: 0, n: 0 });
  const house = tot.w - tot.r;
  el.innerHTML = `
  <div class="admin-section rtp-summary">
    <div class="rtp-kpis">
      <div><span>Postawiono</span><b>${rtpNum(tot.w)} AT$</b></div>
      <div><span>Wypłacono</span><b>${rtpNum(tot.r)} AT$</b></div>
      <div><span>Zysk kasyna</span><b style="color:${house >= 0 ? 'var(--success)' : 'var(--error)'}">${house >= 0 ? '+' : ''}${rtpNum(house)} AT$</b></div>
      <div><span>Faktyczny RTP</span><b>${tot.w ? rtpPct(tot.r / tot.w, 2) : '—'}</b></div>
      <div><span>Rund</span><b>${rtpNum(tot.n)}</b></div>
      <div><span>Portfele / AT$ w obiegu</span><b>${rtpNum(d.economy?.wallets)} / ${rtpNum(d.economy?.totalBalance)}</b></div>
    </div>
    <div class="rtp-toolbar">
      <span style="color:var(--muted);font-size:12px">Baza: <b>${escHtml(d.db)}</b> · zakres RTP ${rtpPct(d.min, 0)}–${rtpPct(d.max, 0)}</span>
      <span style="flex:1"></span>
      <label style="font-size:12px;color:var(--muted)">Wszystkie automaty:</label>
      <input type="number" id="rtp-bulk" step="0.1" min="${d.min * 100}" max="${d.max * 100}" value="95" class="rtp-input">
      <button class="btn btn-primary btn-sm" onclick="rtpBulkSet()">Ustaw</button>
      <button class="btn btn-secondary btn-sm" onclick="rtpResetAll()">↺ Domyślne</button>
      <button class="btn btn-secondary btn-sm" onclick="rtpResetStats()">🗑️ Zeruj statystyki</button>
      <button class="btn btn-secondary btn-sm" onclick="renderCasinoRtpAdmin()">🔄</button>
    </div>
  </div>
  <div class="rtp-grid">${d.games.map(rtpCard).join('')}</div>
  <div class="admin-section">
    <h3>🕓 Historia zmian RTP</h3>
    ${d.history?.length ? `<table class="rtp-hist"><thead><tr><th>Kiedy</th><th>Gra</th><th>Zmiana</th><th>Kto</th></tr></thead><tbody>
      ${d.history.map(h => `<tr><td>${new Date(h.at).toLocaleString('pl-PL')}</td><td>${escHtml(d.games.find(g => g.id === h.gameId)?.name || h.gameId)}</td><td>${rtpPct(h.from, 2)} → <b>${rtpPct(h.to, 2)}</b></td><td>${escHtml(h.by || 'admin')}</td></tr>`).join('')}
    </tbody></table>` : '<p style="color:var(--muted);font-size:13px">Brak zmian — wszystkie gry działają na domyślnym RTP.</p>'}
  </div>`;
}

function rtpCard(g) {
  const kind = RTP_KIND[g.kind] || RTP_KIND.fixed;
  const obs = rtpObserved(g);
  const o = g.observed || {};
  const sim = rtpAdmin.sim[g.id];
  const t = g.target * 100;
  const d = rtpAdmin.data;
  const lowData = o.rounds < 2000;
  const diff = obs !== null ? obs - g.target : 0;
  return `<div class="rtp-card${g.overridden ? ' changed' : ''}${g.target > 1 ? ' danger' : ''}" id="rtp-card-${g.id}">
    <div class="rtp-head">
      <div><b>${escHtml(g.name)}</b><span class="rtp-kind">${kind.label}</span></div>
      <div class="rtp-target">${rtpPct(g.target, 2)}</div>
    </div>
    <div class="rtp-hint">${kind.hint}${g.adjustable ? ` Domyślnie <b>${rtpPct(g.base, 1)}</b>${g.overridden ? ` · współczynnik wypłat ×${g.scale.toFixed(3)}` : ''}.` : ` RTP ≈ ${rtpPct(g.base, 1)}.`}</div>
    ${g.adjustable ? `
    <div class="rtp-edit">
      <input type="range" min="${d.min * 100}" max="${d.max * 100}" step="0.1" value="${t}" oninput="rtpSync('${g.id}', this.value)" id="rtp-range-${g.id}">
      <input type="number" class="rtp-input" min="${d.min * 100}" max="${d.max * 100}" step="0.1" value="${t.toFixed(1)}" oninput="rtpSync('${g.id}', this.value, true)" id="rtp-val-${g.id}">
      <span style="font-size:12px;color:var(--muted)">%</span>
    </div>
    <div class="rtp-warn" id="rtp-warn-${g.id}" style="display:${g.target > 1 ? 'block' : 'none'}">⚠️ RTP powyżej 100% — gracze będą średnio zarabiać, a AT$ w obiegu będą rosły.</div>
    <div class="rtp-actions">
      <button class="btn btn-primary btn-sm" onclick="rtpSave('${g.id}')">💾 Zapisz</button>
      ${g.overridden ? `<button class="btn btn-secondary btn-sm" onclick="rtpSave('${g.id}', ${g.base})">↺ Domyślne</button>` : ''}
      ${g.kind === 'slot' ? `<button class="btn btn-secondary btn-sm" onclick="rtpSimulate('${g.id}')" ${rtpAdmin.busy ? 'disabled' : ''}>🧪 Symuluj</button>` : ''}
    </div>` : ''}
    <div class="rtp-obs">
      <div><span>Faktyczny RTP</span><b style="color:${obs === null ? 'var(--muted)' : Math.abs(diff) < 0.03 || lowData ? 'var(--text)' : diff > 0 ? 'var(--error)' : 'var(--success)'}">${obs === null ? '—' : rtpPct(obs, 2)}</b></div>
      <div><span>Rund</span><b>${rtpNum(o.rounds)}</b></div>
      <div><span>Postawiono</span><b>${rtpNum(o.wagered)}</b></div>
      <div><span>Zysk kasyna</span><b>${rtpNum((o.wagered || 0) - (o.returned || 0))}</b></div>
    </div>
    ${obs !== null && lowData ? `<div class="rtp-hint" style="margin-top:4px">Mało danych — przy małej liczbie rund wynik może mocno odbiegać od ustawionego RTP (zwłaszcza w automatach).</div>` : ''}
    ${sim ? `<div class="rtp-sim">${sim.loading ? '⏳ Symulacja w toku…' : sim.error ? `❌ ${escHtml(sim.error)}` : `🧪 ${rtpNum(sim.spins)} spinów: <b>RTP ${rtpPct(sim.rtp, 2)}</b> · trafienia ${rtpPct(sim.hitRate, 1)} · max ×${rtpNum(sim.maxMult)} · ${(sim.ms / 1000).toFixed(1)} s`}</div>` : ''}
  </div>`;
}

function rtpSync(id, v, fromInput) {
  const n = Number(v);
  if (!fromInput) { const i = document.getElementById('rtp-val-' + id); if (i) i.value = n.toFixed(1); }
  else { const r = document.getElementById('rtp-range-' + id); if (r) r.value = n; }
  const w = document.getElementById('rtp-warn-' + id);
  if (w) w.style.display = n > 100 ? 'block' : 'none';
  document.getElementById('rtp-card-' + id)?.classList.toggle('danger', n > 100);
}

async function rtpSave(id, value) {
  const v = value !== undefined ? value * 100 : Number(document.getElementById('rtp-val-' + id)?.value);
  if (!Number.isFinite(v)) return showToast('Podaj liczbę', 'error');
  if (v > 100 && !confirm(`RTP ${v.toFixed(1)}% oznacza, że gracze średnio wygrywają więcej niż stawiają. Na pewno?`)) return;
  try {
    await rtpApi('/rtp/set', { gameId: id, target: v });
    delete rtpAdmin.sim[id];
    showToast(`✅ RTP zapisane: ${v.toFixed(1)}%`, 'success');
    await renderCasinoRtpAdmin();
  } catch (e) { showToast(e.message, 'error'); }
}

async function rtpBulkSet() {
  const v = Number(document.getElementById('rtp-bulk').value);
  if (!Number.isFinite(v)) return;
  if (!confirm(`Ustawić RTP ${v.toFixed(1)}% dla wszystkich automatów?`)) return;
  try {
    for (const g of rtpAdmin.data.games.filter(g => g.kind === 'slot')) await rtpApi('/rtp/set', { gameId: g.id, target: v });
    rtpAdmin.sim = {};
    showToast('✅ Zapisano', 'success');
    await renderCasinoRtpAdmin();
  } catch (e) { showToast(e.message, 'error'); }
}

async function rtpResetAll() {
  if (!confirm('Przywrócić domyślne RTP we wszystkich grach?')) return;
  try { await rtpApi('/rtp/reset'); rtpAdmin.sim = {}; showToast('↺ Przywrócono domyślne RTP', 'success'); await renderCasinoRtpAdmin(); }
  catch (e) { showToast(e.message, 'error'); }
}

async function rtpResetStats() {
  if (!confirm('Wyzerować statystyki (postawiono / wypłacono) wszystkich gier?')) return;
  try { await rtpApi('/rtp/stats-reset'); showToast('Statystyki wyzerowane', 'success'); await renderCasinoRtpAdmin(); }
  catch (e) { showToast(e.message, 'error'); }
}

async function rtpSimulate(id) {
  if (rtpAdmin.busy) return;
  rtpAdmin.busy = true;
  rtpAdmin.sim[id] = { loading: true };
  rtpDraw();
  try { rtpAdmin.sim[id] = await rtpApi('/rtp/simulate', { gameId: id, spins: 300000 }); }
  catch (e) { rtpAdmin.sim[id] = { error: e.message }; }
  rtpAdmin.busy = false;
  rtpDraw();
}

async function adminLogout() {
  await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
  adminPwd = '';
  goHome();
}
