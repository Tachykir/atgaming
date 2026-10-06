// ══════════════════════════════════════════════════════════════
//  ARCANE ACADEMY — 7×7, klastry, kaskady z rosnącym mnożnikiem, Bonus Pick
// ══════════════════════════════════════════════════════════════
const AA_SYMS = ['🔮', '🦅', '🪄', '🎩', '⚗️', '⭐', '🍃', '💫', '📚'];
const AA = { ORB: 7, TOME: 8 };
const AA_POOL = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 8];
let aaKit = null, aaPick = null, aaMult = 1;

function aaTrailHTML() {
  return `<div class="sk-meter"><div class="sk-meter-top"><span>✨ Mnożnik kaskad</span><b data-aa="multv">×1</b></div>
    <div class="cx-row" style="gap:4px" data-aa="trail">${Array.from({ length: 10 }, (_, i) => `<div data-m="${i + 1}" style="flex:1;text-align:center;padding:4px 0;border-radius:8px;font:800 11px 'DM Mono',monospace;background:rgba(255,255,255,.05);color:rgba(255,255,255,.35);transition:.25s">×${i + 1}</div>`).join('')}</div></div>`;
}
function aaSetMult(m) {
  aaMult = m;
  if (!aaKit) return;
  aaKit.root.querySelector('[data-aa="multv"]').textContent = '×' + m;
  aaKit.root.querySelectorAll('[data-aa="trail"] > div').forEach(d => {
    const on = Number(d.dataset.m) <= m, cur = Number(d.dataset.m) === m;
    d.style.background = cur ? 'linear-gradient(180deg,#c3b0ff,#6a45f0)' : on ? 'rgba(167,139,250,.35)' : 'rgba(255,255,255,.05)';
    d.style.color = on ? '#fff' : 'rgba(255,255,255,.35)';
    d.style.transform = cur ? 'scale(1.12)' : '';
  });
}

function initAAUI(table) {
  aaPick = null; aaMult = 1;
  aaKit = new SlotKit({
    screenId: 'casino-aa', game: 'arcane_academy', title: 'Arcane Academy', icon: '🔮', subtitle: '7×7 · Cluster Pays · Kaskady',
    theme: { a: '#a78bfa', b: '#4fe3ff' },
    cols: 7, rows: 7, event: 'casinoAASpin', boardMaxWidth: '560px',
    randomSym: () => AA_POOL[Math.floor(Math.random() * AA_POOL.length)],
    symHTML: i => ({ html: `<span class="sk-emo">${AA_SYMS[i]}</span>`, cls: i === AA.ORB ? 'wild' : i === AA.TOME ? 'scatter' : '' }),
    features: aaTrailHTML,
    stagger: 70,
    canSpin: () => !aaPick,
    payDivisor: () => 1,
    rules: [
      'Cluster Pays: 5+ takich samych symboli stykających się bokami = wygrana. 💫 Orb (Wild) dołącza do każdego klastra.',
      'Wygrane klastry znikają, nowe symbole spadają z góry. Każda kolejna kaskada zwiększa mnożnik: ×1 → ×2 → … → ×10.',
      '📚 3+ Tomów w spinie otwiera BONUS PICK: odkrywaj księgi z nagrodami (AT$ lub 5 Free Spinów). 3 bomby kończą bonus.',
      'W Free Spinach mnożnik kaskad NIE resetuje się — rośnie przez cały bonus.',
      'Wypłaty w tabeli to × stawki łącznej za klaster danej wielkości.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      aaSetMult(res.isFree ? (res.steps[0]?.mult || aaMult) : 1);
      await kit.stop(res.startGrid);
      for (const st of res.steps) {
        aaSetMult(st.mult);
        const cells = st.clusters.flatMap(cl => cl.cells);
        kit.highlight(cells);
        cxSound.play('win');
        kit.msg(`Kaskada ×${st.mult}: <span class="amt">+${cxFmt(st.win)} AT$</span>`, st.mult > 2 ? 'big' : 'win');
        await kit.wait(kit.turbo ? 350 : 750);
        kit.clearWins();
        await kit.cascade(cells, st.grid, st.falling);
      }
      if (res.steps.length) aaSetMult(res.finalMultiplier);
      if (res.steps.length > 1) { res._msgSet = true; kit.msg(`${res.cascadeCount} kaskad! Razem: <span class="amt">+${cxFmt(res.payout)} AT$</span>`, 'big'); }
      if (res.scatter?.length >= 3 && res.bonusPick) { kit.highlight(res.scatter, 'main', false); cxSound.play('feature'); }
      kit.banner(res.freeSpinsRemaining > 0 ? `📚 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · mnożnik zostaje: <b>×${res.fsMult}</b>` : '', 'purple');
      if (!res.isFree && !res.freeSpinsRemaining) setTimeout(() => !aaKit?.spinning && aaSetMult(1), 1500);
      if (res.fsSummary) res.fsSummary.title = `📚 Free Spiny (×${res.fsSummary.mult})`;
    },
    async afterResult(res, kit) {
      if (res.bonusPick) { await kit.wait(600); aaOpenPick(res.bonusPick); }
    },
    freeBetOf: res => res.bet,
  });
  aaKit.mount(table);
  socket.emit('casinoAAGetState', cxAuth());
}

