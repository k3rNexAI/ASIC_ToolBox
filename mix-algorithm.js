const selectDonors = (items, needed) => {
  const states = new Map([[0, []]]);
  for (const item of items) {
    for (const [sum, selected] of [...states.entries()].reverse()) {
      const next = sum + item.workingBoards;
      if (!states.has(next)) states.set(next, [...selected, item]);
    }
  }
  return states.get(needed) || [];
};

export const mixes = (devices) => {
  const groups = new Map();
  for (const device of devices.filter((item) => item.online && (item.workingBoards === 1 || item.workingBoards === 2))) {
    const key = device.boardModel || device.model;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(device);
  }

  return [...groups.entries()].map(([boardModel, items]) => {
    const candidates = [...items].sort((a, b) => (3 - a.workingBoards) - (3 - b.workingBoards));
    let recipients = [];
    let donors = [];
    let boardTransfers = 0;

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
    const usedDonors = donors.map((donor) => ({
      ...donor,
      transferredBoards: donor.workingBoards,
      afterMixWorkingBoards: 0,
      afterMixRatio: '0/3'
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
      suggestedMixes: recipients.length
    };
  }).filter((mix) => mix.suggestedMixes > 0);
};
