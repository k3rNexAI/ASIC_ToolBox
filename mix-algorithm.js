/**
 * Подбирает набор доноров, суммарно покрывающий точную потребность в платах.
 * Динамическое программирование хранит первый найденный набор для каждой суммы.
 * @param {Array<object>} items Устройства, которые можно использовать как доноров.
 * @param {number} needed Требуемое число плат.
 * @returns {Array<object>} Подходящий набор устройств или пустой массив, если суммы нет.
 */
const selectDonors = (items, needed) => {
  const states = new Map([[0, []]]);
  for (const item of items) {
    // Обратный обход снимка состояний не позволяет учесть одно устройство дважды.
    for (const [sum, selected] of [...states.entries()].reverse()) {
      const next = sum + item.workingBoards;
      if (!states.has(next)) states.set(next, [...selected, item]);
    }
  }
  return states.get(needed) || [];
};

/**
 * Формирует предложения по объединению устройств с одинаковой моделью платы.
 * В качестве получателей выбираются устройства с недостающими платами,
 * а доноры должны точно покрыть их потребность.
 * @param {Array<object>} devices Список устройств и их текущих рабочих плат.
 * @returns {Array<object>} Предложения по моделям, для которых найдено смешивание.
 */
export const mixes = (devices) => {
  const groups = new Map();
  // Учитываются только доступные устройства с одной или двумя рабочими платами.
  for (const device of devices.filter(
    (item) => item.online && (item.workingBoards === 1 || item.workingBoards === 2),
  )) {
    const key = device.boardModel || device.model;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(device);
  }

  return [...groups.entries()]
    .map(([boardModel, items]) => {
      // Сначала рассматриваются устройства, которым для полного комплекта нужно меньше плат.
      const candidates = [...items].sort((a, b) => 3 - a.workingBoards - (3 - b.workingBoards));
      let recipients = [];
      let donors = [];
      let boardTransfers = 0;

      // Уменьшаем число получателей, пока остаток группы не даст точную сумму для донорства.
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

      const selected = new Set([...recipients, ...donors]);
      const unused = items.filter((item) => !selected.has(item));
      // Для результата создаются копии доноров: исходные записи устройств не мутируются.
      const usedDonors = donors.map((donor) => ({
        ...donor,
        transferredBoards: donor.workingBoards,
        afterMixWorkingBoards: 0,
        afterMixRatio: '0/3',
      }));

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
