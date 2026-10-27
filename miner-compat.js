const numeric = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export const scanProtocolOrder = (protocol) => protocol === 'hybrid' ? ['legacy'] : protocol === 'auto' ? ['rest', 'grpc', 'legacy'] : [protocol];
export const needsRestBoardDetails = (device) => Boolean(device?.online && device.status !== 'offline' && device.status !== 'sleep' && device.firmwareFamily !== 'cgminer' && (device.ratio === '0/3' || device.status === 'check'));

const rateFields = [
  [/^(?:GHS|GH\/S)\s*5S$/, 1], [/^(?:MHS|MH\/S)\s*5S$/, 1 / 1000], [/^(?:KHS|KH\/S)\s*5S$/, 1 / 1e6], [/^(?:HS|H\/S)\s*5S$/, 1 / 1e9], [/^(?:THS|TH\/S)\s*5S$/, 1000],
  [/^(?:GHS|GH\/S)\s*(?:AV|AVG|AVERAGE)$/, 1], [/^(?:MHS|MH\/S)\s*(?:AV|AVG|AVERAGE)$/, 1 / 1000], [/^(?:KHS|KH\/S)\s*(?:AV|AVG|AVERAGE)$/, 1 / 1e6], [/^(?:HS|H\/S)\s*(?:AV|AVG|AVERAGE)$/, 1 / 1e9], [/^(?:THS|TH\/S)\s*(?:AV|AVG|AVERAGE)$/, 1000],
  [/^(?:GHS|GH\/S)\s*1M$/, 1], [/^(?:MHS|MH\/S)\s*1M$/, 1 / 1000], [/^(?:GHS|GH\/S)\s*5M$/, 1], [/^(?:MHS|MH\/S)\s*5M$/, 1 / 1000]
];

export function cgminerHashrateGh(row) {
  if (!row || typeof row !== 'object') return null;
  const direct = numeric(row.hashrateGh ?? row.hashrate_gh ?? row.ghs);
  if (direct !== null) return Math.max(0, direct);
  const entries = new Map(Object.entries(row).map(([key, value]) => [key.trim().toUpperCase().replace(/\s+/g, ' '), value]));
  for (const [pattern, multiplier] of rateFields) {
    for (const [key, value] of entries) {
      if (!pattern.test(key)) continue;
      const n = numeric(value);
      if (n !== null) return Math.max(0, n * multiplier);
    }
  }
  for (const [key, value] of entries) {
    if (!/^(?:HASHRATE|RATE|REAL HASHRATE)$/.test(key)) continue;
    if (typeof value === 'string') {
      const match = value.match(/^\s*([\d.,]+)\s*(TH\/s|GH\/s|MH\/s|KH\/s|H\/s)\s*$/i);
      if (match) {
        const n = numeric(match[1]);
        const unit = match[2].toUpperCase();
        const scale = unit === 'TH/S' ? 1000 : unit === 'GH/S' ? 1 : unit === 'MH/S' ? 1 / 1000 : unit === 'KH/S' ? 1 / 1e6 : 1 / 1e9;
        return n === null ? null : Math.max(0, n * scale);
      }
    }
    const n = numeric(value);
    if (n !== null) return Math.max(0, n);
  }
  return null;
}

const firstArray = (obj, keys) => {
  for (const key of keys) if (Array.isArray(obj?.[key])) return obj[key];
  return [];
};
const idOf = (row, fallback) => String(row?.ID ?? row?.Id ?? row?.id ?? row?.ASC ?? row?.DEVDETAILS ?? row?.DEV ?? fallback);
const statusOf = (row) => String(row?.Status ?? row?.STATUS ?? row?.status ?? row?.State ?? row?.state ?? '').trim();
const isBadStatus = (value) => /dead|offline|disabled|error|fail|sick|no device|not found|broken/i.test(value);
const isHashDevice = (row) => {
  const type = String(row?.Type ?? row?.type ?? '').trim();
  return !type || /asc|asic|chain|hash.?board/i.test(type);
};
const chipCountOf = (row) => {
  const n = numeric(row?.Chips ?? row?.chips ?? row?.['Chip Count'] ?? row?.chips_count ?? row?.chipsCount);
  return n === null ? 0 : Math.max(0, Math.trunc(n));
};
const modelOf = (row) => String(row?.Model ?? row?.model ?? row?.Name ?? row?.name ?? '').trim();

