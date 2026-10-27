import assert from 'node:assert/strict';
import { braiinsMinerState, cgminerHashrateGh, needsRestBoardDetails, normalizeCgminerResult, scanProtocolOrder } from '../miner-compat.js';

assert.deepEqual(scanProtocolOrder('auto'), ['rest', 'grpc', 'legacy']);
assert.deepEqual(scanProtocolOrder('hybrid'), ['legacy']);
assert.deepEqual(scanProtocolOrder('legacy'), ['legacy']);
assert.equal(needsRestBoardDetails({ online: true, status: 'check', ratio: '0/3' }), true);
assert.equal(needsRestBoardDetails({ online: true, status: 'check', ratio: '—' }), true);
assert.equal(needsRestBoardDetails({ online: true, status: 'sleep', ratio: '0/3' }), false);
assert.equal(needsRestBoardDetails({ online: false, status: 'offline', ratio: '0/3' }), false);
assert.equal(needsRestBoardDetails({ online: true, status: 'degraded', ratio: '1/3' }), false);
assert.equal(needsRestBoardDetails({ online: true, status: 'check', ratio: '0/3', firmwareFamily: 'cgminer' }), false);

assert.equal(cgminerHashrateGh({ 'GHS 5s': 12500 }), 12500);
assert.equal(cgminerHashrateGh({ 'MHS 5s': 12500000 }), 12500);
assert.equal(cgminerHashrateGh({ 'THS av': 12.5 }), 12500);
assert.equal(cgminerHashrateGh({ hashrate: '12.5 TH/s' }), 12500);

