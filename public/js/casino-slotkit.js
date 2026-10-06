// ══════════════════════════════════════════════════════════════
//  SLOTKIT — wspólny komponent UI automatów
//  Każdy automat podaje konfigurację (plansze, symbole, eventy) i funkcję
//  present(res, kit), która animuje wynik. Kit obsługuje stawki, spin,
//  auto-spin, turbo, free spiny, historię, statystyki i duże wygrane.
// ══════════════════════════════════════════════════════════════

const SK_LINE_COLORS = ['#ffd36b', '#3ff2a3', '#ff6f8a', '#7aa7ff', '#c49bff', '#ff9f43', '#4fe3ff', '#f472b6', '#a3e635', '#fb7185'];
let skActive = null;

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
  }

  // ── Montaż ekranu ─────────────────────────────────────────
  mount(table) {
    this.table = table;
    const cfg = table.config;
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
          <div class="sk-machine" style="--sk-a:${g.theme?.a || '#ffd36b'};--sk-b:${g.theme?.b || '#8b6cff'}">
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
  fillStrip(strip, items, key) {
    strip.innerHTML = items.map(si => { const s = this.cellHTML(si, key); return `<div class="sk-cell ${s.cls || ''}">${s.html}</div>`; }).join('');
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
  startSpin(keys) {
    for (const b of this.boards) {
      if (keys && !keys.includes(b.key)) continue;
      for (let c = 0; c < b.cols; c++) {
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
  stop(grid, key = 'main', { stagger, extraDelay = 0 } = {}) {
    const b = this.board(key);
    this.grids[b.key] = grid;
    const st = stagger ?? (this.turbo ? 50 : this.o.stagger);
    const base = (this.turbo ? 120 : this.o.baseSpin) + extraDelay;
    const ant = this.o.anticipate ? this.o.anticipate(grid, b.key) : null;
    const promises = [];
    let t = base;
    for (let c = 0; c < b.cols; c++) {
      if (ant !== null && ant !== undefined && c >= ant && !this.turbo) t += 650;
      const delay = t;
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
          this.fillStrip(strip, grid[c], b.key);
          [...strip.children].forEach((el, r) => { el.classList.add('land'); if (this.o.decorate) this.o.decorate(el, c, r, grid[c][r], b.key, this); });
          cxSound.play('stop');
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
        el.innerHTML = s.html;
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
    for (const b of this.boards) {
      b.el.classList.remove('dim');
      b.el.querySelectorAll('.sk-cell.hit').forEach(e => e.classList.remove('hit'));
      b.el.querySelector('.sk-svg').innerHTML = '';
    }
  }
  highlight(cells, key = 'main', dim = true) {
    const b = this.board(key);
    if (dim) b.el.classList.add('dim');
    cells.forEach(([c, r]) => this.cell(c, r, key)?.classList.add('hit'));
  }
  drawLine(cells, color, key = 'main') {
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
  }

  // ── Komunikaty / banery ──────────────────────────────────
  msg(html, cls = '') { const m = this.$('msg'); m.className = 'sk-msgbar' + (cls ? ' ' + cls : ''); m.innerHTML = html; }
  banner(html, cls = '') { this.$('banner').innerHTML = html ? `<div class="sk-banner ${cls}" style="margin-bottom:10px">${html}</div>` : ''; }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }

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
      if (!res._msgSet) this.msg(`${res.label || 'Wygrana'}: <span class="amt">+${cxFmt(res.payout)} AT$</span> <span style="opacity:.6">(${res.mult.toLocaleString('pl-PL', { maximumFractionDigits: 2 })}×)</span>`, CX_TIER_ORDER.indexOf(res.tier) >= 2 ? 'big' : 'win');
      cxSound.play(big ? 'bigwin' : 'win');
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
    try { const r = await fetch('/api/casino/game-meta/' + this.o.game); if (r.ok) meta = await r.json(); } catch (e) {}
    const lines = meta?.lines?.length || this.o.lineCount || 1;
    const pays = (meta?.syms || []).filter(s => s.p && s.p.some(v => v > 0)).map((s, i) => {
      const idx = meta.syms.indexOf(s);
      const ico = this.o.symHTML(idx, 'main');
      const html = typeof ico === 'string' ? ico : ico.html;
      const rows = s.p.map((v, n) => v > 0 ? `<li>${n}× → <b>${(v / (this.o.payDivisor ? this.o.payDivisor(meta) : lines)).toLocaleString('pl-PL', { maximumFractionDigits: 2 })}×</b></li>` : '').filter(Boolean).reverse().join('');
      return `<div class="cx-pay"><div class="ico">${html}</div><div><div style="font-size:11px;font-weight:700">${cxEsc(s.n)}${s.wild ? ' · WILD' : ''}</div><ul>${rows}</ul></div></div>`;
    }).join('');
    cxModal(`<h3>${this.o.icon} ${cxEsc(this.o.title)}</h3>
      <div class="cx-rules"><ul>${(this.o.rules || []).map(r => `<li>${r}</li>`).join('')}</ul></div>
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
document.addEventListener('cx-leave', () => { if (skActive) { skActive.auto = 0; skActive.paused = false; skActive = null; } });
document.addEventListener('cx-error', () => { if (skActive && skActive.spinning) skActive.abort('Spin anulowany'); });

// Pomocnik: rejestruje handler wyniku dla danego eventu
function skBindResult(eventName, getKit) {
  socket.on(eventName, res => { const k = getKit(); if (k) k.onResult(res); });
}
