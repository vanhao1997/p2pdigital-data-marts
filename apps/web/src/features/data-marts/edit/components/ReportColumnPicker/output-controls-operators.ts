import { isVietnameseLocale } from '../../../../../shared/utils/field-humanizer';

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_null'
  | 'is_not_null'
  | 'regex'
  | 'not_regex'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'is_true'
  | 'is_false'
  | 'relative_date';

export interface OperatorMeta {
  value: FilterOperator;
  label: string;
  shortLabel: string;
}

// Mirror of backend OutputControlsValidatorService type sets — cover every type
// name each supported provider emits (BigQuery + Athena + Redshift), keep in sync.
const STRING_TYPES = new Set(['STRING', 'VARCHAR', 'CHAR', 'TEXT', 'BPCHAR']);
const NUMBER_TYPES = new Set([
  'INTEGER',
  'INT',
  'BIGINT',
  'SMALLINT',
  'TINYINT',
  'FLOAT',
  'REAL',
  'DOUBLE',
  'DOUBLE PRECISION',
  'NUMERIC',
  'BIGNUMERIC',
  'DECIMAL',
]);
const DATE_TYPES = new Set([
  'DATE',
  'DATETIME',
  'TIMESTAMP',
  'TIMESTAMP WITH TIME ZONE',
  'TIMESTAMPTZ',
  'TIMESTAMP_NTZ',
]);
// Time-of-day types are kept out of DATE_TYPES: relative_date presets resolve to
// calendar dates (current_date / date_add), which are meaningless for a column
// with no date component and rejected by the backend renderer.
const TIME_TYPES = new Set(['TIME', 'TIME WITH TIME ZONE', 'TIMETZ']);
const BOOL_TYPES = new Set(['BOOLEAN', 'BOOL']);

const STRING_OPERATORS: OperatorMeta[] = [
  { value: 'eq', label: 'is', shortLabel: '=' },
  { value: 'neq', label: 'is not', shortLabel: '≠' },
  { value: 'in', label: 'is any of', shortLabel: '∈' },
  { value: 'not_in', label: 'is none of', shortLabel: '∉' },
  { value: 'contains', label: 'contains', shortLabel: '⊃' },
  { value: 'not_contains', label: "doesn't contain", shortLabel: '⊅' },
  { value: 'starts_with', label: 'starts with', shortLabel: '↦' },
  { value: 'ends_with', label: 'ends with', shortLabel: '↤' },
  { value: 'is_empty', label: 'is empty', shortLabel: '∅' },
  { value: 'is_not_empty', label: 'is not empty', shortLabel: '¬∅' },
  { value: 'is_null', label: 'is null', shortLabel: '∅?' },
  { value: 'is_not_null', label: 'is not null', shortLabel: '¬∅?' },
  { value: 'regex', label: 'matches regex', shortLabel: '/.../' },
  { value: 'not_regex', label: "doesn't match regex", shortLabel: '!/.../' },
];

const NUMBER_OPERATORS: OperatorMeta[] = [
  { value: 'eq', label: 'equals', shortLabel: '=' },
  { value: 'neq', label: 'not equals', shortLabel: '≠' },
  { value: 'in', label: 'is any of', shortLabel: '∈' },
  { value: 'not_in', label: 'is none of', shortLabel: '∉' },
  { value: 'gt', label: 'greater than', shortLabel: '>' },
  { value: 'lt', label: 'less than', shortLabel: '<' },
  { value: 'gte', label: 'greater than or equal', shortLabel: '≥' },
  { value: 'lte', label: 'less than or equal', shortLabel: '≤' },
  { value: 'between', label: 'between', shortLabel: 'X..Y' },
  { value: 'is_null', label: 'is null', shortLabel: '∅' },
  { value: 'is_not_null', label: 'is not null', shortLabel: '¬∅' },
];

