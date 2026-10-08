import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHmac } from 'node:crypto';
import { DataSource } from 'typeorm';

const REGISTRATION_WINDOW_MS = 5 * 60 * 1_000;
const MAX_REGISTRATIONS_PER_WINDOW = 10;
const RETENTION_MS = 24 * 60 * 60 * 1_000;

export interface OAuthRegistrationRateLimiter {
  assertAllowed(sourceKey: string, resource: string, redirectOriginKey: string): Promise<void>;
}

@Injectable()
export class OAuthRegistrationRateLimiterService implements OAuthRegistrationRateLimiter {
  private readonly hmacSecret: string;
  private nextPruneAt = 0;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService
  ) {
    const configuredSecret = configService.get<string>('IDP_BETTER_AUTH_SECRET', '');
    this.hmacSecret =
      configuredSecret ||
      (configService.get<string>('NODE_ENV') === 'test'
        ? 'owox-test-only-oauth-registration-hmac-secret'
        : '');
  }

  async assertAllowed(
    sourceKey: string,
    resource: string,
    redirectOriginKey: string
  ): Promise<void> {
    if (!this.hmacSecret) {
      throw new Error('IDP_BETTER_AUTH_SECRET is required for OAuth registration limiting');
    }

    const now = Date.now();
    const bucketStart = new Date(Math.floor(now / REGISTRATION_WINDOW_MS) * REGISTRATION_WINDOW_MS);
    const blockedUntil = new Date(bucketStart.getTime() + REGISTRATION_WINDOW_MS);
    const ipHash = this.hmac('source', sourceKey || 'unknown');
    const scopeKey = `dcr:${this.hmac('resource-origin', `${resource}|${redirectOriginKey}`)}`;

    await this.incrementAttempt(bucketStart, ipHash, scopeKey, blockedUntil);
    await this.pruneExpired();

    const attempt = await this.findAttempt(bucketStart, ipHash, scopeKey);
    if ((attempt?.failedAttempts ?? 0) <= MAX_REGISTRATIONS_PER_WINDOW) {
      return;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1_000));
    throw new HttpException(
      {
        message: 'Too many dynamic client registration attempts',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private async incrementAttempt(
    bucketStart: Date,
    ipHash: string,
    scopeKey: string,
    blockedUntil: Date
  ): Promise<void> {
    const sqlite =
      this.dataSource.options.type === 'better-sqlite3' ||
      this.dataSource.options.type === 'sqlite';
    const sql = sqlite
      ? `INSERT INTO api_key_exchange_attempts
           (bucketStart, ipHash, apiKeyIdHash, scopeKey, failedAttempts, blockedUntil, createdAt)
         VALUES (?, ?, NULL, ?, 1, NULL, CURRENT_TIMESTAMP)
         ON CONFLICT(bucketStart, ipHash, scopeKey) DO UPDATE SET
           failedAttempts = failedAttempts + 1,
           blockedUntil = CASE WHEN failedAttempts + 1 > ? THEN ? ELSE blockedUntil END`
      : `INSERT INTO api_key_exchange_attempts
           (bucketStart, ipHash, apiKeyIdHash, scopeKey, failedAttempts, blockedUntil, createdAt)
         VALUES (?, ?, NULL, ?, 1, NULL, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           blockedUntil = CASE WHEN failedAttempts + 1 > ? THEN ? ELSE blockedUntil END,
           failedAttempts = failedAttempts + 1`;

    await this.dataSource.query(sql, [
      this.toDatabaseTimestamp(bucketStart),
      ipHash,
      scopeKey,
      MAX_REGISTRATIONS_PER_WINDOW,
      this.toDatabaseTimestamp(blockedUntil),
    ]);
  }

  private async findAttempt(
    bucketStart: Date,
    ipHash: string,
    scopeKey: string
  ): Promise<{ failedAttempts: number } | null> {
    const rows = (await this.dataSource.query(
      `SELECT failedAttempts
         FROM api_key_exchange_attempts
        WHERE bucketStart = ? AND ipHash = ? AND scopeKey = ?
        LIMIT 1`,
      [this.toDatabaseTimestamp(bucketStart), ipHash, scopeKey]
    )) as Array<{ failedAttempts: number }>;
    return rows[0] ?? null;
  }

  private async pruneExpired(): Promise<void> {
    const now = Date.now();
    if (now < this.nextPruneAt) return;
    this.nextPruneAt = now + 60_000;
    await this.dataSource.query(
      `DELETE FROM api_key_exchange_attempts WHERE scopeKey LIKE 'dcr:%' AND createdAt < ?`,
      [this.toDatabaseTimestamp(new Date(now - RETENTION_MS))]
    );
  }

  private hmac(domain: string, value: string): string {
    if (!this.hmacSecret) {
      throw new Error('IDP_BETTER_AUTH_SECRET is required for OAuth registration limiting');
    }
    return createHmac('sha256', this.hmacSecret)
      .update(`oauth-registration:${domain}:${value}`)
      .digest('hex');
  }

  private toDatabaseTimestamp(value: Date): string {
    return value.toISOString().replace('T', ' ').replace('Z', '');
  }
}
