/** Экранирует HTML-значимые символы перед вставкой данных API в разметку. */
const safe = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
(async () => {
  const box = document.querySelector('#railCods');
  if (box) {
    try {
      // Сгруппировать ЦОДы по коду ЕС; записи без указанной группы попадут в общий раздел.
      const r = await fetch('/api/cods');
      const cods = await r.json();
      const groups = new Map();
      cods.forEach((c) => {
        const k = c.ec || 'Без группы';
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(c);
      });
      box.innerHTML =
        [...groups]
          .map(
            ([name, items]) =>
              `<details class="rail-ec"><summary><span>${safe(name)}</span><b>${items.length}</b></summary><div class="rail-ec-items">${items.map((c) => `<a class="rail-cod" href="/#cods"><strong>${safe(c.name)}</strong><small>${safe(c.cidr || c.start || '')}</small></a>`).join('')}</div></details>`,
          )
          .join('') || '<div class="rail-empty">Нет ЦОДов</div>';
    } catch {
      // Не прерывать инициализацию оглавления, если API недоступен или вернул некорректный ответ.
      box.innerHTML = '<div class="rail-empty">Список ЦОДов недоступен</div>';
    }
  }
  const toc = [...document.querySelectorAll('.guide-toc a')],
    sections = toc.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    // Подсвечивать пункт по секции, наиболее заметной в заданной полосе просмотра.
    const io = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (active)
          toc.forEach((a) => a.classList.toggle('current', a.hash === `#${active.target.id}`));
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.2, 0.5] },
    );
    sections.forEach((s) => io.observe(s));
  }
})();
