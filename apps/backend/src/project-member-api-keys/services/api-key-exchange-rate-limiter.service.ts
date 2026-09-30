import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHmac } from 'node:crypto';
import { DataSource, LessThan, Repository } from 'typeorm';
import { ApiKeyExchangeAttempt } from '../entities/api-key-exchange-attempt.entity';

export type ApiKeyExchangeRateLimitKey = {
  ipHash: string;
  apiKeyIdHash?: string;
  bucketStart: Date;
};

export type ApiKeyExchangeRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

const BUCKET_MS = 5 * 60 * 1_000;
const RETENTION_MS = 24 * 60 * 60 * 1_000;
const PER_KEY_LIMIT = 5;
const PER_IP_LIMIT = 30;

@Injectable()
export class ApiKeyExchangeRateLimiterService {
  private readonly repository: Repository<ApiKeyExchangeAttempt>;
  private readonly hmacSecret: string;
  private nextPruneAt = 0;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService
  ) {
    this.repository = dataSource.getRepository(ApiKeyExchangeAttempt);
    // Prefer a dedicated deployment secret. The Better Auth secret remains a
    // backwards-compatible fallback for existing deployments. Domain
    // separation below keeps these hashes scoped to this limiter.
    const configuredSecret =
      configService.get<string>('API_KEY_EXCHANGE_HMAC_SECRET') ||
      configService.get<string>('IDP_BETTER_AUTH_SECRET', '');
    // The application configuration requires an identity secret in deployed
    // environments. Test-only application harnesses may intentionally omit
    // the complete identity-provider configuration; use a deterministic
    // non-production value there so unrelated HTTP tests can boot without
    // weakening the deployed secret contract.
    this.hmacSecret =
      configuredSecret ||
      (configService.get<string>('NODE_ENV') === 'test'
        ? 'owox-test-only-api-key-exchange-hmac-secret'
        : '');
    if (!this.hmacSecret) {
      throw new Error('IDP_BETTER_AUTH_SECRET is required for API-key exchange limiting');
    }
  }

  createRateLimitKey(ipAddress: string, apiKeyId?: string): ApiKeyExchangeRateLimitKey {
    const now = Date.now();
    const bucketStart = new Date(Math.floor(now / BUCKET_MS) * BUCKET_MS);
    return {
      ipHash: this.hmac('ip', ipAddress),
      ...(apiKeyId ? { apiKeyIdHash: this.hmac('api-key-id', apiKeyId) } : {}),
      bucketStart,
    };
  }

  async check(key: ApiKeyExchangeRateLimitKey): Promise<ApiKeyExchangeRateLimitDecision> {
    const [ipAttempt, keyAttempt] = await Promise.all([
      this.findAttempt(key, 'ip'),
      key.apiKeyIdHash ? this.findAttempt(key, `key:${key.apiKeyIdHash}`) : null,
    ]);
    const now = Date.now();
    const blockedUntil = [ipAttempt?.blockedUntil, keyAttempt?.blockedUntil]
      .filter((value): value is Date => value instanceof Date && value.getTime() > now)
      .sort((left, right) => right.getTime() - left.getTime())[0];
    if (!blockedUntil) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil.getTime() - now) / 1_000)),
    };
  }

  async recordFailure(key: ApiKeyExchangeRateLimitKey): Promise<void> {
    await this.incrementAttempt(key, 'ip', PER_IP_LIMIT);
    if (key.apiKeyIdHash) {
      await this.incrementAttempt(key, `key:${key.apiKeyIdHash}`, PER_KEY_LIMIT, key.apiKeyIdHash);
    }
    await this.pruneExpired();
  }

  async resetKeyBucket(key: ApiKeyExchangeRateLimitKey): Promise<void> {
    if (!key.apiKeyIdHash) return;
    await this.repository.update(
      {
        bucketStart: key.bucketStart,
        ipHash: key.ipHash,
        scopeKey: `key:${key.apiKeyIdHash}`,
      },
      { failedAttempts: 0, blockedUntil: null }
    );
  }

  private async incrementAttempt(
    key: ApiKeyExchangeRateLimitKey,
    scopeKey: string,
    limit: number,
    apiKeyIdHash: string | null = null
  ): Promise<void> {
    const blockedUntil = new Date(key.bucketStart.getTime() + BUCKET_MS);
    const sqlite =
      this.dataSource.options.type === 'better-sqlite3' ||
      this.dataSource.options.type === 'sqlite';
    const sql = sqlite
      ? `INSERT INTO api_key_exchange_attempts
           (bucketStart, ipHash, apiKeyIdHash, scopeKey, failedAttempts, blockedUntil, createdAt)
         VALUES (?, ?, ?, ?, 1, CASE WHEN 1 >= ? THEN ? ELSE NULL END, CURRENT_TIMESTAMP)
         ON CONFLICT(bucketStart, ipHash, scopeKey) DO UPDATE SET
           failedAttempts = failedAttempts + 1,
           blockedUntil = CASE WHEN failedAttempts + 1 >= ? THEN ? ELSE blockedUntil END`
      : `INSERT INTO api_key_exchange_attempts
           (bucketStart, ipHash, apiKeyIdHash, scopeKey, failedAttempts, blockedUntil, createdAt)
         VALUES (?, ?, ?, ?, 1, CASE WHEN 1 >= ? THEN ? ELSE NULL END, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           blockedUntil = CASE WHEN failedAttempts + 1 >= ? THEN ? ELSE blockedUntil END,
           failedAttempts = failedAttempts + 1`;

    await this.dataSource.query(sql, [
      this.toDatabaseTimestamp(key.bucketStart),
      key.ipHash,
      apiKeyIdHash,
      scopeKey,
      limit,
      this.toDatabaseTimestamp(blockedUntil),
      limit,
      this.toDatabaseTimestamp(blockedUntil),
    ]);
  }

  private async findAttempt(
    key: ApiKeyExchangeRateLimitKey,
    scopeKey: string
  ): Promise<ApiKeyExchangeAttempt | null> {
    return this.repository.findOne({
      where: { bucketStart: key.bucketStart, ipHash: key.ipHash, scopeKey },
    });
  }

  private async pruneExpired(): Promise<void> {
    const now = Date.now();
    if (now < this.nextPruneAt) return;
    this.nextPruneAt = now + 60_000;
    await this.repository.delete({ createdAt: LessThan(new Date(now - RETENTION_MS)) });
  }

  private hmac(domain: string, value: string): string {
    return createHmac('sha256', this.hmacSecret)
      .update(`api-key-exchange:${domain}:${value}`)
      .digest('hex');
  }

  private toDatabaseTimestamp(value: Date): string {
    return value.toISOString().replace('T', ' ').replace('Z', '');
  }
}
