/* ============================================================
   ORBIT MOBILE — "Install ORBIT" (build 262)
   · Android / Chrome / Edge: shows an Install banner and opens the browser's install window
   · iPhone / iPad (Safari): shows how to add ORBIT to the Home Screen (Share → Add to Home Screen)
   · Hidden when ORBIT already runs as an installed app, and for 14 days after "×"
   · Profile → can also call window.orbitInstall() from a button
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'orbit_install_dismissed';
  const DAYS = 14;
  const standalone = () => (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) || window.navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\//i.test(ua);
  const isPhone = () => (window.matchMedia && matchMedia('(max-width: 760px)').matches) || isIOS || /android/i.test(ua);
  const dismissedRecently = () => { try { const t = +localStorage.getItem(KEY) || 0; return t && (Date.now() - t) < DAYS * 864e5; } catch (e) { return false; } };
  const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} hide(); };
  let deferred = null;

  /* mark the page so styles / other scripts can tell it runs as an installed app */
  if (standalone()) document.documentElement.classList.add('orbit-installed');

  function hide() { const b = document.getElementById('orbInstall'); if (b) b.remove(); }
  function banner(html) {
    hide(); const d = document.createElement('div'); d.id = 'orbInstall'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Install ORBIT');
    d.innerHTML = `<img src="icons/orbit-192.png" alt="">${html}<button class="x" aria-label="Not now">×</button>`;
    d.querySelector('.x').addEventListener('click', dismiss);
    const go = d.querySelector('.go'); if (go) go.addEventListener('click', install);
    document.body.appendChild(d);
  }
  const shareIcon = '<svg class="share" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

  async function install() {
    if (deferred) {
      deferred.prompt();
      try { const r = await deferred.userChoice; if (r && r.outcome === 'accepted') hide(); } catch (e) {}
      deferred = null; return true;
    }
    if (isIOS) { showIOS(true); return true; }
    return false;
  }
  window.orbitInstall = install;
  window.orbitIsInstalled = standalone;

  function showAndroid() {
    if (standalone() || dismissedRecently() || !isPhone()) return;
    banner('<div class="t"><b>Install ORBIT</b><small>Open it from your home screen, full screen like an app.</small></div><button class="go">Install</button>');
  }
  function showIOS(force) {
    if (standalone() || (!force && (dismissedRecently() || !isIOSSafari))) return;
    banner(`<div class="t"><b>Add ORBIT to your Home Screen</b><small>Tap ${shareIcon} <b style="display:inline;font-size:inherit">Share</b>, then <b style="display:inline;font-size:inherit">Add to Home Screen</b>.</small></div>`);
  }

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; setTimeout(showAndroid, 2500); });
  window.addEventListener('appinstalled', () => { hide(); deferred = null; document.documentElement.classList.add('orbit-installed'); });
  if (isIOSSafari) setTimeout(() => showIOS(false), 4000);
})();
