// ══════════════════════════════════════════════════════════════
//  KASYNO — dzienny bonus, historia gier, osiągnięcia
// ══════════════════════════════════════════════════════════════
const CX_GAME_NAMES = {
  slots: '🍀 Lucky Fruits', path_of_gambling: '🕳️ Path of Gambling', jackpot_frenzy: '🏆 Jackpot Frenzy', dragon_hoard: '🐉 Dragon Hoard',
  arcane_academy: '🔮 Arcane Academy', dual_blades: '⚔️ Dual Blades', neon_racer: '🏎️ Neon Racer', candy_tumble: '🍭 Candy Tumble',
  book_pharaoh: '📖 Księga Faraona', hot_777: '🔥 Hot 777', olympus_ways: "⚡ Olympus Ways", wild_duel: "🤠 Wild Duel", cosmic_infinity: "🌌 Cosmic Infinity", deep_sea: "🎣 Deep Sea Fortune", sugar_cells: "🧁 Sugar Cells", pandora_mystery: "🎁 Pandora's Mystery", titan_colossus: "🗿 Titan Colossus", ninja_walk: "🥷 Ninja Walk", mega_wheel: "🎡 Mega Wheel", alchemy_lab: "⚗️ Alchemy Lab", pachinko: '🎯 Pachinko', crash: '🚀 Crash', coinflip: '🪙 Coinflip',
  roulette: '🎡 Ruletka', poker: '🃏 Poker', blackjack: '🂡 Blackjack', daily: '🎁 Dzienny bonus', topup: '📬 Doładowanie',
  achievement: '🏆 Osiągnięcie', admin: '⚙️ Admin', vip: '🎖️ VIP',
};
const CX_KIND = { vip: 'awans', round: '', free: 'FREE', bonus: 'BONUS', bet: 'zakład', cashout: 'wypłata', buyin: 'wejście', achievement: 'nagroda', admin: 'admin' };
let cxDaily = null, cxDailyTimer = null;

async function cxLoadDaily() {
  if (!casinoWallet) return;
  cxLoadVip();
  try { const r = await fetch('/api/casino/daily'); if (r.ok) cxDaily = await r.json(); } catch (e) {}
  cxRenderProgressActions();
}

function cxRenderProgressActions() {
  const el = document.getElementById('cx-hero-actions');
  if (!el) return;
  const d = cxDaily;
  const daily = !d ? '' : d.available
    ? `<button class="cx-btn gold cx-daily ready" onclick="cxClaimDaily()">🎁 Odbierz bonus <b>+${cxShort(d.amount)}</b><small>dzień ${d.nextStreak}</small></button>`
    : `<button class="cx-btn cx-daily" onclick="cxShowDailyInfo()">🎁 Następny bonus za <b data-cx-countdown>—</b></button>`;
  el.innerHTML = `${daily}
    <button class="cx-btn" onclick="cxShowHistory()">📜 Historia</button>
    <button class="cx-btn" onclick="cxShowAchievements()">🏆 Osiągnięcia</button>`;
  clearInterval(cxDailyTimer);
  if (d && !d.available && d.nextAt) {
    const tick = () => {
      const c = document.querySelector('[data-cx-countdown]');
      if (!c) return clearInterval(cxDailyTimer);
      const s = Math.max(0, Math.floor((d.nextAt - Date.now()) / 1000));
      c.textContent = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      if (s === 0) { clearInterval(cxDailyTimer); cxLoadDaily(); }
    };
    tick(); cxDailyTimer = setInterval(tick, 1000);
  }
}

function cxDailyStrip(table, streak, highlight) {
  return `<div class="cx-daily-strip">${table.map((a, i) => {
    const day = i + 1, done = day < highlight || (day <= streak && !highlight), cur = day === highlight;
    return `<div class="${done ? 'done' : ''}${cur ? ' cur' : ''}"><span>Dzień ${day}${day === table.length ? '+' : ''}</span><b>${cxShort(a)}</b></div>`;
  }).join('')}</div>`;
}

