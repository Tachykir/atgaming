// ══════════════════════════════════════════════════════════════
//  SLOTKIT — wspólny komponent UI automatów
//  Każdy automat podaje konfigurację (plansze, symbole, eventy) i funkcję
//  present(res, kit), która animuje wynik. Kit obsługuje stawki, spin,
//  auto-spin, turbo, free spiny, historię, statystyki i duże wygrane.
// ══════════════════════════════════════════════════════════════

const SK_LINE_COLORS = ['#ffd36b', '#3ff2a3', '#ff6f8a', '#7aa7ff', '#c49bff', '#ff9f43', '#4fe3ff', '#f472b6', '#a3e635', '#fb7185'];
let skActive = null;

// Motywy efektów scatterów: kolory, cząsteczki przy lądowaniu / oczekiwaniu / wyzwoleniu bonusu
const SK_SCATTER_FX = {
  cosmic:  { colors: ['#ffd36b', '#ff7ad9', '#7aa7ff', '#c084fc', '#ffffff'], land: [['star', 14], ['ring', 1]], ant: 'star', win: [['star', 34], ['spark', 18], ['ring', 2]] },
  mist:    { colors: ['#c4b5fd', '#a78bfa', '#e9d5ff', '#94a3b8'], glyphs: 'ᚠᚢᚦᚨᚱᚲᚷᚹ', land: [['smoke', 6], ['glyph', 4], ['ring', 1]], ant: 'smoke', win: [['smoke', 14], ['glyph', 14], ['ring', 2]] },
  fire:    { colors: ['#ff8a3d', '#ffd36b', '#ff3b3b', '#fff3c4'], land: [['ember', 22], ['ring', 1]], ant: 'ember', win: [['ember', 55], ['spark', 18], ['ring', 2]] },
  magic:   { colors: ['#a78bfa', '#4fe3ff', '#f0abfc', '#ffffff'], glyphs: '✦✧⟡✶ᛟᛉ✺', land: [['glyph', 8], ['star', 8], ['ring', 1]], ant: 'glyph', win: [['glyph', 26], ['star', 22], ['ring', 3]] },
  eclipse: { colors: ['#60a5fa', '#ff6f8a', '#e0e7ff', '#a5b4fc'], land: [['ring', 2], ['spark', 12]], ant: 'spark', win: [['ring', 4], ['bolt', 7], ['spark', 28]] },
  neon:    { colors: ['#34f5c5', '#f472b6', '#4fe3ff', '#ffffff'], land: [['bolt', 5], ['spark', 10], ['ring', 1]], ant: 'bolt', win: [['bolt', 12], ['spark', 28], ['ring', 2]] },
  candy:   { colors: ['#ff7ad9', '#7aa7ff', '#ffd36b', '#3ff2a3', '#ff9f43'], land: [['confetti', 18], ['bubble', 6]], ant: 'bubble', win: [['confetti', 60], ['bubble', 14], ['ring', 1]] },
  egypt:   { colors: ['#ffd36b', '#f5a623', '#fff3c4', '#4fc3ff'], land: [['sand', 22], ['ring', 1]], ant: 'sand', win: [['coin', 26], ['sand', 36], ['ring', 2]] },
};

class SlotKit {
  constructor(opts) {
    this.o = Object.assign({ turboDefault: false, stagger: 140, baseSpin: 420, anticipate: null }, opts);
    this.boards = this.o.boards || [{ key: 'main', cols: this.o.cols, rows: this.o.rows }];
    this.spinning = false;
    this.auto = 0;          // pozostałe auto-spiny (Infinity = bez limitu)
    this.turbo = false;
    try { this.turbo = localStorage.getItem('sk_turbo') === '1'; } catch (e) {}
    this.free = 0;
    this.stats = { spins: 0, spent: 0, won: 0, best: 0 };
    this.session = { spins: 0, spent: 0, won: 0 };
    this.history = [];
    this.waiting = null;
    this.grids = {};
    // Scatter: { is(symIdx) → bool, fx: nazwa motywu, need: ile do bonusu, icon }
    this.sc = this.o.scatter ? Object.assign({ need: 3, fx: 'cosmic', icon: '✨' }, this.o.scatter) : null;
    this.scTheme = this.sc ? SK_SCATTER_FX[this.sc.fx] || SK_SCATTER_FX.cosmic : null;
    if (this.sc && !this.o.anticipate && this.boards.length === 1) {
      this.o.anticipate = grid => {
        let n = 0;
        for (let c = 0; c < grid.length; c++) { if (n >= this.sc.need - 1) return c; if (grid[c].some(si => this.sc.is(si))) n++; }
        return null;
      };
    }
  }

