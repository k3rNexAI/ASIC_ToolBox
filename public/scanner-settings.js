(() => {
  const $ = (selector) => document.querySelector(selector);
  const mount = $('#scannerSettingsMount');
  if (!mount) return;

  mount.innerHTML = `
    <details class="scan-settings" id="scannerSettingsPanel">
      <summary><strong>⚙ Настройки сканирования</strong><span>Основные параметры · протоколы · авторизация</span></summary>
      <form id="scanSettingsForm">
        <div class="scan-settings-sections">
          <section class="scan-settings-section scan-settings-main">
            <header><strong>Основные настройки</strong><small>Общие параметры каждого запуска</small></header>
            <div class="scan-settings-main-fields">
              <label>Протокол по умолчанию
                <select id="mapProtocol"><option value="hybrid">Быстрый CGMiner скан + детали только проблемных</option><option value="rest">REST API — только REST, без CGMiner</option><option value="auto">Авто: REST → gRPC → CGMiner (последовательно)</option><option value="grpc">gRPC</option><option value="legacy">CGMiner / стоковый TCP 4028</option></select>
              </label>
              <label>Размер пачки ASIC<input id="scanBatchSize" type="number" min="1" max="256" step="1" required></label>
              <label>Максимум IP за запуск<input id="scanMaxIps" type="number" min="1" max="65536" step="1" required></label>
            </div>
          </section>

          <section class="scan-settings-section scan-protocol-section">
            <header><strong>Настройки протоколов</strong><small>Порты, ожидание ответа и соединения</small></header>
            <div class="scan-protocol-cards">
              <fieldset class="scan-protocol-card">
                <legend>REST API</legend>
                <label>Порт<input id="scanRestPort" type="number" min="1" max="65535" step="1" required></label>
                <label>Таймаут, мс<input id="scanRestTimeout" type="number" min="500" max="30000" step="100" required></label>
                <label>Соединений на ASIC<input id="scanRestSockets" type="number" min="1" max="16" step="1" required></label>
                <label class="scan-setting-check"><input id="scanRestKeepAlive" type="checkbox"> Keep-Alive</label>
              </fieldset>
              <fieldset class="scan-protocol-card">
                <legend>gRPC</legend>
                <label>Порт<input id="scanGrpcPort" type="number" min="1" max="65535" step="1" required></label>
                <label>Таймаут, мс<input id="scanGrpcTimeout" type="number" min="3000" max="30000" step="500" required></label>
              </fieldset>
              <fieldset class="scan-protocol-card">
                <legend>TCP / BOSminer</legend>
                <label>Порт<input id="scanLegacyPort" type="number" min="1" max="65535" step="1" required></label>
                <label>Таймаут, мс<input id="scanLegacyTimeout" type="number" min="300" max="20000" step="100" required></label>
              </fieldset>
            </div>
          </section>

          <section class="scan-settings-section scan-auth-section">
            <header><strong>Данные для авторизации</strong><small>Используются для запросов к ASIC и SSH-доступа</small></header>
            <div class="scan-auth-fields">
              <label>Пользователь ASIC<input id="scanUsername" type="text" autocomplete="username" maxlength="128" required></label>
              <label class="scan-password-label">Пароль ASIC
                <span class="scan-password-control"><input id="scanPassword" type="password" autocomplete="current-password" maxlength="512"><button id="toggleScanPassword" type="button" class="button secondary small-button" aria-controls="scanPassword" aria-pressed="false">Показать</button></span>
              </label>
              <label class="scan-setting-check scan-clear-password"><input id="scanClearPassword" type="checkbox"> Очистить сохранённый пароль</label>
            </div>
          </section>
        </div>
        <p class="scan-settings-note">Гибридный режим по умолчанию использует CGMiner/TCP 4028 для быстрого прохода всех ASIC. Подробный REST-опрос выполняется только для проблемных Braiins ASIC; SSH-проверка NoPIC не задерживает массовый скан. «Авто» проверяет REST → gRPC → CGMiner последовательно и может быть медленнее. Сканирование и мониторинг не запускаются одновременно. Пароль маскируется и хранится локально; настройки применяются сразу.</p>
        <div class="scan-settings-actions"><button id="applyScanSettings" class="button primary small-button" type="submit">Применить настройки</button><span id="scanSettingsStatus" role="status" aria-live="polite">Загрузка настроек…</span></div>
      </form>
    </details>`;

  /** Заполняет поле настроек, если соответствующий элемент присутствует в DOM. */
  const setValue = (id, value) => {
    const el = $(`#${id}`);
    if (el) el.value = value;
  };
  /** Синхронизирует производные переключатели и подписи протоколов с выбранным режимом. */
  const syncProtocolControls = (settings) => {
    const selected = settings.protocol;
    // Режим auto включает все механизмы, а отдельные режимы — только свой протокол.
    const checked =
      selected === 'auto'
        ? { useRest: true, useGrpc: true, useLegacy: true }
        : {
            useRest: selected === 'rest',
            useGrpc: selected === 'grpc',
            useLegacy: selected === 'legacy' || selected === 'hybrid',
          };
    for (const [id, value] of Object.entries(checked)) {
      const input = $(`#${id}`);
      if (input) input.checked = value;
    }
    const portLabels = [
      ['useRest', `REST API ${settings.restPort}`],
      ['useGrpc', `gRPC ${settings.grpcPort}`],
      ['useLegacy', `TCP ${settings.legacyPort}`],
    ];
    for (const [id, text] of portLabels) {
      const strong = $(`#${id}`)?.parentElement?.querySelector('strong');
      if (strong) strong.textContent = text;
    }
    // Сообщаем остальным компонентам, что применённый набор настроек обновился.
    window.dispatchEvent(new CustomEvent('scanner-settings-applied', { detail: settings }));
  };
  /** Отображает полученные настройки и возвращает пароль в безопасное маскированное состояние. */
  const fill = (settings) => {
    window.appliedScanSettings = settings;
    setValue('mapProtocol', settings.protocol);
    setValue('scanBatchSize', settings.batchSize);
    setValue('scanMaxIps', settings.maxScanIps);
    setValue('scanRestTimeout', settings.restTimeoutMs);
    setValue('scanGrpcTimeout', settings.grpcTimeoutMs);
    setValue('scanLegacyTimeout', settings.legacyTimeoutMs);
    setValue('scanRestPort', settings.restPort);
    setValue('scanGrpcPort', settings.grpcPort);
    setValue('scanLegacyPort', settings.legacyPort);
    setValue('scanRestSockets', settings.restSocketsPerDevice);
    $('#scanRestKeepAlive').checked = Boolean(settings.restKeepAlive);
    $('#scanUsername').value = settings.username;
    $('#scanPassword').value = settings.password || '';
    $('#scanPassword').placeholder = settings.passwordConfigured
      ? 'Сохранённый пароль'
      : 'Пароль не задан';
    $('#scanClearPassword').checked = false;
    $('#scanPassword').disabled = false;
    const reveal = $('#toggleScanPassword');
    $('#scanPassword').type = 'password';
    reveal.textContent = 'Показать';
    reveal.setAttribute('aria-pressed', 'false');
    syncProtocolControls(settings);
  };
  // При переходе по якорю раскрываем панель и прокручиваем к ней после отрисовки кадра.
  if (location.hash === '#scannerSettingsPanel') {
    const panel = $('#scannerSettingsPanel');
    panel.open = true;
    requestAnimationFrame(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  const form = $('#scanSettingsForm');
  const status = $('#scanSettingsStatus');
  const password = $('#scanPassword');
  const reveal = $('#toggleScanPassword');
  form.addEventListener('input', () => {
    status.textContent = 'Есть изменения — нажмите «Применить настройки»';
  });
  reveal.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    reveal.textContent = visible ? 'Скрыть' : 'Показать';
    reveal.setAttribute('aria-pressed', String(visible));
    password.focus({ preventScroll: true });
  });
  $('#scanClearPassword').addEventListener('change', (event) => {
    password.disabled = event.target.checked;
    if (password.disabled) password.value = '';
  });
  password.addEventListener('input', () => {
    if ($('#scanClearPassword').checked) $('#scanClearPassword').checked = false;
    password.disabled = false;
  });

  // Сохраняем значения формы одним запросом; интерфейс блокируется до завершения операции.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#applyScanSettings');
    button.disabled = true;
    status.textContent = 'Сохранение…';
    const payload = {
      protocol: $('#mapProtocol').value,
      batchSize: Number($('#scanBatchSize').value),
      maxScanIps: Number($('#scanMaxIps').value),
      restTimeoutMs: Number($('#scanRestTimeout').value),
      grpcTimeoutMs: Number($('#scanGrpcTimeout').value),
      legacyTimeoutMs: Number($('#scanLegacyTimeout').value),
      restPort: Number($('#scanRestPort').value),
      grpcPort: Number($('#scanGrpcPort').value),
      legacyPort: Number($('#scanLegacyPort').value),
      restSocketsPerDevice: Number($('#scanRestSockets').value),
      restKeepAlive: $('#scanRestKeepAlive').checked,
      username: $('#scanUsername').value,
      password: password.value,
      clearPassword: $('#scanClearPassword').checked,
    };
    try {
      const settings = await fetchJson('/api/scanner-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      fill(settings);
      status.textContent = 'Настройки применены · перезапуск не требуется';
    } catch (error) {
      // Ошибка остаётся в статусной строке, а finally в любом случае разблокирует кнопку.
      status.textContent = `Не удалось применить: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });

  // Публикуем Promise начальной загрузки, чтобы другие части страницы могли дождаться настроек.
  window.scannerSettingsReady = (async () => {
    try {
      const settings = await fetchJson('/api/scanner-settings');
      fill(settings);
      status.textContent = 'Настройки загружены';
      return settings;
    } catch (error) {
      // Возвращаем null при сбое: страница остаётся доступной, а причина видна пользователю.
      status.textContent = `Настройки не загружены: ${error.message}`;
      return null;
    }
  })();

  /** Выполняет JSON-запрос и преобразует HTTP-ошибки в понятное исключение для вызывающего кода. */
  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка запроса');
    return data;
  }
})();
