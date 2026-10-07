// ══════════════════════════════════════════════════════════════
//  DUAL BLADES — dwie plansze 3×3, Shadow Blade, Sync Bonus
// ══════════════════════════════════════════════════════════════
const DB_SYMS = ['🗡️', '⚔️', '✴️', '🎭', '💨', '🪙', '🌑', '🌒'];
const DB = { SHADOW: 6, ECLIPSE: 7 };
const DB_COLORS = ['#c9d6ff', '#ff6f8a', '#ff9f43', '#c084fc', '#9fb3c8', '#ffd36b', '#60a5fa', '#7a5cff'];
const DB_POOL = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 7];
const DB_LINES = [[1,1,1],[0,0,0],[2,2,2],[0,1,2],[2,1,0]];
let dbKit = null;

function dbSyncHTML(n = 0, goal = 5) {
  return `<div class="sk-meter"><div class="sk-meter-top"><span>⚡ Sync Meter — ${goal} synchronizacji = 5 Free Spinów</span><b data-db="syncv">${n} / ${goal}</b></div>
    <div class="cx-row" style="gap:6px" data-db="sync">${Array.from({ length: goal }, (_, i) => `<div style="flex:1;height:10px;border-radius:99px;background:${i < n ? 'linear-gradient(90deg,#3b62e0,#7aa7ff)' : 'rgba(255,255,255,.07)'};box-shadow:${i < n ? '0 0 10px rgba(122,167,255,.6)' : 'none'}"></div>`).join('')}</div></div>`;
}

function initDBUI(table) {
  dbKit = new SlotKit({
    screenId: 'casino-db', game: 'dual_blades', title: 'Dual Blades', icon: '⚔️', subtitle: '2 × 3×3 · 10 linii · Sync ×2',
    theme: { a: '#60a5fa', b: '#ff6f8a' },
    scatter: { is: i => i === DB.ECLIPSE, fx: 'eclipse', icon: '🌒' },
    boards: [{ key: 'L', cols: 3, rows: 3 }, { key: 'R', cols: 3, rows: 3 }],
    midHTML: '<div data-db="mid" style="font-size:30px">⚔️</div><div data-db="midtxt" style="font-size:11px;color:var(--muted)">SYNC</div>',
    event: 'casinoDBSpin', lineCount: 10, fontSize: 'clamp(26px, 5vw, 52px)',
    randomSym: () => DB_POOL[Math.floor(Math.random() * DB_POOL.length)],
    symHTML: i => ({ color: DB_COLORS[i], html: `<span class="sk-emo">${DB_SYMS[i]}</span>`, cls: i === DB.SHADOW ? 'wild' : i === DB.ECLIPSE ? 'scatter' : '' }),
    features: () => dbSyncHTML(0, 5),
    payDivisor: () => 10,
    rules: [
      'Dwie niezależne plansze 3×3, każda ma 5 linii (3 poziome + 2 skosy). Wygrana = 3 takie same na linii.',
      '🌑 Shadow Blade (Wild) na LEWEJ planszy zamienia cały ten sam bęben na PRAWEJ planszy w Wildy.',
      '⚡ Sync Bonus: gdy obie plansze wygrają w tym samym spinie, cała wygrana ×2 (w Free Spinach ×3).',
      'Sync Meter: 5 synchronizacji = 5 Free Spinów.',
      '🌒 3 / 4 / 5+ Eclipse na obu planszach razem = 8 / 10 / 15 Free Spinów.',
      'RTP ≈ 95%.',
    ],
    onSpinStart(kit) { kit.startSpin(); kit.root.querySelector('[data-db="mid"]').textContent = '⚔️'; kit.root.querySelector('[data-db="midtxt"]').textContent = 'SYNC'; },
    async present(res, kit) {
      await Promise.all([kit.stop(res.leftGrid, 'L'), kit.stop(res.rightGrid, 'R', { extraDelay: kit.turbo ? 60 : 200 })]);
      res.shadowCols.forEach(c => kit.colEl(c, 'R').classList.add('expanded'));
      kit.showLineWins(res.leftWins, DB_LINES, 'L');
      kit.showLineWins(res.rightWins, DB_LINES, 'R');
      if (res.syncBonus) {
        cxSound.play('feature');
        kit.root.querySelector('[data-db="mid"]').textContent = '⚡';
        kit.root.querySelector('[data-db="midtxt"]').innerHTML = `<b style="color:var(--cx-gold);font-size:16px">×${res.syncMult}</b>`;
        res._msgSet = true;
        kit.msg(`⚡ SYNC BONUS ×${res.syncMult}! <span class="amt">+${cxFmt(res.payout)} AT$</span>`, 'big');
      }
      const goal = res.syncGoal || 5;
      const meter = kit.root.querySelector('[data-sk="features"]');
      meter.innerHTML = dbSyncHTML(res.syncMeter, goal);
      if (res.freeSpinsAwarded) {
        if (res.scatter?.count >= 3) await Promise.all([kit.scatterWin(res.scatter.left, 'L'), kit.scatterWin(res.scatter.right, 'R', { quiet: true })]);
        else { cxSound.play('feature'); await kit.wait(600); }
        await kit.splash(`${res.freeSpinsAwarded} FREE SPINS`, (res.syncFSAwarded && res.scatter?.count < 3 ? 'Sync Meter pełny! ' : '') + 'Sync Bonus ×3', '🌒', '#60a5fa');
        kit.msg(`${res.syncFSAwarded && !res.scatter?.count ? '⚡ Sync Meter pełny!' : '🌒 Eclipse!'} <b>+${res.freeSpinsAwarded} Free Spinów</b>`, 'feature');
        res._msgSet = res.payout === 0 || res._msgSet;
      }
      kit.banner(res.freeSpinsRemaining > 0 ? `🌒 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · Sync ×3` : '', 'purple');
    },
    freeBetOf: res => res.bet,
  });
  dbKit.mount(table);
}
skBindResult('casinoDBResult', () => dbKit);
