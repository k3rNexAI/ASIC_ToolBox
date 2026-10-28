import assert from 'node:assert/strict';
import {
  braiinsMinerState,
  cgminerHashrateGh,
  needsRestBoardDetails,
  normalizeCgminerResult,
  scanProtocolOrder,
} from '../miner-compat.js';

// scanProtocolOrder получает режим работы и возвращает список протоколов по порядку попыток.
// Проверки фиксируют: auto перебирает все варианты, а hybrid и legacy сразу выбирают legacy.
assert.deepEqual(scanProtocolOrder('auto'), ['rest', 'grpc', 'legacy']);
assert.deepEqual(scanProtocolOrder('hybrid'), ['legacy']);
assert.deepEqual(scanProtocolOrder('legacy'), ['legacy']);
assert.equal(needsRestBoardDetails({ online: true, status: 'check', ratio: '0/3' }), true);
assert.equal(needsRestBoardDetails({ online: true, status: 'check', ratio: '—' }), true);
assert.equal(needsRestBoardDetails({ online: true, status: 'sleep', ratio: '0/3' }), false);
assert.equal(needsRestBoardDetails({ online: false, status: 'offline', ratio: '0/3' }), false);
assert.equal(needsRestBoardDetails({ online: true, status: 'degraded', ratio: '1/3' }), false);
// cgminer уже предоставляет сведения о платах в своём формате, поэтому REST-дозапрос не нужен.
assert.equal(
  needsRestBoardDetails({ online: true, status: 'check', ratio: '0/3', firmwareFamily: 'cgminer' }),
  false,
);

// cgminerHashrateGh получает объект со значениями хешрейта и возвращает число в GH/s.
// Эти примеры защищают преобразование GH/s, MH/s и TH/s и чтение строки с единицей измерения.
assert.equal(cgminerHashrateGh({ 'GHS 5s': 12500 }), 12500);
assert.equal(cgminerHashrateGh({ 'MHS 5s': 12500000 }), 12500);
assert.equal(cgminerHashrateGh({ 'THS av': 12.5 }), 12500);
assert.equal(cgminerHashrateGh({ hashrate: '12.5 TH/s' }), 12500);

