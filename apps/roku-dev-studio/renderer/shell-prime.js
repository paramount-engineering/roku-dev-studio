/**
 * Cold-start shell hints before renderer/dist/app.js loads.
 * External script so index.html CSP can use script-src 'self' without 'unsafe-inline'.
 */
(function () {
  try {
    var p =
      (window.rdsShell && window.rdsShell.platform) ||
      (typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? 'darwin' : '');
    if (p) document.body.classList.add('platform-' + p);
    document.documentElement.style.setProperty('--app-zoom', '1');
  } catch (e) {
    /* ignore */
  }
})();