const DATE_OPERATORS: OperatorMeta[] = [
  { value: 'eq', label: 'on', shortLabel: '=' },
  { value: 'neq', label: 'not on', shortLabel: '≠' },
  { value: 'in', label: 'is any of', shortLabel: '∈' },
  { value: 'not_in', label: 'is none of', shortLabel: '∉' },
  { value: 'gt', label: 'after', shortLabel: '>' },
  { value: 'lt', label: 'before', shortLabel: '<' },
  { value: 'gte', label: 'on or after', shortLabel: '≥' },
  { value: 'lte', label: 'on or before', shortLabel: '≤' },
  { value: 'between', label: 'between', shortLabel: 'X..Y' },
  { value: 'relative_date', label: 'relative', shortLabel: '⏱' },
  { value: 'is_null', label: 'is null', shortLabel: '∅' },
  { value: 'is_not_null', label: 'is not null', shortLabel: '¬∅' },
];

const BOOLEAN_OPERATORS: OperatorMeta[] = [
  { value: 'is_true', label: 'is true', shortLabel: '✓' },
  { value: 'is_false', label: 'is false', shortLabel: '✗' },
  { value: 'is_null', label: 'is null', shortLabel: '∅' },
  { value: 'is_not_null', label: 'is not null', shortLabel: '¬∅' },
];

const FALLBACK_OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  not_contains: "doesn't contain",
  starts_with: 'starts with',
  ends_with: 'ends with',
  in: 'is any of',
  not_in: 'is none of',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  is_null: 'is null',
  is_not_null: 'is not null',
  regex: 'matches regex',
  not_regex: "doesn't match regex",
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater than or equal',
  lte: 'less than or equal',
  between: 'between',
  is_true: 'is true',
  is_false: 'is false',
  relative_date: 'relative',
};

// Same comparison operators as dates minus relative_date (calendar-only presets).
// "at"-framed labels read naturally for a time of day, which has no calendar date
// to be "on" / "on or after".
const TIME_LABEL_OVERRIDES: Partial<Record<FilterOperator, string>> = {
  eq: 'at',
  neq: 'not at',
  gte: 'at or after',
  lte: 'at or before',
};
const TIME_OPERATORS: OperatorMeta[] = DATE_OPERATORS.filter(o => o.value !== 'relative_date').map(
  o => {
    const label = TIME_LABEL_OVERRIDES[o.value];
    return label ? { ...o, label } : o;
  }
);

const STRING_OPERATORS_VI: Partial<Record<FilterOperator, string>> = {
  eq: 'bằng',
  neq: 'khác',
  in: 'thuộc danh sách',
  not_in: 'không thuộc danh sách',
  contains: 'chứa',
  not_contains: 'không chứa',
  starts_with: 'bắt đầu bằng',
  ends_with: 'kết thúc bằng',
  is_empty: 'rỗng',
  is_not_empty: 'không rỗng',
  is_null: 'trống (NULL)',
  is_not_null: 'không trống (NOT NULL)',
  regex: 'khớp biểu thức (Regex)',
  not_regex: 'không khớp biểu thức (Regex)',
};

const NUMBER_OPERATORS_VI: Partial<Record<FilterOperator, string>> = {
  eq: 'bằng (=)',
  neq: 'khác (≠)',
  in: 'thuộc danh sách',
  not_in: 'không thuộc danh sách',
  gt: 'lớn hơn (>)',
  lt: 'nhỏ hơn (<)',
  gte: 'lớn hơn hoặc bằng (≥)',
  lte: 'nhỏ hơn hoặc bằng (≤)',
  between: 'trong khoảng',
  is_null: 'trống (NULL)',
  is_not_null: 'không trống (NOT NULL)',
};

const DATE_OPERATORS_VI: Partial<Record<FilterOperator, string>> = {
  eq: 'vào ngày',
  neq: 'không vào ngày',
  in: 'thuộc danh sách',
  not_in: 'không thuộc danh sách',
  gt: 'sau ngày',
  lt: 'trước ngày',
  gte: 'từ ngày trở đi',
  lte: 'đến ngày trở về trước',
  between: 'trong khoảng',
  relative_date: 'thời gian tương đối',
  is_null: 'trống (NULL)',
  is_not_null: 'không trống (NOT NULL)',
};

const TIME_OPERATORS_VI: Partial<Record<FilterOperator, string>> = {
  ...DATE_OPERATORS_VI,
  eq: 'vào lúc',
  neq: 'không vào lúc',
  gt: 'sau lúc',
  lt: 'trước lúc',
  gte: 'từ lúc trở đi',
  lte: 'đến lúc trở về trước',
};

