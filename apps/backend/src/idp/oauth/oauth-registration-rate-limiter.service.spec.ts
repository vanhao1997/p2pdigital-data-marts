import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { ApiKeyExchangeAttempt } from '../../project-member-api-keys/entities/api-key-exchange-attempt.entity';
import { OAuthRegistrationRateLimiterService } from './oauth-registration-rate-limiter.service';

const configService = () =>
  new ConfigService({ IDP_BETTER_AUTH_SECRET: 'test-deployment-secret-long-enough' });

const createDataSource = async (database: string) => {
  const source = new DataSource({
    type: 'better-sqlite3',
    database,
    entities: [ApiKeyExchangeAttempt],
    synchronize: true,
  });
  await source.initialize();
  return source;
};

describe('OAuthRegistrationRateLimiterService', () => {
  let dataSource: DataSource;
  let service: OAuthRegistrationRateLimiterService;

  beforeEach(async () => {
    dataSource = await createDataSource(':memory:');
    service = new OAuthRegistrationRateLimiterService(dataSource, configService());
  });

  afterEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('blocks the eleventh registration for the same source, resource, and redirect origin', async () => {
    for (let index = 0; index < 10; index += 1) {
      await service.assertAllowed(
        '203.0.113.10',
        'https://mcp.owox.com/mcp',
        'http://127.0.0.1:5555'
      );
    }

    const error = await service
      .assertAllowed('203.0.113.10', 'https://mcp.owox.com/mcp', 'http://127.0.0.1:5555')
      .catch(error => error);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((error as HttpException).getResponse()).toMatchObject({
      message: 'Too many dynamic client registration attempts',
      retryAfterSeconds: expect.any(Number),
    });
  });

  it('keeps source, resource, and redirect-origin buckets isolated', async () => {
    for (let index = 0; index < 10; index += 1) {
      await service.assertAllowed(
        '203.0.113.10',
        'https://mcp.owox.com/mcp',
        'http://127.0.0.1:5555'
      );
    }

    await expect(
      service.assertAllowed('203.0.113.11', 'https://mcp.owox.com/mcp', 'http://127.0.0.1:5555')
    ).resolves.toBeUndefined();
    await expect(
      service.assertAllowed('203.0.113.10', 'https://mcp.owox.com/mcp', 'http://127.0.0.1:6666')
    ).resolves.toBeUndefined();
    await expect(
      service.assertAllowed(
        '203.0.113.10',
        'https://project-a.mcp.owox.com/mcp',
        'http://127.0.0.1:5555'
      )
    ).resolves.toBeUndefined();
  });

  it('stores only HMAC identifiers in the shared limiter table', async () => {
    const source = '203.0.113.99';
    const resource = 'https://mcp.owox.com/mcp';
    const origin = 'https://chatgpt.com';

    await service.assertAllowed(source, resource, origin);

    const rows = await dataSource.getRepository(ApiKeyExchangeAttempt).find();
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(source);
    expect(serialized).not.toContain(resource);
    expect(serialized).not.toContain(origin);
    expect(rows).toHaveLength(1);
    expect(rows[0].ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].scopeKey).toMatch(/^dcr:[a-f0-9]{64}$/);
    expect(rows[0].apiKeyIdHash).toBeNull();
  });

  it('persists OAuth registration buckets across service restarts', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'owox-dcr-limiter-'));
    const databasePath = join(tempDir, 'limiter.sqlite');
    let firstDataSource: DataSource | undefined;
    let secondDataSource: DataSource | undefined;

    try {
      firstDataSource = await createDataSource(databasePath);
      const firstService = new OAuthRegistrationRateLimiterService(
        firstDataSource,
        configService()
      );

      for (let index = 0; index < 10; index += 1) {
        await firstService.assertAllowed(
          '203.0.113.10',
          'https://mcp.owox.com/mcp',
          'http://127.0.0.1:5555'
        );
      }

      await firstDataSource.destroy();

      secondDataSource = await createDataSource(databasePath);
      const secondService = new OAuthRegistrationRateLimiterService(
        secondDataSource,
        configService()
      );
      const error = await secondService
        .assertAllowed('203.0.113.10', 'https://mcp.owox.com/mcp', 'http://127.0.0.1:5555')
        .catch(error => error);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    } finally {
      if (firstDataSource?.isInitialized) {
        await firstDataSource.destroy();
      }
      if (secondDataSource?.isInitialized) {
        await secondDataSource.destroy();
      }
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('shares one registration budget across two live database connections', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'owox-dcr-workers-'));
    const databasePath = join(tempDir, 'limiter.sqlite');
    const sources: DataSource[] = [];

    try {
      sources.push(await createDataSource(databasePath));
      sources.push(await createDataSource(databasePath));
      const workers = sources.map(
        source => new OAuthRegistrationRateLimiterService(source, configService())
      );

      for (let index = 0; index < 10; index += 1) {
        await workers[index % 2].assertAllowed(
          '203.0.113.10',
          'https://mcp.owox.com/mcp',
          'https://chatgpt.com'
        );
      }

      for (const worker of workers) {
        const error = await worker
          .assertAllowed('203.0.113.10', 'https://mcp.owox.com/mcp', 'https://chatgpt.com')
          .catch(error => error);
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    } finally {
      for (const source of sources) {
        if (source.isInitialized) await source.destroy();
      }
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('prunes only OAuth registration rows from the shared limiter table', async () => {
    await dataSource.getRepository(ApiKeyExchangeAttempt).save([
      {
        bucketStart: new Date(Date.now() - 25 * 60 * 60 * 1_000),
        ipHash: 'a'.repeat(64),
        apiKeyIdHash: null,
        scopeKey: 'dcr:' + 'b'.repeat(64),
        failedAttempts: 1,
        blockedUntil: null,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1_000),
      },
      {
        bucketStart: new Date(Date.now() - 25 * 60 * 60 * 1_000),
        ipHash: 'c'.repeat(64),
        apiKeyIdHash: null,
        scopeKey: 'ip',
        failedAttempts: 1,
        blockedUntil: null,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1_000),
      },
    ]);

    await service.assertAllowed('203.0.113.10', 'https://mcp.owox.com/mcp', 'https://chatgpt.com');

    const rows = await dataSource.getRepository(ApiKeyExchangeAttempt).find();
    expect(rows.some(row => row.scopeKey === 'dcr:' + 'b'.repeat(64))).toBe(false);
    expect(rows.some(row => row.scopeKey === 'ip')).toBe(true);
  });

  it('boots without a secret but fails closed when registration limiting is used', async () => {
    const limiter = new OAuthRegistrationRateLimiterService(
      dataSource,
      new ConfigService({ NODE_ENV: 'production', IDP_BETTER_AUTH_SECRET: '' })
    );

    await expect(
      limiter.assertAllowed('203.0.113.10', 'https://mcp.owox.com/mcp', 'https://chatgpt.com')
    ).rejects.toThrow('IDP_BETTER_AUTH_SECRET is required for OAuth registration limiting');
  });
});