function aaOpenPick(pick) {
  aaPick = pick;
  cxSound.play('feature');
  const books = pick.board.map((it, i) => `<button class="aa-book" data-i="${i}" style="aspect-ratio:3/4;border-radius:14px;border:2px solid rgba(167,139,250,.5);background:linear-gradient(160deg,#3b2a7a,#170f36);font-size:34px;cursor:pointer;transition:.2s;color:#fff;font-weight:800">📕</button>`).join('');
  const m = cxModal(`<h3>📚 BONUS PICK</h3><p class="cx-rules">Wybieraj księgi. Nagrody to wielokrotność stawki <b>${cxFmt(pick.bet)} AT$</b> lub Free Spiny. <b>3 bomby</b> kończą bonus.</p>
    <div class="cx-row" style="justify-content:space-between;margin:10px 0"><span class="cx-pill">Wygrane: <b data-aa="ptotal" style="color:var(--cx-gold)">${cxFmt(pick.total)} AT$</b></span><span class="cx-pill">Free Spiny: <b data-aa="pfs">${pick.fs}</b></span><span class="cx-pill">Bomby: <b data-aa="pbombs">${'💣'.repeat(pick.bombs) || '0'}</b> / 3</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:10px" data-aa="books">${books}</div>`);
  m.el.querySelector('.cx-modal-close').style.display = 'none';
  m.el.onclick = null;
  m.el.querySelector('[data-aa="books"]').onclick = e => {
    const b = e.target.closest('.aa-book');
    if (!b || b.disabled || !aaPick || aaPick.busy) return;
    aaPick.busy = true;
    b.style.transform = 'rotateY(90deg)';
    socket.emit('casinoAAPick', cxAuth({ index: Number(b.dataset.i) }));
  };
  aaPick.modal = m;
}
function aaBookFace(it) {
  if (!it) return '📕';
  if (it.type === 'bomb') return '💣';
  if (it.type === 'fs') return `<span style="font-size:16px">🎁<br>+${it.value} FS</span>`;
  return `<span style="font-size:16px;color:var(--cx-gold)">×${it.value}</span>`;
}
socket.on('casinoAAPickResult', d => {
  if (!aaPick || !aaKit) return;
  const m = aaPick.modal;
  const b = m.el.querySelector(`.aa-book[data-i="${d.index}"]`);
  aaPick.busy = false;
  if (b) {
    b.disabled = true;
    b.innerHTML = aaBookFace(d.item);
    b.style.transform = '';
    b.style.background = d.item.type === 'bomb' ? 'linear-gradient(160deg,#5a0f26,#2a0612)' : 'linear-gradient(160deg,#3d2a08,#1a1204)';
    b.style.borderColor = d.item.type === 'bomb' ? '#ff5c7a' : '#ffd36b';
  }
  cxSound.play(d.item.type === 'bomb' ? 'lose' : 'chip');
  if (d.cash) cxFloat(d.cash, b);
  m.el.querySelector('[data-aa="ptotal"]').textContent = cxFmt(d.pick.total) + ' AT$';
  m.el.querySelector('[data-aa="pfs"]').textContent = d.pick.fs;
  m.el.querySelector('[data-aa="pbombs"]').textContent = '💣'.repeat(d.pick.bombs) || '0';
  cxSetBalance(d.balance);
  aaKit.stats.won += d.cash; aaKit.session.won += d.cash; aaKit.renderStats();
  if (d.pick.done) {
    d.pick.board.forEach((it, i) => { const bb = m.el.querySelector(`.aa-book[data-i="${i}"]`); if (bb && !bb.disabled) { bb.disabled = true; bb.innerHTML = aaBookFace(it); bb.style.opacity = '.45'; } });
    setTimeout(async () => {
      m.close();
      const pick = aaPick; aaPick = null;
      if (d.pick.total > 0) await cxBigWin({ amount: d.pick.total, bet: d.pick.bet, tier: d.pick.total >= d.pick.bet * 25 ? 'huge' : 'mega', title: '📚 BONUS PICK' });
      if (d.fsAwarded) {
        aaKit.free = d.freeSpins; aaKit.freeBet = d.pick.bet; aaKit.updateBet();
        aaKit.banner(`📚 FREE SPINS: <b>${d.freeSpins}</b> · mnożnik zostaje między spinami`, 'purple');
        setTimeout(() => aaKit && !aaKit.spinning && aaKit.spin(), 900);
      }
    }, 1600);
  }
});
socket.on('casinoAAState', s => {
  if (!aaKit) return;
  if (s.pick) aaOpenPick(s.pick);
  if (s.freeSpins > 0) { aaKit.free = s.freeSpins; aaKit.freeBet = s.freeBet; aaSetMult(s.fsMult || 1); aaKit.updateBet(); aaKit.banner(`📚 FREE SPINS: <b>${s.freeSpins}</b>`, 'purple'); }
});
skBindResult('casinoAAResult', () => aaKit);
