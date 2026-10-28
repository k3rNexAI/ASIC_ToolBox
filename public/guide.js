/**
 * Преобразует значение в текст и заменяет символы, которые браузер иначе
 * воспринял бы как HTML-разметку. Результат безопаснее вставлять в HTML-шаблон;
 * функция используется ниже для названий и адресов, полученных из API.
 */
const safe = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
(async () => {
  const box = document.querySelector('#railCods');
  // Наполняем боковой список только если его контейнер есть на этой странице.
  if (box) {
    try {
      // Запрашиваем данные ЦОДов; await позволяет дождаться ответа и его JSON,
      // прежде чем строить список. Ошибка сети или разбора попадёт в catch ниже.
      const r = await fetch('/api/cods');
      const cods = await r.json();
      // Map хранит для каждого кода ЕС массив записей; отсутствие кода
      // объединяет запись в раздел «Без группы».
      const groups = new Map();
      cods.forEach((c) => {
        const k = c.ec || 'Без группы';
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(c);
      });
      // Превращаем группы в раскрывающиеся HTML-разделы. safe защищает
      // подставляемые значения, а join соединяет ссылки без лишних запятых.
      // Если групп нет, вместо пустого списка показываем отдельное сообщение.
      box.innerHTML =
        [...groups]
          .map(
            ([name, items]) =>
              `<details class="rail-ec"><summary><span>${safe(name)}</span><b>${items.length}</b></summary><div class="rail-ec-items">${items.map((c) => `<a class="rail-cod" href="/#cods"><strong>${safe(c.name)}</strong><small>${safe(c.cidr || c.start || '')}</small></a>`).join('')}</div></details>`,
          )
          .join('') || '<div class="rail-empty">Нет ЦОДов</div>';
    } catch {
      // Ошибка загрузки или разбора не должна мешать настройке оглавления ниже;
      // показываем состояние ошибки непосредственно в контейнере списка.
      box.innerHTML = '<div class="rail-empty">Список ЦОДов недоступен</div>';
    }
  }
  // Находим ссылки оглавления и соответствующие им существующие разделы страницы.
  // filter(Boolean) убирает ссылки, для которых не нашлось целевого элемента.
  const toc = [...document.querySelectorAll('.guide-toc a')],
    sections = toc.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  // Observer сообщает, когда разделы входят в заданную область просмотра.
  // Проверка позволяет оставить страницу работоспособной в браузерах без этой возможности.
  if ('IntersectionObserver' in window) {
    // При изменении видимости выбираем вошедший в область раздел с наибольшей
    // видимой долей и отмечаем соответствующую ссылку оглавления как текущую.
    const io = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (active)
          toc.forEach((a) => a.classList.toggle('current', a.hash === `#${active.target.id}`));
      },
      // Полоса сдвинута внутрь окна: это задаёт, где отслеживать разделы;
      // пороги указывают Observer, при каких долях видимости присылать события.
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.2, 0.5] },
    );
    // Подключаем наблюдение только к найденным выше разделам страницы.
    sections.forEach((s) => io.observe(s));
  }
})();
