import { maskEmail } from './email-utils.js';

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;

const SENSITIVE_KEY_PATTERN =
  /(^|[_-])(authorization|cookie|set-cookie|password|secret|token|access_token|refresh_token|id_token|client_secret|code|code_verifier|api_key|apikey)([_-]|$)/i;
const EMAIL_KEY_PATTERN = /(^|[_-])email([_-]|$)/i;
const NAME_KEY_PATTERN = /(^|[_-])(name|full_name|fullname|display_name|displayname)([_-]|$)/i;
const EMAIL_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_VALUE_PATTERN = /https?:\/\/[^\s)]+/gi;
const SENSITIVE_URL_PARAMS = new Set([
  'access_token',
  'refresh_token',
  'id_token',
  'token',
  'key',
  'code',
  'client_secret',
  'secret',
  'password',
]);

export function sanitizeLogMessage(message: string): string {
  return maskEmailValues(maskUrlSecrets(message));
}

export function sanitizeLogMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return sanitizeLogRecord(meta, 0);
}

export function summarizeBetterAuthArgs(args: unknown[]): Record<string, unknown> {
  return {
    argCount: args.length,
    args: args.slice(0, MAX_ARRAY_ITEMS).map(summarizeLogArg),
  };
}

function summarizeLogArg(arg: unknown): Record<string, unknown> {
  if (arg instanceof Error) {
    return {
      type: 'Error',
      name: arg.name,
    };
  }

  if (arg === null) return { type: 'null' };
  if (Array.isArray(arg)) return { type: 'array', length: arg.length };

  if (typeof arg === 'object') {
    const keys = Object.keys(arg as Record<string, unknown>).filter(key => !isSensitiveKey(key));
    return {
      type: 'object',
      keys: keys.slice(0, MAX_ARRAY_ITEMS),
      omittedSensitiveKeys: Object.keys(arg as Record<string, unknown>).length - keys.length,
    };
  }

  return { type: typeof arg };
}

function sanitizeLogValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogMessage(value.message),
    };
  }

  if (typeof value === 'string') {
    return sanitizeLogMessage(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol' || typeof value === 'function') return `[${typeof value}]`;

  if (depth >= MAX_DEPTH) return '[Object]';

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map(item => sanitizeLogValue(item, depth + 1));
  }

  return sanitizeLogRecord(value as Record<string, unknown>, depth + 1);
}

function sanitizeLogRecord(value: Record<string, unknown>, depth: number): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = REDACTED;
      continue;
    }
    if (isEmailKey(key) && typeof rawValue === 'string') {
      sanitized[key] = maskEmail(rawValue);
      continue;
    }
    if (isNameKey(key) && typeof rawValue === 'string') {
      sanitized[key] = REDACTED;
      continue;
    }
    sanitized[key] = sanitizeLogValue(rawValue, depth);
  }
  return sanitized;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(normalizeKey(key));
}

function isEmailKey(key: string): boolean {
  return EMAIL_KEY_PATTERN.test(normalizeKey(key));
}

function isNameKey(key: string): boolean {
  return NAME_KEY_PATTERN.test(normalizeKey(key));
}

function normalizeKey(key: string): string {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function maskEmailValues(value: string): string {
  return value.replace(EMAIL_VALUE_PATTERN, email => maskEmail(email));
}

function maskUrlSecrets(value: string): string {
  const withMaskedUrls = value.replace(URL_VALUE_PATTERN, urlValue => maskSingleUrl(urlValue));
  return withMaskedUrls.replace(
    /((?:[?&]|\b)(?:access_token|refresh_token|id_token|token|key|code|client_secret|secret|password)=)[^&\s]+/gi,
    `$1${REDACTED}`
  );
}

function maskSingleUrl(value: string): string {
  try {
    const url = new URL(value);
    let changed = false;
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_URL_PARAMS.has(key.toLowerCase())) {
        url.searchParams.set(key, REDACTED);
        changed = true;
      }
    }
    return changed ? url.toString() : value;
  } catch {
    return value;
  }
}
