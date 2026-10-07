// ══════════════════════════════════════════════════════════════
//  DRAGON HOARD — 4×5, 20 linii, rozszerzający się Smok, Hold & Win
// ══════════════════════════════════════════════════════════════
const DH_SYMS = ['👑', '⚔️', '🛡️', '🧪', '📜', '🪙', '🐉', '🔥', '💎', ''];
const DH_COLORS = ['#ffd36b', '#9fb3c8', '#4f8cff', '#3ff2a3', '#d9b38c', '#ffb300', '#ff5a1f', '#ff3b3b', '#4fe3ff', '#333'];
const DH = { DRAGON: 6, FIRE: 7, GEM: 8, EMPTY: 9 };
const DH_POOL = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 7, 8, 8];
const DH_LINES = [
  [2,2,2,2],[0,0,0,0],[4,4,4,4],[1,1,1,1],[3,3,3,3],
  [0,1,2,1],[4,3,2,3],[0,1,2,3],[4,3,2,1],[1,0,1,0],
  [3,4,3,4],[0,2,4,2],[4,2,0,2],[0,0,1,2],[2,2,1,0],
  [0,1,1,1],[4,3,3,3],[2,1,0,1],[2,3,4,3],[1,2,3,2],
];
const DH_JP = { mini: 10, minor: 25, major: 100, grand: 1000 };
const DH_JP_LABEL = { mini: 'MINI', minor: 'MINOR', major: 'MAJOR', grand: 'GRAND' };
let dhKit = null;
let dhState = { gems: [], hold: false, respins: 0 };

function dhGemLabel(g) { return g.jp ? DH_JP_LABEL[g.jp] : '×' + +(g.v * cxK('dragon_hoard')).toFixed(2); }
function dhJPHtml(bet) {
  return `<div class="sk-meter" style="flex:2"><div class="sk-meter-top"><span>💎 6+ gemów = Hold & Win · zapełnij 20 pól = GRAND</span></div>
    <div class="cx-row" style="gap:6px">${Object.entries(DH_JP).map(([k, m]) => `<div style="flex:1;text-align:center;padding:6px;border-radius:10px;background:rgba(255,138,61,.12);border:1px solid rgba(255,138,61,.35)"><div style="font-size:10px;font-weight:800;color:#ffb37a">${DH_JP_LABEL[k]}</div><b class="cx-mono" data-dh-jp="${k}" style="font-size:13px;color:var(--cx-gold)">${cxShort(m * bet * cxK('dragon_hoard'))}</b></div>`).join('')}</div></div>`;
}

