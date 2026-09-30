import { ProjectMemberApiKeyCryptoService } from './project-member-api-key-crypto.service';

describe('ProjectMemberApiKeyCryptoService', () => {
  const service = new ProjectMemberApiKeyCryptoService();

  it('generates API key ids in the public pmk format', () => {
    const apiKeyId = service.generateApiKeyId();

    expect(apiKeyId).toMatch(/^pmk_[A-Za-z0-9_-]{22}$/);
  });

  it('generates API key secrets in the secret credential format', () => {
    const apiKeySecret = service.generateApiKeySecret();

    expect(apiKeySecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('stores a hash, salt, and KDF params for a generated secret', async () => {
    const apiKeyId = service.generateApiKeyId();
    const apiKeySecret = service.generateApiKeySecret();

    const stored = await service.hashSecret(apiKeyId, apiKeySecret);

    expect(stored.keyHash).toEqual(expect.any(String));
    expect(stored.keyHash).not.toBe(apiKeySecret);
    expect(stored.keyHashSalt).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(stored.keyHashParams).toEqual({
      algorithm: 'scrypt',
      version: 1,
      keyLength: 64,
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
    });
  });

  it('verifies the correct secret against the stored hash material', async () => {
    const apiKeyId = service.generateApiKeyId();
    const apiKeySecret = service.generateApiKeySecret();
    const stored = await service.hashSecret(apiKeyId, apiKeySecret);

    await expect(service.verifySecret(apiKeyId, apiKeySecret, stored)).resolves.toBe(true);
  });

  it('rejects the wrong secret', async () => {
    const apiKeyId = service.generateApiKeyId();
    const stored = await service.hashSecret(apiKeyId, service.generateApiKeySecret());

    await expect(
      service.verifySecret(apiKeyId, service.generateApiKeySecret(), stored)
    ).resolves.toBe(false);
  });

  it('rejects malformed ids and secrets before verification', async () => {
    const apiKeyId = service.generateApiKeyId();
    const apiKeySecret = service.generateApiKeySecret();
    const stored = await service.hashSecret(apiKeyId, apiKeySecret);

    expect(service.isValidApiKeyId('bad-key')).toBe(false);
    expect(service.isValidApiKeySecret('bad-secret')).toBe(false);
    await expect(service.verifySecret('bad-key', apiKeySecret, stored)).resolves.toBe(false);
    await expect(service.verifySecret(apiKeyId, 'bad-secret', stored)).resolves.toBe(false);
  });

  it('returns all semaphore capacity after queued work drains', async () => {
    type Deferred = { promise: Promise<void>; resolve: () => void };
    const deferred = (): Deferred => {
      let resolve!: () => void;
      const promise = new Promise<void>(nextResolve => {
        resolve = nextResolve;
      });
      return { promise, resolve };
    };
    const gate = deferred();
    const internal = service as unknown as {
      withScryptSlot<T>(operation: () => Promise<T>): Promise<T>;
      activeScryptOperations: number;
    };

    const operations = Array.from({ length: 6 }, () =>
      internal.withScryptSlot(async () => gate.promise)
    );
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(internal.activeScryptOperations).toBe(4);

    gate.resolve();
    await Promise.all(operations);
    expect(internal.activeScryptOperations).toBe(0);
  });
});
