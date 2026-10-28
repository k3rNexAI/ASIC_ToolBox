/**
 * Ищет среди устройств-доноров набор, который отдаёт ровно нужное число плат.
 * Для каждой достижимой суммы Map хранит первый найденный набор устройств;
 * такой способ перебора вариантов называется динамическим программированием.
 * @param {Array<object>} items Кандидаты в доноры; у каждого есть workingBoards.
 * @param {number} needed Сколько плат суммарно нужно получателям.
 * @returns {Array<object>} Найденные доноры или пустой массив, если точной суммы нет.
 */
const selectDonors = (items, needed) => {
  const states = new Map([[0, []]]);
  for (const item of items) {
    // Перебираем снимок уже найденных сумм с конца: новые суммы от этого устройства
    // не попадут в текущий обход, поэтому одно устройство нельзя добавить дважды.
    for (const [sum, selected] of [...states.entries()].reverse()) {
      const next = sum + item.workingBoards;
      if (!states.has(next)) states.set(next, [...selected, item]);
    }
  }
  return states.get(needed) || [];
};

/**
 * Строит предложения по объединению устройств с совместимой моделью платы.
 * Получатели — устройства, которым не хватает плат до трёх; доноры передают
 * ровно недостающее число, чтобы после передачи их собственные платы не учитывались.
 * @param {Array<object>} devices Устройства с моделью, доступностью и числом рабочих плат.
 * @returns {Array<object>} Данные предложений для моделей, где удалось собрать смешивание.
 */
export const mixes = (devices) => {
  const groups = new Map();
  // Сразу отбрасываем недоступные устройства и устройства без дефицита/донорского
  // остатка в диапазоне 1–2 плат; оставшиеся можно распределить между ролями.
  for (const device of devices.filter(
    (item) => item.online && (item.workingBoards === 1 || item.workingBoards === 2),
  )) {
    const key = device.boardModel || device.model;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(device);
  }

  return [...groups.entries()]
    .map(([boardModel, items]) => {
      // Сортируем по числу недостающих плат (3 - workingBoards), от меньшего к большему:
      // это задаёт порядок получателей, а оставшиеся элементы проверяются как доноры.
      const candidates = [...items].sort((a, b) => 3 - a.workingBoards - (3 - b.workingBoards));
      let recipients = [];
      let donors = [];
      let boardTransfers = 0;

      // Проверяем всё меньше устройств в начале списка как получателей. Для каждого
      // варианта считаем дефицит и ищем точную сумму среди оставшихся устройств-доноров;
      // первая найденная комбинация сохраняется, дальнейший поиск не нужен.
      for (let count = candidates.length; count > 0; count--) {
        const candidateRecipients = candidates.slice(0, count);
        const needed = candidateRecipients.reduce((sum, item) => sum + (3 - item.workingBoards), 0);
        const candidateDonors = selectDonors(candidates.slice(count), needed);
        if (candidateDonors.length) {
          recipients = candidateRecipients;
          donors = candidateDonors;
          boardTransfers = needed;
          break;
        }
      }

      // Отмечаем участников найденного предложения, чтобы отдельно перечислить остальных.
      const selected = new Set([...recipients, ...donors]);
      const unused = items.filter((item) => !selected.has(item));
      // Создаём отдельные записи для результата: исходные объекты devices не меняются.
      // В копии фиксируем число переданных плат и состояние донора после передачи.
      const usedDonors = donors.map((donor) => ({
        ...donor,
        transferredBoards: donor.workingBoards,
        afterMixWorkingBoards: 0,
        afterMixRatio: '0/3',
      }));

      // Собираем сводку по модели: исходные устройства, выбранные роли, остатки
      // и итоговые количества. Этот объект ниже фильтруется по наличию получателей.
      return {
        boardModel,
        devices: items,
        donors: usedDonors,
        recipients,
        usedDonors,
        usedRecipients: recipients,
        unusedDonors: unused.filter((item) => item.workingBoards === 1 || item.workingBoards === 2),
        unusedRecipients: [],
        unused,
        availableBoards: usedDonors.reduce((sum, donor) => sum + donor.transferredBoards, 0),
        boardTransfers,
        suggestedMixes: recipients.length,
      };
    })
    .filter((mix) => mix.suggestedMixes > 0);
};
