// ══════════════════════════════════════════════════════════════
//  PWA — service worker, instalacja aplikacji, wymuszony landscape
// ══════════════════════════════════════════════════════════════
const atPwa = (() => {
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const fsSupported = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  let deferred = null;

  document.documentElement.classList.toggle('pwa-standalone', standalone);
  document.documentElement.classList.toggle('touch', touch);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW:', e)));
  }

  // ── Instalacja ───────────────────────────────────────────
  const canInstall = () => !standalone && (!!deferred || ios);
  function refreshButtons() {
    document.querySelectorAll('[data-pwa-install]').forEach(b => { b.hidden = !canInstall(); });
    document.querySelectorAll('[data-pwa-fs]').forEach(b => { b.hidden = !(touch && fsSupported && !standalone); });
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refreshButtons(); });
  addEventListener('appinstalled', () => { deferred = null; refreshButtons(); if (typeof showToast === 'function') showToast('📲 AT Gaming zainstalowane!', 'success'); });

  async function install() {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice.catch(() => ({}));
      if (outcome === 'accepted') deferred = null;
      refreshButtons();
      return;
    }
    if (ios) iosHelp();
  }
  function iosHelp() {
    const box = document.createElement('div');
    box.className = 'pwa-sheet';
    box.innerHTML = `<div class="pwa-sheet-box">
      <img src="/icons/icon-192.png" alt="">
      <h3>Zainstaluj AT Gaming</h3>
      <ol><li>Stuknij <b>Udostępnij</b> <span class="pwa-ico">⬆️</span> na pasku Safari</li>
      <li>Wybierz <b>Do ekranu początkowego</b> <span class="pwa-ico">➕</span></li>
      <li>Uruchamiaj grę z ikony — pełny ekran, bez paska przeglądarki</li></ol>
      <button class="pwa-btn">OK</button></div>`;
    box.onclick = e => { if (e.target === box || e.target.classList.contains('pwa-btn')) box.remove(); };
    document.body.appendChild(box);
  }

  // ── Orientacja ───────────────────────────────────────────
  async function lockLandscape() {
    try { await screen.orientation?.lock?.('landscape'); return true; } catch (e) { return false; }
  }
  // Pełny ekran + blokada poziomu (Android: obraca ekran nawet przy wyłączonym autoobracaniu)
  async function goLandscape() {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      }
    } catch (e) {}
    const ok = await lockLandscape();
    if (!ok && ios) {
      const t = document.querySelector('#rotate-overlay .ro-hint');
      if (t) t.textContent = 'Na iPhonie obróć telefon ręcznie (wyłącz blokadę orientacji w Centrum sterowania).';
    }
  }
  async function toggleFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      try { screen.orientation?.unlock?.(); } catch (e) {}
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else goLandscape();
  }

  function buildOverlay() {
    if (document.getElementById('rotate-overlay')) return;
    const o = document.createElement('div');
    o.id = 'rotate-overlay';
    o.innerHTML = `<div class="ro-phone"><div class="ro-screen">🎰</div></div>
      <h2>Obróć telefon poziomo</h2>
      <p class="ro-hint">AT Gaming działa w trybie poziomym — tak jak automaty w kasynie.</p>
      ${fsSupported && !ios ? '<button class="pwa-btn" id="ro-go">⛶ Pełny ekran w poziomie</button>' : ''}
      ${!standalone ? '<button class="pwa-btn ghost" data-pwa-install hidden>📲 Zainstaluj aplikację</button>' : ''}`;
    document.body.appendChild(o);
    o.querySelector('#ro-go')?.addEventListener('click', goLandscape);
    o.querySelector('[data-pwa-install]')?.addEventListener('click', install);
  }

  function init() {
    buildOverlay();
    document.addEventListener('click', e => {
      if (e.target.closest('[data-pwa-install]')) install();
      if (e.target.closest('[data-pwa-fs]')) toggleFullscreen();
    });
    refreshButtons();
    if (standalone) lockLandscape();
    // Po wyjściu z pełnego ekranu przeglądarka zdejmuje blokadę — overlay znów pilnuje orientacji
    document.addEventListener('fullscreenchange', refreshButtons);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return { install, goLandscape, toggleFullscreen, refreshButtons, get standalone() { return standalone; }, get fsAvailable() { return touch && fsSupported && !standalone; }, get canInstall() { return canInstall(); } };
})();