function initDHUI(table) {
  dhState = { gems: [], hold: false, respins: 0 };
  dhKit = new SlotKit({
    screenId: 'casino-dh', game: 'dragon_hoard', title: 'Dragon Hoard', icon: '🐉', subtitle: '4×5 · 20 linii · Hold & Win',
    theme: { a: '#ff8a3d', b: '#ffd36b' },
    scatter: { is: i => i === DH.FIRE, fx: 'fire', icon: '🔥' },
    cols: 4, rows: 5, event: 'casinoDHSpin', lineCount: 20, boardMaxWidth: '440px',
    randomSym: () => dhState.hold ? DH.EMPTY : DH_POOL[Math.floor(Math.random() * DH_POOL.length)],
    symHTML: i => ({ noTile: i === DH.EMPTY, color: DH_COLORS[i], html: i === DH.EMPTY ? '' : `<span class="sk-emo">${DH_SYMS[i]}</span>`, cls: i === DH.DRAGON ? 'wild' : i === DH.FIRE ? 'scatter' : i === DH.GEM ? 'special' : '' }),
    decorate(el, c, r, si) {
      if (si === DH.GEM) {
        const g = dhState.gems.find(g => g.col === c && g.row === r);
        if (g && !el.querySelector('.sk-badge')) el.insertAdjacentHTML('beforeend', `<span class="sk-badge">${dhGemLabel(g)}</span>`);
        if (dhState.hold) el.classList.add('sticky');
      }
    },
    features: () => dhJPHtml(table.config.minBet),
    onBetChange: bet => Object.entries(DH_JP).forEach(([k, m]) => { const el = dhKit?.root.querySelector(`[data-dh-jp="${k}"]`); if (el) el.textContent = cxShort(m * bet * cxK('dragon_hoard')); }),
    onSpinStart(kit) {
      if (dhState.hold) {
        // Migotanie pustych pól
        for (let c = 0; c < 4; c++) for (let r = 0; r < 5; r++) {
          if (!dhState.gems.find(g => g.col === c && g.row === r)) kit.cell(c, r)?.animate([{ opacity: .2 }, { opacity: .7 }, { opacity: .2 }], { duration: 400, iterations: 3 });
        }
      } else kit.startSpin();
    },
    anticipate: grid => {
      let n = 0;
      for (let c = 0; c < 4; c++) { if (n >= 4) return c; n += grid[c].filter(s => s === DH.GEM).length; }
      return null;
    },
    freeLeft: res => res.mode === 'hold' || res.holdTriggered ? (res.respinsLeft || 0) + (res.freeSpinsRemaining || 0) : res.freeSpinsRemaining,
    rules: [
      '20 linii, wygrane od lewej, min. 3 symbole.',
      '🐉 Smok jest Wildem i rozszerza się na cały bęben.',
      '🔥 3 / 4 / 5+ Ognia = 8 / 12 / 15 Free Spinów z wygranymi ×2.',
      '💎 Każdy Gem ma wartość (×1–×15 stawki) albo jackpot Mini/Minor/Major. 6+ Gemów w jednym spinie uruchamia HOLD & WIN.',
      'Hold & Win: gemy zostają, masz 3 respiny; każdy nowy gem resetuje licznik do 3. Na koniec wypłacana jest suma wszystkich gemów. Zapełnienie 20 pól = dodatkowo GRAND ×1000.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      if (res.mode === 'hold') {
        dhState.gems = res.gems;
        const cells = res.newGems.map(g => [g.col, g.row]);
        if (cells.length) { await kit.revealCells(res.grid, cells); cxSound.play('feature'); }
        else await kit.wait(kit.turbo ? 200 : 600);
        dhState.respins = res.respinsLeft;
        kit.banner(`💎 HOLD & WIN — respiny: <b>${res.respinsLeft}</b> · gemy: <b>${res.gems.length}/20</b>`, 'gold');
        if (res.holdEnded) {
          kit.highlight(res.gems.map(g => [g.col, g.row]), 'main', false);
          const jp = res.jackpotWins.map(j => DH_JP_LABEL[j.jp]).join(' + ');
          res._msgSet = true;
          kit.msg(`💎 Hold & Win zakończony: <span class="amt">+${cxFmt(res.payout)} AT$</span>${jp ? ` · 🏆 ${jp}` : ''}`, 'big');
          dhState.hold = false;
          kit.banner(res.freeSpinsRemaining > 0 ? `🔥 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · wygrane ×2` : '');
          await kit.wait(1400);
          if (res.payout >= res.bet * 8) { res.fsSummary = { title: '💎 HOLD & WIN', win: res.payout, bet: res.bet }; res.payout = res.payout; res.tier = 'none'; }
        }
        return;
      }
      dhState.gems = res.gems || [];
      await kit.stop(res.grid);
      // Rozszerzanie smoków
      for (let c = 0; c < 4; c++) if (res.grid[c].includes(DH.DRAGON)) { kit.expandCol(c, DH.DRAGON); cxSound.play('chip'); await kit.wait(kit.turbo ? 60 : 180); }
      kit.showLineWins(res.winLines, DH_LINES);
      if (res.freeSpinsAwarded) { await kit.scatterWin(res.scatter); await kit.splash(`${res.freeSpinsAwarded} FREE SPINS`, 'Wygrane ×2', '🔥', '#ff8a3d'); kit.msg(`🔥 <b>+${res.freeSpinsAwarded} Free Spinów</b> (wygrane ×2)`, 'feature'); res._msgSet = res.payout === 0; }
      if (res.holdTriggered) {
        cxSound.play('feature');
        kit.highlight(res.gems.map(g => [g.col, g.row]), 'main', false);
        await kit.wait(700);
        await kit.splash('HOLD & WIN', `${res.gems.length} gemów zostaje · 3 respiny`, '💎', '#4fe3ff');
        kit.msg(`💎 ${res.gems.length} gemów — <b>HOLD & WIN!</b>`, 'feature');
        res._msgSet = res.payout === 0;
        dhState.hold = true;
        const g = Array.from({ length: 4 }, (_, c) => Array.from({ length: 5 }, (_, r) => res.gems.find(x => x.col === c && x.row === r) ? DH.GEM : DH.EMPTY));
        kit.clearWins();
        kit.setGrid(g);
        kit.banner(`💎 HOLD & WIN — respiny: <b>${res.respinsLeft}</b> · gemy: <b>${res.gems.length}/20</b>`, 'gold');
      } else if (!dhState.hold) {
        kit.banner(res.freeSpinsRemaining > 0 ? `🔥 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · wygrane ×2` : '');
      }
    },
    freeBetOf: res => res.bet,
  });
  dhKit.mount(table);
}
skBindResult('casinoDHResult', () => dhKit);
