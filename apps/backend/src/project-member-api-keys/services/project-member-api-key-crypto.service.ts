import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const ProjectMemberApiKeyHashParamsSchema = z.object({
  algorithm: z.literal('scrypt'),
  version: z.literal(1),
  keyLength: z.number().int().positive(),
  cost: z.number().int().positive(),
  blockSize: z.number().int().positive(),
  parallelization: z.number().int().positive(),
});

export type ProjectMemberApiKeyHashParams = z.infer<typeof ProjectMemberApiKeyHashParamsSchema>;

export type ProjectMemberApiKeyStoredHash = {
  keyHash: string;
  keyHashSalt: string;
  keyHashParams: ProjectMemberApiKeyHashParams;
};

const API_KEY_ID_REGEX = /^pmk_[A-Za-z0-9_-]{22}$/;
const API_KEY_SECRET_REGEX = /^[A-Za-z0-9_-]{43}$/;

const CURRENT_HASH_PARAMS: ProjectMemberApiKeyHashParams = {
  algorithm: 'scrypt',
  version: 1,
  keyLength: 64,
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
};

const MAX_CONCURRENT_SCRYPT = 4;
const MAX_QUEUED_SCRYPT = 32;

export class ApiKeyKdfCapacityError extends Error {
  constructor() {
    super('API-key verification capacity is temporarily unavailable');
    this.name = 'ApiKeyKdfCapacityError';
  }
}

@Injectable()
export class ProjectMemberApiKeyCryptoService {
  private activeScryptOperations = 0;
  private readonly scryptWaiters: Array<() => void> = [];

  generateApiKeyId(): string {
    return `pmk_${randomBytes(16).toString('base64url')}`;
  }

  generateApiKeySecret(): string {
    return randomBytes(32).toString('base64url');
  }

  isValidApiKeyId(apiKeyId: string): boolean {
    return API_KEY_ID_REGEX.test(apiKeyId);
  }

  isValidApiKeySecret(apiKeySecret: string): boolean {
    return API_KEY_SECRET_REGEX.test(apiKeySecret);
  }

  async hashSecret(apiKeyId: string, apiKeySecret: string): Promise<ProjectMemberApiKeyStoredHash> {
    if (!this.isValidApiKeyId(apiKeyId)) {
      throw new Error('Invalid API key id format');
    }
    if (!this.isValidApiKeySecret(apiKeySecret)) {
      throw new Error('Invalid API key secret format');
    }

    const keyHashSalt = randomBytes(16).toString('base64url');
    const keyHashParams = { ...CURRENT_HASH_PARAMS };
    const keyHash = (
      await this.deriveHash(apiKeyId, apiKeySecret, keyHashSalt, keyHashParams)
    ).toString('base64url');

    return { keyHash, keyHashSalt, keyHashParams };
  }

  async verifySecret(
    apiKeyId: string,
    apiKeySecret: string,
    storedHash: ProjectMemberApiKeyStoredHash
  ): Promise<boolean> {
    if (!this.isValidApiKeyId(apiKeyId) || !this.isValidApiKeySecret(apiKeySecret)) {
      return false;
    }

    const keyHashParams = this.parseHashParams(storedHash.keyHashParams);
    if (!keyHashParams) {
      return false;
    }

    const expectedHash = Buffer.from(storedHash.keyHash, 'base64url');
    const actualHash = await this.deriveHash(
      apiKeyId,
      apiKeySecret,
      storedHash.keyHashSalt,
      keyHashParams
    );

    return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash);
  }

  private deriveHash(
    apiKeyId: string,
    apiKeySecret: string,
    keyHashSalt: string,
    params: ProjectMemberApiKeyHashParams
  ): Promise<Buffer> {
    const canonicalMaterial = `owox_pmkey:${apiKeyId}:${apiKeySecret}`;

    return this.withScryptSlot(
      async () =>
        new Promise<Buffer>((resolve, reject) => {
          scrypt(
            canonicalMaterial,
            keyHashSalt,
            params.keyLength,
            {
              N: params.cost,
              r: params.blockSize,
              p: params.parallelization,
            },
            (error, derivedKey) => {
              if (error) {
                reject(error);
                return;
              }
              resolve(derivedKey);
            }
          );
        })
    );
  }

  private async withScryptSlot<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.acquireScryptSlot();
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async acquireScryptSlot(): Promise<() => void> {
    if (this.activeScryptOperations >= MAX_CONCURRENT_SCRYPT) {
      if (this.scryptWaiters.length >= MAX_QUEUED_SCRYPT) {
        throw new ApiKeyKdfCapacityError();
      }
      await new Promise<void>(resolve =>
        this.scryptWaiters.push(() => {
          // The releasing operation hands its slot to this waiter. Count the
          // transferred slot before the waiter starts so active capacity does
          // not slowly shrink after queued work drains.
          this.activeScryptOperations += 1;
          resolve();
        })
      );
    } else {
      this.activeScryptOperations += 1;
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeScryptOperations -= 1;
      const next = this.scryptWaiters.shift();
      if (next) {
        next();
      }
    };
  }

  private parseHashParams(
    params: ProjectMemberApiKeyHashParams | Record<string, unknown>
  ): ProjectMemberApiKeyHashParams | null {
    const result = ProjectMemberApiKeyHashParamsSchema.safeParse(params);
    return result.success ? result.data : null;
  }
}
