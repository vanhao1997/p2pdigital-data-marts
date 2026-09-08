import i18n from '../../i18n';
import { sanitizeErrorDiagnostic } from './sanitize-error-diagnostic';

const SAFE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,254}$/;
const SENSITIVE_PARAM_KEY_PATTERN =
  /(?:^|_)(?:id|ids)$|id$|ids$|token|secret|password|authorization|cookie|url|uri|sql|query|email|account|credential|private|payload/i;
const ERROR_CATEGORIES = new Set([
  'authentication',
  'permission',
  'rate_limit',
  'timeout',
  'unavailable',
  'validation',
  'billing',
  'internal',
  'unknown',
]);

export function localizeOperationalError(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (value.type !== 'error' && value.type !== 'warning') return null;
  if (typeof value.code !== 'string' || !SAFE_CODE_PATTERN.test(value.code)) return null;

  const key = `operationalErrors.codes.${value.code}`;
  const category =
    typeof value.category === 'string' && ERROR_CATEGORIES.has(value.category)
      ? value.category
      : null;
  const categoryKey = category ? `operationalErrors.categories.${category}` : null;
  const params = safeParams(value.params);
  return i18n.exists(key)
    ? i18n.t(key, params)
    : categoryKey && i18n.exists(categoryKey)
      ? i18n.t(categoryKey)
      : i18n.t('operationalErrors.unknown', { code: value.code });
}

export function getOperationalErrorDisplayMessage(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const localized = localizeOperationalError(parsed);
    if (localized) return localized;
    if (isRecord(parsed)) {
      const message = parsed.error ?? parsed.message ?? parsed.warning;
      if (typeof message === 'string') return sanitizeErrorDiagnostic(message) ?? null;
    }
  } catch {
    // Legacy runs can contain a plain text error; sanitize it below.
  }

  return sanitizeErrorDiagnostic(trimmed) ?? null;
}

function safeParams(value: unknown): Record<string, string | number | boolean> {
  if (!isRecord(value)) return {};
  const params: Record<string, string | number | boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_PARAM_KEY_PATTERN.test(key)) continue;
    if (typeof entry === 'string' || typeof entry === 'boolean') params[key] = entry;
    else if (typeof entry === 'number' && Number.isFinite(entry)) params[key] = entry;
  }
  return params;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
