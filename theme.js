(function() {
  var STORAGE_KEY = 'dc_theme';

  function getTheme() {
    try {
      var t = localStorage.getItem(STORAGE_KEY);
      if (t === 'light' || t === 'dark') return t;
    } catch (e) {}
    return 'dark';
  }

  function syncThemeToggleBtn(theme) {
    var btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    var isLight = theme === 'light';
    if (btn.classList.contains('nav-item')) {
      btn.innerHTML = '<span class="nav-icon">' + (isLight ? '☀' : '🌙') + '</span> ' + (isLight ? 'Light mode' : 'Dark mode');
    } else {
      btn.textContent = isLight ? '☀' : '🌙';
    }
    btn.title = isLight ? 'Switch to dark theme' : 'Switch to light theme';
    btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
  }

  function applyTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    syncThemeToggleBtn(theme);
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  function toggleTheme() {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    if (typeof renderAll === 'function') try { renderAll(); } catch (e) {}
    else if (typeof renderBA === 'function') try { renderBA(); } catch (e) {}
  }

  function initTheme() {
    applyTheme(getTheme());
  }

  window.getTheme = getTheme;
  window.applyTheme = applyTheme;
  window.toggleTheme = toggleTheme;
  window.initTheme = initTheme;

  initTheme();
  document.addEventListener('DOMContentLoaded', function() {
    syncThemeToggleBtn(getTheme());
  });
})();
