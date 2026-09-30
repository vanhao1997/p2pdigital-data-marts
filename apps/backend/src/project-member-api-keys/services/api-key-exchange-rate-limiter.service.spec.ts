import { DataSource } from 'typeorm';
import { ApiKeyExchangeAttempt } from '../entities/api-key-exchange-attempt.entity';
import { ApiKeyExchangeRateLimiterService } from './api-key-exchange-rate-limiter.service';

describe('ApiKeyExchangeRateLimiterService', () => {
  let dataSource: DataSource;
  let service: ApiKeyExchangeRateLimiterService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ApiKeyExchangeAttempt],
      synchronize: true,
    });
    await dataSource.initialize();
    service = new ApiKeyExchangeRateLimiterService(dataSource, {
      get: () => 'test-deployment-secret-long-enough-for-hmac',
    } as never);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('blocks the sixth invalid attempt for the same key and IP and reports Retry-After', async () => {
    const key = service.createRateLimitKey('203.0.113.10', 'pmk_key_a');

    for (let index = 0; index < 5; index += 1) {
      await service.recordFailure(key);
    }

    const decision = await service.check(key);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(300);
  });

  it('limits an IP across distinct API keys while keeping key buckets isolated', async () => {
    const keys = Array.from({ length: 30 }, (_, index) =>
      service.createRateLimitKey('203.0.113.11', `pmk_key_${index}`)
    );
    for (const key of keys) await service.recordFailure(key);

    expect((await service.check(keys[0])).allowed).toBe(false);
    expect(
      (await service.check(service.createRateLimitKey('203.0.113.12', 'pmk_key_0'))).allowed
    ).toBe(true);
  });

  it('resets a successful key bucket without resetting the shared IP bucket', async () => {
    const key = service.createRateLimitKey('203.0.113.13', 'pmk_key_reset');
    for (let index = 0; index < 5; index += 1) await service.recordFailure(key);
    await service.resetKeyBucket(key);

    expect((await service.check(key)).allowed).toBe(true);
    const stored = await dataSource.getRepository(ApiKeyExchangeAttempt).find();
    expect(stored.find(row => row.scopeKey === 'ip')?.failedAttempts).toBe(5);
  });

  it('persists only HMAC identifiers, never raw client IP or API-key id', async () => {
    const ip = '203.0.113.99';
    const rawApiKeyId = 'pmk_secret-looking-id';
    await service.recordFailure(service.createRateLimitKey(ip, rawApiKeyId));

    const stored = await dataSource.getRepository(ApiKeyExchangeAttempt).find();
    expect(JSON.stringify(stored)).not.toContain(ip);
    expect(JSON.stringify(stored)).not.toContain(rawApiKeyId);
    expect(stored.every(row => /^[a-f0-9]{64}$/.test(row.ipHash))).toBe(true);
    expect(stored.find(row => row.apiKeyIdHash)?.apiKeyIdHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('prunes attempt records older than 24 hours', async () => {
    await dataSource.getRepository(ApiKeyExchangeAttempt).save({
      bucketStart: new Date(Date.now() - 25 * 60 * 60 * 1_000),
      ipHash: 'a'.repeat(64),
      apiKeyIdHash: null,
      scopeKey: 'ip',
      failedAttempts: 1,
      blockedUntil: null,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1_000),
    });
    await service.recordFailure(service.createRateLimitKey('203.0.113.14'));

    const stored = await dataSource.getRepository(ApiKeyExchangeAttempt).find();
    expect(stored).toHaveLength(1);
    expect(stored[0].ipHash).not.toBe('a'.repeat(64));
  });
});
