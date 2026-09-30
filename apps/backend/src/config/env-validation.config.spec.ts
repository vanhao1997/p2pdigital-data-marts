import { validateConfig } from './env-validation.config';

describe('Admicro extractor environment validation', () => {
  it('allows the connector to remain disabled without sidecar settings', () => {
    const config = validateConfig({});
    expect(config.ADMICRO_EXTRACTOR_ENABLED).toBe(false);
    expect(config.MCP_DYNAMIC_CLIENT_REGISTRATION_ENABLED).toBe('false');
    expect(config.TYPEORM_LOG_QUERY_PARAMETERS).toBe('false');
  });

  it('requires URL and shared secret when enabled', () => {
    expect(() => validateConfig({ ADMICRO_EXTRACTOR_ENABLED: 'true' })).toThrow(
      'ADMICRO_EXTRACTOR_URL is required'
    );
  });

  it('accepts a complete enabled configuration', () => {
    const config = validateConfig({
      ADMICRO_EXTRACTOR_ENABLED: 'true',
      ADMICRO_EXTRACTOR_URL: 'http://admicro-extractor:8091',
      ADMICRO_EXTRACTOR_SHARED_SECRET: 'secret',
    });
    expect(config.ADMICRO_EXTRACTOR_ENABLED).toBe(true);
    expect(config.ADMICRO_EXTRACTOR_MAX_CONCURRENCY).toBe(2);
  });

  it('rejects a credential-bearing extractor URL', () => {
    expect(() =>
      validateConfig({
        ADMICRO_EXTRACTOR_ENABLED: 'true',
        ADMICRO_EXTRACTOR_URL: 'https://user:pass@admicro-extractor:8091',
        ADMICRO_EXTRACTOR_SHARED_SECRET: 'secret',
      })
    ).toThrow('ADMICRO_EXTRACTOR_URL must be an HTTP(S) URL');
  });
});
