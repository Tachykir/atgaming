// ══════════════════════════════════════════════════════════════
//  MEGA WHEEL — 5×3, 20 linii, 🎡 na bębnach 1/3/5 = KOŁO FORTUNY na cały ekran
// ══════════════════════════════════════════════════════════════
const MW_SYMS = ['7', '💎', '🔔', '🍉', '🍇', '🍋', '🍒', '🌟', '🎡'];
const MW_COLORS = ['#ff3b6b', '#4fe3ff', '#ffd36b', '#3ff2a3', '#b06bff', '#f2e24a', '#ff5c7a', '#ffd36b', '#ff5fb3'];
const MW = { WILD: 7, SC: 8 };
const MW_POOL = [0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7];
const MW_POOL_FS = MW_POOL.concat([7, 7, 7]);
const MW_LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,0,2,0,0],
];
// Układ koła — identyczny jak na serwerze (games/casino/mega_wheel.js)
const MW_WHEEL = [
  { k: 'm', m: 10 }, { k: 'fs', fs: 8 }, { k: 'm', m: 25 }, { k: 'jp', jp: 'mini' },
  { k: 'm', m: 15 }, { k: 'm', m: 100 }, { k: 're' }, { k: 'm', m: 20 },
  { k: 'm', m: 50 }, { k: 'jp', jp: 'grand' }, { k: 'm', m: 10 }, { k: 'm', m: 250 },
  { k: 'fs', fs: 8 }, { k: 'm', m: 15 }, { k: 'm', m: 75 }, { k: 'jp', jp: 'major' },
  { k: 'm', m: 20 }, { k: 'm', m: 500 }, { k: 're' }, { k: 'm', m: 10 },
  { k: 'm', m: 25 }, { k: 'm', m: 1000 }, { k: 'm', m: 15 }, { k: 'm', m: 50 },
];
const MW_JP = { mini: 50, major: 200, grand: 1000 };
const MW_JP_LABEL = { mini: 'MINI', major: 'MAJOR', grand: 'GRAND' };
const MW_JP_COLOR = { mini: '#3d7bff', major: '#e8173a', grand: '#ffd36b' };
const MW_FX_COLORS = ['#ff5fb3', '#ffd36b', '#b06bff', '#ffffff', '#4fe3ff'];
let mwKit = null, mwFree = false;

function mwMult(m, k) { const v = m * (k || 1); return '×' + (v >= 100 ? Math.round(v) : +v.toFixed(1)).toLocaleString('pl-PL'); }

