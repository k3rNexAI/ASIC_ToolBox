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
 * Запрашивает локальный корневой URL сервера и возвращает статус с телом ответа.
 * Ошибка соединения трактуется как отсутствие готового сервера, а таймаут
 * принудительно закрывает запрос, чтобы проверка не задерживала запуск.
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
 * Проверяет доступность локального порта: отказ соединения означает,
 * что сервер на нём не слушает; успешное соединение означает занятый порт.
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
/** Запускает системный браузер для указанного локального адреса. */
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
/** Останавливает дочерний сервер не более одного раза при завершении лаунчера. */
function stopServer() {
  if (child && !child.killed && !stopping) {
    stopping = true;
    child.kill();
  }
}
/**
 * Проверяет готовый экземпляр, выбирает свободный порт и запускает сервер.
 * Запуск считается успешным только после получения ожидаемого ответа приложения.
 */
async function main() {
  if (!existsSync(NODE) || !existsSync(SERVER)) {
    console.error(
      'Файлы приложения не найдены. Распакуйте весь архив и запустите ASIC ToolBox.exe из его папки.',
    );
    process.exitCode = 1;
    return;
  }
  // Не создаём второй экземпляр, если на базовом порту уже отвечает наше приложение.
  const current = await request(BASE_PORT);
  if (current?.status === 200 && current.body.includes('ASIC ToolBox')) {
    await openBrowser(`http://${HOST}:${BASE_PORT}`);
    return;
  }
  let port = BASE_PORT;
  // Ограниченный диапазон позволяет избежать бесконечного поиска и совпадает с сообщением об ошибке.
  for (; port < BASE_PORT + 20; port++) if (await isPortFree(port)) break;
  if (port >= BASE_PORT + 20) {
    console.error('Не удалось найти свободный локальный порт 4180–4199.');
    process.exitCode = 1;
    return;
  }
  console.log(`ASIC ToolBox запускается: http://${HOST}:${port}`);
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
  // Ожидаем готовности с общим пределом времени; отдельные короткие запросы
  // позволяют обнаружить ранний ответ сервера или его преждевременное завершение.
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    const response = await request(port);
    if (response?.status === 200 && response.body.includes('ASIC ToolBox')) {
      await openBrowser(`http://${HOST}:${port}`);
      console.log('ASIC ToolBox работает. Закройте это окно, чтобы остановить сервер.');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  console.error(
    'Сервер не ответил за 25 секунд. Проверьте файлы приложения и локальные порты 4180–4199.',
  );
  // При таймауте не оставляем запущенный в фоне процесс.
  stopServer();
  process.exitCode = 1;
}
process.on('SIGINT', stopServer);
process.on('SIGTERM', stopServer);
process.on('exit', stopServer);
// Перехватываем сбой верхнеуровневого запуска, сообщаем его и выставляем ненулевой код выхода.
main().catch((error) => {
  console.error(`Ошибка запуска: ${error.message}`);
  stopServer();
  process.exitCode = 1;
});