const BOOLEAN_OPERATORS_VI: Partial<Record<FilterOperator, string>> = {
  is_true: 'là đúng (True)',
  is_false: 'là sai (False)',
  is_null: 'trống (NULL)',
  is_not_null: 'không trống (NOT NULL)',
};

const FALLBACK_OPERATOR_LABELS_VI: Record<FilterOperator, string> = {
  eq: 'bằng',
  neq: 'khác',
  contains: 'chứa',
  not_contains: 'không chứa',
  starts_with: 'bắt đầu bằng',
  ends_with: 'kết thúc bằng',
  in: 'thuộc danh sách',
  not_in: 'không thuộc danh sách',
  is_empty: 'rỗng',
  is_not_empty: 'không rỗng',
  is_null: 'trống (NULL)',
  is_not_null: 'không trống (NOT NULL)',
  regex: 'khớp biểu thức (Regex)',
  not_regex: 'không khớp biểu thức (Regex)',
  gt: 'lớn hơn',
  lt: 'nhỏ hơn',
  gte: 'lớn hơn hoặc bằng',
  lte: 'nhỏ hơn hoặc bằng',
  between: 'trong khoảng',
  is_true: 'là đúng (True)',
  is_false: 'là sai (False)',
  relative_date: 'thời gian tương đối',
};

function localizeOperators(
  ops: OperatorMeta[],
  viMap: Partial<Record<FilterOperator, string>>
): OperatorMeta[] {
  if (!isVietnameseLocale()) return ops;
  return ops.map(o => {
    const viLabel = viMap[o.value];
    return viLabel ? { ...o, label: viLabel } : o;
  });
}

export function operatorsForType(fieldType: string): OperatorMeta[] {
  if (STRING_TYPES.has(fieldType)) return localizeOperators(STRING_OPERATORS, STRING_OPERATORS_VI);
  if (NUMBER_TYPES.has(fieldType)) return localizeOperators(NUMBER_OPERATORS, NUMBER_OPERATORS_VI);
  if (DATE_TYPES.has(fieldType)) return localizeOperators(DATE_OPERATORS, DATE_OPERATORS_VI);
  if (TIME_TYPES.has(fieldType)) return localizeOperators(TIME_OPERATORS, TIME_OPERATORS_VI);
  if (BOOL_TYPES.has(fieldType)) return localizeOperators(BOOLEAN_OPERATORS, BOOLEAN_OPERATORS_VI);
  return [];
}

export function isFilterableType(fieldType: string): boolean {
  return operatorsForType(fieldType).length > 0;
}

// Shared so FilterValueEditor parses values with the SAME type sets — a number
// column must emit a JS number, not a string (Athena quotes strings, breaking a
// `bigint > '10'` comparison); a date column keeps its string for the backend cast.
export function isNumberType(fieldType: string): boolean {
  return NUMBER_TYPES.has(fieldType);
}

export function isDateType(fieldType: string): boolean {
  return DATE_TYPES.has(fieldType);
}

// Subset of DATE_TYPES that carry a time-of-day component. Used to gate the
// timezone control in the bucket popover: a pure DATE column cannot accept a
// timezone conversion (e.g. BigQuery DATE(col, 'tz') requires TIMESTAMP).
const TIMESTAMP_TYPES = new Set([...DATE_TYPES].filter(t => t !== 'DATE'));

export function isTimestampType(fieldType: string): boolean {
  return TIMESTAMP_TYPES.has(fieldType);
}

export function isTimeType(fieldType: string): boolean {
  return TIME_TYPES.has(fieldType);
}

export function isStringType(fieldType: string): boolean {
  return STRING_TYPES.has(fieldType);
}

export function isBoolType(fieldType: string): boolean {
  return BOOL_TYPES.has(fieldType);
}

export function operatorLabelFor(operator: FilterOperator, fieldType: string): string {
  const meta = operatorsForType(fieldType).find(o => o.value === operator);
  if (meta) return meta.label;
  return isVietnameseLocale()
    ? FALLBACK_OPERATOR_LABELS_VI[operator]
    : FALLBACK_OPERATOR_LABELS[operator];
}