function mwCss() {
  if (document.getElementById('casino-mw-css')) return;
  const st = document.createElement('style');
  st.id = 'casino-mw-css';
  st.textContent = `
#screen-casino-mw .sk-machine { background: radial-gradient(ellipse at 50% -10%, rgba(255,95,179,.28), transparent 60%), linear-gradient(160deg, #2a0820, #12031a 60%, #0a0210); box-shadow: 0 0 0 3px rgba(255,95,179,.55), 0 0 0 6px rgba(255,211,107,.25), 0 0 46px rgba(255,95,179,.35); }
#screen-casino-mw .sk-machine::after { content: ''; position: absolute; inset: 5px; border-radius: 22px; pointer-events: none; z-index: 1; border: 5px dotted rgba(255,211,107,.85); filter: drop-shadow(0 0 4px #ffd36b); animation: mwBulbs 0.9s steps(2) infinite; opacity: .55; }
#screen-casino-mw .sk-machine.anticipating::after { animation-duration: .25s; opacity: .95; }
@keyframes mwBulbs { 0% { border-color: rgba(255,211,107,.95); } 50% { border-color: rgba(255,95,179,.95); } 100% { border-color: rgba(255,211,107,.95); } }
#screen-casino-mw .sk-logo { color: #fff; text-shadow: 0 0 6px #ff5fb3, 0 0 18px #ff5fb3, 0 0 30px #b06bff; animation: mwNeon 3.2s infinite; }
@keyframes mwNeon { 0%, 18%, 22%, 60%, 64%, 100% { opacity: 1; } 20%, 62% { opacity: .55; } }
.mw-jpbar { display: flex; gap: 6px; flex: 2; min-width: 220px; }
.mw-jpbar > div { flex: 1; text-align: center; padding: 5px 4px; border-radius: 10px; background: rgba(0,0,0,.4); border: 1px solid color-mix(in srgb, var(--c) 60%, transparent); box-shadow: inset 0 0 12px color-mix(in srgb, var(--c) 25%, transparent); }
.mw-jpbar small { display: block; font: 800 10px 'Syne', sans-serif; letter-spacing: .12em; color: var(--c); }
.mw-jpbar b { font: 700 13px 'DM Mono', monospace; color: #fff; }
@media (orientation: landscape) and (max-height: 540px) { .mw-jpbar > div { display: flex; align-items: baseline; justify-content: center; gap: 5px; padding: 2px 4px; } .mw-jpbar small { display: inline; font-size: 9px; } .mw-jpbar b { font-size: 12px; } }
.mw-wov { position: fixed; inset: 0; z-index: 2430; display: flex; align-items: center; justify-content: center; gap: 2vmin; overflow: hidden; cursor: default;
  background: radial-gradient(circle at 50% 50%, rgba(140,20,100,.6), rgba(30,4,40,.92) 45%, rgba(6,1,10,.97) 75%); animation: cxFade .3s; }
.mw-wov.out { opacity: 0; transition: opacity .35s; }
.mw-rays { position: absolute; left: 50%; top: 50%; width: 220vmax; height: 220vmax; margin: -110vmax 0 0 -110vmax; pointer-events: none; opacity: .28;
  background: repeating-conic-gradient(from 0deg, rgba(255,95,179,.55) 0deg 7deg, transparent 7deg 15deg, rgba(255,211,107,.45) 15deg 22deg, transparent 22deg 30deg); animation: mwRays 24s linear infinite; }
.mw-wov.spinning .mw-rays { animation-duration: 5s; opacity: .4; }
@keyframes mwRays { to { transform: rotate(360deg); } }
.mw-fxc { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
.mw-stage { position: relative; flex: none; width: min(90vw, 90vh); height: min(90vw, 90vh); z-index: 2; }
.mw-stage canvas { width: 100%; height: 100%; display: block; }
.mw-side { position: relative; z-index: 3; display: flex; flex-direction: column; gap: 10px; align-items: center; text-align: center; min-width: 0; flex: 1 1 0; max-width: 300px; }
.mw-title { font: 800 clamp(18px, 3.4vmin, 38px)/1.05 'Syne', sans-serif; color: #fff; letter-spacing: .04em; text-shadow: 0 0 8px #ff5fb3, 0 0 24px #ff5fb3, 0 0 42px #b06bff; animation: mwNeon 2.6s infinite; }
.mw-sub { font-size: clamp(11px, 1.8vmin, 15px); color: rgba(255,255,255,.75); }
.mw-chain { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
.mw-chain span { font: 800 clamp(11px, 1.8vmin, 15px) 'DM Mono', monospace; padding: 3px 8px; border-radius: 999px; background: rgba(255,90,54,.25); border: 1px solid #ff5a36; color: #ffd0c4; animation: mwChip .45s cubic-bezier(.3,1.8,.5,1); }
.mw-chain span.fin { background: rgba(255,211,107,.2); border-color: #ffd36b; color: #ffd36b; }
@keyframes mwChip { from { transform: scale(0); } to { transform: scale(1); } }
.mw-dbl { font: 800 clamp(20px, 4.5vmin, 46px)/1 'Syne', sans-serif; color: #ff8a5c; text-shadow: 0 0 16px #ff5a36; display: none; }
.mw-dbl.on { display: block; animation: mwChip .5s cubic-bezier(.3,1.8,.5,1); }
.mw-jps { display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 230px; }
.mw-jps div { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 5px 10px; border-radius: 10px; background: rgba(0,0,0,.45); border: 1px solid color-mix(in srgb, var(--c) 70%, transparent); font-size: clamp(11px, 1.8vmin, 14px); }
.mw-jps div.hit { animation: mwJpHit .35s steps(2) 8; box-shadow: 0 0 22px var(--c); }
@keyframes mwJpHit { 50% { background: color-mix(in srgb, var(--c) 55%, transparent); } }
.mw-jps small { font: 800 1em 'Syne', sans-serif; color: var(--c); letter-spacing: .1em; }
.mw-jps b { font-family: 'DM Mono', monospace; color: #fff; }
.mw-total { font: 800 clamp(16px, 3.6vmin, 34px)/1.1 'Syne', sans-serif; color: var(--cx-gold, #ffd36b); text-shadow: 0 0 18px rgba(255,211,107,.6); min-height: 1.1em; }
.mw-hint { font-size: 11px; color: rgba(255,255,255,.5); }
.mw-pop { position: absolute; left: 50%; top: 50%; z-index: 4; transform: translate(-50%, -50%); text-align: center; pointer-events: none; white-space: nowrap; animation: mwPop .6s cubic-bezier(.2,1.7,.4,1) both; }
.mw-pop small { display: block; font: 800 clamp(12px, 3vmin, 26px) 'Syne', sans-serif; letter-spacing: .14em; color: #fff; text-shadow: 0 0 10px var(--c, #ff5fb3); }
.mw-pop b { display: block; font: 800 clamp(34px, 12vmin, 120px)/1 'Syne', sans-serif; background: linear-gradient(180deg, #fff, var(--c, #ffd36b)); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 6px 0 rgba(0,0,0,.5)) drop-shadow(0 0 30px var(--c, #ffd36b)); }
.mw-pop i { display: block; font: 700 clamp(14px, 3.6vmin, 34px) 'DM Mono', monospace; font-style: normal; color: #ffd36b; text-shadow: 0 2px 0 #000, 0 0 16px rgba(255,211,107,.7); margin-top: 4px; }
.mw-pop.out { animation: mwPopOut .35s ease-in forwards; }
@keyframes mwPop { from { transform: translate(-50%, -50%) scale(.2) rotate(-8deg); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
@keyframes mwPopOut { to { transform: translate(-50%, -50%) scale(1.4); opacity: 0; } }
.mw-jpfull { position: fixed; inset: 0; z-index: 2445; display: grid; place-items: center; pointer-events: none; background: radial-gradient(circle, color-mix(in srgb, var(--c) 45%, transparent), transparent 70%); animation: mwJpBg 2.6s ease-out forwards; text-align: center; }
.mw-jpfull > div { animation: mwJpTxt 2.6s cubic-bezier(.2,1.5,.4,1) forwards; }
.mw-jpfull b { display: block; font: 800 clamp(60px, 22vmin, 240px)/.95 'Syne', sans-serif; background: linear-gradient(180deg, #fff 10%, var(--c) 60%, #7a4a00); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 8px 0 rgba(0,0,0,.55)) drop-shadow(0 0 50px var(--c)); }
.mw-jpfull small { display: block; font: 800 clamp(22px, 7vmin, 70px) 'Syne', sans-serif; letter-spacing: .3em; color: #fff; text-shadow: 0 0 20px var(--c), 0 4px 0 #000; }
.mw-jpfull i { display: block; font: 700 clamp(20px, 6vmin, 56px) 'DM Mono', monospace; font-style: normal; color: #ffd36b; text-shadow: 0 3px 0 #000, 0 0 24px #ffd36b; margin-top: 8px; }
@keyframes mwJpBg { 0% { opacity: 0; } 10% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes mwJpTxt { 0% { transform: scale(3) rotate(-6deg); opacity: 0; } 18% { transform: scale(1); opacity: 1; } 82% { transform: scale(1.04); opacity: 1; } 100% { transform: scale(.85); opacity: 0; } }
@media (max-aspect-ratio: 5/4) {
  .mw-wov { flex-direction: column; gap: 1.5vmin; }
  .mw-stage { width: min(92vw, 70vh); height: min(92vw, 70vh); }
  .mw-side { flex: none; max-width: 92vw; width: 92vw; }
  .mw-side.r { flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .mw-jps { flex-direction: row; max-width: none; }
  .mw-jps div { flex: 1; flex-direction: column; gap: 0; padding: 3px 6px; }
}
@media (max-height: 500px) {
  .mw-jpbar > div { display: flex; gap: 5px; justify-content: center; align-items: baseline; padding: 1px 4px; }
  .mw-jpbar small { display: inline; font-size: 9px; }
  .mw-jpbar b { font-size: 11px; }
}
@media (max-height: 500px) and (min-aspect-ratio: 5/4) {
  .mw-side { gap: 5px; }
  .mw-jps div { padding: 3px 7px; }
}`;
  document.head.appendChild(st);
}

