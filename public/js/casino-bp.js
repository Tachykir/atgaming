// ══════════════════════════════════════════════════════════════
//  KSIĘGA FARAONA — 5×3, 10 linii, Księga = Wild+Scatter, rozszerzający symbol
// ══════════════════════════════════════════════════════════════
const BP_SYMS = ['🧭', '👑', '🗿', '🪲', 'A', 'K', 'Q', 'J', '10', '📖'];
const BP_COLORS = ['#ffd36b', '#4fc3ff', '#c9a36b', '#3ff2a3', '#ff6f8a', '#c084fc', '#4fc3ff', '#3ff2a3', '#ff9f43', '#ffd36b'];
const BP_NAMES = ['Odkrywca', 'Faraon', 'Posąg', 'Skarabeusz', 'As', 'Król', 'Dama', 'Walet', 'Dziesiątka', 'Księga'];
const BP = { BOOK: 9 };
const BP_POOL = [0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9];
const BP_LINES = [[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[1,2,2,2,1],[1,0,0,0,1],[2,2,1,0,0],[0,0,1,2,2],[2,1,1,1,0]];
let bpKit = null, bpSpecial = null;

function bpSymHTML(i) {
  const letter = i >= 4 && i <= 8;
  return { html: letter ? `<span>${BP_SYMS[i]}</span>` : `<span class="sk-emo">${BP_SYMS[i]}</span>`, tile: letter ? 'letter' : '', color: BP_COLORS[i], cls: i === BP.BOOK ? 'wild scatter' : '' };
}
function bpSpecialHTML() {
  if (bpSpecial === null) return '<div class="sk-meter"><div class="sk-meter-top"><span>📖 3+ Księgi = 10 Free Spinów z rozszerzającym się symbolem</span></div></div>';
  return `<div class="sk-meter" style="display:flex;align-items:center;gap:12px"><div style="width:52px;height:52px;position:relative;font-size:30px" class="sk-cell">${ctxTile(bpSymHTML(bpSpecial))}</div>
    <div><div style="font-size:11px;color:var(--muted);font-weight:800;letter-spacing:.1em">SYMBOL SPECJALNY</div><b style="color:var(--cx-gold)">${BP_NAMES[bpSpecial]}</b> — rozszerza się na całe bębny</div></div>`;
}
function ctxTile(s) { return `<div class="sk-tile ${s.tile || ''}" style="--c:${s.color}">${s.html}</div>`; }
function bpRenderFeature() { const el = bpKit?.root.querySelector('[data-sk="features"]'); if (el) el.innerHTML = bpSpecialHTML(); }

function initBPUI(table) {
  bpSpecial = null;
  bpKit = new SlotKit({
    screenId: 'casino-bp', game: 'book_pharaoh', title: 'Księga Faraona', icon: '📖', subtitle: '5×3 · 10 linii · rozszerzający się symbol',
    theme: { a: '#ffd36b', b: '#4fc3ff' },
    scatter: { is: i => i === BP.BOOK, fx: 'egypt', icon: '📖' },
    cols: 5, rows: 3, event: 'casinoBPSpin', lineCount: 10, boardMaxWidth: '640px',
    randomSym: () => BP_POOL[Math.floor(Math.random() * BP_POOL.length)],
    symHTML: bpSymHTML,
    features: bpSpecialHTML,
    anticipate: grid => {
      let n = 0;
      for (let c = 0; c < 5; c++) { if (n >= 2) return c; if (grid[c].includes(BP.BOOK)) n++; }
      return null;
    },
    rules: [
      '10 linii, wygrane od lewej. Odkrywca, Faraon, Posąg i Skarabeusz płacą już od 2 symboli, litery od 3.',
      '📖 Księga jest jednocześnie Wildem i Scatterem: 3 / 4 / 5 Ksiąg = 2× / 20× / 200× stawki + 10 Free Spinów.',
      'Przed Free Spinami losowany jest SYMBOL SPECJALNY. Jeśli pojawi się na wystarczającej liczbie bębnów (2 dla wysokich, 3 dla liter), rozszerza się na całe bębny i płaci na wszystkich 10 liniach — nawet gdy bębny nie sąsiadują.',
      'Free Spiny można wygrać ponownie (+10).',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      await kit.stop(res.grid);
      kit.showLineWins(res.winLines, BP_LINES);
      if (res.books?.count >= 3) await kit.scatterWin(res.books.cells);
      if (res.expand) {
        await kit.wait(res.winLines.length ? 900 : 300);
        kit.clearWins();
        for (const c of res.expand.reels) { kit.expandCol(c, res.expand.symIdx); cxSound.play('chip'); await kit.wait(kit.turbo ? 80 : 260); }
        kit.highlight(res.expand.reels.flatMap(c => [[c, 0], [c, 1], [c, 2]]));
        res._msgSet = true;
        kit.countMsg(`📖 ${BP_NAMES[res.expand.symIdx]} na ${res.expand.reels.length} bębnach:`, res.payout, 'big');
        await kit.wait(900);
      }
      if (res.freeSpinsAwarded) {
        bpSpecial = res.special;
        await kit.wait(300);
        await kit.splash(`${res.freeSpinsAwarded} FREE SPINS`, `Symbol specjalny: ${BP_NAMES[res.special]}`, `<div style="width:120px;height:120px;position:relative;margin:0 auto;font-size:64px" class="sk-cell">${ctxTile(bpSymHTML(res.special))}</div>`, '#ffd36b');
        if (!res._msgSet) { kit.msg(`📖 Księgi! <b>+${res.freeSpinsAwarded} Free Spinów</b> · symbol specjalny: <b>${BP_NAMES[res.special]}</b>`, 'feature'); res._msgSet = res.payout === 0; }
      }
      bpSpecial = res.freeSpinsRemaining > 0 ? res.special : null;
      bpRenderFeature();
      kit.banner(res.freeSpinsRemaining > 0 ? `📖 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · symbol specjalny: <b>${BP_NAMES[res.special]}</b>` : '', 'gold');
    },
    freeBetOf: res => res.bet,
  });
  bpKit.mount(table);
}
skBindResult('casinoBPResult', () => bpKit);