// normalizeCgminerResult получает ответ cgminer, собранный из сводки, списка плат и сведений о них,
// и возвращает единый объект майнера; проверки ниже сверяют модель, скорость, платы и состояние.
const stock = normalizeCgminerResult({
  ip: '192.0.2.21',
  version: { VERSION: [{ CGMiner: '4.11.1', API: '3.7' }] },
  summary: { SUMMARY: [{ 'MHS 5s': 28000000, 'MHS av': 27500000 }] },
  devs: {
    DEVS: [
      { ID: 4, Type: 'ASC', Status: 'Alive', 'MHS 5s': 9000000 },
      { ID: 5, Type: 'ASC', Status: 'Alive', 'MHS 5s': 9500000 },
      { ID: 6, Type: 'ASC', Status: 'Alive', 'MHS 5s': 9500000 },
    ],
  },
  details: {
    DEVDETAILS: [
      { ID: 4, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
      { ID: 5, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
      { ID: 6, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
    ],
  },
});
assert.equal(stock.firmwareFamily, 'unknown');
assert.equal(stock.model, 'Antminer S19');
assert.equal(stock.hashrateGh, 28000);
assert.equal(stock.totalBoards, 3);
assert.equal(stock.workingBoards, 3);
assert.equal(stock.status, 'healthy');

// Этот ответ содержит три платы, одна из которых помечена Dead; нормализатор должен учесть это,
// а не считать все найденные строки исправными.
const partialCgminer = normalizeCgminerResult({
  ip: '192.0.2.27',
  version: { VERSION: [{ CGMiner: '4.11.1', BOSminer: '0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 19000 }] },
  devs: {
    DEVS: [
      { ID: 1, Type: 'ASC', Status: 'Alive', 'GHS 5s': 10000 },
      { ID: 2, Type: 'ASC', Status: 'Alive', 'GHS 5s': 9000 },
      { ID: 3, Type: 'ASC', Status: 'Dead', 'GHS 5s': 0 },
    ],
  },
  details: {
    DEVDETAILS: [
      { ID: 1, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
      { ID: 2, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
      { ID: 3, Type: 'ASC', Model: 'Antminer S19', Chips: 0 },
    ],
  },
});
assert.equal(partialCgminer.firmwareFamily, 'braiins');
assert.equal(partialCgminer.workingBoards, 2);
assert.equal(partialCgminer.ratio, '2/3');
assert.equal(partialCgminer.status, 'degraded');

// Если в ответе есть только сводка, нормализатор сохраняет хешрейт, но не может сосчитать платы.
// Проверки также подтверждают, что отсутствие данных о платах не означает ошибку или известную прошивку.
const summaryOnly = normalizeCgminerResult({
  ip: '192.0.2.22',
  version: { VERSION: [{ CGMiner: 'CGMiner 4.11' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 52500 }] },
});
assert.equal(summaryOnly.hashrateGh, 52500);
assert.equal(summaryOnly.boards.length, 1);
assert.equal(summaryOnly.status, 'healthy');
assert.equal(summaryOnly.firmwareFamily, 'unknown');
assert.equal(summaryOnly.totalBoards, 0);
assert.equal(summaryOnly.ratio, '—');

// При классификации прошивки явное имя VNish важнее того, что в ответе также указана версия cgminer.
// Это не мешает распознать доступный хешрейт и оставить рабочий майнер в состоянии healthy.
const explicitOtherFirmware = normalizeCgminerResult({
  ip: '192.0.2.28',
  version: { VERSION: [{ CGMiner: '4.11.1', Firmware: 'VNish 1.2' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 52500 }] },
});
assert.equal(explicitOtherFirmware.firmwareFamily, 'cgminer');
assert.equal(explicitOtherFirmware.status, 'healthy');

// Прошивку Braiins можно распознать по имени BOSminer внутри версии cgminer или по отдельному полю.
// Два примера проверяют оба варианта данных, приходящих от майнера.
const braiins = normalizeCgminerResult({
  ip: '192.0.2.23',
  version: { VERSION: [{ CGMiner: 'BOSminer+ 0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 20 }] },
});
assert.equal(braiins.firmwareFamily, 'braiins');
const bosminerNamedVersion = normalizeCgminerResult({
  ip: '192.0.2.24',
  version: { VERSION: [{ CGMiner: '4.11.1', BOSminer: '0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 20 }] },
});
assert.equal(bosminerNamedVersion.firmwareFamily, 'braiins');
// Пауза может быть указана в общей сводке, а может — отдельно в строках всех плат.
// В обоих случаях результат нормализации должен сообщать, что майнер спит, а не неисправен.
const pausedBOSminer = normalizeCgminerResult({
  ip: '192.0.2.25',
  version: { VERSION: [{ CGMiner: '4.11.1', BOSminer: '0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 0, Status: 'Paused' }] },
});
assert.equal(pausedBOSminer.status, 'sleep');
const pausedFromDeviceRows = normalizeCgminerResult({
  ip: '192.0.2.30',
  version: { VERSION: [{ CGMiner: '4.11.1', BOSminer: '0.1.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 0 }] },
  devs: {
    DEVS: [
      { ID: 1, Type: 'ASC', Status: 'Paused', 'GHS 5s': 0 },
      { ID: 2, Type: 'ASC', Status: 'Paused', 'GHS 5s': 0 },
      { ID: 3, Type: 'ASC', Status: 'Paused', 'GHS 5s': 0 },
    ],
  },
  details: {
    DEVDETAILS: [
      { ID: 1, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
      { ID: 2, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
      { ID: 3, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
    ],
  },
});
assert.equal(pausedFromDeviceRows.ratio, '0/3');
assert.equal(pausedFromDeviceRows.minerState, 'sleep');
assert.equal(pausedFromDeviceRows.status, 'sleep');
// Тот же вывод о паузе ожидается и без распознанного семейства прошивки: решающим является статус.
const pausedUnknownFirmware = normalizeCgminerResult({
  ip: '192.0.2.29',
  version: { VERSION: [{ CGMiner: '4.11.1', API: '3.7' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 0, Status: 'Paused' }] },
});
assert.equal(pausedUnknownFirmware.firmwareFamily, 'unknown');
assert.equal(pausedUnknownFirmware.status, 'sleep');
const zeroRateBOSminer = normalizeCgminerResult({
  ip: '192.0.2.26',
  version: { VERSION: [{ BOSminer: '0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 0, Status: 'Dead' }] },
});
assert.equal(zeroRateBOSminer.status, 'check');
// braiinsMinerState получает ответ Braiins или готовое поле minerState и возвращает единое состояние.
// Вложенные поля описывают причину остановки; тесты различают паузу, остановку и активную работу.
const pausedState = {
  detailed_status: { status: { status: { stopped: { reason: { mining_paused_by_user: {} } } } } },
};
const stoppedState = {
  detailed_status: {
    status: { status: { stopped: { reason: { all_mining_pools_are_unresponsive: {} } } } },
  },
};
const runningState = { detailed_status: { status: { status: { running: {} } } } };
assert.equal(braiinsMinerState(pausedState), 'sleep');
assert.equal(braiinsMinerState({ minerState: 'pausedByUser' }), 'sleep');
assert.equal(braiinsMinerState(stoppedState), 'stopped');
assert.equal(braiinsMinerState(runningState), 'running');
console.log('miner-compat tests passed');
