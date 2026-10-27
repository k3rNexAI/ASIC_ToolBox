import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const APP_ROOT = path.dirname(fileURLToPath(import.meta.url));
const NODE = path.join(APP_ROOT, 'runtime', 'node.exe');
const SERVER = path.join(APP_ROOT, 'server.js');
const HOST = '127.0.0.1';
const BASE_PORT = Number(process.env.PORT || 4180);
let child = null;
let stopping = false;

function request(port, pathname = '/') {
  return new Promise((resolve) => {
    const req = http.get({ hostname: HOST, port, path: pathname, timeout: 700 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (part) => { body += part; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

async function openBrowser(url) {
  const result = await new Promise((resolve) => {
    const proc = spawn('cmd.exe', ['/d', '/s', '/c', 'start', '""', url], {
      windowsHide: true,
      stdio: 'ignore'
    });
    proc.once('error', () => resolve(false));
    proc.once('exit', (code) => resolve(code === 0));
  });
  return result;
}

function stopServer() {
  if (!child || child.killed || stopping) return;
  stopping = true;
  child.kill();
}

async function main() {
  if (!existsSync(NODE) || !existsSync(SERVER)) {
    console.error('Файлы приложения не найдены. Распакуйте весь архив, затем запустите ASIC ToolBox.exe из его папки.');
    process.exitCode = 1;
    return;
  }

  // Reuse the local app if this launcher is started a second time.
  const current = await request(BASE_PORT);
  if (current?.status === 200 && current.body.includes('ASIC ToolBox')) {
    await openBrowser(`http://${HOST}:${BASE_PORT}`);
    return;
  }

  let port = BASE_PORT;
  for (; port < BASE_PORT + 20; port++) {
    const occupied = await request(port);
    if (!occupied) break;
  }
  if (port >= BASE_PORT + 20) {
    console.error('Не удалось найти свободный локальный порт (проверен диапазон 4180–4199).');
    process.exitCode = 1;
    return;
  }

  console.log(`ASIC ToolBox запускается: http://${HOST}:${port}`);
  child = spawn(NODE, [SERVER], {
    cwd: APP_ROOT,
    env: { ...process.env, HOST, PORT: String(port) },
    windowsHide: true,
    stdio: 'ignore'
  });
  child.once('error', (error) => {
    console.error(`Не удалось запустить сервер: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code) => {
    if (!stopping && code !== 0) console.error(`Сервер завершился с кодом ${code ?? 'неизвестно'}.`);
    if (!stopping && code !== 0) process.exitCode = 1;
  });

  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    const response = await request(port);
    if (response?.status === 200 && response.body.includes('ASIC ToolBox')) {
      await openBrowser(`http://${HOST}:${port}`);
      console.log('ASIC ToolBox работает. Закройте это окно, чтобы остановить локальный сервер.');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  console.error('Сервер не ответил за 25 секунд. Проверьте файлы программы или занятость портов 4180–4199.');
  stopServer();
  process.exitCode = 1;
}

process.on('SIGINT', stopServer);
process.on('SIGTERM', stopServer);
process.on('exit', stopServer);
main().catch((error) => {
  console.error(`Ошибка запуска: ${error.message}`);
  stopServer();
  process.exitCode = 1;
});
