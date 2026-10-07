import { isMaskedWebhookUrl, maskWebhookUrl } from './webhook-url-mask.util';

describe('webhook-url-mask', () => {
  it('masks Google Chat key and token query values', () => {
    const raw =
      'https://chat.googleapis.com/v1/spaces/AAA/messages?key=google-api-key&token=google-webhook-token';

    const masked = maskWebhookUrl(raw);

    expect(masked).toBe(
      'https://chat.googleapis.com/v1/spaces/_redacted_/messages?key=REDACTED&token=REDACTED'
    );
    expect(masked).not.toContain('google-api-key');
    expect(masked).not.toContain('google-webhook-token');
    expect(isMaskedWebhookUrl(masked)).toBe(true);
  });

  it('masks path-based webhook secrets and preserves only the origin', () => {
    const masked = maskWebhookUrl('https://hooks.example.test/services/secret/path');

    expect(masked).toBe('https://hooks.example.test/_redacted_');
    expect(isMaskedWebhookUrl(masked)).toBe(true);
  });

  it('masks a single path segment because it can contain the webhook secret', () => {
    const masked = maskWebhookUrl('https://hooks.example.test/secret-token');

    expect(masked).toBe('https://hooks.example.test/_redacted_');
    expect(masked).not.toContain('secret-token');
    expect(isMaskedWebhookUrl(masked)).toBe(true);
  });

  it('returns null for an unset webhook', () => {
    expect(maskWebhookUrl(null)).toBeNull();
    expect(maskWebhookUrl(undefined)).toBeNull();
    expect(isMaskedWebhookUrl(null)).toBe(false);
  });
});
