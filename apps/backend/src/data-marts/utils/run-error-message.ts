import { castError } from '@owox/internal-helpers';
import { BusinessViolationException } from '../../common/exceptions/business-violation.exception';
import { ProjectOperationBlockedException } from '../../common/exceptions/project-operation-blocked.exception';
import {
  classifyProviderError,
  type ProviderErrorCategory,
  PROVIDER_ERROR_TAXONOMY_VERSION,
} from './provider-error-taxonomy';

export type OperationalErrorParam = string | number | boolean;

export interface OperationalErrorPayload {
  type: 'error' | 'warning';
  at: string;
  taxonomyVersion: typeof PROVIDER_ERROR_TAXONOMY_VERSION;
  provider: import('./provider-error-taxonomy').ProviderErrorProvider;
  category: ProviderErrorCategory;
  retryable: boolean;
  code: string;
  params?: Record<string, OperationalErrorParam>;
  message?: string;
}

export interface OperationalErrorOptions {
  code: string;
  message: string;
  type?: OperationalErrorPayload['type'];
  at?: Date | string;
  params?: Record<string, unknown>;
}

const MAX_ERROR_MESSAGE_LENGTH = 300;
const MAX_PARAM_STRING_LENGTH = 120;
const SAFE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,254}$/;
const SENSITIVE_PARAM_KEY_PATTERN =
  /(?:^|_)(?:id|ids)$|id$|ids$|token|secret|password|authorization|cookie|url|uri|sql|query|email|account|credential|private|payload/i;

export function createOperationalErrorPayload(
  error: unknown,
  options: OperationalErrorOptions
): OperationalErrorPayload {
  const params = {
    ...safePrimitiveParams(errorDetailsFrom(error)),
    ...safePrimitiveParams(firstViolationFrom(error)),
    ...safePrimitiveParams(options.params),
  };
  const message = sanitizeOperationalErrorMessage(messageFrom(error), options.message);
  const classification = classifyProviderError(error, options.code);

  return {
    type: options.type ?? 'error',
    at: toIsoString(options.at),
    taxonomyVersion: classification.taxonomyVersion,
    provider: classification.provider,
    category: classification.category,
    retryable: classification.retryable,
    code: errorCodeFrom(error, options.code),
    ...(Object.keys(params).length > 0 ? { params } : {}),
    ...(message ? { message } : {}),
  };
}

export function serializeOperationalError(
  error: unknown,
  options: OperationalErrorOptions
): string {
  return JSON.stringify(createOperationalErrorPayload(error, options));
}

export function sanitizeOperationalErrorMessage(value: unknown, fallback: string): string {
  const sanitized = messageFrom(value)
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
      '[redacted private key]'
    )
    .replace(
      /\b(access_token|refresh_token|client_secret|private_key|password|authorization|cookie)\b\s*[:=]\s*(?:Bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      '$1=[redacted]'
    )
    .replace(/\btoken\b\s*=\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, 'token=[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{10,}\b/gi, 'Bearer [redacted]')
    .replace(/\bEA[A-Za-z0-9_-]{10,}\b/gi, '[redacted token]')
    .replace(/\bact_\d+\b/gi, '[redacted account]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[redacted identifier]')
    .replace(/\b\d{10,}\b/g, '[redacted identifier]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted email]')
    .replace(/https?:\/\/[^\s)]+/gi, '[redacted URL]')
    .replace(/\r?\n\s+at\s+[\s\S]*/g, '')
    .replace(/\b(?:SELECT|INSERT|UPDATE|DELETE|MERGE|WITH)\b[\s\S]*/i, '[redacted query]')
    .replace(/\s+/g, ' ')
    .trim();

  const resolved = !sanitized || sanitized === '[redacted query]' ? fallback : sanitized;
  return resolved.length > MAX_ERROR_MESSAGE_LENGTH
    ? `${resolved.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1)}…`
    : resolved;
}

/**
 * Pulls the human-readable text out of a persisted run entry.
 *
 * `warning` is part of the chain because a failed run's `errors` array holds classified
 * warnings alongside genuine errors, and those carry their text under `warning` rather
 * than `error`. Without it they fall through to the raw JSON, which is what then reaches
 * customers in failure emails and MCP report status.
 */
export function extractRunErrorMessage(errorStr: string): string {
  try {
    const parsed = JSON.parse(errorStr) as Record<string, unknown>;
    const message = parsed['error'] ?? parsed['message'] ?? parsed['msg'] ?? parsed['warning'];
    if (typeof message === 'string') {
      return sanitizeOperationalErrorMessage(message, 'Run failed');
    }
    return typeof parsed['code'] === 'string' ? parsed['code'] : errorStr;
  } catch {
    return sanitizeOperationalErrorMessage(errorStr, 'Run failed');
  }
}

function messageFrom(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return castError(error).message;
}

function errorCodeFrom(error: unknown, fallback: string): string {
  if (error instanceof ProjectOperationBlockedException) {
    return normalizeErrorCode(error.blockedReasons[0], fallback);
  }
  const direct = identityFrom(error);
  const violation = firstViolationFrom(error);
  return normalizeErrorCode(
    direct?.code ?? direct?.errorCode ?? direct?.reason ?? violation?.['code'],
    fallback
  );
}

function identityFrom(error: unknown): Record<string, unknown> | null {
  return typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
}

function errorDetailsFrom(error: unknown): Record<string, unknown> | undefined {
  return error instanceof BusinessViolationException ? error.errorDetails : undefined;
}

function firstViolationFrom(error: unknown): Record<string, unknown> | undefined {
  const errors = errorDetailsFrom(error)?.['errors'];
  const first = Array.isArray(errors) ? errors[0] : undefined;
  return typeof first === 'object' && first !== null
    ? (first as Record<string, unknown>)
    : undefined;
}

function normalizeErrorCode(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `PROVIDER_${String(value)}`;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return SAFE_CODE_PATTERN.test(trimmed) ? trimmed : fallback;
}

function safePrimitiveParams(
  value: Record<string, unknown> | undefined
): Record<string, OperationalErrorParam> {
  if (!value) return {};
  const params: Record<string, OperationalErrorParam> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'code' || SENSITIVE_PARAM_KEY_PATTERN.test(key)) continue;
    if (typeof entry === 'boolean') params[key] = entry;
    else if (typeof entry === 'number' && Number.isFinite(entry)) params[key] = entry;
    else if (typeof entry === 'string') {
      const sanitized = sanitizeOperationalErrorMessage(entry, '').slice(
        0,
        MAX_PARAM_STRING_LENGTH
      );
      if (sanitized) params[key] = sanitized;
    }
  }
  return params;
}

function toIsoString(value: Date | string | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}
