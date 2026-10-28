(() => {
  'use strict';
  const storageKey = 'asic-toolbox-theme';
  const themes = new Set(['original', 'soft-dark', 'mist-sage']);
  const root = document.documentElement;

  /** Проверяет значение по списку themes и возвращает его, если тема поддерживается.
   * Для пустого или неизвестного значения выбирает 'original', чтобы страница
   * не получила тему, для которой у неё может не быть оформления.
   */
  const normalize = (value) => (themes.has(value) ? value : 'original');
  /** Применяет тему к документу: обновляет атрибут корневого элемента и все
   * переключатели темы. Вызывается при загрузке, выборе в переключателе и
   * изменении из другой вкладки. Если persist равен true, также запоминает
   * выбор в localStorage, чтобы восстановить его при следующем открытии.
   */
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
        // Браузер может запретить доступ к localStorage (например, настройками
        // приватности). Не прерываем работу: тема уже применена выше и остаётся
        // активной до закрытия или перезагрузки этой страницы.
      }
    }
  };

  // Сначала берём значение по умолчанию, затем пытаемся восстановить последний
  // выбор из localStorage. normalize также отсекает сохранённые неизвестные темы.
  let initial = 'original';
  try {
    initial = normalize(localStorage.getItem(storageKey));
  } catch {
    // Если браузер запретил чтение localStorage, initial остаётся 'original'.
  }
  // Передаём восстановленный выбор в apply; при запуске его не нужно записывать обратно.
  apply(initial);

  // Находим переключатели в документе и подписываем каждый на событие change.
  // Когда пользователь выбирает значение, apply применяет его и сохраняет в localStorage.
  document.querySelectorAll('[data-theme-switch]').forEach((select) => {
    select.addEventListener('change', () => apply(select.value, true));
  });

  // Браузер отправляет событие storage этой вкладке, когда значение меняется
  // в другой вкладке того же сайта. Используем новое значение (или тему по
  // умолчанию, если запись удалили) и не сохраняем его повторно.
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) apply(event.newValue || 'original');
  });
})();