export function normalizeCgminerResult({ ip, port = 4028, version = {}, summary = {}, devs = {}, details = {}, stats = {} }) {
  const summaryRow = firstArray(summary, ['SUMMARY', 'summary'])[0] || summary?.summary || {};
  let devRows = firstArray(devs, ['DEVS', 'devs']).filter(isHashDevice);
  let detailRows = firstArray(details, ['DEVDETAILS', 'devdetails']).filter(isHashDevice);
  const statRows = firstArray(stats, ['STATS', 'stats']);
  if (!devRows.length && !detailRows.length && statRows.length) {
    devRows = statRows.filter((row) => cgminerHashrateGh(row) !== null);
  }
  const primary = devRows.length ? devRows : detailRows;
  const totalRateFromSummary = cgminerHashrateGh(summaryRow);
  const versionRow = firstArray(version, ['VERSION', 'version'])[0] || version?.version || {};
  const versionText = [...Object.entries(versionRow).flatMap(([key, value]) => [key, value]), version.Description, version.CGMiner].filter(Boolean).join(' ');
  const rows = primary.slice(0, 16).map((device, index) => {
    const id = idOf(device, index);
    const detail = detailRows.find((item, itemIndex) => idOf(item, itemIndex) === id) || detailRows[index] || {};
    const rate = cgminerHashrateGh(device) ?? cgminerHashrateGh(detail) ?? 0;
    const state = statusOf(device) || statusOf(detail);
    const bad = isBadStatus(state);
    const chips = chipCountOf(detail) || chipCountOf(device);
    return {
      number: index + 1,
      id,
      model: modelOf(detail) || modelOf(device) || 'ASIC chain',
      chips,
      hashrateGh: rate,
      working: !bad && rate > 0,
      enabled: !/disabled/i.test(state),
      status: state || (rate > 0 ? 'Hashing' : 'No hash rate')
    };
  });
  const summedRate = rows.reduce((sum, row) => sum + row.hashrateGh, 0);
  const totalHashrateGh = totalRateFromSummary ?? (summedRate || 0);
  const hasBoardData = rows.length > 0;
  if (!rows.length) {
    rows.push({ number: 1, id: 'miner', model: 'Общий хешрейт', chips: 0, hashrateGh: totalHashrateGh, working: totalHashrateGh > 0, enabled: true, status: totalHashrateGh > 0 ? 'Hashing' : 'No hash rate' });
  }
  const model = detailRows.map(modelOf).find(Boolean) || devRows.map(modelOf).find(Boolean) || versionRow.Description || versionRow.CGMiner || 'ASIC (CGMiner API)';
  const bos = /braiins|bosminer/i.test(versionText) || /braiins|bosminer/i.test(String(model));
  const otherFirmware = /\b(vnish|luxos|hiveon|asic\.to|awesome miner|whatsminer firmware)\b/i.test(versionText);
  const firmwareFamily = bos ? 'braiins' : otherFirmware ? 'cgminer' : 'unknown';
  const summaryOnlyUnknown = !hasBoardData && firmwareFamily !== 'cgminer';
  const totalBoards = summaryOnlyUnknown ? 0 : rows.length;
  const activeCount = summaryOnlyUnknown ? 0 : rows.filter((row) => row.working).length;
  const minerState = braiinsMinerState({ status: [summaryRow.Status, summaryRow.STATUS, summaryRow.State, summaryRow.state, ...statRows, ...devRows, ...detailRows] });
  const status = minerState === 'sleep' ? 'sleep' : totalBoards === 0 ? (totalHashrateGh > 0 ? 'healthy' : 'check') : activeCount === 0 ? 'check' : activeCount < totalBoards ? 'degraded' : 'healthy';
  return {
    ip,
    online: true,
    api: `TCP ${port}`,
    firmwareFamily,
    firmwareName: bos ? `Braiins OS · ${versionText || 'CGMiner API'}` : otherFirmware ? `Другая прошивка · ${versionText}` : `Прошивка не определена · ${versionText || 'CGMiner API'}`,
    model: String(model).replace(/^Bitmain\s+/i, '').trim() || 'ASIC (CGMiner API)',
    boardModel: [...new Set(rows.map((row) => row.model).filter(Boolean))].join(', '),
    boards: summaryOnlyUnknown ? rows.map((row) => ({ ...row, working: false })) : rows,
    fans: [],
    version: versionText || (bos ? 'Braiins OS · legacy API' : 'CGMiner-compatible firmware'),
    hashrateGh: totalHashrateGh,
    workingBoards: activeCount,
    totalBoards,
    failedBoards: hasBoardData ? rows.filter((row) => !row.working).map((row) => row.number) : [],
    errorLogs: [],
    noPic: false,
    ratio: totalBoards ? `${activeCount}/${totalBoards}` : '—',
    status,
    minerState
  };
}

const flattenState = (value, output = []) => {
  if (typeof value === 'string' || typeof value === 'number') output.push(String(value));
  else if (Array.isArray(value)) value.forEach((item) => flattenState(item, output));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) { output.push(key); flattenState(child, output); }
  }
  return output;
};

export function braiinsMinerState(details = {}) {
  const hints = [details, details.detailed_status, details.detailedStatus, details.status, details.performance_mode, details.performanceMode, details.power_mode, details.powerMode, details.miner_state, details.minerState].filter((x) => x !== undefined && x !== null);
  const words = flattenState(hints).join(' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/[_-]+/g, ' ');
  if (/\bsleep(?:ing)?\b|\bsuspend(?:ed|ing)?\b|\bstandby\b|\bpaus(?:e|ed|ing)\b|mining paused by user|user requested pause/.test(words)) return 'sleep';
  if (/\bstopped\b/.test(words)) return 'stopped';
  if (/\bstopping\b/.test(words)) return 'stopping';
  if (/\bstarting\b/.test(words)) return 'starting';
  if (/\brunning\b|\bnormal\b/.test(words)) return 'running';
  return 'unknown';
}
