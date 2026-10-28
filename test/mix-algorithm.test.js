import assert from 'node:assert/strict';
import { mixes } from '../mix-algorithm.js';

/**
 * Собирает описание онлайн-устройства для входного списка mixes().
 * Получает IP и число рабочих плат, а возвращает объект с этими данными
 * и полями модели, которые алгоритм использует при подборе устройств.
 */
const device = (ip, workingBoards) => ({
  ip,
  online: true,
  model: 'ASIC',
  boardModel: 'BH42651',
  workingBoards,
  ratio: `${workingBoards}/3`,
});

// Проверяем случай, когда одного получателя недостаточно: устройству 2/3
// нужна одна плата, а донор 2/3 отдаёт две. Без второго получателя остаток
// донора не будет нулевым, поэтому mixes() не должен предлагать такой вариант.
assert.deepEqual(mixes([device('10.0.0.1', 2), device('10.0.0.2', 2)]), []);

// Здесь два получателя 2/3 вместе используют обе платы одного донора 2/3.
const exactFit = mixes([device('10.0.0.3', 2), device('10.0.0.4', 2), device('10.0.0.8', 2)]);
// Результат mixes() должен содержать один подходящий вариант; его общие
// счётчики и сведения об использованном доноре должны описывать те же две платы.
assert.equal(exactFit.length, 1);
assert.equal(exactFit[0].boardTransfers, 2);
assert.equal(exactFit[0].availableBoards, 2);
assert.equal(exactFit[0].usedDonors.length, 1);
assert.equal(exactFit[0].usedDonors[0].afterMixRatio, '0/3');
assert.equal(exactFit[0].usedDonors[0].transferredBoards, 2);

// Проверяем объединение плат от нескольких доноров: два устройства 1/3
// вместе дают две платы, необходимые получателю 1/3.
const twoDonors = mixes([device('10.0.0.5', 1), device('10.0.0.6', 1), device('10.0.0.7', 1)]);
// Убедимся, что вариант действительно выбран и в нём учтены оба донора,
// а число переданных и доступных плат равно двум.
assert.equal(twoDonors.length, 1);
assert.equal(twoDonors[0].usedDonors.length, 2);
assert.equal(twoDonors[0].boardTransfers, 2);
assert.equal(twoDonors[0].availableBoards, 2);

console.log('Mix algorithm regression tests passed.');
