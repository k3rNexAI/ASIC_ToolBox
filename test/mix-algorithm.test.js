import assert from 'node:assert/strict';
import { mixes } from '../mix-algorithm.js';

const device = (ip, workingBoards) => ({
  ip,
  online: true,
  model: 'ASIC',
  boardModel: 'BH42651',
  workingBoards,
  ratio: `${workingBoards}/3`,
});

// Единственный реципиенту 2/3 нужна одна плата. Донор 2/3 отдаст две,
// поэтому такой микс не предлагается: после него донор не станет 0/3.
assert.deepEqual(mixes([device('10.0.0.1', 2), device('10.0.0.2', 2)]), []);

// Два реципиента 2/3 полностью используют обе платы донора 2/3.
const exactFit = mixes([device('10.0.0.3', 2), device('10.0.0.4', 2), device('10.0.0.8', 2)]);
assert.equal(exactFit.length, 1);
assert.equal(exactFit[0].boardTransfers, 2);
assert.equal(exactFit[0].availableBoards, 2);
assert.equal(exactFit[0].usedDonors.length, 1);
assert.equal(exactFit[0].usedDonors[0].afterMixRatio, '0/3');
assert.equal(exactFit[0].usedDonors[0].transferredBoards, 2);

// Два донора 1/3 точно закрывают одного реципиента 1/3.
const twoDonors = mixes([device('10.0.0.5', 1), device('10.0.0.6', 1), device('10.0.0.7', 1)]);
assert.equal(twoDonors.length, 1);
assert.equal(twoDonors[0].usedDonors.length, 2);
assert.equal(twoDonors[0].boardTransfers, 2);
assert.equal(twoDonors[0].availableBoards, 2);

console.log('Mix algorithm regression tests passed.');
