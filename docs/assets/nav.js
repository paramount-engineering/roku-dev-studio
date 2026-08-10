// Mobile nav toggle + theme toggle — shared across all docs pages.
document.addEventListener('DOMContentLoaded', function () {
  var navToggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (navToggle && links) {
    navToggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Features page: left-sidebar navigation with a single visible panel at a time — a plain
  // hash-routed show/hide, no page reload. Only runs on features.html (guarded by the sidebar's
  // presence) so this is a no-op on every other page.
  var featuresSidebar = document.querySelector('.features-sidebar');
  if (featuresSidebar) {
    var featureLinks = Array.prototype.slice.call(featuresSidebar.querySelectorAll('[data-feature]'));
    var featurePanels = Array.prototype.slice.call(document.querySelectorAll('[data-feature-panel]'));
    var defaultFeatureId = featurePanels.length ? featurePanels[0].id : null;

    var showFeature = function (id) {
      var target = document.getElementById(id);
      var resolvedId = target && target.hasAttribute('data-feature-panel') ? id : defaultFeatureId;
      featurePanels.forEach(function (panel) {
        panel.hidden = panel.id !== resolvedId;
      });
      featureLinks.forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('data-feature') === resolvedId);
      });
      return resolvedId;
    };

    featureLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var id = link.getAttribute('data-feature');
        showFeature(id);
        history.pushState(null, '', '#' + id);
        featuresSidebar.parentElement.scrollIntoView({ block: 'start' });
      });
    });

    window.addEventListener('hashchange', function () {
      if (location.hash) showFeature(location.hash.slice(1));
    });

    showFeature(location.hash ? location.hash.slice(1) : defaultFeatureId);
  }

  // Image lightbox: click any screenshot to view it full-size, with its caption (a
  // <figcaption> when the image is wrapped in a <figure>, else its alt text). Every <img>
  // qualifies except the small header logo (.brand-icon) — no per-image opt-in needed.
  var lightboxImages = Array.prototype.filter.call(document.querySelectorAll('img'), function (img) {
    return !img.classList.contains('brand-icon');
  });
  if (lightboxImages.length) {
    var lbOverlay = document.createElement('div');
    lbOverlay.className = 'lightbox-overlay';
    lbOverlay.setAttribute('role', 'dialog');
    lbOverlay.setAttribute('aria-modal', 'true');
    lbOverlay.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="Close">' +
      '<svg class="icon" width="18" height="18"><use href="assets/icons.svg#icon-x"></use></svg>' +
      '</button>' +
      '<img alt="">' +
      '<div class="lightbox-caption"></div>';
    document.body.appendChild(lbOverlay);

    var lbImg = lbOverlay.querySelector('img');
    var lbCaption = lbOverlay.querySelector('.lightbox-caption');
    var lbClose = lbOverlay.querySelector('.lightbox-close');
    var lastFocused = null;

    var closeLightbox = function () {
      lbOverlay.classList.remove('open');
      lbImg.src = '';
      if (lastFocused) lastFocused.focus();
    };

    var openLightbox = function (img) {
      lastFocused = img;
      lbImg.src = img.currentSrc || img.src;
      var figure = img.closest('figure');
      var caption = figure ? figure.querySelector('figcaption') : null;
      lbCaption.textContent = (caption ? caption.textContent : img.getAttribute('alt') || '').trim();
      lbOverlay.classList.add('open');
      lbClose.focus();
    };

    lightboxImages.forEach(function (img) {
      img.addEventListener('click', function () { openLightbox(img); });
    });

    lbClose.addEventListener('click', closeLightbox);

    // Backdrop click-to-close, mousedown-latched: only closes when BOTH the press AND the
    // release land on the overlay itself (not the image/caption/close button) — a plain
    // click listener would also fire after a drag-select that starts on the image and is
    // released over the backdrop, closing the lightbox out from under an unrelated gesture.
    var backdropPressed = false;
    lbOverlay.addEventListener('mousedown', function (e) { backdropPressed = e.target === lbOverlay; });
    lbOverlay.addEventListener('mouseup', function (e) {
      if (backdropPressed && e.target === lbOverlay) closeLightbox();
      backdropPressed = false;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lbOverlay.classList.contains('open')) closeLightbox();
    });
  }

  // Theme: 'light' | 'dark' | null (null = follow system, the default — see assets/style.css).
  // The choice is applied instantly in <head> (before paint, see the inline script in each
  // page) to avoid a flash of the wrong theme; this only handles the click-to-cycle + icon sync.
  var STORAGE_KEY = 'rds-docs-theme';
  var themeBtn = document.querySelector('.theme-toggle');
  if (!themeBtn) return;
  var root = document.documentElement;

  function readTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function writeTheme(theme) {
    try {
      if (theme === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* private browsing / storage disabled — theme just won't persist across reloads */
    }
  }

  function updateButton(theme) {
    var iconId = theme === 'light' ? 'icon-sun' : theme === 'dark' ? 'icon-moon' : 'icon-devices';
    var label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';
    themeBtn.innerHTML = '<svg class="icon" width="16" height="16"><use href="assets/icons.svg#' + iconId + '"></use></svg>';
    themeBtn.title = 'Theme: ' + label + ' (click to change)';
    themeBtn.setAttribute('aria-label', 'Theme: ' + label);
  }

  updateButton(readTheme());

  themeBtn.addEventListener('click', function () {
    // Cycle System -> Light -> Dark -> System ...
    var current = readTheme();
    var next = current === null ? 'light' : current === 'light' ? 'dark' : null;
    if (next === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);
    writeTheme(next);
    updateButton(next);
  });
});
