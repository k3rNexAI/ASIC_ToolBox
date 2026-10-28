const $ = (s) => document.querySelector(s);
let cods = [],
  currentMap = null;
/** Отправляет запрос на сервер и возвращает разобранный JSON-ответ. Параметр u — адрес, o — настройки fetch (например, метод и тело запроса). Если сервер сообщил об ошибке, выбрасывает исключение с её текстом: вызывающие функции могут обработать его через catch. */
const api = async (u, o) => {
  const r = await fetch(u, o),
    d = await r.json();
  if (!r.ok) throw Error(d.error || 'Ошибка');
  return d;
};
/** Превращает значение в безопасный для вставки в HTML текст: символы разметки заменяются на специальные HTML-коды. Это не даёт имени или IP, полученному от пользователя или сервера, стать исполняемой разметкой. Возвращённую строку используют при сборке HTML ниже. */
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c],
  );
/** Показывает сообщение m в общем элементе уведомлений, добавляя класс видимости. Таймер через 2,4 секунды убирает этот класс; функцию вызывают при сохранении, отсутствии выбора и ошибках загрузки. */
const toast = (m) => {
  const x = $('#toast');
  x.textContent = m;
  x.classList.add('show');
  setTimeout(() => x.classList.remove('show'), 2400);
};
/** Разбирает IPv4-адрес на четыре числа и складывает октеты в одно число, чтобы адреса можно было сравнивать и перебирать арифметически. При неверном количестве частей или значениях вне 0–255 возвращает null; ips использует это как признак некорректной границы диапазона. */
const ipN = (ip) => {
  const p = String(ip || '')
    .split('.')
    .map(Number);
  return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n < 256)
    ? ((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3]
    : null;
};
/** Делит числовое представление IPv4 на четыре октета и соединяет их точками. ips вызывает эту обратную к ipN функцию для каждого адреса диапазона. */
const ipT = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
/** Строит не более n адресов для диапазона ЦОДа c: границы start/end переводятся в числа, затем каждый адрес обратно в строку. Если граница некорректна, возвращается пустой список. Фильтр убирает адреса, оканчивающиеся на .0 и .255 (сетевые/широковещательные в обычных подсетях), а slice ограничивает список размером карты. */
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
/** Считает число ячеек карты m как произведение стеллажей, полок и устройств на полке. Значения по умолчанию дают разумные размеры, если параметр отсутствует или равен нулю; результат определяет длину раскладки. */
function cap(m) {
  return (+m.racks || 11) * (+m.shelves || 6) * (+m.devicesPerShelf || 4);
}
/** Возвращает последний октет IP для короткой подписи кнопки устройства; если адрес пуст, показывает тире. */
function suffix(ip) {
  return (
    String(ip || '')
      .split('.')
      .pop() || '—'
  );
}
/** Находит в уже загруженном списке ЦОД запись, выбранную в выпадающем списке; результат используют для диапазона IP и справочной подписи. */
function cod() {
  return cods.find((c) => c.id === $('#mapCodSelect').value);
}
/** Собирает массив ячеек нужной длины для текущей карты. Ранее сохранённые ячейки остаются на своих позициях; для новых берутся последовательные IP из диапазона выбранного ЦОДа. Массив используется при отрисовке и отправке на сервер. */
function cells() {
  const n = cap(currentMap),
    old = Array.isArray(currentMap.cells) ? currentMap.cells : [],
    gen = ips(cod(), n);
  return Array.from({ length: n }, (_, i) => old[i] || { slot: i + 1, ip: gen[i] || '' });
}
/** Обновляет подпись рядом с картой: показывает имя, диапазон IP и размеры выбранного ЦОДа либо приглашение выбрать его. Данные вставляются как HTML, поэтому текстовые значения проходят через esc. */
function meta() {
  const c = cod();
  $('#mapCodMeta').innerHTML = c
    ? `<strong>${esc(c.name)}</strong><span>Диапазон: ${esc(c.cidr || `${c.start}${c.end ? ' — ' + c.end : ''}`)}</span><span>${currentMap.racks} стеллажей × ${currentMap.shelves} полок × ${currentMap.devicesPerShelf} ASIC</span>`
    : 'Выберите ЦОД';
}
/** Перерисовывает карту в элементе #rackMap. Если карта или ЦОД не выбраны, показывает пустое состояние; иначе строит кнопки устройств по линейному списку ячеек и назначает им редактирование IP. Вызывается после загрузки, изменения размеров и правки ячейки. */
function render() {
  const box = $('#rackMap');
  if (!currentMap || !cod()) {
    box.className = 'rack-map empty';
    box.innerHTML = '<div class="empty-icon">▦</div><h3>Карта не выбрана</h3>';
    meta();
    return;
  }
  // Ячейки хранятся одним списком, а номер ячейки вычисляется по трём координатам: стеллажу, полке и месту на полке.
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
          // null означает нажатие «Отмена» и оставляет карту без изменений; подтверждённый пустой ввод очищает IP. После правки сохраняем массив в карте и перерисовываем кнопки.
          cs[i].ip = v.trim();
          currentMap.cells = cs;
          render();
        }
      }),
  );
  meta();
}
/** Загружает карту по id с сервера. Если id пуст, сбрасывает текущую карту и показывает пустое состояние; старые карты без размеров дополняются настройками по умолчанию, после чего поля формы и сетка синхронизируются с полученными данными. */
async function load(id) {
  if (!id) {
    currentMap = null;
    return render();
  }
  currentMap = await api('/api/maps/' + encodeURIComponent(id));
  // Старые записи могли не содержать размеры сетки: добавляем их, не теряя остальные поля и уже сохранённые ячейки.
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
/** Берёт размеры из полей формы, подставляет значения по умолчанию для пустого/нулевого ввода и пересобирает карту. Ячейки очищаются намеренно: при следующих cells() позиции и адреса будут сформированы заново под новую геометрию. */
function generate() {
  if (!currentMap) return toast('Выберите ЦОД');
  currentMap.racks = +$('#mapRacks').value || 11;
  currentMap.shelves = +$('#mapShelves').value || 6;
  currentMap.devicesPerShelf = +$('#mapDevicesPerShelf').value || 4;
  currentMap.cells = [];
  render();
}
/** Отправляет размеры и подготовленный массив ячеек методом PUT на сервер. Ответ заменяет локальную карту и отображается; ошибки API не скрываются здесь и передаются вызывающему обработчику (например, обработчику клика/общей логике интерфейса). */
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
/** Строит боковую панель из списка cods: записи объединяются по ec, а ЦОДы без группы попадают в «Без группы». Если контейнера панели нет, функция ничего не меняет; текстовые поля экранируются перед сборкой HTML. */
function renderSidebarCods() {
  const box = $('#railCods');
  if (!box) return;
  const groups = new Map();
  // Map хранит группы в порядке первого появления; push сохраняет порядок ЦОДов внутри каждой группы.
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
/** Начальная настройка страницы: загружает список ЦОДов с сервера, наполняет им боковую панель и выпадающий список, затем связывает выбор ЦОДа и кнопки с загрузкой, генерацией и сохранением карты. */
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
// init возвращает Promise; catch ловит ошибки запроса или настройки и показывает их текст пользователю тем же уведомлением, что и остальные сообщения.
init().catch((e) => toast(e.message));
