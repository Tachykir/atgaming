// ══════════════════════════════════════════════════════════════
//  HOT 777 — klasyk 3×3, Fire Respin, koło mnożników
// ══════════════════════════════════════════════════════════════
const H7_SYMS = ['7', 'BAR', '🔔', '🍉', '🍇', '🍋', '🍒', '🃏'];
const H7_COLORS = ['#ff3b3b', '#ffd36b', '#ffb300', '#3ff2a3', '#a855f7', '#e8d84a', '#ff5c7a', '#c084fc'];
const H7_POOL = [0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7];
const H7_LINES = [[1,1,1],[0,0,0],[2,2,2],[0,1,2],[2,1,0]];
let h7Kit = null;

function h7SymHTML(i) {
  if (i === 0) return { html: '<span style="font-size:1.25em;font-style:italic">7</span>', tile: 'letter', color: H7_COLORS[0] };
  if (i === 1) return { html: '<span style="font-size:.55em;letter-spacing:.05em;padding:4px 8px;border:3px solid #fff;border-radius:8px;background:#111">BAR</span>', tile: 'letter', color: H7_COLORS[1] };
  return { html: `<span class="sk-emo">${H7_SYMS[i]}</span>`, color: H7_COLORS[i], cls: i === 7 ? 'wild' : '' };
}

// Koło mnożników
function h7Wheel(wheel) {
  return new Promise(resolve => {
    const opts = wheel.options, n = opts.length;
    const ov = document.createElement('div');
    ov.className = 'cx-splash';
    ov.style.setProperty('--sp', '#ff3b3b');
    ov.innerHTML = `<div class="sp-box" style="display:flex;flex-direction:column;align-items:center;gap:14px"><div class="sp-title">🔥 KOŁO MNOŻNIKÓW 🔥</div>
      <div style="position:relative;width:300px;height:300px"><canvas width="600" height="600" style="width:100%;height:100%"></canvas>
      <div style="position:absolute;left:50%;top:-6px;transform:translateX(-50%);font-size:34px;filter:drop-shadow(0 4px 6px #000)">🔻</div></div>
      <div class="sp-sub" id="h7w-res">Pełny ekran! Kręcimy…</div></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d');
    const seg = Math.PI * 2 / n, colors = ['#ff3b3b', '#ffd36b', '#ff9f43', '#c084fc', '#3ff2a3'];
    const target = -(wheel.index * seg + seg / 2) - Math.PI / 2 + Math.PI * 2 * 6;
    const t0 = performance.now(), dur = 3200;
    const draw = a => {
      ctx.clearRect(0, 0, 600, 600);
      ctx.save(); ctx.translate(300, 300); ctx.rotate(a);
      for (let i = 0; i < n; i++) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 280, i * seg, (i + 1) * seg); ctx.closePath();
        ctx.fillStyle = colors[i % colors.length]; ctx.fill(); ctx.strokeStyle = '#1a0d00'; ctx.lineWidth = 6; ctx.stroke();
        ctx.save(); ctx.rotate(i * seg + seg / 2); ctx.fillStyle = '#1a0d00'; ctx.font = '800 60px Syne, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×' + opts[i], 180, 0); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.fillStyle = '#1a0d00'; ctx.fill();
      ctx.restore();
    };
    let last = -1;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const a = target * (1 - Math.pow(1 - p, 3.5));
      draw(a);
      const tick = Math.floor(a / seg); if (tick !== last) { last = tick; cxSound.play('tick'); }
      if (p < 1) requestAnimationFrame(step);
      else {
        cxSound.play('bigwin');
        ov.querySelector('#h7w-res').innerHTML = `Mnożnik: <b style="color:var(--cx-gold);font-size:28px">×${wheel.mult}</b>`;
        setTimeout(() => { ov.style.transition = 'opacity .25s'; ov.style.opacity = '0'; setTimeout(() => { ov.remove(); resolve(); }, 250); }, 1400);
      }
    };
    requestAnimationFrame(step);
  });
}

function initH7UI(table) {
  h7Kit = new SlotKit({
    screenId: 'casino-h7', game: 'hot_777', title: 'Hot 777', icon: '🔥', subtitle: '3×3 · 5 linii · Fire Respin · koło ×10',
    theme: { a: '#ff3b3b', b: '#ffd36b' },
    cols: 3, rows: 3, event: 'casinoH7Spin', lineCount: 5, boardMaxWidth: '420px', fontSize: 'clamp(34px, 7vw, 66px)',
    randomSym: () => H7_POOL[Math.floor(Math.random() * H7_POOL.length)],
    symHTML: h7SymHTML,
    rules: [
      '5 linii (3 poziome + 2 skosy), wygrana za 3 takie same symbole na linii. 🃏 Joker zastępuje każdy symbol.',
      '🔥 FIRE RESPIN: jeśli dwa bębny są w całości jednym symbolem, a spin nic nie wygrał — trzeci bęben kręci się jeszcze raz za darmo.',
      '🎡 Pełny ekran jednego symbolu (Jokery się liczą) uruchamia KOŁO MNOŻNIKÓW ×2–×10, które mnoży całą wygraną.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      await kit.stop(res.firstGrid);
      if (res.respin) {
        const c = res.respin.col;
        for (let k = 0; k < 3; k++) if (k !== c) kit.colEl(k).classList.add('expanded');
        kit.msg('🔥 <b>FIRE RESPIN!</b> Ostatni bęben kręci się jeszcze raz', 'feature');
        cxSound.play('feature');
        await kit.wait(700);
        kit.startSpin(null, [c]);
        kit.colEl(c).classList.add('anticip');
        await kit.wait(900);
        await kit.stop(res.grid, 'main', { only: [c] });
        for (let k = 0; k < 3; k++) kit.colEl(k).classList.remove('expanded', 'anticip');
      }
      if (res.wheel) {
        kit.showLineWins(res.winLines, H7_LINES);
        await kit.wait(900);
        await h7Wheel(res.wheel);
        res._msgSet = true;
        kit.countMsg(`🎡 Pełny ekran ×${res.wheel.mult}!`, res.payout, 'big');
      } else kit.showLineWins(res.winLines, H7_LINES);
      if (res.respin && !res.payout) { res._msgSet = true; kit.msg('🔥 Respin bez trafienia — następnym razem!'); }
    },
  });
  h7Kit.mount(table);
}
skBindResult('casinoH7Result', () => h7Kit);