function mwSymHTML(i) {
  if (i === 0) return { html: '<span style="font-size:1.2em;font-style:italic;font-weight:900">7</span>', tile: 'letter', color: MW_COLORS[0] };
  return { html: `<span class="sk-emo">${MW_SYMS[i]}</span>`, color: MW_COLORS[i], cls: i === MW.WILD ? 'wild' : i === MW.SC ? 'scatter' : '' };
}

function mwJpBar(bet) {
  return `<div class="sk-meter" style="flex:2"><div class="sk-meter-top"><span>🎡 3 scattery (bębny 1·3·5) = KOŁO FORTUNY</span><b>do ×${(1000 * cxK('mega_wheel')).toLocaleString('pl-PL', { maximumFractionDigits: 0 })}</b></div>
    <div class="mw-jpbar">${Object.entries(MW_JP).map(([k, m]) => `<div style="--c:${MW_JP_COLOR[k]}"><small>${MW_JP_LABEL[k]}</small><b data-mw-jp="${k}">${cxShort(m * bet * cxK('mega_wheel'))}</b></div>`).join('')}</div></div>`;
}

// ── Koło fortuny na cały ekran ───────────────────────────────
function mwSegStyle(s, i) {
  if (s.k === 'jp') return { bg: s.jp === 'grand' ? '#1d0b26' : MW_JP_COLOR[s.jp], fg: s.jp === 'grand' ? '#ffd36b' : '#fff', edge: s.jp === 'grand' ? '#ffd36b' : null };
  if (s.k === 'fs') return { bg: '#13c495', fg: '#fff' };
  if (s.k === 're') return { bg: '#ff5a36', fg: '#fff' };
  if (s.m >= 250) return { bg: '#ffd36b', fg: '#4a1a00' };
  if (s.m >= 50) return { bg: '#ff9a2e', fg: '#2a0a00' };
  return { bg: i % 2 ? '#8b3dff' : '#ff3d9a', fg: '#fff' };
}
function mwSegText(s, k) {
  if (s.k === 'm') return [mwMult(s.m, k)];
  if (s.k === 'fs') return ['+' + s.fs, 'FREE SPINS'];
  if (s.k === 're') return ['RESPIN', '×2'];
  return [MW_JP_LABEL[s.jp], 'JACKPOT'];
}
function mwRenderWheel(S, k) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const R = S / 2, n = MW_WHEEL.length, seg = Math.PI * 2 / n;
  ctx.translate(R, R);
  // Segmenty (indeks 0 zaczyna się na kącie 0 i idzie zgodnie z ruchem wskazówek)
  MW_WHEEL.forEach((s, i) => {
    const st = mwSegStyle(s, i);
    const a0 = i * seg, a1 = (i + 1) * seg;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * .995, a0, a1); ctx.closePath();
    ctx.fillStyle = st.bg; ctx.fill();
    // Połysk
    const sh = ctx.createRadialGradient(0, 0, R * .2, 0, 0, R);
    sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(.6, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = sh; ctx.fill();
    ctx.lineWidth = S * .005; ctx.strokeStyle = 'rgba(255,230,170,.9)'; ctx.stroke();
    if (st.edge) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R * .985, a0 + .01, a1 - .01); ctx.lineWidth = S * .008; ctx.strokeStyle = st.edge; ctx.stroke(); ctx.restore(); }
    // Tekst promieniście
    const lines = mwSegText(s, k);
    ctx.save(); ctx.rotate(a0 + seg / 2);
    ctx.fillStyle = st.fg; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = S * .006; ctx.shadowOffsetY = S * .002;
    if (lines.length === 1) {
      const fs = lines[0].length > 5 ? S * .046 : S * .056;
      ctx.font = `800 ${fs}px Syne, sans-serif`; ctx.fillText(lines[0], R * .9, 0);
    } else {
      ctx.font = `800 ${S * .036}px Syne, sans-serif`; ctx.fillText(lines[0], R * .9, -S * .012);
      ctx.font = `700 ${S * .018}px Syne, sans-serif`; ctx.fillText(lines[1], R * .9, S * .02);
    }
    ctx.restore();
  });
  // Pierścień wewnętrzny
  ctx.beginPath(); ctx.arc(0, 0, R * .3, 0, Math.PI * 2); ctx.lineWidth = S * .008; ctx.strokeStyle = 'rgba(255,211,107,.7)'; ctx.stroke();
  return cv;
}

