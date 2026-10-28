(() => {
  'use strict';
  const storageKey = 'asic-toolbox-theme';
  const themes = new Set(['original', 'soft-dark', 'mist-sage']);
  const root = document.documentElement;

  const normalize = (value) => (themes.has(value) ? value : 'original');
  const apply = (value, persist = false) => {
    const theme = normalize(value);
    root.dataset.theme = theme;
    document.querySelectorAll('[data-theme-switch]').forEach((select) => {
      select.value = theme;
    });
    if (persist) {
      try {
        localStorage.setItem(storageKey, theme);
      } catch {}
    }
  };

  let initial = 'original';
  try {
    initial = normalize(localStorage.getItem(storageKey));
  } catch {}
  apply(initial);

  document.querySelectorAll('[data-theme-switch]').forEach((select) => {
    select.addEventListener('change', () => apply(select.value, true));
  });

  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) apply(event.newValue || 'original');
  });
})();