async function cxClaimDaily() {
  const btn = document.querySelector('.cx-daily.ready');
  if (btn) btn.disabled = true;
  try {
    const r = await fetch('/api/casino/daily', { method: 'POST' });
    const d = await r.json();
    if (!r.ok) { cxToast(d.error || 'Nie udało się odebrać bonusu', 'error'); return cxLoadDaily(); }
    if (d.balance != null) cxSetBalance(d.balance);
    cxSound.play('bigwin');
    cxCoinRain(40);
    const table = cxDaily?.table || [];
    cxModal(`<div style="text-align:center"><div style="font-size:64px">🎁</div><h3 style="font-size:26px">Dzienny bonus!</h3>
      <div class="cx-daily-amt">+${cxFmt(d.amount)} AT$</div>
      <p style="color:var(--muted);margin:6px 0 14px">Seria: <b style="color:var(--cx-gold)">${d.streak} ${d.streak === 1 ? 'dzień' : 'dni'}</b> — wracaj codziennie, bonus rośnie do ${cxShort(table[table.length - 1] || 0)} AT$.</p>
      ${cxDailyStrip(table, d.streak, Math.min(d.streak, table.length))}</div>`);
  } catch (e) { cxToast('Błąd połączenia', 'error'); }
  cxLoadDaily();
}

function cxShowDailyInfo() {
  const d = cxDaily; if (!d) return;
  cxModal(`<h3>🎁 Dzienny bonus</h3><p class="cx-rules">Odbieraj bonus raz dziennie (dzień liczony wg czasu polskiego). Każdy kolejny dzień z rzędu daje więcej AT$; przerwa zeruje serię.</p>
    <p style="margin:10px 0">Twoja seria: <b style="color:var(--cx-gold)">${d.streak}</b>. Jutro dostaniesz <b>+${cxFmt(d.amount)} AT$</b>.</p>
    ${cxDailyStrip(d.table, d.streak, 0)}`);
}

