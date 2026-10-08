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
    ${g.kind === 'slot' && Math.abs((g.effBase ?? g.base) - g.base) > 1e-9 ? `<div class="rtp-hint" style="color:var(--accent)">🎲 Zmienione szanse symboli — bazowe RTP po zmianie ${rtpPct(g.effBase, 2)} (wypłaty skorygowane do docelowego RTP).</div>` : ''}
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
      ${g.kind === 'slot' ? `<button class="btn btn-secondary btn-sm" onclick="symOpen('${g.id}')">🎲 Szanse symboli</button>` : ''}
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

async function rtpSimulate(id, spins = 300000) {
  if (rtpAdmin.busy) return;
  rtpAdmin.busy = true;
  rtpAdmin.sim[id] = { loading: true };
  rtpDraw();
  try { rtpAdmin.sim[id] = await rtpApi('/rtp/simulate', { gameId: id, spins }); }
  catch (e) { rtpAdmin.sim[id] = { error: e.message }; }
  rtpAdmin.busy = false;
  rtpDraw();
}

// ══ Szanse symboli (edytor) ══════════════════════════════════════
let symEd = null;
function symCss() {
  if (document.getElementById('sym-ed-css')) return;
  const st = document.createElement('style'); st.id = 'sym-ed-css';
  st.textContent = `
  .sym-ov{position:fixed;inset:0;z-index:5000;background:rgba(4,4,8,.8);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}
  .sym-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:18px;width:min(860px,100%);display:flex;flex-direction:column;gap:12px}
  .sym-box h3{font-size:20px}
  .sym-tbl{width:100%;border-collapse:collapse;font-size:13px}
  .sym-tbl th{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;text-align:left;padding:6px;border-bottom:1px solid var(--border)}
  .sym-tbl td{padding:6px;border-bottom:1px solid var(--border);vertical-align:middle}
  .sym-tbl .r{text-align:right;font-family:'DM Mono',monospace;white-space:nowrap}
  .sym-ico{width:34px;height:34px;display:grid;place-items:center;font-size:22px;border-radius:9px;background:var(--surface2);font-weight:800}
  .sym-ico img{width:28px;height:28px;object-fit:contain}
  .sym-tag{font-size:10px;font-weight:800;padding:1px 6px;border-radius:6px;margin-left:6px;background:rgba(124,92,252,.2);color:var(--accent)}
  .sym-f{display:flex;align-items:center;gap:8px}.sym-f input[type=range]{flex:1;min-width:90px}
  .sym-f input[type=number]{width:70px}
  .sym-row.chg td{background:rgba(124,92,252,.08)}
  .sym-up{color:var(--success)}.sym-down{color:var(--error)}
  .sym-act{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  @media (max-width:640px){.sym-tbl .hide-m{display:none}}`;
  document.head.appendChild(st);
}
async function symOpen(id) {
  symCss();
  try { symEd = await rtpApi('/symbols', { gameId: id }); }
  catch (e) { return showToast(e.message, 'error'); }
  symEd.f = symEd.factors.slice();
  document.querySelector('.sym-ov')?.remove();
  const ov = document.createElement('div');
  ov.className = 'sym-ov';
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
  symDraw();
}
const symChance = (ws, i) => { const t = ws.reduce((a, b) => a + b, 0); return t > 0 ? ws[i] / t : 0; };
function symDraw() {
  const ov = document.querySelector('.sym-ov'); if (!ov || !symEd) return;
  const d = symEd, base = d.syms.map(s => s.w), now = d.syms.map((s, i) => s.w * d.f[i]);
  ov.innerHTML = `<div class="sym-box">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3>🎲 Szanse symboli — ${escHtml(d.name)}</h3><button class="btn btn-secondary btn-sm" onclick="document.querySelector('.sym-ov').remove()">✕</button></div>
    <p class="rtp-hint">Mnożnik zwiększa lub zmniejsza szansę wypadnięcia symbolu na bębnach (×0 = symbol znika, ×2 = dwa razy częściej). Dotyczy gry bazowej i bonusów (tryby specjalne mogą mieć własne wagi). Procenty to udział symbolu w puli bazowej bębnów.</p>
    <table class="sym-tbl"><thead><tr><th></th><th>Symbol</th><th class="r hide-m">Waga</th><th class="r">Szansa</th><th>Mnożnik szansy</th><th class="r">Nowa szansa</th></tr></thead><tbody>
    ${d.syms.map((s, i) => { const b = symChance(base, i), n = symChance(now, i);
      return `<tr class="sym-row${d.f[i] !== 1 ? ' chg' : ''}"><td><div class="sym-ico" style="${s.color ? `color:${escHtml(s.color)}` : ''}">${s.img ? `<img src="${escHtml(s.img)}" alt="">` : escHtml(s.e || '?')}</div></td>
        <td><b>${escHtml(s.n)}</b>${s.wild ? '<span class="sym-tag">WILD</span>' : ''}${s.scatter ? '<span class="sym-tag">SCATTER</span>' : ''}</td>
        <td class="r hide-m">${s.w}</td><td class="r">${(b * 100).toFixed(2)}%</td>
        <td><div class="sym-f"><input type="range" min="0" max="${5}" step="0.05" value="${Math.min(5, d.f[i])}" oninput="symSet(${i}, this.value)"><input type="number" class="rtp-input" min="0" max="10" step="0.05" value="${d.f[i]}" onchange="symSet(${i}, this.value)">×</div></td>
        <td class="r ${n > b + 1e-9 ? 'sym-up' : n < b - 1e-9 ? 'sym-down' : ''}">${(n * 100).toFixed(2)}%</td></tr>`; }).join('')}
    </tbody></table>
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px"><input type="checkbox" id="sym-keep" ${d.keep ? 'checked' : ''} onchange="symEd.keep=this.checked">
      <span><b>Zachowaj docelowe RTP (${rtpPct(d.target, 1)})</b> — po zapisie symulacja (do 4 mln spinów, dokładność ±1%) zmierzy nowy zwrot i przeskaluje wypłaty, więc zmieni się tylko częstość symboli i zmienność gry. Odznacz, jeśli zmiana szans ma realnie zmienić zwrot (np. więcej diamentów = więcej wygranych).</span></label>
    <div class="sym-act">
      <button class="btn btn-primary btn-sm" id="sym-save" onclick="symSave()">💾 Zapisz</button>
      <button class="btn btn-secondary btn-sm" onclick="symEd.f = symEd.f.map(() => 1); symDraw()">Wszystkie ×1</button>
      ${d.at ? `<button class="btn btn-secondary btn-sm" onclick="symReset()">↺ Przywróć domyślne</button><span class="rtp-hint">zmienione ${new Date(d.at).toLocaleString('pl-PL')}</span>` : ''}
    </div>
    <div class="rtp-hint" id="sym-status"></div>
  </div>`;
}
function symSet(i, v) { symEd.f[i] = Math.max(0, Math.min(10, Math.round((Number(v) || 0) * 100) / 100)); symDraw(); }
async function symSave() {
  const btn = document.getElementById('sym-save'), st = document.getElementById('sym-status');
  btn.disabled = true; st.textContent = symEd.keep ? '⏳ Symulacja nowego RTP (do ~30 s dla bardzo zmiennych gier)…' : '⏳ Zapisywanie…';
  try {
    const r = await rtpApi('/symbols/set', { gameId: symEd.game, factors: symEd.f, keepRtp: symEd.keep });
    showToast('✅ Szanse symboli zapisane', 'success');
    document.querySelector('.sym-ov')?.remove();
    await renderCasinoRtpAdmin();
    rtpSimulate(r.game, 1_000_000);   // pokaż faktyczny zwrot po zmianie
  } catch (e) { btn.disabled = false; st.textContent = '❌ ' + e.message; }
}
async function symReset() {
  if (!confirm('Przywrócić domyślne szanse symboli?')) return;
  try { await rtpApi('/symbols/reset', { gameId: symEd.game }); showToast('↺ Domyślne szanse', 'success'); document.querySelector('.sym-ov')?.remove(); await renderCasinoRtpAdmin(); }
  catch (e) { showToast(e.message, 'error'); }
}

async function adminLogout() {
  await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
  adminPwd = '';
  goHome();
}