  // ── Montaż ekranu ─────────────────────────────────────────
  mount(table) {
    this.table = table;
    const cfg = table.config;
    cxLoadRtp(this.o.game).then(() => { if (this.root && this.steps) this.updateBet(); });
    this.steps = cxBetSteps(cfg.minBet, cfg.maxBet);
    let saved = null;
    try { saved = Number(localStorage.getItem('sk_bet_' + table.id)); } catch (e) {}
    this.betIdx = Math.max(0, this.steps.indexOf(saved));
    this.free = 0; this.auto = 0; this.spinning = false; this.history = [];
    this.session = { spins: 0, spent: 0, won: 0 };

    const screen = cxScreen(this.o.screenId);
    const g = this.o;
    screen.innerHTML = `<div class="cx-shell">
      ${cxTopbar({ icon: g.icon, title: table.name, sub: g.subtitle || '', info: 'skActive && skActive.showInfo()' })}
      <div class="sk-wrap">
        <div class="sk-main">
          <div class="sk-machine" data-sk="machine"${this.sc ? ` data-scfx="${this.sc.fx}"` : ''} style="--sk-a:${g.theme?.a || '#ffd36b'};--sk-b:${g.theme?.b || '#8b6cff'};--scc:${this.scTheme?.colors[0] || '#d79bff'}">
            <canvas class="sk-fx" data-sk="fx"></canvas>
            ${this.sc ? `<div class="sk-sc-counter" data-sk="sccount"><span class="ico">${this.sc.icon}</span><b>0</b><i>/${this.sc.need}</i></div>` : ''}
            <div class="sk-marquee"><div class="sk-bulbs"></div><div class="sk-logo">${g.icon} ${cxEsc(g.title)}</div><div class="sk-bulbs"></div></div>
            <div class="sk-feature-row" data-sk="features"></div>
            <div data-sk="banner"></div>
            <div data-sk="boards"></div>
          </div>
          <div class="sk-msgbar" data-sk="msg">${g.idleMsg || 'Ustaw stawkę i naciśnij SPIN'}</div>
          <div class="sk-controls">
            <div class="sk-betbox">
              <button class="sk-round" data-sk="betdown" title="Zmniejsz stawkę">−</button>
              <div class="val"><span>Stawka</span><b data-sk="bet">—</b></div>
              <button class="sk-round" data-sk="betup" title="Zwiększ stawkę">+</button>
              <button class="cx-btn sm" data-sk="betmax" title="Maksymalna stawka">MAX</button>
            </div>
            <button class="sk-spin" data-sk="spin" title="Spacja"><span class="sk-spin-ico">⟳</span><span data-sk="spinlbl">SPIN</span></button>
            <div class="sk-right" style="position:relative">
              <button class="cx-btn sm${this.turbo ? ' gold' : ''}" data-sk="turbo" title="Szybkie kręcenie">⚡ Turbo</button>
              <button class="cx-btn sm" data-sk="auto">🔁 Auto</button>
            </div>
          </div>
        </div>
        <div class="sk-side">
          ${g.sideTop ? `<div class="cx-panel" data-sk="sidetop">${g.sideTop}</div>` : ''}
          <div class="cx-panel"><h4>Statystyki</h4><div class="sk-stats" data-sk="stats"></div></div>
          <div class="cx-panel"><h4>Ostatnie spiny</h4><div class="sk-history" data-sk="hist"><div style="color:var(--muted);font-size:12px">Brak</div></div></div>
        </div>
      </div>
    </div>`;
    this.root = screen;
    this.$ = k => screen.querySelector(`[data-sk="${k}"]`);
    this.buildBoards();
    this.$('betdown').onclick = () => this.changeBet(-1);
    this.$('betup').onclick = () => this.changeBet(1);
    this.$('betmax').onclick = () => this.changeBet(999);
    this.$('spin').onclick = () => this.onSpinClick();
    this.$('turbo').onclick = () => { this.turbo = !this.turbo; this.$('turbo').classList.toggle('gold', this.turbo); try { localStorage.setItem('sk_turbo', this.turbo ? '1' : '0'); } catch (e) {} };
    this.$('auto').onclick = e => this.toggleAutoMenu(e);
    if (g.features) this.$('features').innerHTML = g.features();
    this.updateBet();
    this.renderStats();
    skActive = this;
    if (g.onMount) g.onMount(this);
    cxLoadSlotStats(g.statsId || g.game).then(s => { if (s && skActive === this) { this.stats = { spins: s.spins, spent: s.spent, won: s.won, best: s.bestWin }; this.renderStats(); if (g.onStats) g.onStats(s, this); } });
  }