async function cxShowHistory() {
  const m = cxModal(`<h3>📜 Historia gier</h3><div class="cx-hist-wrap"><p style="color:var(--muted)">⏳ Ładowanie…</p></div>`, { wide: true });
  try {
    const r = await fetch('/api/casino/history?limit=100');
    const list = r.ok ? await r.json() : [];
    const box = m.el.querySelector('.cx-hist-wrap');
    if (!list.length) { box.innerHTML = '<p style="color:var(--muted)">Brak wpisów — zagraj w coś!</p>'; return; }
    box.innerHTML = `<table class="cx-hist"><thead><tr><th>Kiedy</th><th>Gra</th><th class="r">Stawka</th><th class="r">Wygrana</th><th class="r">Wynik</th></tr></thead><tbody>${list.map(h => {
      const net = (h.win || 0) - (h.bet || 0);
      const t = new Date(h.ts);
      const kind = CX_KIND[h.kind] ?? h.kind;
      return `<tr><td class="t">${t.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} ${t.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${CX_GAME_NAMES[h.game] || cxEsc(h.game)}${kind ? ` <span class="cx-hist-kind">${kind}</span>` : ''}${h.note ? `<div class="n">${cxEsc(h.note)}</div>` : ''}</td>
        <td class="r">${h.bet ? cxFmt(h.bet) : '—'}</td><td class="r">${h.win ? cxFmt(h.win) : '—'}</td>
        <td class="r ${net > 0 ? 'cx-pos' : net < 0 ? 'cx-neg' : ''}">${net > 0 ? '+' : ''}${net ? cxFmt(net) : '0'}</td></tr>`;
    }).join('')}</tbody></table>`;
  } catch (e) { m.el.querySelector('.cx-hist-wrap').innerHTML = '<p style="color:var(--cx-lose)">Błąd połączenia</p>'; }
}

async function cxShowAchievements() {
  const m = cxModal(`<h3>🏆 Osiągnięcia</h3><div class="cx-ach-wrap"><p style="color:var(--muted)">⏳ Ładowanie…</p></div>`, { wide: true });
  try {
    const r = await fetch('/api/casino/achievements');
    const list = r.ok ? await r.json() : [];
    const done = list.filter(a => a.unlocked).length;
    m.el.querySelector('h3').innerHTML = `🏆 Osiągnięcia <span class="cx-pill" style="font-size:13px;vertical-align:middle">${done} / ${list.length}</span>`;
    m.el.querySelector('.cx-ach-wrap').innerHTML = `<div class="cx-ach-grid">${list.map(a => {
      const pct = a.progress ? Math.round(a.progress.have / a.progress.need * 100) : (a.unlocked ? 100 : 0);
      return `<div class="cx-ach ${a.unlocked ? 'on' : ''}"><div class="ico">${a.icon}</div><div class="txt"><b>${cxEsc(a.name)}</b><span>${cxEsc(a.desc)}</span>
        ${a.unlocked ? `<em>✓ ${new Date(a.unlocked).toLocaleDateString('pl-PL')}</em>` : a.progress ? `<div class="cx-ach-bar"><i style="width:${pct}%"></i></div><em>${cxShort(a.progress.have)} / ${cxShort(a.progress.need)}</em>` : ''}</div>
        <div class="rw">+${cxShort(a.reward)}</div></div>`;
    }).join('')}</div>`;
  } catch (e) { m.el.querySelector('.cx-ach-wrap').innerHTML = '<p style="color:var(--cx-lose)">Błąd połączenia</p>'; }
}

// Powiadomienie o zdobytym osiągnięciu (na żywo, w dowolnej grze)
const cxAchQueue = [];
let cxAchShowing = false;
socket.on('casinoAchievement', a => { cxAchQueue.push(a); if (!cxAchShowing) cxNextAchievement(); });
function cxNextAchievement() {
  const a = cxAchQueue.shift();
  if (!a) { cxAchShowing = false; return; }
  cxAchShowing = true;
  if (a.balance != null) cxSetBalance(a.balance, false);
  cxSound.play('feature');
  const el = document.createElement('div');
  el.className = 'cx-ach-pop';
  el.innerHTML = `<div class="ico">${a.icon}</div><div><small>Osiągnięcie odblokowane!</small><b>${cxEsc(a.name)}</b><span>${cxEsc(a.desc)}</span></div><div class="rw">+${cxFmt(a.reward)} AT$</div>`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); cxNextAchievement(); }, 400); }, 4200);
}

