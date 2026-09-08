const MAX_DIAGNOSTIC_LENGTH = 300;

export function sanitizeErrorDiagnostic(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const sanitized = trimmed
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
      '[redacted private key]'
    )
    .replace(
      /\b(access_token|refresh_token|client_secret|private_key|password|authorization|cookie|token)\b\s*[:=]\s*([^\s,;}]+)/gi,
      '$1=[redacted]'
    )
    .replace(/\b(?:Bearer\s+)?EA[A-Za-z0-9_-]{10,}\b/gi, '[redacted token]')
    .replace(/\bact_\d+\b/gi, '[redacted account]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[redacted identifier]')
    .replace(/\b\d{10,}\b/g, '[redacted identifier]')
    .replace(/https?:\/\/[^\s)]+/gi, '[redacted URL]');

  return sanitized.length > MAX_DIAGNOSTIC_LENGTH
    ? `${sanitized.slice(0, MAX_DIAGNOSTIC_LENGTH - 1)}…`
    : sanitized;
}