const stock = normalizeCgminerResult({
  ip: '192.0.2.21',
  version: { VERSION: [{ CGMiner: '4.11.1', API: '3.7' }] },
  summary: { SUMMARY: [{ 'MHS 5s': 28000000, 'MHS av': 27500000 }] },
  devs: { DEVS: [
    { ID: 4, Type: 'ASC', Status: 'Alive', 'MHS 5s': 9000000 },
    { ID: 5, Type: 'ASC', Status: 'Alive', 'MHS 5s': 9500000 },
    { ID: 6, Type: 'ASC', Status: 'Alive', 'MHS 5s': 9500000 }
  ] },
  details: { DEVDETAILS: [
    { ID: 4, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
    { ID: 5, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
    { ID: 6, Type: 'ASC', Model: 'Antminer S19', Chips: 76 }
  ] }
});
assert.equal(stock.firmwareFamily, 'unknown');
assert.equal(stock.model, 'Antminer S19');
assert.equal(stock.hashrateGh, 28000);
assert.equal(stock.totalBoards, 3);
assert.equal(stock.workingBoards, 3);
assert.equal(stock.status, 'healthy');

const partialCgminer = normalizeCgminerResult({
  ip: '192.0.2.27',
  version: { VERSION: [{ CGMiner: '4.11.1', BOSminer: '0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 19000 }] },
  devs: { DEVS: [
    { ID: 1, Type: 'ASC', Status: 'Alive', 'GHS 5s': 10000 },
    { ID: 2, Type: 'ASC', Status: 'Alive', 'GHS 5s': 9000 },
    { ID: 3, Type: 'ASC', Status: 'Dead', 'GHS 5s': 0 }
  ] },
  details: { DEVDETAILS: [
    { ID: 1, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
    { ID: 2, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
    { ID: 3, Type: 'ASC', Model: 'Antminer S19', Chips: 0 }
  ] }
});
assert.equal(partialCgminer.firmwareFamily, 'braiins');
assert.equal(partialCgminer.workingBoards, 2);
assert.equal(partialCgminer.ratio, '2/3');
assert.equal(partialCgminer.status, 'degraded');

const summaryOnly = normalizeCgminerResult({
  ip: '192.0.2.22',
  version: { VERSION: [{ CGMiner: 'CGMiner 4.11' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 52500 }] }
});
assert.equal(summaryOnly.hashrateGh, 52500);
assert.equal(summaryOnly.boards.length, 1);
assert.equal(summaryOnly.status, 'healthy');
assert.equal(summaryOnly.firmwareFamily, 'unknown');
assert.equal(summaryOnly.totalBoards, 0);
assert.equal(summaryOnly.ratio, '—');

const explicitOtherFirmware = normalizeCgminerResult({
  ip: '192.0.2.28',
  version: { VERSION: [{ CGMiner: '4.11.1', Firmware: 'VNish 1.2' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 52500 }] }
});
assert.equal(explicitOtherFirmware.firmwareFamily, 'cgminer');
assert.equal(explicitOtherFirmware.status, 'healthy');

const braiins = normalizeCgminerResult({
  ip: '192.0.2.23',
  version: { VERSION: [{ CGMiner: 'BOSminer+ 0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 20 }] }
});
assert.equal(braiins.firmwareFamily, 'braiins');
const bosminerNamedVersion = normalizeCgminerResult({
  ip: '192.0.2.24',
  version: { VERSION: [{ CGMiner: '4.11.1', BOSminer: '0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 20 }] }
});
assert.equal(bosminerNamedVersion.firmwareFamily, 'braiins');
const pausedBOSminer = normalizeCgminerResult({
  ip: '192.0.2.25',
  version: { VERSION: [{ CGMiner: '4.11.1', BOSminer: '0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 0, Status: 'Paused' }] }
});
assert.equal(pausedBOSminer.status, 'sleep');
const pausedFromDeviceRows = normalizeCgminerResult({
  ip: '192.0.2.30',
  version: { VERSION: [{ CGMiner: '4.11.1', BOSminer: '0.1.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 0 }] },
  devs: { DEVS: [
    { ID: 1, Type: 'ASC', Status: 'Paused', 'GHS 5s': 0 },
    { ID: 2, Type: 'ASC', Status: 'Paused', 'GHS 5s': 0 },
    { ID: 3, Type: 'ASC', Status: 'Paused', 'GHS 5s': 0 }
  ] },
  details: { DEVDETAILS: [
    { ID: 1, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
    { ID: 2, Type: 'ASC', Model: 'Antminer S19', Chips: 76 },
    { ID: 3, Type: 'ASC', Model: 'Antminer S19', Chips: 76 }
  ] }
});
assert.equal(pausedFromDeviceRows.ratio, '0/3');
assert.equal(pausedFromDeviceRows.minerState, 'sleep');
assert.equal(pausedFromDeviceRows.status, 'sleep');
const pausedUnknownFirmware = normalizeCgminerResult({
  ip: '192.0.2.29',
  version: { VERSION: [{ CGMiner: '4.11.1', API: '3.7' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 0, Status: 'Paused' }] }
});
assert.equal(pausedUnknownFirmware.firmwareFamily, 'unknown');
assert.equal(pausedUnknownFirmware.status, 'sleep');
const zeroRateBOSminer = normalizeCgminerResult({
  ip: '192.0.2.26',
  version: { VERSION: [{ BOSminer: '0.2.0' }] },
  summary: { SUMMARY: [{ 'GHS 5s': 0, Status: 'Dead' }] }
});
assert.equal(zeroRateBOSminer.status, 'check');
const pausedState = { detailed_status: { status: { status: { stopped: { reason: { mining_paused_by_user: {} } } } } } };
const stoppedState = { detailed_status: { status: { status: { stopped: { reason: { all_mining_pools_are_unresponsive: {} } } } } } };
const runningState = { detailed_status: { status: { status: { running: {} } } } };
assert.equal(braiinsMinerState(pausedState), 'sleep');
assert.equal(braiinsMinerState({ minerState: 'pausedByUser' }), 'sleep');
assert.equal(braiinsMinerState(stoppedState), 'stopped');
assert.equal(braiinsMinerState(runningState), 'running');
console.log('miner-compat tests passed');