// ══ VIP ══════════════════════════════════════════════════════
// 1 spin = 1 XP; VIP 1 za 1000 XP, każdy kolejny poziom +500 XP; bez limitu poziomów; mnożnik wygranych 1 + 0,01 × poziom, mnożnik XP 1 + 0,1 × poziom
let cxVip = null;
const cxVipTotal = L => 1000 * L + 250 * L * (L - 1);
const CX_VIP_TIERS = [[500, 'cosmic', 'Kosmiczny'], [250, 'mythic', 'Mityczny'], [100, 'legend', 'Legenda'], [75, 'diamond', 'Diament'], [50, 'plat', 'Platyna'], [25, 'gold', 'Złoto'], [10, 'silver', 'Srebro'], [1, 'bronze', 'Brąz'], [0, 'none', 'Start']];
const cxVipTier = L => CX_VIP_TIERS.find(t => L >= t[0]);
const cxVipMultTxt = m => '×' + m.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function cxLoadVip() {
  try { const r = await fetch('/api/casino/vip'); if (r.ok) { cxVip = await r.json(); cxRenderVip(); } } catch (e) {}
}
function cxVipChipHTML() {
  const v = cxVip;
  if (!v) return '';
  const pct = Math.floor(v.cur / v.need * 100);
  return `<span class="vip-lv">VIP ${v.level}</span><span class="vip-m">${cxVipMultTxt(v.mult)}</span><i style="--p:${pct}%"></i>`;
}
function cxVipCardHTML() {
  const v = cxVip;
  if (!v) return '';
  const pct = v.cur / v.need * 100;
  return `<div class="cx-vip-card t-${cxVipTier(v.level)[1]}" onclick="cxShowVip()" title="Poziom VIP — szczegóły">
    <div class="vc-top"><span class="vc-badge">🎖️ VIP ${v.level}</span><span class="vc-mult">wygrane ${cxVipMultTxt(v.mult)}</span></div>
    <div class="vc-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="vc-txt">${cxFmt(v.cur)} / ${cxFmt(v.need)} XP do VIP ${v.level + 1} · XP ${cxVipMultTxt(v.xpMult || 1)}</div></div>`;
}
function cxRenderVip() {
  const tier = cxVip ? cxVipTier(cxVip.level)[1] : 'none';
  document.querySelectorAll('[data-cx-vip-chip]').forEach(el => { el.innerHTML = cxVipChipHTML(); el.hidden = !cxVip; el.className = 'cx-vip-chip t-' + tier; });
  document.querySelectorAll('[data-cx-vip-card]').forEach(el => { el.innerHTML = cxVipCardHTML(); });
}
function cxShowVip() {
  const v = cxVip;
  if (!v) return;
  const rows = [];
  const from = Math.max(1, v.level - 2), to = from + 9;
  const marks = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000].filter(L => L > to).slice(0, 5);
  for (const L of [...Array.from({ length: to - from + 1 }, (_, i) => from + i), ...marks]) {
    const need = cxVipTotal(L), done = v.level >= L;
    rows.push(`<tr class="${done ? 'done' : ''}${L === v.level ? ' cur' : ''}"><td><b>VIP ${L}</b> <small>${cxVipTier(L)[2]}</small></td><td class="r">${cxFmt(need)} XP</td><td class="r">${cxVipMultTxt(1 + L / 100)}</td><td class="r">${cxVipMultTxt(1 + L / 10)}</td><td class="r">${done ? '✓' : `${cxFmt(Math.max(0, need - v.xp))} XP`}</td></tr>`);
  }
  cxModal(`<h3>🎖️ Program VIP</h3>
    ${cxVipCardHTML()}
    <p class="cx-rules" style="margin:12px 0">Każdy spin na automacie (także darmowy) daje <b>1 XP</b>, a duże wygrane dodatkowo: Big Win +5, Mega +15, Huge +40, Giga +100, Mega Giga Frito +300, Ultra Frito +600, Turbo Giga Frito +1 200, Kosmiczne Frito +2 500, Legendarne Frito +5 000, Super Mega Rollo Kebab +10 000, jackpoty od 15 000× — tyle XP, ile × stawki, uruchomienie bonusu +25. VIP 1 wymaga 1 000 XP, a każdy kolejny poziom o 500 XP więcej. Poziomy nie mają limitu. Każdy poziom zwiększa o 1% <b>wszystkie wygrane na automatach</b> (VIP 10 = ×1,10, VIP 100 = ×2,00) i o 10% <b>zdobywane XP</b> (VIP 10 = ×2 XP, VIP 100 = ×11 XP).</p>
    <table class="cx-hist cx-vip-tbl"><thead><tr><th>Poziom</th><th class="r">Łącznie XP</th><th class="r">Wygrane</th><th class="r">XP</th><th class="r">Brakuje</th></tr></thead><tbody>${rows.join('')}</tbody></table>`, { wide: true });
}
socket.on('casinoVip', v => {
  const up = v.levelUp;
  cxVip = v;
  cxRenderVip();
  if (v.bonus > 0) cxVipXpPop(v.bonus);
  if (!up) return;
  cxSound.play('feature');
  const el = document.createElement('div');
  el.className = 'cx-ach-pop cx-vip-pop t-' + cxVipTier(v.level)[1];
  el.innerHTML = `<div class="ico">🎖️</div><div><small>Awans VIP!</small><b>VIP ${v.level}</b><span>Wygrane na automatach ${cxVipMultTxt(v.mult)}</span></div>`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3800);
});

// „+40 XP” wyskakujące przy znaczku VIP (bonusowe XP za dużą wygraną / bonus)
function cxVipXpPop(n) {
  const chip = document.querySelector('.cx-screen.active [data-cx-vip-chip]:not([hidden])');
  if (!chip) return;
  const r = chip.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'cx-vip-xp';
  el.textContent = `+${n} XP`;
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.bottom + 4) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
