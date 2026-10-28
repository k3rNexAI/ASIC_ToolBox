const $ = (s) => document.querySelector(s);
let cods = [],
  currentMap = null;
/** Выполняет API-запрос, разбирает JSON и превращает ответ с ошибкой в исключение. */
const api = async (u, o) => {
  const r = await fetch(u, o),
    d = await r.json();
  if (!r.ok) throw Error(d.error || 'Ошибка');
  return d;
};
/** Экранирует специальные HTML-символы перед вставкой недоверенных значений в разметку. */
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c],
  );
/** Показывает краткое уведомление и автоматически скрывает его через заданное время. */
const toast = (m) => {
  const x = $('#toast');
  x.textContent = m;
  x.classList.add('show');
  setTimeout(() => x.classList.remove('show'), 2400);
};
/** Преобразует IPv4 в число; некорректный адрес обозначается null. */
const ipN = (ip) => {
  const p = String(ip || '')
    .split('.')
    .map(Number);
  return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n < 256)
    ? ((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3]
    : null;
};
/** Возвращает строковое представление 32-битного IPv4-адреса. */
const ipT = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
/** Строит список допустимых адресов диапазона, исключая сетевой и широковещательный адреса. */
function ips(c, n) {
  const a = ipN(c.start),
    b = ipN(c.end || c.start);
  if (a === null || b === null) return [];
  // Ограничение применяется после фильтрации граничных адресов, чтобы не занимать ими ячейки.
  return Array.from({ length: b - a + 1 }, (_, i) => ipT(a + i))
    .filter((ip) => {
      const x = +ip.split('.').pop();
      return x > 0 && x < 255;
    })
    .slice(0, n);
}
function cap(m) {
  return (+m.racks || 11) * (+m.shelves || 6) * (+m.devicesPerShelf || 4);
}
/** Извлекает последнюю часть адреса для компактной подписи устройства. */
function suffix(ip) {
  return (
    String(ip || '')
      .split('.')
      .pop() || '—'
  );
}
function cod() {
  return cods.find((c) => c.id === $('#mapCodSelect').value);
}
/** Сохраняет существующие ячейки, а для новых позиций подставляет адреса из выбранного диапазона. */
function cells() {
  const n = cap(currentMap),
    old = Array.isArray(currentMap.cells) ? currentMap.cells : [],
    gen = ips(cod(), n);
  return Array.from({ length: n }, (_, i) => old[i] || { slot: i + 1, ip: gen[i] || '' });
}
/** Обновляет справочные сведения о выбранном ЦОДе. */
function meta() {
  const c = cod();
  $('#mapCodMeta').innerHTML = c
    ? `<strong>${esc(c.name)}</strong><span>Диапазон: ${esc(c.cidr || `${c.start}${c.end ? ' — ' + c.end : ''}`)}</span><span>${currentMap.racks} стеллажей × ${currentMap.shelves} полок × ${currentMap.devicesPerShelf} ASIC</span>`
    : 'Выберите ЦОД';
}
/** Отрисовывает карту, включая пустое состояние, сетку устройств и обработчики редактирования. */
function render() {
  const box = $('#rackMap');
  if (!currentMap || !cod()) {
    box.className = 'rack-map empty';
    box.innerHTML = '<div class="empty-icon">▦</div><h3>Карта не выбрана</h3>';
    meta();
    return;
  }
  // Индексы ячеек линейные: раскладка вычисляется из числа стеллажей, полок и устройств.
  const rs = +currentMap.racks,
    ss = +currentMap.shelves,
    pp = +currentMap.devicesPerShelf,
    cs = cells();
  box.className = 'rack-map builder-map';
  box.style.setProperty('--rack-min-width', `${Math.max(162, pp * 30 + 12)}px`);
  box.innerHTML = Array.from(
    { length: rs },
    (_, r) =>
      `<section class="rack"><header><b>Стеллаж ${r + 1}</b><small>${esc(cs[r * ss * pp]?.ip || '')} — ${esc(cs[(r + 1) * ss * pp - 1]?.ip || '')}</small></header>${Array.from(
        { length: ss },
        (_, s) =>
          `<div class="shelf"><div class="shelf-devices">${Array.from({ length: pp }, (_, p) => {
            const i = r * ss * pp + s * pp + p;
            return `<button class="map-device builder-cell" data-i="${i}"><b>${esc(suffix(cs[i].ip))}</b><small>${esc(cs[i].ip || 'пусто')}</small></button>`;
          }).join('')}</div></div>`,
      ).join('')}</section>`,
  ).join('');
  box.querySelectorAll('.builder-cell').forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.i,
          v = prompt('Полный IP для позиции. Пусто — очистить:', cs[i].ip || '');
        if (v !== null) {
          // Отмена prompt не меняет данные; пустая строка, напротив, очищает адрес ячейки.
          cs[i].ip = v.trim();
          currentMap.cells = cs;
          render();
        }
      }),
  );
  meta();
}
/** Загружает карту выбранного ЦОДа и приводит старые записи к структуре с настройками по умолчанию. */
async function load(id) {
  if (!id) {
    currentMap = null;
    return render();
  }
  currentMap = await api('/api/maps/' + encodeURIComponent(id));
  // Совместимость с картами, созданными до появления параметров геометрии.
  if (!currentMap.racks)
    currentMap = {
      ...currentMap,
      racks: 11,
      shelves: 6,
      devicesPerShelf: 4,
      cells: currentMap.cells || [],
    };
  $('#mapRacks').value = currentMap.racks;
  $('#mapShelves').value = currentMap.shelves;
  $('#mapDevicesPerShelf').value = currentMap.devicesPerShelf;
  render();
}
/** Применяет введённые размеры и сбрасывает ячейки для повторной генерации раскладки. */
function generate() {
  if (!currentMap) return toast('Выберите ЦОД');
  currentMap.racks = +$('#mapRacks').value || 11;
  currentMap.shelves = +$('#mapShelves').value || 6;
  currentMap.devicesPerShelf = +$('#mapDevicesPerShelf').value || 4;
  currentMap.cells = [];
  render();
}
/** Отправляет текущие настройки и ячейки на сервер; при успехе обновляет карту и уведомляет пользователя. */
async function save() {
  if (!currentMap) return toast('Выберите ЦОД');
  currentMap = await api('/api/maps/' + currentMap.codId, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      racks: +$('#mapRacks').value,
      shelves: +$('#mapShelves').value,
      devicesPerShelf: +$('#mapDevicesPerShelf').value,
      cells: cells(),
    }),
  });
  render();
  toast('Карта сохранена');
}
/** Формирует сгруппированный список ЦОДов для боковой панели. */
function renderSidebarCods() {
  const box = $('#railCods');
  if (!box) return;
  const groups = new Map();
  // Группировка сохраняет исходный порядок появления групп и записей.
  cods.forEach((c) => {
    const g = c.ec || 'Без группы';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  });
  box.innerHTML = cods.length
    ? [...groups.entries()]
        .map(
          ([g, items]) =>
            `<details class="rail-ec"><summary><span>${esc(g)}</span><b>${items.length}</b></summary><div class="rail-ec-items">${items.map((c) => `<a class="rail-cod" href="/#cods" title="${esc(c.name)}"><strong>${esc(c.name)}</strong><small>${esc(c.cidr || `${c.start || ''}${c.end ? ' — ' + c.end : ''}`)}</small></a>`).join('')}</div></details>`,
        )
        .join('')
    : '<div class="rail-empty">Нет ЦОДов</div>';
}
/** Загружает справочник ЦОДов и связывает элементы интерфейса с действиями карты. */
async function init() {
  cods = await api('/api/cods');
  renderSidebarCods();
  $('#mapCodSelect').innerHTML =
    '<option value="">Выберите ЦОД</option>' +
    cods.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#mapCodSelect').onchange = (e) => load(e.target.value);
  $('#mapGenerateBtn').onclick = generate;
  $('#mapSaveBtn').onclick = save;
}
// Ошибка начальной загрузки выводится в том же пользовательском уведомлении, что и остальные ошибки API.
init().catch((e) => toast(e.message));