function mwWheel(res, kit) {
  return new Promise(resolve => {
    const wheel = res.wheel, k = res.rtpScale || cxK('mega_wheel'), turbo = kit.turbo;
    const ov = document.createElement('div');
    ov.className = 'mw-wov';
    const jpAmt = Object.fromEntries((res.jackpots || []).map(j => [j.jp, j.amount]));
    ov.innerHTML = `<div class="mw-rays"></div><canvas class="mw-fxc"></canvas>
      <div class="mw-side l"><div class="mw-title">🎡 KOŁO<br>FORTUNY</div><div class="mw-sub" data-mw="sub">${mwFree ? 'Free Spin — koło wraca!' : 'Trzy scattery! Kręcimy…'}</div><div class="mw-dbl" data-mw="dbl"></div><div class="mw-chain" data-mw="chain"></div></div>
      <div class="mw-stage"><canvas></canvas></div>
      <div class="mw-side r"><div class="mw-jps">${Object.entries(MW_JP).map(([j, m]) => `<div style="--c:${MW_JP_COLOR[j]}" data-mw-j="${j}"><small>${MW_JP_LABEL[j]}</small><b>${cxShort(jpAmt[j] ?? m * res.bet * k)}</b></div>`).join('')}</div>
        <div class="mw-total" data-mw="total"></div><div class="mw-hint" data-mw="hint"></div></div>`;
    document.body.appendChild(ov);
    const $ = s => ov.querySelector(`[data-mw="${s}"]`);
    const stage = ov.querySelector('.mw-stage'), cv = stage.querySelector('canvas'), ctx = cv.getContext('2d');
    const fxCv = ov.querySelector('.mw-fxc');
    let alive = true;
    const fx = new CxFx({ canvas: () => fxCv, theme: () => ({ colors: MW_FX_COLORS }), alive: () => alive });
    const css = stage.getBoundingClientRect().width;
    const D = Math.min(2, devicePixelRatio || 1);
    const S = Math.round(css * D);
    cv.width = cv.height = S;
    const R = S / 2, WR = R * .86; // promień koła (rama + żarówki na zewnątrz)
    const img = mwRenderWheel(Math.round(WR * 2), k);
    const n = MW_WHEEL.length, seg = Math.PI * 2 / n, BULBS = 48;
    let ang = Math.random() * Math.PI * 2, flap = 0, mode = 'idle', winSeg = -1, hub = '🎡', hubC = '#ffd36b', lastIdx = null, lastTick = 0, vel = 0;
    const center = () => { const r = stage.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; };

    const draw = t => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, S, S);
      ctx.translate(R, R);
      // poświata
      const gl = ctx.createRadialGradient(0, 0, WR * .8, 0, 0, R);
      gl.addColorStop(0, 'rgba(255,95,179,.55)'); gl.addColorStop(1, 'rgba(255,95,179,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      // koło
      ctx.save(); ctx.rotate(ang);
      ctx.drawImage(img, -WR, -WR, WR * 2, WR * 2);
      if (winSeg >= 0) {
        const pulse = .35 + .3 * Math.sin(t / 90);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, WR * .995, winSeg * seg, (winSeg + 1) * seg); ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${pulse})`; ctx.fill();
        ctx.lineWidth = S * .012; ctx.strokeStyle = '#fff'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = S * .04; ctx.stroke(); ctx.shadowBlur = 0;
      }
      // przyciemnienie pozostałych przy wygranej
      ctx.restore();
      // rama
      const rim = ctx.createLinearGradient(-R, -R, R, R);
      rim.addColorStop(0, '#fff3c4'); rim.addColorStop(.3, '#ffb02e'); rim.addColorStop(.55, '#8a4b00'); rim.addColorStop(.8, '#ffd36b'); rim.addColorStop(1, '#fff3c4');
      ctx.beginPath(); ctx.arc(0, 0, WR + R * .065, 0, Math.PI * 2); ctx.moveTo(WR - R * .005, 0); ctx.arc(0, 0, WR - R * .005, 0, Math.PI * 2, true);
      ctx.fillStyle = rim; ctx.fill('evenodd');
      ctx.beginPath(); ctx.arc(0, 0, WR + R * .065, 0, Math.PI * 2); ctx.lineWidth = S * .006; ctx.strokeStyle = '#3a1500'; ctx.stroke();
      // żarówki
      const step = Math.floor(t / (mode === 'spin' ? Math.max(25, 90 - Math.abs(vel) * 900) : mode === 'win' ? 110 : 420));
      for (let i = 0; i < BULBS; i++) {
        const a = i / BULBS * Math.PI * 2;
        const x = Math.cos(a) * (WR + R * .033), y = Math.sin(a) * (WR + R * .033);
        const on = mode === 'spin' ? (i + step) % 4 === 0 || (i + step) % 4 === 1 : mode === 'win' ? step % 2 === 0 : (i + step) % 2 === 0;
        const br = R * .02;
        if (on) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, br * 2.6);
          const col = mode === 'win' ? (i % 2 ? '#ff5fb3' : '#fff3c4') : '#fff3c4';
          g.addColorStop(0, '#fff'); g.addColorStop(.35, col); g.addColorStop(1, 'rgba(255,200,80,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, br * 2.6, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = '#6b3a12'; ctx.beginPath(); ctx.arc(x, y, br * .8, 0, Math.PI * 2); ctx.fill();
        }
      }
      // piasta
      const hg = ctx.createRadialGradient(-WR * .05, -WR * .05, 0, 0, 0, WR * .24);
      hg.addColorStop(0, '#5b1a6e'); hg.addColorStop(1, '#16031f');
      ctx.beginPath(); ctx.arc(0, 0, WR * .22, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
      ctx.lineWidth = S * .012; ctx.strokeStyle = rim; ctx.stroke();
      ctx.fillStyle = hubC; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = hubC; ctx.shadowBlur = S * .02;
      const hs = hub.length > 6 ? S * .045 : hub.length > 4 ? S * .055 : S * .07;
      ctx.font = `800 ${hs}px Syne, sans-serif`; ctx.fillText(hub, 0, S * .004);
      ctx.shadowBlur = 0;
      // wskaźnik (u góry, odbija się na kołkach)
      ctx.save(); ctx.translate(0, -WR - R * .07); ctx.rotate(flap);
      ctx.beginPath(); ctx.moveTo(-R * .06, -R * .03); ctx.lineTo(R * .06, -R * .03); ctx.lineTo(0, R * .13); ctx.closePath();
      const pg = ctx.createLinearGradient(0, -R * .03, 0, R * .13); pg.addColorStop(0, '#fff3c4'); pg.addColorStop(1, '#ff3d9a');
      ctx.fillStyle = pg; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = S * .015; ctx.fill();
      ctx.lineWidth = S * .005; ctx.strokeStyle = '#3a1500'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * .028, 0, Math.PI * 2); ctx.fillStyle = '#ffd36b'; ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    let raf = null;
    const loop = t => { if (!alive) return; flap *= .86; draw(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    const idxAtPointer = a => { const p = ((-Math.PI / 2 - a) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2); return Math.floor(p / seg); };
    const spinTo = (segIdx, turns) => new Promise(done => {
      mode = 'spin'; winSeg = -1; ov.classList.add('spinning');
      const jitter = (Math.random() - .5) * .62;
      const want = (segIdx + .5 + jitter) * seg;
      let target = -Math.PI / 2 - want;
      const a0 = ang;
      while (target < a0 + Math.PI * 2 * turns) target += Math.PI * 2;
      const dur = turbo ? 2300 : 5200, wind = turbo ? 0 : 380;
      const t0 = performance.now();
      let prev = a0;
      const step = now => {
        if (!alive) return done();
        const el = now - t0;
        if (el < wind) { ang = a0 - .14 * Math.sin(el / wind * Math.PI / 2); }
        else {
          const p = Math.min(1, (el - wind) / dur);
          // rozpędzanie (pierwsze 10%) i długie zwalnianie
          const e = p < .1 ? .1 * Math.pow(p / .1, 2) * .55 : .055 + .945 * (1 - Math.pow(1 - (p - .1) / .9, 3.4));
          ang = (a0 - .14) + (target - a0 + .14) * Math.min(1, e);
          if (p >= 1) { ang = target; vel = 0; ov.classList.remove('spinning'); return done(); }
        }
        vel = ang - prev; prev = ang;
        const idx = idxAtPointer(ang);
        if (lastIdx !== null && idx !== lastIdx) {
          flap = Math.max(-.6, Math.min(.6, -Math.sign(vel || 1) * (.25 + Math.min(.35, Math.abs(vel) * 3))));
          if (now - lastTick > 32) { cxSound.play('tick'); lastTick = now; }
        }
        lastIdx = idx;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const pop = (label, big, amt, color, ms) => {
      const p = document.createElement('div');
      p.className = 'mw-pop'; p.style.setProperty('--c', color);
      p.innerHTML = `<small>${label}</small><b>${big}</b>${amt ? `<i>${amt}</i>` : ''}`;
      stage.appendChild(p);
      setTimeout(() => { p.classList.add('out'); setTimeout(() => p.remove(), 350); }, ms);
    };
    const boom = (big) => {
      const c = center();
      const W = innerWidth, H = innerHeight;
      fx.emit(c.x, c.y, 'ring', 2, { scale: 1.6 });
      fx.emit(c.x, c.y, 'star', big ? 60 : 30, { spread: c.r * .5, scale: 1.8, speed: 2.2 });
      fx.emit(c.x, c.y, 'coin', big ? 40 : 18, { spread: c.r * .3, scale: 1.4, speed: 1.8 });
      for (let i = 0; i < (big ? 14 : 8); i++) setTimeout(() => fx.emit(W * Math.random(), -10, 'confetti', 14, { spread: 40, scale: 1.6, speed: 1.4 }), i * 60);
      fx.emit(W * .05, H, 'confetti', big ? 50 : 25, { spread: 30, scale: 1.6, speed: 2.6 });
      fx.emit(W * .95, H, 'confetti', big ? 50 : 25, { spread: 30, scale: 1.6, speed: 2.6 });
    };
    const jackpotFull = (jp, amount) => {
      const el = document.createElement('div');
      el.className = 'mw-jpfull'; el.style.setProperty('--c', MW_JP_COLOR[jp]);
      el.innerHTML = `<div><b>${MW_JP_LABEL[jp]}</b><small>JACKPOT</small><i>+${cxFmt(amount)} AT$</i></div>`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2700);
    };
    const chainEl = $('chain');
    const chip = (txt, fin) => { const s = document.createElement('span'); if (fin) s.className = 'fin'; s.textContent = txt; chainEl.appendChild(s); };

    (async () => {
      await kit.wait(turbo ? 250 : 700);
      for (let i = 0; i < wheel.spins.length; i++) {
        const sp = wheel.spins[i], s = MW_WHEEL[sp.seg];
        $('sub').textContent = i === 0 ? 'Kręcimy kołem…' : `Respin ${i} — wynik ×${sp.k === 're' ? sp.dbl / 2 : sp.dbl}`;
        hub = '🎡'; hubC = '#ffd36b';
        cxSound.play('feature');
        await spinTo(sp.seg, i === 0 ? (turbo ? 3 : 6) : (turbo ? 2 : 4));
        winSeg = sp.seg; mode = 'win';
        cxSound.play('stop');
        if (sp.k === 're') {
          hub = 'RESPIN'; hubC = '#ff8a5c';
          cxSound.play('scwin');
          boom(false);
          pop('RESPIN KOŁA', '×2', 'wynik podwojony!', '#ff5a36', turbo ? 700 : 1300);
          chip('RESPIN ×2');
          const d = $('dbl'); d.textContent = `WYNIK ×${sp.dbl}`; d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
          await kit.wait(turbo ? 900 : 1700);
          continue;
        }
        // Wynik końcowy
        const dblTxt = sp.dbl > 1 ? ` (×${sp.dbl})` : '';
        if (sp.k === 'm') {
          hub = mwMult(sp.x, k); hubC = sp.m >= 250 ? '#ffd36b' : '#fff';
          cxSound.play('bigwin');
          boom(sp.x >= 100);
          pop('MNOŻNIK STAWKI' + dblTxt, mwMult(sp.x, k), `+${cxFmt(wheel.amount)} AT$`, mwSegStyle(s, sp.seg).bg, turbo ? 1100 : 2200);
          if (sp.x >= 50) cxMultFlash(sp.x * k, MW_FX_COLORS);
          chip(mwMult(sp.x, k), true);
        } else if (sp.k === 'jp') {
          hub = MW_JP_LABEL[sp.jp]; hubC = MW_JP_COLOR[sp.jp];
          cxSound.play('scwin'); cxSound.play('bigwin');
          boom(true); setTimeout(() => boom(true), 500);
          jackpotFull(sp.jp, wheel.amount);
          cxMultFlash(sp.x * k, [MW_JP_COLOR[sp.jp], '#fff']);
          ov.querySelector(`[data-mw-j="${sp.jp}"]`)?.classList.add('hit');
          chip(MW_JP_LABEL[sp.jp] + dblTxt, true);
          await kit.wait(turbo ? 1200 : 2200);
          pop(MW_JP_LABEL[sp.jp] + ' JACKPOT' + dblTxt, mwMult(sp.x, k), `+${cxFmt(wheel.amount)} AT$`, MW_JP_COLOR[sp.jp], turbo ? 900 : 1800);
        } else if (sp.k === 'fs') {
          hub = '+' + sp.fs + ' FS'; hubC = '#3ff2c0';
          cxSound.play('scwin');
          boom(false);
          pop('FREE SPINS' + dblTxt, '+' + sp.fs, 'więcej 🌟 Wildów!', '#13c495', turbo ? 1100 : 2200);
          chip('+' + sp.fs + ' FS', true);
        }
        $('sub').textContent = 'Koniec kręcenia';
        $('total').innerHTML = wheel.amount > 0 ? `+${cxFmt(wheel.amount)} AT$` : `+${sp.fs} FREE SPINS`;
      }
      $('hint').textContent = 'dotknij, aby kontynuować';
      let closed = false;
      const close = () => {
        if (closed) return; closed = true;
        ov.classList.add('out');
        setTimeout(() => { alive = false; cancelAnimationFrame(raf); ov.remove(); resolve(); }, 380);
      };
      ov.addEventListener('click', close);
      setTimeout(close, turbo ? 1200 : 2600);
    })();
  });
}

function initMWUI(table) {
  mwCss();
  mwFree = false;
  mwKit = new SlotKit({
    screenId: 'casino-mw', game: 'mega_wheel', title: 'Mega Wheel', icon: '🎡', subtitle: '5×3 · 20 linii · Koło Fortuny do ×1000 · 3 jackpoty',
    theme: { a: '#ff5fb3', b: '#ffd36b' },
    cols: 5, rows: 3, event: 'casinoMWSpin', lineCount: 20, boardMaxWidth: '640px',
    randomSym: () => { const p = mwFree ? MW_POOL_FS : MW_POOL; return p[Math.floor(Math.random() * p.length)]; },
    symHTML: mwSymHTML,
    scatter: {
      is: i => i === MW.SC, icon: '🎡', need: 3, fx: 'cosmic',
      theme: { colors: MW_FX_COLORS, land: [['star', 12], ['confetti', 12], ['ring', 1]], ant: 'star', win: [['confetti', 50], ['star', 26], ['coin', 14], ['ring', 2]] },
    },
    features: () => mwJpBar(table.config.minBet),
    onBetChange: bet => Object.entries(MW_JP).forEach(([j, m]) => { const el = mwKit?.root.querySelector(`[data-mw-jp="${j}"]`); if (el) el.textContent = cxShort(m * bet * cxK('mega_wheel')); }),
    rules: [
      '20 linii, wygrane od lewej, min. 3 takie same symbole. 🌟 Gwiazda (Wild, bębny 2–5) zastępuje każdy symbol poza scatterem.',
      '🎡 Scatter pojawia się tylko na bębnach 1, 3 i 5. Trzy scattery uruchamiają KOŁO FORTUNY na cały ekran.',
      'Koło ma 24 segmenty: mnożniki stawki ×10, ×15, ×20, ×25, ×50, ×75, ×100, ×250, ×500, ×1000 (im wyższy, tym rzadszy), „+8 FREE SPINS”, „RESPIN KOŁA ×2” oraz jackpoty MINI ×50, MAJOR ×200 i GRAND ×1000.',
      'RESPIN KOŁA ×2: koło kręci się jeszcze raz, a wynik zostaje podwojony (także liczba free spinów). Respiny łączą się w łańcuch — maks. ×8.',
      'Free Spiny: 🌟 Wildy pojawiają się znacznie częściej, a trzy scattery mogą ponownie uruchomić koło.',
      'Maksymalna wygrana: 10 000× stawki na spin.',
      'RTP ≈ 95%.',
    ],
    async present(res, kit) {
      mwFree = res.mode === 'free';
      await kit.stop(res.grid);
      if (res.winLines.length) { kit.showLineWins(res.winLines, MW_LINES); if (res.wheel) await kit.wait(kit.turbo ? 400 : 1100); }
      if (res.wheel) {
        kit.clearWins();
        await kit.scatterWin(res.scatter);
        await kit.splash('KOŁO FORTUNY', 'Trzy scattery — kręcimy wielkim kołem!', '🎡');
        await mwWheel(res, kit);
        const f = res.wheel.final;
        if (res.freeSpinsAwarded) await cxSplash({ title: `+${res.freeSpinsAwarded} FREE SPINS`, sub: 'Więcej 🌟 Wildów — koło może wrócić!', icon: '🎡', color: '#13c495' });
        if (res.winLines.length) kit.showLineWins(res.winLines, MW_LINES);
        res._msgSet = true;
        if (res.wheel.amount > 0) kit.countMsg(f.k === 'jp' ? `🏆 ${MW_JP_LABEL[f.jp]} JACKPOT!` : `🎡 Koło fortuny ${mwMult(f.x, res.rtpScale)}!`, res.payout, 'big');
        else kit.msg(`🎡 Koło fortuny: <b>+${res.freeSpinsAwarded} Free Spinów</b>${res.payout > 0 ? ` · <span class="amt">+${cxFmt(res.payout)} AT$</span>` : ''}`, 'feature');
      } else if (res.scatter?.length === 2) {
        kit.highlight(res.scatter, 'main', false, false);
      }
      if (res.capped) kit.msg(`🏆 Maksymalna wygrana! <span class="amt">+${cxFmt(res.payout)} AT$</span>`, 'big');
      kit.banner(res.freeSpinsRemaining > 0 ? `🎡 FREE SPINS: <b>${res.freeSpinsRemaining}</b> · więcej 🌟 Wildów · koło może wrócić` : '', 'gold');
      if (!res.freeSpinsRemaining) mwFree = false; else mwFree = true;
    },
    freeBetOf: res => res.bet,
  });
  mwKit.mount(table);
}
skBindResult('casinoMWResult', () => mwKit);
