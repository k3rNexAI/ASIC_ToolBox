const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const APP_ROOT = path.dirname(process.execPath);
const NODE = path.join(APP_ROOT, 'runtime', 'node.exe');
const SERVER = path.join(APP_ROOT, 'server.js');
const HOST = '127.0.0.1';
const BASE_PORT = Number(process.env.PORT || 4180);
let child = null;
let stopping = false;

/**
 * Проверяет HTTP-ответ приложения на указанном локальном порту.
 * Возвращает Promise (результат, который появится позже): объект со статусом
 * и текстом ответа либо null, если соединиться не удалось. main() использует
 * это для отличия уже запущенного ASIC ToolBox от посторонней службы.
 * Короткий таймаут и обработчик ошибки не дают проверке зависнуть: при сбое
 * запрос закрывается, а ошибка считается отсутствием готового приложения.
 */
function request(port) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: HOST, port, path: '/', timeout: 700 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (part) => {
        body += part;
      });
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}
/**
 * Проверяет, можно ли занять указанный порт на локальном компьютере.
 * Возвращает Promise с true, если соединение не удалось из-за отказа или
 * недоступного адреса (порт подходит), и false, если соединение установлено
 * (порт уже занят). main() вызывает проверку для выбора порта серверу;
 * ограничение времени и закрытие сокета не оставляют пробную связь открытой.
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: HOST, port });
    socket.setTimeout(350);
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', (error) =>
      resolve(error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH'),
    );
  });
}
/**
 * Просит Windows открыть URL в системном браузере.
 * Возвращает Promise: true при успешном завершении команды запуска и false,
 * если команду не удалось запустить. main() вызывает функцию после того,
 * как обнаружит отвечающее приложение; сам сервер эта функция не проверяет.
 */
function openBrowser(url) {
  return new Promise((resolve) => {
    const proc = spawn('cmd.exe', ['/d', '/s', '/c', 'start', '""', url], {
      windowsHide: true,
      stdio: 'ignore',
    });
    proc.once('error', () => resolve(false));
    proc.once('exit', (code) => resolve(code === 0));
  });
}
/**
 * Останавливает дочерний процесс сервера, если он ещё работает.
 * Функцию вызывают обработчики сигналов завершения, событие выхода и путь
 * ошибки/таймаута в main(). Флаг stopping не даёт повторно посылать сигнал;
 * child.killed показывает, что процессу уже отправляли сигнал остановки.
 */
function stopServer() {
  if (child && !child.killed && !stopping) {
    stopping = true;
    child.kill();
  }
}
/**
 * Основной сценарий лаунчера: проверяет файлы, ищет готовый экземпляр,
 * выбирает порт и запускает сервер, затем ждёт ответа приложения.
 * При успехе открывает локальный адрес в браузере; при ошибке или превышении
 * времени сообщает об этом и выставляет ненулевой код завершения. Функцию
 * запускает нижний обработчик main().catch(), который также ловит неожиданные ошибки.
 */
async function main() {
  if (!existsSync(NODE) || !existsSync(SERVER)) {
    console.error(
      'Файлы приложения не найдены. Распакуйте весь архив и запустите ASIC ToolBox.exe из его папки.',
    );
    process.exitCode = 1;
    return;
  }
  // Сначала проверяем базовый порт: совпадение статуса и узнаваемого текста
  // ответа подтверждает, что там уже работает именно наше приложение.
  // В этом случае повторный сервер не запускаем — просто открываем его в браузере.
  const current = await request(BASE_PORT);
  if (current?.status === 200 && current.body.includes('ASIC ToolBox')) {
    await openBrowser(`http://${HOST}:${BASE_PORT}`);
    return;
  }
  let port = BASE_PORT;
  // Перебираем базовый порт и следующие 19 адресов. Цикл останавливается
  // на первом свободном порту; предел не даёт искать бесконечно и соответствует
  // диапазону, указанному пользователю в сообщении ниже.
  for (; port < BASE_PORT + 20; port++) if (await isPortFree(port)) break;
  if (port >= BASE_PORT + 20) {
    console.error('Не удалось найти свободный локальный порт 4180–4199.');
    process.exitCode = 1;
    return;
  }
  console.log(`ASIC ToolBox запускается: http://${HOST}:${port}`);
  // Запускаем отдельный процесс Node.js для сервера. Рабочая папка нужна
  // серверу для поиска файлов приложения, а HOST и PORT передаются ему
  // через переменные среды; вывод скрыт, чтобы не открывать лишнее окно.
  child = spawn(NODE, [SERVER], {
    cwd: APP_ROOT,
    env: { ...process.env, HOST, PORT: String(port) },
    windowsHide: true,
    stdio: 'ignore',
  });
  child.once('error', (error) => {
    console.error(`Не удалось запустить сервер: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code) => {
    if (!stopping && code !== 0) {
      console.error(`Сервер завершился с кодом ${code ?? 'неизвестно'}.`);
      process.exitCode = 1;
    }
  });
  // Проверяем готовность повторными короткими HTTP-запросами, но не дольше
  // 25 секунд. Проверка exitCode позволяет сразу заметить, что процесс сервера
  // завершился до готовности, вместо бесполезного ожидания до конца таймера.
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    const response = await request(port);
    if (response?.status === 200 && response.body.includes('ASIC ToolBox')) {
      await openBrowser(`http://${HOST}:${port}`);
      console.log('ASIC ToolBox работает. Закройте это окно, чтобы остановить сервер.');
      return;
    }
    // Небольшая пауза между запросами снижает частоту проверок, пока сервер
    // запускается; после неё цикл пробует снова.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  console.error(
    'Сервер не ответил за 25 секунд. Проверьте файлы приложения и локальные порты 4180–4199.',
  );
  // Если сервер не ответил вовремя, завершаем его, чтобы не оставить
  // безымянный процесс в фоне после выхода лаунчера.
  stopServer();
  process.exitCode = 1;
}
process.on('SIGINT', stopServer);
process.on('SIGTERM', stopServer);
process.on('exit', stopServer);
// Запускаем основной сценарий. catch() ловит ошибки Promise, которые не были
// обработаны внутри main(): сообщает причину, останавливает возможный сервер
// и помечает запуск как неуспешный ненулевым кодом выхода.
main().catch((error) => {
  console.error(`Ошибка запуска: ${error.message}`);
  stopServer();
  process.exitCode = 1;
});
