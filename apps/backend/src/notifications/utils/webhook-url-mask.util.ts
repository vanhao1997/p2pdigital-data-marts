const REDACTED_PATH_SEGMENT = '_redacted_';
const REDACTED_QUERY_VALUE = 'REDACTED';

export function maskWebhookUrl(webhookUrl?: string | null): string | null {
  if (!webhookUrl) return null;

  try {
    const url = new URL(webhookUrl);
    const maskedPath = maskPath(url);
    const maskedSearch = maskSearch(url);
    return `${url.origin}${maskedPath}${maskedSearch}`;
  } catch {
    return REDACTED_QUERY_VALUE;
  }
}

export function isMaskedWebhookUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === REDACTED_QUERY_VALUE) return true;

  try {
    const url = new URL(value);
    if (url.pathname.split('/').includes(REDACTED_PATH_SEGMENT)) return true;
    return Array.from(url.searchParams.values()).some(param => param === REDACTED_QUERY_VALUE);
  } catch {
    return false;
  }
}

function maskPath(url: URL): string {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return '';

  if (url.hostname === 'chat.googleapis.com' && segments.length >= 4) {
    return `/${segments[0]}/${segments[1]}/${REDACTED_PATH_SEGMENT}/${segments[segments.length - 1]}`;
  }

  return `/${REDACTED_PATH_SEGMENT}`;
}

function maskSearch(url: URL): string {
  const keys = Array.from(new Set(Array.from(url.searchParams.keys()))).sort();
  if (keys.length === 0) return '';
  return `?${keys.map(key => `${encodeURIComponent(key)}=${REDACTED_QUERY_VALUE}`).join('&')}`;
}
