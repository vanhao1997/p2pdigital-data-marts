import { ProjectOperationBlockedException } from '../../common/exceptions/project-operation-blocked.exception';

export const PROVIDER_ERROR_TAXONOMY_VERSION = 1 as const;

export type ProviderErrorCategory =
  | 'authentication'
  | 'permission'
  | 'rate_limit'
  | 'timeout'
  | 'unavailable'
  | 'validation'
  | 'billing'
  | 'internal'
  | 'unknown';

export type ProviderErrorProvider = 'google' | 'facebook' | 'admicro' | 'generic';

export interface ProviderErrorClassification {
  taxonomyVersion: typeof PROVIDER_ERROR_TAXONOMY_VERSION;
  provider: ProviderErrorProvider;
  category: ProviderErrorCategory;
  retryable: boolean;
  code: string;
}

const SAFE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,254}$/;

export function classifyProviderError(error: unknown, fallbackCode: string): ProviderErrorClassification {
  const direct = asRecord(error);
  const payload = asRecord(direct?.payload);
  const providerError = asRecord(payload?.error);
  const explicitCode = firstString(
    direct?.code,
    direct?.errorCode,
    direct?.reason,
    providerError?.code,
    providerError?.errorCode
  );
  const status = firstNumber(
    direct?.statusCode,
    direct?.status,
    asRecord(direct?.response)?.status,
    providerError?.status
  );
  const name = firstString(direct?.name);
  const category = categoryFor({
    code: explicitCode,
    status,
    name,
    blocked: error instanceof ProjectOperationBlockedException,
  });
  const provider = providerFor(explicitCode, name, direct?.provider);

  return {
    taxonomyVersion: PROVIDER_ERROR_TAXONOMY_VERSION,
    provider,
    category,
    retryable: isRetryable(category),
    code: normalizeCode(explicitCode, codeForCategory(category, fallbackCode)),
  };
}

function providerFor(code: string | undefined, name: string | undefined, explicit: unknown): ProviderErrorProvider {
  if (explicit === 'google' || explicit === 'facebook' || explicit === 'admicro' || explicit === 'generic') {
    return explicit;
  }
  const value = `${code ?? ''} ${name ?? ''}`.toLowerCase();
  if (value.includes('google') || value.startsWith('bq_') || value.startsWith('sheets_')) return 'google';
  if (value.includes('facebook') || value.startsWith('fb_')) return 'facebook';
  if (value.includes('admicro')) return 'admicro';
  return 'generic';
}

function categoryFor({
  code,
  status,
  name,
  blocked,
}: {
  code?: string;
  status?: number;
  name?: string;
  blocked: boolean;
}): ProviderErrorCategory {
  const value = `${code ?? ''} ${name ?? ''}`.toLowerCase();
  if (blocked || value.includes('license') || value.includes('overdraft')) return 'billing';
  if (value.includes('permission') || value.includes('forbidden') || status === 403) return 'permission';
  if (
    value.includes('auth') ||
    value.includes('oauth') ||
    value.includes('token') ||
    status === 401
  )
    return 'authentication';
  if (value.includes('rate') || value.includes('quota') || status === 429) return 'rate_limit';
  if (value.includes('timeout') || value.includes('abort') || value.includes('deadline')) return 'timeout';
  if (status !== undefined && status >= 500) return 'unavailable';
  if (status !== undefined && status >= 400) return 'validation';
  if (value.includes('validation') || value.includes('invalid')) return 'validation';
  if (value) return 'internal';
  return 'unknown';
}

function isRetryable(category: ProviderErrorCategory): boolean {
  return category === 'rate_limit' || category === 'timeout' || category === 'unavailable';
}

function codeForCategory(category: ProviderErrorCategory, fallbackCode: string): string {
  if (SAFE_CODE_PATTERN.test(fallbackCode)) return fallbackCode;
  return `PROVIDER_${category.toUpperCase()}`;
}

function normalizeCode(value: string | undefined, fallbackCode: string): string {
  return value && SAFE_CODE_PATTERN.test(value.trim()) ? value.trim() : fallbackCode;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function firstNumber(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value));
}
