// ══════════════════════════════════════════════════════════════
//  CANDY TUMBLE — 6×5, wypłata za 8+ w dowolnym miejscu, tumble, bomby
// ══════════════════════════════════════════════════════════════
const CT_SYMS = ['🍬', '🫐', '🍇', '🍏', '🍉', '🍑', '🍌', '🍓', '🍒', '🍭', '💣'];
const CT_COLORS = ['#ff4d8d', '#4f7dff', '#a855f7', '#7bd96b', '#ff5c5c', '#ffa07a', '#ffe14d', '#ff3b5c', '#d9264f', '#ff7ad9', '#ff9f43'];
const CT = { LOLLY: 9, BOMB: 10 };
const CT_POOL = [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9];
let ctKit = null, ctBombs = {};

function initCTUI(table) {
  ctBombs = {};
  ctKit = new SlotKit({
    screenId: 'casino-ct', game: 'candy_tumble', title: 'Candy Tumble', icon: '🍭', subtitle: '6×5 · wygrana za 8+ w dowolnym miejscu · bomby do ×100',
    theme: { a: '#ff7ad9', b: '#7aa7ff' },
    cols: 6, rows: 5, event: 'casinoCTSpin', boardMaxWidth: '600px', stagger: 90,
    randomSym: () => CT_POOL[Math.floor(Math.random() * CT_POOL.length)],
    symHTML: i => ({ html: `<span class="sk-emo">${CT_SYMS[i]}</span>`, color: CT_COLORS[i], cls: i === CT.LOLLY ? 'scatter' : i === CT.BOMB ? 'special' : '' }),
    decorate(el, c, r, si) {
      if (si === CT.BOMB && ctBombs[c + ',' + r] && !el.querySelector('.sk-badge')) el.insertAdjacentHTML('beforeend', `<span class="sk-badge">×${ctBombs[c + ',' + r]}</span>`);
    },
    anticipate: grid => {
      let n = 0;
      for (let c = 0; c < 6; c++) { if (n >= 3) return c; n += grid[c].filter(s => s === CT.LOLLY).length; }
      return null;
    },
    payDivisor: () => 1,
    payLabels: ['8–9', '10–11', '12+'],
    rules: [
      'Pay Anywhere: 8 lub więcej takich samych symboli w DOWOLNYM miejscu planszy = wygrana.',
      'Tumble: wygrane symbole znikają, a w ich miejsce spadają nowe — kolejne wygrane w tym samym spinie są możliwe.',
      '🍭 Lizak (Scatter): 4 / 5 / 6 = 3× / 5× / 100× stawki + 10 Free Spinów. W Free Spinach 3+ Lizaki = +5 spinów.',
      '💣 W Free Spinach spadają bomby z mnożnikami ×2–×100. Gdy sekwencja tumble zakończy się wygraną, suma wszystkich bomb na planszy mnoży wygraną spinu.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      ctBombs = res.startBombs || {};
      await kit.stop(res.startGrid);
      for (const st of res.steps) {
        const cells = st.wins.flatMap(w => w.cells);
        kit.highlight(cells);
        cxSound.play('win');
        kit.msg(st.wins.map(w => `${CT_SYMS[w.symIdx]}×${w.count}`).join(' · ') + ` <span class="amt">+${cxFmt(st.win)} AT$</span>`, 'win');
        await kit.wait(kit.turbo ? 350 : 800);
        kit.clearWins();
        ctBombs = st.bombs || {};
        await kit.cascade(cells, st.grid, st.falling);
      }
      ctBombs = res.bombs || {};
      // Bomby mnożą wygraną
      if (res.bombMult > 0) {
        const bcells = Object.keys(res.bombs).map(k => k.split(',').map(Number));
        kit.highlight(bcells, 'main', true);
        cxSound.play('feature');
        kit.msg(`💣 Bomby: <b>×${res.bombMult}</b> → ${cxFmt(res.baseWin)} × ${res.bombMult} = <span class="amt">${cxFmt(res.baseWin * res.bombMult)} AT$</span>`, 'big');
        res._msgSet = true;
        const m = kit.$('machine'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake');
        await kit.wait(1500);
      } else if (res.steps.length > 1) { res._msgSet = true; kit.countMsg(`${res.steps.length} tumble!`, res.payout, 'big'); }
      if (res.scatter?.count >= 3) kit.highlight(res.scatter.cells, 'main', false);
      if (res.freeSpinsAwarded) {
        await kit.wait(600);
        await kit.splash(res.isFree ? `+${res.freeSpinsAwarded} FREE SPINS` : `${res.freeSpinsAwarded} FREE SPINS`, 'Bomby z mnożnikami do ×100!', '🍭', '#ff7ad9');
        if (!res._msgSet) { kit.msg(`🍭 ${res.scatter.count} Lizaki! <b>+${res.freeSpinsAwarded} Free Spinów</b>`, 'feature'); res._msgSet = res.payout === 0; }
      }
      kit.banner(res.freeSpinsRemaining > 0 ? `🍭 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · 💣 bomby mnożą wygrane` : '', '');
    },
    freeBetOf: res => res.bet,
  });
  ctKit.mount(table);
}
skBindResult('casinoCTResult', () => ctKit);
