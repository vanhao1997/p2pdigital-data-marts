import crypto from 'node:crypto';
import Redis from 'ioredis';

const DEFAULT_NAMESPACE = 'admicro:extractor:replay:v1:';

export class MemoryReplayStore {
  constructor({ now = () => Date.now() } = {}) {
    this.mode = 'memory';
    this.shared = false;
    this.now = now;
    this.entries = new Map();
  }

  async claim(nonce, ttlMs) {
    const now = this.now();
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= now) this.entries.delete(key);
    }
    const expiresAt = this.entries.get(nonce);
    if (expiresAt && expiresAt > now) return false;
    this.entries.set(nonce, now + ttlMs);
    return true;
  }

  async close() {}

  async health() {
    return { ok: true, mode: this.mode, shared: this.shared };
  }
}

export class RedisReplayStore {
  constructor({ client, namespace = DEFAULT_NAMESPACE } = {}) {
    if (!client) throw new Error('Redis replay store requires a Redis client');
    this.client = client;
    this.namespace = namespace;
    this.mode = 'redis';
    this.shared = true;
  }

  async claim(nonce, ttlMs) {
    await this.ensureConnected();
    const key = `${this.namespace}${crypto.createHash('sha256').update(nonce).digest('hex')}`;
    const result = await this.client.set(key, '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async close() {
    if (typeof this.client.quit === 'function') await this.client.quit();
  }

  async health() {
    try {
      await this.ensureConnected();
      await this.client.ping();
      return { ok: true, mode: this.mode, shared: this.shared };
    } catch {
      return { ok: false, mode: this.mode, shared: this.shared };
    }
  }

  async ensureConnected() {
    if (this.client.status === 'wait' && typeof this.client.connect === 'function') {
      await this.client.connect();
    }
  }
}

export function createReplayStoreFromEnv(env = process.env) {
  const mode = String(env.ADMICRO_EXTRACTOR_NONCE_STORE || 'memory')
    .trim()
    .toLowerCase();
  if (mode === 'memory') return new MemoryReplayStore();
  if (mode !== 'redis') throw new Error('ADMICRO_EXTRACTOR_NONCE_STORE must be memory or redis');

  const redisUrl = String(env.ADMICRO_EXTRACTOR_REDIS_URL || '').trim();
  if (!redisUrl) throw new Error('ADMICRO_EXTRACTOR_REDIS_URL is required for Redis nonce storage');
  return new RedisReplayStore({ client: new Redis(redisUrl, { lazyConnect: true }) });
}
