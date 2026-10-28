(() => {
  'use strict';
  const storageKey = 'asic-toolbox-theme';
  const themes = new Set(['original', 'soft-dark', 'mist-sage']);
  const root = document.documentElement;

  /** Возвращает поддерживаемую тему; неизвестные значения безопасно сбрасывает к исходной. */
  const normalize = (value) => (themes.has(value) ? value : 'original');
  /** Применяет тему ко всему документу и, по запросу, сохраняет выбор пользователя. */
  const apply = (value, persist = false) => {
    const theme = normalize(value);
    root.dataset.theme = theme;
    document.querySelectorAll('[data-theme-switch]').forEach((select) => {
      select.value = theme;
    });
    if (persist) {
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // Хранилище может быть недоступно; тема остаётся применённой в текущем документе.
      }
    }
  };

  let initial = 'original';
  try {
    initial = normalize(localStorage.getItem(storageKey));
  } catch {
    // При запрете доступа к хранилищу используем тему по умолчанию.
  }
  apply(initial);

  // Синхронизируем каждый переключатель с текущей темой и сохраняем новые выборы.
  document.querySelectorAll('[data-theme-switch]').forEach((select) => {
    select.addEventListener('change', () => apply(select.value, true));
  });

  // Изменения в другой вкладке применяются без повторной записи в хранилище.
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) apply(event.newValue || 'original');
  });
})();
