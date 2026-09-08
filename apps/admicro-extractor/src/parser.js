const TYPE_KEYS = {
  campaign: ['data_rpt_campaign', 'campaigns', 'campaign', 'data'],
  date: ['data_rpt_date', 'dates', 'date', 'data'],
};

const TOTAL_LABELS = new Set([
  'total',
  'totals',
  'grand total',
  'tong',
  'tong cong',
  'tong so',
  'tat ca',
  'toan bo',
  'all',
  'overall',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!/^[\[{]/.test(text)) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function printable(value) {
  if (value === undefined || value === null) return null;
  if (isObject(value) || Array.isArray(value)) return JSON.stringify(value);
  return value;
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function isNumericLike(value) {
  return /^[+-]?[\d.,]+%?$/.test(String(value ?? '').trim());
}

function removeTotalRows(headers, rows) {
  const candidateIndexes = headers
    .map((header, index) => ({ header: normalizeText(header), index }))
    .filter(
      ({ header }) =>
        /^(key|type|row type|name|title|label)$/.test(header) ||
        /campaign|domain|site|date|location|platform|device/.test(header)
    )
    .map(({ index }) => index);
  const indexes = candidateIndexes.length
    ? candidateIndexes
    : [0, 1, 2].filter(index => index < headers.length);
  return rows.filter(
    row =>
      !indexes.some(index => {
        const value = row[index];
        return !isNumericLike(value) && TOTAL_LABELS.has(normalizeText(value));
      })
  );
}

function normalizeRows(value) {
  const parsed = parseJson(value);
  if (parsed !== value) return normalizeRows(parsed);
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  const keys = Object.keys(value);
  const values = Object.values(value);
  if (values.length > 0 && values.every(isObject))
    return values.map((row, index) => ({ key: keys[index], ...row }));
  return [value];
}

function findSource(dataview, reportType) {
  if (!isObject(dataview)) return dataview;
  for (const key of TYPE_KEYS[reportType] ?? []) if (dataview[key] != null) return dataview[key];
  if (dataview.reportData != null) return dataview.reportData;

  // Admicro occasionally wraps the selected report under a renamed key. Prefer
  // a non-empty array before treating the wrapper itself as one data row.
  for (const value of Object.values(dataview)) {
    if (Array.isArray(value) && value.length > 0) return value;
  }

  return dataview;
}

export function parseDataview(dataview, reportType) {
  const source = findSource(parseJson(dataview), reportType);
  const normalized = normalizeRows(source);
  if (!normalized.length) return { headers: [], rows: [] };
  if (Array.isArray(normalized[0])) {
    const width = Math.max(...normalized.map(row => row.length));
    const headers = Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
    const rows = normalized.map(row => headers.map((_, index) => printable(row[index])));
    return { headers, rows: uniqueRows(removeTotalRows(headers, rows)) };
  }
  const objectRows = normalized.map(row => (isObject(row) ? row : { value: row }));
  const headers = [...new Set(objectRows.flatMap(row => Object.keys(row)))];
  const rows = objectRows.map(row => headers.map(header => printable(row[header])));
  return { headers, rows: uniqueRows(removeTotalRows(headers, rows)) };
}

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeCell(value, { identifier = false, decimal = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (identifier) return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text || /^n\/a$/i.test(text)) return null;
  const numeric = text.replace(/%$/, '').replace(/\s+/g, '');
  let normalized = numeric;
  const commaIndex = numeric.lastIndexOf(',');
  const dotIndex = numeric.lastIndexOf('.');
  if (commaIndex >= 0 && dotIndex >= 0) {
    normalized =
      commaIndex > dotIndex
        ? numeric.replace(/\./g, '').replace(',', '.')
        : numeric.replace(/,/g, '');
  } else if (commaIndex >= 0) {
    normalized = /,\d{1,2}$/.test(numeric) ? numeric.replace(',', '.') : numeric.replace(/,/g, '');
  } else if (!decimal && !text.endsWith('%') && /^\d{1,3}(\.\d{3})+$/.test(numeric)) {
    normalized = numeric.replace(/\./g, '');
  } else {
    normalized = numeric.replace(/,/g, '');
  }
  const number = Number(normalized);
  return Number.isFinite(number) && /^[+-]?[\d.,]+%?$/.test(text) ? number : value;
}

export function parseCampaignIds(value) {
  return [
    ...new Set(
      String(value ?? '')
        .split(/[,;\s]+/u)
        .map(item => item.trim())
        .filter(Boolean)
    ),
  ];
}