  buildBoards() {
    const wrap = this.$('boards');
    const multi = this.boards.length > 1;
    wrap.className = multi ? 'sk-reels dual' : '';
    wrap.innerHTML = '';
    this.boards.forEach((b, bi) => {
      if (multi && bi === 1 && this.o.midHTML) { const mid = document.createElement('div'); mid.className = 'sk-mid'; mid.dataset.sk = 'mid'; mid.innerHTML = this.o.midHTML; wrap.appendChild(mid); }
      const el = document.createElement('div');
      el.className = 'sk-reels';
      el.style.gridTemplateColumns = `repeat(${b.cols}, 1fr)`;
      el.style.setProperty('--sk-fs', this.o.fontSize || `clamp(18px, ${Math.round(34 / Math.max(b.cols, b.rows) * 4.2)}px, 54px)`);
      if (this.o.boardMaxWidth) { el.style.maxWidth = this.o.boardMaxWidth; el.style.margin = '0 auto'; }
      el.dataset.board = b.key;
      // Proporcje planszy (komórki 100px + odstępy 6px + padding 8px) — w poziomie na telefonie plansza dopasowuje się do wysokości
      el.style.setProperty('--sk-ar', `${b.cols * 100 + (b.cols - 1) * 6 + 16} / ${b.rows * 100 + 16}`);
      for (let c = 0; c < b.cols; c++) {
        const col = document.createElement('div');
        col.className = 'sk-col';
        col.style.aspectRatio = `1 / ${b.rows}`;
        const strip = document.createElement('div');
        strip.className = 'sk-strip';
        col.appendChild(strip);
        el.appendChild(col);
      }
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'sk-svg');
      el.appendChild(svg);
      b.el = el;
      wrap.appendChild(el);
      const g = Array.from({ length: b.cols }, () => Array.from({ length: b.rows }, () => this.o.randomSym(b.key)));
      this.setGrid(g, b.key);
    });
  }

  board(key = 'main') { return this.boards.find(b => b.key === key) || this.boards[0]; }
  colEl(c, key) { return this.board(key).el.children[c]; }
  cell(c, r, key) { return this.colEl(c, key)?.firstChild?.children[r]; }

  cellHTML(symIdx, key) {
    const s = this.o.symHTML(symIdx, key);
    return typeof s === 'string' ? { html: s, cls: '' } : s;
  }
  cellInner(s) {
    if (this.o.tiles === false || s.noTile) return s.html;
    return `<div class="sk-tile${s.tile ? ' ' + s.tile : ''}" style="--c:${s.color || this.o.tileColor || '#6b5bd6'}">${s.html}</div>`;
  }
  fillStrip(strip, items, key) {
    strip.innerHTML = items.map(si => { const s = this.cellHTML(si, key); return `<div class="sk-cell ${s.cls || ''}">${this.cellInner(s)}</div>`; }).join('');
  }
  setGrid(grid, key = 'main') {
    const b = this.board(key);
    this.grids[b.key] = grid;
    for (let c = 0; c < b.cols; c++) {
      const strip = this.colEl(c, b.key).firstChild;
      strip.style.transition = 'none'; strip.style.transform = 'none'; strip.classList.remove('blur');
      this.fillStrip(strip, grid[c], b.key);
    }
    this.decorate(b.key);
  }
  decorate(key) {
    if (!this.o.decorate) return;
    const b = this.board(key);
    for (let c = 0; c < b.cols; c++) for (let r = 0; r < b.rows; r++) {
      const el = this.cell(c, r, b.key);
      if (el) this.o.decorate(el, c, r, this.grids[b.key][c][r], b.key, this);
    }
  }

  // ── Animacja bębnów ───────────────────────────────────────
  startSpin(keys, only) {
    if (!only) this.scReset();
    for (const b of this.boards) {
      if (keys && !keys.includes(b.key)) continue;
      for (let c = 0; c < b.cols; c++) {
        if (only && !only.includes(c)) continue;
        const col = this.colEl(c, b.key);
        col.classList.remove('expanded');
        const strip = col.firstChild;
        const n = b.rows * 3;
        const items = Array.from({ length: n }, () => this.o.randomSym(b.key));
        this.fillStrip(strip, [...items, ...items.slice(0, b.rows)], b.key);
        strip.classList.add('blur');
        strip.style.transition = 'none';
        const total = n + b.rows;
        strip.animate([{ transform: `translateY(-${(n / total) * 100}%)` }, { transform: 'translateY(0)' }], { duration: this.turbo ? 160 : 240, iterations: Infinity });
      }
    }
  }
  // Zatrzymaj bęben(y) na podanej siatce; zwraca Promise po ostatnim
  stop(grid, key = 'main', { stagger, extraDelay = 0, only } = {}) {
    const b = this.board(key);
    this.grids[b.key] = grid;
    const st = stagger ?? (this.turbo ? 50 : this.o.stagger);
    const base = (this.turbo ? 120 : this.o.baseSpin) + extraDelay;
    const ant = this.o.anticipate ? this.o.anticipate(grid, b.key) : null;
    const promises = [];
    let t = base;
    const antOn = ant !== null && ant !== undefined && !this.turbo;
    for (let c = 0; c < b.cols; c++) {
      if (only && !only.includes(c)) continue;
      if (antOn && c >= ant) t += 650;
      const delay = t;
      if (antOn && c === ant) setTimeout(() => { for (let k = ant; k < b.cols; k++) this.colEl(k, b.key)?.classList.add('anticip'); cxSound.play('feature'); this.antStart(b.key); }, delay - 650);
      promises.push(new Promise(res => setTimeout(() => {
        const col = this.colEl(c, b.key);
        const strip = col.firstChild;
        strip.getAnimations().forEach(a => a.cancel());
        const k = b.rows * 2;
        const rand = Array.from({ length: k }, () => this.o.randomSym(b.key));
        this.fillStrip(strip, [...grid[c], ...rand], b.key);
        strip.classList.remove('blur');
        const total = k + b.rows;
        strip.style.transition = 'none';
        strip.style.transform = `translateY(-${(k / total) * 100}%)`;
        void strip.offsetHeight;
        strip.style.transition = `transform ${this.turbo ? 160 : 300}ms cubic-bezier(.2,.9,.35,1.18)`;
        strip.style.transform = 'translateY(0)';
        setTimeout(() => {
          strip.style.transition = 'none'; strip.style.transform = 'none';
          col.classList.remove('anticip');
          this.fillStrip(strip, grid[c], b.key);
          [...strip.children].forEach((el, r) => { el.classList.add('land'); if (this.o.decorate) this.o.decorate(el, c, r, grid[c][r], b.key, this); });
          cxSound.play('stop');
          if (this.sc) this.scLand(c, grid[c], b.key);
          if (!b.el.querySelector('.sk-col.anticip')) this.antStop();
          if (this.o.onColStop) this.o.onColStop(c, grid, b.key, this);
          res();
        }, this.turbo ? 170 : 310);
      }, delay)));
      t += st;
    }
    return Promise.all(promises);
  }
  // Odkryj pojedyncze komórki (Hold & Win, kaskady)
  revealCells(grid, cells, key = 'main', each = 90) {
    const b = this.board(key);
    this.grids[b.key] = grid;
    return new Promise(res => {
      if (!cells.length) return res();
      cells.forEach(([c, r], i) => setTimeout(() => {
        const el = this.cell(c, r, b.key);
        if (!el) return;
        const s = this.cellHTML(grid[c][r], b.key);
        el.className = 'sk-cell land ' + (s.cls || '');
        el.innerHTML = this.cellInner(s);
        this.burstCell(c, r, b.key, 10);
        if (this.o.decorate) this.o.decorate(el, c, r, grid[c][r], b.key, this);
        if (i === cells.length - 1) setTimeout(res, 300);
      }, i * (this.turbo ? 30 : each)));
    });
  }
  // Kaskada: usuń komórki, a potem pokaż nową siatkę z "opadaniem"
  async cascade(removed, newGrid, falling, key = 'main') {
    removed.forEach(([c, r]) => { const el = this.cell(c, r, key); if (el) { el.classList.remove('hit'); el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 }], { duration: 260, fill: 'forwards' }); } });
    await this.wait(this.turbo ? 160 : 280);
    this.setGrid(newGrid, key);
    const fall = new Set(falling.map(([c, r]) => c + ',' + r));
    const b = this.board(key);
    for (let c = 0; c < b.cols; c++) for (let r = 0; r < b.rows; r++) {
      const el = this.cell(c, r, key);
      if (fall.has(c + ',' + r)) el.animate([{ transform: 'translateY(-160%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: this.turbo ? 180 : 320, easing: 'cubic-bezier(.3,1.3,.5,1)', delay: (b.rows - r) * 25 });
    }
    await this.wait(this.turbo ? 220 : 420);
  }
  expandCol(c, symIdx, key = 'main') {
    const b = this.board(key);
    const col = this.colEl(c, key);
    col.classList.add('expanded');
    for (let r = 0; r < b.rows; r++) { this.grids[b.key][c][r] = symIdx; }
    this.fillStrip(col.firstChild, this.grids[b.key][c], key);
    [...col.firstChild.children].forEach(el => el.animate([{ transform: 'scaleY(.2)', opacity: .3 }, { transform: 'scaleY(1)', opacity: 1 }], { duration: 300, easing: 'ease-out' }));
  }

  // ── Wygrane ──────────────────────────────────────────────
  clearWins() {
    clearInterval(this.cycleT); clearTimeout(this.cycleStart);
    this.$('machine')?.classList.remove('win', 'bigwin');
    for (const b of this.boards) {
      b.el.classList.remove('dim');
      b.el.querySelectorAll('.sk-cell.hit, .sk-cell.sc-win').forEach(e => e.classList.remove('hit', 'sc-win'));
      b.el.querySelector('.sk-svg').innerHTML = '';
    }
  }

  // ── Scattery ─────────────────────────────────────────────
  cellCenter(c, r, key) {
    const el = this.cell(c, r, key), m = this.$('machine');
    if (!el || !m) return null;
    const er = el.getBoundingClientRect(), mr = m.getBoundingClientRect();
    return { x: er.left - mr.left + er.width / 2, y: er.top - mr.top + er.height / 2, w: er.width };
  }
  scReset() {
    this.scCount = 0;
    const el = this.$('sccount');
    if (el) { el.classList.remove('show', 'full'); el.querySelector('b').textContent = '0'; }
  }
  // Scatter wylądował: wyskok symbolu, cząsteczki motywu, dzwonek, licznik
  scLand(c, col, key) {
    col.forEach((si, r) => {
      if (!this.sc.is(si)) return;
      this.scCount = (this.scCount || 0) + 1;
      const n = this.scCount;
      const el = this.cell(c, r, key);
      if (el) { el.classList.remove('sc-land'); void el.offsetWidth; el.classList.add('sc-land'); }
      const p = this.cellCenter(c, r, key);
      if (p) for (const [kind, cnt] of this.scTheme.land) this.emit(p.x, p.y, kind, Math.round(cnt * (1 + (n - 1) * .25)), { spread: p.w / 2.4, scale: p.w / 70 });
      cxSound.play('scatter', n);
      const cnt = this.$('sccount');
      if (cnt) {
        cnt.querySelector('b').textContent = n;
        cnt.classList.add('show');
        cnt.classList.toggle('full', n >= this.sc.need);
        cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump');
      }
    });
  }
  // Oczekiwanie na ostatni scatter: cząsteczki wzdłuż kręcących się bębnów + bicie serca
  antStart(key) {
    this.antStop();
    this.$('machine')?.classList.add('anticipating');
    const kind = this.scTheme?.ant || 'spark';
    this.antT = setInterval(() => {
      const m = this.$('machine'); if (!m || skActive !== this) return this.antStop();
      const mr = m.getBoundingClientRect();
      this.board(key).el.querySelectorAll('.sk-col.anticip').forEach(col => {
        const r = col.getBoundingClientRect();
        const edge = Math.random() < .5 ? r.left : r.right;
        const x = (kind === 'bolt' || kind === 'smoke' ? r.left + Math.random() * r.width : edge) - mr.left;
        const y = r.top - mr.top + (kind === 'ember' || kind === 'bubble' || kind === 'sand' ? r.height * (.75 + Math.random() * .25) : Math.random() * r.height);
        this.emit(x, y, kind, kind === 'bolt' ? 1 : 2, { spread: 6, scale: r.width / 80 });
      });
    }, 90);
    let beat = 0;
    this.antBeat = setInterval(() => { if (beat++ < 12) cxSound.play('heartbeat'); }, 520);
    cxSound.play('heartbeat');
  }
  antStop() {
    clearInterval(this.antT); clearInterval(this.antBeat); this.antT = this.antBeat = null;
    this.$('machine')?.classList.remove('anticipating');
  }
  // Wyzwolenie bonusu przez scattery: błysk, wyróżnienie, połączenie promieniem, eksplozje cząsteczek
  async scatterWin(cells, key = 'main', { quiet = false } = {}) {
    if (!cells?.length) return;
    const m = this.$('machine');
    const th = this.scTheme || SK_SCATTER_FX.cosmic;
    const b = this.board(key);
    b.el.classList.add('dim');
    cells.forEach(([c, r]) => this.cell(c, r, key)?.classList.add('sc-win'));
    const sorted = cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length > 1) this.drawLine(sorted, th.colors[0], key);
    b.el.querySelector('.sk-svg polyline:last-child')?.classList.add('sc-beam');
    if (m && !quiet) {
      const fl = document.createElement('div');
      fl.className = 'sk-flash';
      m.appendChild(fl);
      setTimeout(() => fl.remove(), 900);
      m.classList.remove('sc-trigger'); void m.offsetWidth; m.classList.add('sc-trigger');
      setTimeout(() => m.classList.remove('sc-trigger'), 1400);
    }
    if (!quiet) cxSound.play('scwin');
    const step = this.turbo ? 40 : 120;
    cells.forEach(([c, r], i) => setTimeout(() => {
      const p = this.cellCenter(c, r, key);
      if (p) for (const [kind, cnt] of th.win) this.emit(p.x, p.y, kind, Math.ceil(cnt / 2), { spread: p.w / 2, scale: p.w / 70, speed: 1.3 });
    }, i * step));
    setTimeout(() => {
      if (!m || quiet) return;
      const mr = m.getBoundingClientRect();
      for (const [kind, cnt] of th.win) this.emit(mr.width / 2, mr.height / 2, kind, cnt, { spread: mr.width / 5, scale: 1.2, speed: 1.8 });
    }, cells.length * step);
    await this.wait(this.turbo ? 500 : 1100 + cells.length * step);
  }
  highlight(cells, key = 'main', dim = true, burst = true) {
    const b = this.board(key);
    if (dim) b.el.classList.add('dim');
    const seen = new Set();
    cells.forEach(([c, r]) => {
      this.cell(c, r, key)?.classList.add('hit');
      if (burst && !seen.has(c + ',' + r) && seen.size < 30) { seen.add(c + ',' + r); this.burstCell(c, r, key, cells.length > 12 ? 5 : 9); }
    });
  }
  // ── Cząsteczki ───────────────────────────────────────────
  symColor(c, r, key) {
    const g = this.grids[this.board(key).key];
    if (!g) return '#ffd36b';
    const s = this.cellHTML(g[c][r], key);
    return s.color || this.o.theme?.a || '#ffd36b';
  }
  burstCell(c, r, key = 'main', n = 9) {
    const el = this.cell(c, r, key), m = this.$('machine');
    if (!el || !m) return;
    const er = el.getBoundingClientRect(), mr = m.getBoundingClientRect();
    this.burst(er.left - mr.left + er.width / 2, er.top - mr.top + er.height / 2, this.symColor(c, r, key), n, er.width / 3);
  }
  burst(x, y, color, n = 10, spread = 20) {
    this.emit(x, y, 'spark', n, { spread, colors: [color] });
  }
  // Typowane cząsteczki: spark, star, ember, glyph, confetti, bubble, smoke, bolt, coin, ring, sand
  emit(x, y, kind, n = 10, o = {}) {
    if (!this.fx) this.fx = { parts: [], raf: null };
    if (!this.$('fx')) return;
    const colors = o.colors || this.scTheme?.colors || [this.o.theme?.a || '#ffd36b'];
    const pick = () => colors[Math.floor(Math.random() * colors.length)];
    const sc = o.scale || 1, sp = o.speed || 1, spread = o.spread ?? 20;
    if (this.fx.parts.length > 900) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = { k: kind, x: x + Math.cos(a) * spread * Math.random(), y: y + Math.sin(a) * spread * Math.random(), vx: 0, vy: 0, g: .12, drag: .985, life: 1, decay: .02, size: 3, color: pick(), rot: Math.random() * 6, vr: (Math.random() - .5) * .3 };
      const v = (1.5 + Math.random() * 4) * sp;
      switch (kind) {
        case 'spark': p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 2; p.decay = .012 + Math.random() * .02; p.size = 2 + Math.random() * 3.5; p.star = Math.random() < .3; if (Math.random() < .35) p.color = '#fff'; break;
        case 'star': p.vx = Math.cos(a) * v * .6; p.vy = Math.sin(a) * v * .6 - 1; p.g = .02; p.drag = .96; p.decay = .01 + Math.random() * .012; p.size = (4 + Math.random() * 6) * sc; break;
        case 'ember': p.vx = (Math.random() - .5) * 2.2 * sp; p.vy = -(1 + Math.random() * 3) * sp; p.g = -.04; p.drag = .99; p.decay = .012 + Math.random() * .015; p.size = (1.5 + Math.random() * 3) * sc; break;
        case 'glyph': { const gl = this.scTheme?.glyphs || '✦✧'; p.ch = gl[Math.floor(Math.random() * gl.length)]; p.vx = Math.cos(a) * v * .5; p.vy = -(1 + Math.random() * 2) * sp; p.g = -.015; p.drag = .97; p.decay = .01 + Math.random() * .01; p.size = (12 + Math.random() * 12) * sc; break; }
        case 'confetti': p.vx = Math.cos(a) * v * 1.2; p.vy = Math.sin(a) * v - 4 * sp; p.g = .14; p.drag = .975; p.decay = .008 + Math.random() * .01; p.size = (5 + Math.random() * 5) * sc; p.vr = (Math.random() - .5) * .5; break;
        case 'bubble': p.vx = (Math.random() - .5) * 1.5; p.vy = -(.8 + Math.random() * 2) * sp; p.g = -.02; p.drag = .99; p.decay = .01 + Math.random() * .01; p.size = (4 + Math.random() * 9) * sc; break;
        case 'smoke': p.vx = (Math.random() - .5) * 1.2; p.vy = -(.3 + Math.random()) * sp; p.g = -.005; p.drag = .99; p.decay = .008 + Math.random() * .008; p.size = (14 + Math.random() * 18) * sc; break;
        case 'bolt': { p.decay = .06 + Math.random() * .04; p.g = 0; const len = (40 + Math.random() * 70) * sc; const pts = [[0, 0]]; let px = 0, py = 0; for (let k = 1; k <= 7; k++) { px = Math.cos(a) * len * k / 7 + (Math.random() - .5) * 14 * sc; py = Math.sin(a) * len * k / 7 + (Math.random() - .5) * 14 * sc; pts.push([px, py]); } p.pts = pts; p.x = x; p.y = y; break; }
        case 'coin': p.vx = Math.cos(a) * v * .8; p.vy = -(4 + Math.random() * 5) * sp; p.g = .22; p.drag = .99; p.decay = .009 + Math.random() * .008; p.size = (6 + Math.random() * 4) * sc; p.vr = .15 + Math.random() * .25; p.color = Math.random() < .5 ? '#ffd36b' : '#f5a623'; break;
        case 'ring': p.x = x; p.y = y; p.r = 6 * sc + i * 14 * sc; p.vrad = (2.5 + i * .6) * sp * Math.max(1, sc); p.g = 0; p.decay = .028; p.size = 4 * sc; break;
        case 'sand': p.vx = Math.cos(a) * v * .7; p.vy = Math.sin(a) * v * .5 - 1.5; p.g = .05; p.drag = .97; p.decay = .012 + Math.random() * .015; p.size = (1 + Math.random() * 2) * sc; break;
      }
      this.fx.parts.push(p);
    }
    if (!this.fx.raf) this.fxLoop();
  }
  fxLoop() {
    const cv = this.$('fx');
    if (!cv || skActive !== this) { this.fx.raf = null; this.fx.parts = []; return; }
    const r = cv.getBoundingClientRect(), d = devicePixelRatio;
    if (cv.width !== Math.round(r.width * d)) { cv.width = r.width * d; cv.height = r.height * d; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.globalCompositeOperation = 'lighter';
    this.fx.parts = this.fx.parts.filter(p => {
      p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
      if (p.life <= 0) return false;
      const al = Math.min(1, p.life * 1.4);
      ctx.globalAlpha = al;
      ctx.fillStyle = ctx.strokeStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      switch (p.k) {
        case 'star': {
          ctx.globalAlpha = al * (.6 + .4 * Math.sin(p.life * 30));
          const s = p.size; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * .3); ctx.beginPath();
          for (let k = 0; k < 8; k++) { const rr = k % 2 ? s * .28 : s; const an = k * Math.PI / 4; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
          ctx.closePath(); ctx.fill(); ctx.restore(); break;
        }
        case 'ember': ctx.globalAlpha = al * (.55 + Math.random() * .45); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.5 + p.life * .5), 0, Math.PI * 2); ctx.fill(); break;
        case 'glyph': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.rot) * .4); ctx.font = `700 ${p.size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.ch, 0, 0); ctx.restore(); break;
        case 'confetti': ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(Math.cos(p.rot * 2.3), 1); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); ctx.globalCompositeOperation = 'lighter'; break;
        case 'bubble': ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x + Math.sin(p.rot * 3) * 2, p.y, p.size, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = al * .5; ctx.beginPath(); ctx.arc(p.x - p.size * .35, p.y - p.size * .35, p.size * .22, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); break;
        case 'smoke': { p.size *= 1.012; ctx.shadowBlur = 0; ctx.globalAlpha = al * .22; const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size); gr.addColorStop(0, p.color); gr.addColorStop(1, 'transparent'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); break; }
        case 'bolt': ctx.lineWidth = 2.2; ctx.shadowBlur = 16; ctx.beginPath(); p.pts.forEach(([px, py], k) => k ? ctx.lineTo(p.x + px, p.y + py) : ctx.moveTo(p.x + px, p.y + py)); ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.stroke(); break;
        case 'coin': { ctx.globalCompositeOperation = 'source-over'; const w = Math.abs(Math.cos(p.rot)) * p.size + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, w, p.size, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#a35f00'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; break; }
        case 'ring': p.r += p.vrad; ctx.lineWidth = Math.max(.5, p.size * p.life); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); break;
        case 'sand': ctx.shadowBlur = 4; ctx.fillRect(p.x, p.y, p.size, p.size); break;
        default:
          if (p.star) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 6); ctx.fillRect(-p.size, -p.size * .25, p.size * 2, p.size * .5); ctx.fillRect(-p.size * .25, -p.size, p.size * .5, p.size * 2); ctx.restore(); }
          else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill(); }
      }
      return true;
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    if (this.fx.parts.length) this.fx.raf = requestAnimationFrame(() => this.fxLoop());
    else { ctx.clearRect(0, 0, r.width, r.height); this.fx.raf = null; }
  }
  drawLine(cells, color, key = 'main', label) {
    const b = this.board(key);
    const svg = b.el.querySelector('.sk-svg');
    const br = b.el.getBoundingClientRect();
    const pts = cells.map(([c, r]) => {
      const e = this.cell(c, r, key);
      if (!e) return null;
      const cr = e.getBoundingClientRect();
      return `${cr.left - br.left + cr.width / 2},${cr.top - br.top + cr.height / 2}`;
    }).filter(Boolean);
    svg.setAttribute('viewBox', `0 0 ${br.width} ${br.height}`);
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', pts.join(' '));
    pl.setAttribute('stroke', color);
    pl.style.color = color;
    svg.appendChild(pl);
    if (label && pts.length) {
      const mid = pts[Math.floor(pts.length / 2)].split(',').map(Number);
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', mid[0]); tx.setAttribute('y', mid[1] - 4); tx.setAttribute('text-anchor', 'middle');
      tx.textContent = label;
      svg.appendChild(tx);
    }
  }
  // Po pokazaniu wszystkich wygranych — pokazuj je po kolei z kwotą
  cycleWins(wins, key = 'main') {
    clearInterval(this.cycleT); clearTimeout(this.cycleStart);
    if (!wins?.length || this.turbo) return;
    const b = this.board(key);
    let i = 0;
    const show = () => {
      if (skActive !== this || this.spinning) return clearInterval(this.cycleT);
      const w = wins[i % wins.length]; i++;
      b.el.querySelector('.sk-svg').innerHTML = '';
      b.el.querySelectorAll('.sk-cell.hit').forEach(e => e.classList.remove('hit'));
      b.el.classList.add('dim');
      w.cells.forEach(([c, r]) => this.cell(c, r, key)?.classList.add('hit'));
      const cells = w.cells.slice().sort((a, b) => a[0] - b[0]);
      const label = '+' + cxFmt(w.win);
      if (w.li !== undefined) this.drawLine(cells.length > 1 ? cells : cells.concat(cells), SK_LINE_COLORS[w.li % SK_LINE_COLORS.length], key, label);
      else { const [c, r] = w.cells[Math.floor(w.cells.length / 2)]; this.drawLine([[c, r], [c, r]], 'transparent', key, label); }
    };
    this.cycleStart = setTimeout(() => { show(); this.cycleT = setInterval(show, 1300); }, 1600);
  }
  // Standard dla gier liniowych: podświetl wszystkie, narysuj linie
  showLineWins(wins, lines, key = 'main') {
    if (!wins?.length) return;
    const all = [];
    wins.forEach(w => {
      w.cells.forEach(c => all.push(c));
      const cells = w.cells.slice().sort((a, b) => a[0] - b[0]);
      this.drawLine(cells.length > 1 ? cells : cells.concat(cells), SK_LINE_COLORS[w.li % SK_LINE_COLORS.length], key);
    });
    this.highlight(all, key);
    if (wins.length > 1 || (wins[0] && wins[0].li !== undefined)) this.cycleWins(wins, key);
  }

  // ── Komunikaty / banery ──────────────────────────────────
  msg(html, cls = '') { const m = this.$('msg'); m.className = 'sk-msgbar' + (cls ? ' ' + cls : ''); m.innerHTML = html; }
  banner(html, cls = '') { this.$('banner').innerHTML = html ? `<div class="sk-banner ${cls}" style="margin-bottom:10px">${html}</div>` : ''; }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  // Licznik wygranej w pasku komunikatu
  countMsg(prefix, amount, cls, suffix = '') {
    this.msg(`${prefix} <span class="amt">+0 AT$</span> ${suffix}`, cls);
    const m = this.$('msg'); m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop');
    const el = m.querySelector('.amt');
    const dur = Math.min(1600, 350 + Math.log10(Math.max(10, amount)) * 220);
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      if (!el.isConnected) return;
      el.textContent = '+' + cxFmt(amount * (1 - Math.pow(1 - p, 3))) + ' AT$';
      if (p < 1) { if (Math.random() < .25) cxSound.play('tick'); requestAnimationFrame(step); }
    };
    requestAnimationFrame(step);
  }
  splash(title, sub, icon, color) { return cxSplash({ title, sub, icon, color: color || this.o.theme?.a }); }

  // ── Stawka ───────────────────────────────────────────────
  get bet() { return this.steps[this.betIdx]; }
  changeBet(d) {
    if (this.spinning || this.free > 0) return;
    this.betIdx = d === 999 ? this.steps.length - 1 : Math.max(0, Math.min(this.steps.length - 1, this.betIdx + d));
    try { localStorage.setItem('sk_bet_' + this.table.id, this.bet); } catch (e) {}
    cxSound.play('click');
    this.updateBet();
  }
  updateBet() {
    this.$('bet').textContent = this.free > 0 && this.freeBet ? cxFmt(this.freeBet) : cxFmt(this.bet);
    const lock = this.spinning || this.free > 0;
    this.$('betdown').disabled = lock || this.betIdx === 0;
    this.$('betup').disabled = lock || this.betIdx === this.steps.length - 1;
    this.$('betmax').disabled = lock;
    const sb = this.$('spin');
    sb.classList.toggle('free', this.free > 0);
    sb.classList.toggle('auto', this.auto > 0 && this.free === 0);
    this.$('spinlbl').textContent = this.free > 0 ? `FREE ${this.free}` : this.auto > 0 ? (this.auto === Infinity ? 'STOP ∞' : `STOP ${this.auto}`) : 'SPIN';
    if (this.o.onBetChange) this.o.onBetChange(this.free > 0 && this.freeBet ? this.freeBet : this.bet, this);
  }

  // ── Auto ─────────────────────────────────────────────────
  toggleAutoMenu(e) {
    e.stopPropagation();
    if (this.auto > 0) { this.auto = 0; this.updateBet(); return; }
    const host = this.$('auto').parentElement;
    host.querySelector('.sk-auto-menu')?.remove();
    const m = document.createElement('div');
    m.className = 'sk-auto-menu';
    m.innerHTML = [10, 25, 50, 100, 250, '∞'].map(n => `<button data-n="${n}">${n}</button>`).join('');
    host.appendChild(m);
    m.onclick = ev => {
      const n = ev.target.dataset.n; if (!n) return;
      this.auto = n === '∞' ? Infinity : Number(n);
      m.remove();
      this.updateBet();
      if (!this.spinning) this.spin();
    };
    setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
  }

  onSpinClick() {
    if (this.auto > 0 && this.free === 0) { this.auto = 0; this.updateBet(); return; }
    this.spin();
  }

  // ── Spin ─────────────────────────────────────────────────
  spin() {
    if (this.spinning || skActive !== this || !casinoTableId) return;
    if (this.o.canSpin && !this.o.canSpin(this)) return;
    const isFree = this.free > 0;
    if (!isFree && cxBalance() < this.bet) { this.msg('Za mało AT$ na tę stawkę', ''); this.auto = 0; this.updateBet(); return; }
    this.spinning = true;
    this.updateBet();
    this.clearWins();
    this.$('spin').classList.add('spinning');
    if (!isFree) cxSetBalance(cxBalance() - this.bet, false);
    this.msg(isFree ? `🎁 Darmowy spin…` : 'Powodzenia! 🍀');
    if (this.o.onSpinStart) this.o.onSpinStart(this); else this.startSpin();
    this.sentAt = performance.now();
    socket.emit(this.o.event, cxAuth({ bet: this.bet }));
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => { if (this.spinning) this.abort('Brak odpowiedzi serwera — spróbuj ponownie'); }, 10000);
  }
  abort(message) {
    clearTimeout(this.timeout);
    this.antStop();
    this.spinning = false;
    this.auto = 0;
    this.$('spin').classList.remove('spinning');
    for (const b of this.boards) if (this.grids[b.key]) this.setGrid(this.grids[b.key], b.key);
    this.msg(message);
    this.updateBet();
    if (casinoWallet) fetch('/api/casino/wallet').then(r => r.ok && r.json()).then(d => d && cxSetBalance(d.wallet.balance, false)).catch(() => {});
  }

  async onResult(res) {
    if (!this.spinning || skActive !== this) return;
    clearTimeout(this.timeout);
    if (res.rtpScale) cxRtpK[this.o.game] = res.rtpScale;
    const wasFree = !res.paid;
    try { await this.o.present(res, this); } catch (e) { console.error(e); }
    // Księgowanie
    this.stats.spins++; this.session.spins++;
    if (!wasFree) { this.stats.spent += res.bet; this.session.spent += res.bet; }
    this.stats.won += res.payout; this.session.won += res.payout;
    if (res.payout > this.stats.best) this.stats.best = res.payout;
    cxSetBalance(res.balance);
    this.free = res.nextFree ? (this.o.freeLeft ? this.o.freeLeft(res) : (res.freeSpinsRemaining || 1)) : 0;
    if (this.free > 0) this.freeBet = this.o.freeBetOf ? this.o.freeBetOf(res) : (this.freeBet || res.bet);
    this.addHistory(res);
    this.renderStats();

    // Wiadomość o wygranej / duża wygrana
    const big = CX_TIER_ORDER.indexOf(res.tier) >= CX_TIER_ORDER.indexOf('mega');
    if (res.payout > 0) {
      if (!res._msgSet) this.countMsg(`${res.label || 'Wygrana'}:`, res.payout, CX_TIER_ORDER.indexOf(res.tier) >= 2 ? 'big' : 'win', `<span style="opacity:.6">(${res.mult.toLocaleString('pl-PL', { maximumFractionDigits: 2 })}×)</span>`);
      const mach = this.$('machine');
      mach.classList.add(CX_TIER_ORDER.indexOf(res.tier) >= 2 ? 'bigwin' : 'win');
      if (CX_TIER_ORDER.indexOf(res.tier) >= 2) { mach.classList.remove('shake'); void mach.offsetWidth; mach.classList.add('shake'); const r = mach.getBoundingClientRect(); for (let i = 0; i < 5; i++) setTimeout(() => this.burst(r.width * (.2 + Math.random() * .6), r.height * (.3 + Math.random() * .4), ['#ffd36b', '#ff6f8a', '#3ff2a3', '#8b6cff'][i % 4], 26, 40), i * 120); }
      if (!big) cxSound.play('win');
      if (big) await cxBigWin({ amount: res.payout, bet: res.bet, tier: res.tier, label: res.label });
    } else if (!res._msgSet) {
      this.msg(this.free > 0 ? `🎁 Pozostało darmowych spinów: <b>${this.free}</b>` : 'Brak wygranej — spróbuj jeszcze raz');
    }
    if (res.fsSummary && this.o.summaryTitle !== false) {
      await this.featureSummary(res.fsSummary);
    }
    if (this.o.afterResult) await this.o.afterResult(res, this);

    this.spinning = false;
    this.$('spin').classList.remove('spinning');
    if (this.auto > 0 && this.free === 0 && res.paid) this.auto = this.auto === Infinity ? Infinity : this.auto - 1;
    this.updateBet();
    // Kontynuacja: free spiny grają się same, auto-spin wg licznika
    if (skActive === this && casinoTableId && (this.free > 0 || this.auto > 0) && !this.paused) {
      const delay = this.turbo ? 250 : res.payout > 0 ? 900 : 450;
      setTimeout(() => { if (!this.spinning && skActive === this && (this.free > 0 || this.auto > 0) && !this.paused) this.spin(); }, delay);
    }
  }

  async featureSummary(s) {
    if (!s) return;
    const title = s.title || '🎁 Koniec darmowych spinów';
    const tier = s.win >= (s.bet || this.freeBet || this.bet) * 25 ? 'huge' : 'mega';
    if (s.win > 0) await cxBigWin({ amount: s.win, bet: s.bet || this.freeBet || this.bet, tier, title });
    else this.msg(`${title} — tym razem bez wygranej`, 'feature');
  }

  addHistory(res) {
    this.history.unshift(res);
    this.history = this.history.slice(0, 15);
    const el = this.$('hist');
    el.innerHTML = this.history.map(h => {
      const cls = h.freeSpinsAwarded || h.bonusPick || h.holdTriggered || h.turboTriggered ? 'feat' : CX_TIER_ORDER.indexOf(h.tier) >= 2 ? 'big' : '';
      const tag = h.paid ? cxShort(h.bet) : 'FREE';
      return `<div class="sk-hist ${cls}"><span>${tag}</span><span class="${h.net > 0 ? 'cx-pos' : h.net < 0 ? 'cx-neg' : ''}">${h.payout > 0 ? '+' + cxFmt(h.payout) : h.paid ? '—' : '0'}</span></div>`;
    }).join('');
  }
  renderStats() {
    const s = this.stats;
    const rtp = s.spent > 0 ? (s.won / s.spent * 100) : null;
    this.$('stats').innerHTML = `
      <div class="sk-stat"><span>Spiny</span><b>${cxFmt(s.spins)}</b></div>
      <div class="sk-stat"><span>Rekord</span><b style="color:var(--cx-gold)">${s.best ? cxShort(s.best) : '—'}</b></div>
      <div class="sk-stat"><span>Postawione</span><b>${cxShort(s.spent)}</b></div>
      <div class="sk-stat"><span>Wygrane</span><b>${cxShort(s.won)}</b></div>
      <div class="sk-stat" style="grid-column:1/3"><span>Bilans sesji</span><b class="${this.session.won - this.session.spent >= 0 ? 'cx-pos' : 'cx-neg'}">${this.session.won - this.session.spent >= 0 ? '+' : ''}${cxFmt(this.session.won - this.session.spent)} AT$</b>${rtp !== null ? `<span style="margin-top:2px">Twój zwrot łącznie: ${rtp.toFixed(1)}%</span>` : ''}</div>`;
  }

  // ── Tabela wypłat ───────────────────────────────────────
  async showInfo() {
    let meta = null;
    meta = await cxLoadRtp(this.o.game);
    const lines = meta?.lines?.length || this.o.lineCount || 1;
    const pays = (meta?.syms || []).filter(s => s.p && s.p.some(v => v > 0)).map((s, i) => {
      const idx = meta.syms.indexOf(s);
      const ico = this.o.symHTML(idx, 'main');
      const html = typeof ico === 'string' ? ico : ico.html;
      const rows = s.p.map((v, n) => v > 0 ? `<li>${this.o.payLabels ? this.o.payLabels[n] : n + '×'} → <b>${(v / (this.o.payDivisor ? this.o.payDivisor(meta) : lines)).toLocaleString('pl-PL', { maximumFractionDigits: 2 })}×</b></li>` : '').filter(Boolean).reverse().join('');
      return `<div class="cx-pay"><div class="ico">${html}</div><div><div style="font-size:11px;font-weight:700">${cxEsc(s.n)}${s.wild ? ' · WILD' : ''}</div><ul>${rows}</ul></div></div>`;
    }).join('');
    cxModal(`<h3>${this.o.icon} ${cxEsc(this.o.title)}</h3>
      <div class="cx-rules"><ul>${(this.o.rules || []).map(r => `<li>${meta?.rtp ? r.replace(/RTP ≈ [\d,.]+%/, 'RTP ' + cxRtpPct(meta.rtp)) : r}</li>`).join('')}</ul></div>
      ${pays ? `<h4 style="margin-top:14px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Wypłaty (× stawki łącznej${meta?.lines ? ', na linię' : ''})</h4><div class="cx-paytable">${pays}</div>` : ''}
      <div style="font-size:11px;color:var(--muted)">Skróty: <b>Spacja</b> — spin/stop auto. Wygrane z wielu linii sumują się.</div>`, { wide: true });
  }
}

// Spacja = spin (gdy aktywny automat)
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || !skActive) return;
  const scr = skActive.root;
  if (!scr || !scr.classList.contains('active')) return;
  if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) { if (document.activeElement?.tagName !== 'BUTTON') return; }
  if (document.querySelector('.cx-modal, .cx-bigwin')) return;
  e.preventDefault();
  skActive.onSpinClick();
});
document.addEventListener('cx-leave', () => { if (skActive) { skActive.antStop(); skActive.auto = 0; skActive.paused = false; skActive = null; } });
document.addEventListener('cx-error', () => { if (skActive && skActive.spinning) skActive.abort('Spin anulowany'); });

// Pomocnik: rejestruje handler wyniku dla danego eventu
function skBindResult(eventName, getKit) {
  socket.on(eventName, res => { const k = getKit(); if (k) k.onResult(res); });
}
