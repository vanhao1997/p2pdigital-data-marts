import { describe, expect, it, vi } from 'vitest';
import { signRequest, verifyHmac, bodyHash } from '../src/security.js';
import { MemoryReplayStore, RedisReplayStore } from '../src/replay-store.js';

function requestFor(headers) {
  return {
    get(name) {
      return headers[name.toLowerCase()] || '';
    },
  };
}

describe('Admicro extractor HMAC', () => {
  it('accepts a fresh signed body and rejects replay', async () => {
    const body = JSON.stringify({ runId: 'run-1' });
    const timestamp = String(Date.now());
    const nonce = 'nonce-1';
    const secret = 'test-secret';
    const signature = signRequest({ timestamp, nonce, body, secret });
    const headers = {
      'x-owox-timestamp': timestamp,
      'x-owox-nonce': nonce,
      'x-owox-body-sha256': bodyHash(body),
      'x-owox-signature': signature,
    };
    const replayStore = new MemoryReplayStore();
    await expect(verifyHmac(requestFor(headers), body, secret, replayStore)).resolves.toEqual({ ok: true });
    await expect(verifyHmac(requestFor(headers), body, secret, replayStore)).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it('rejects body tampering', async () => {
    const body = '{}';
    const timestamp = String(Date.now());
    const secret = 'test-secret';
    const nonce = 'nonce-2';
    const signature = signRequest({ timestamp, nonce, body, secret });
    const result = await verifyHmac(
      requestFor({
        'x-owox-timestamp': timestamp,
        'x-owox-nonce': nonce,
        'x-owox-body-sha256': bodyHash(body),
        'x-owox-signature': signature,
      }),
      '{"changed":true}',
      secret
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain('body hash');
  });

  it('uses Redis SET NX with a bounded TTL for a horizontally shared nonce store', async () => {
    const client = { set: vi.fn().mockResolvedValue('OK') };
    const store = new RedisReplayStore({ client });

    await expect(store.claim('nonce-redis', 600000)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith(
      expect.stringMatching(/^admicro:extractor:replay:v1:[a-f0-9]{64}$/),
      '1',
      'PX',
      600000,
      'NX'
    );
  });

  it('allows a memory nonce to be claimed again after its TTL expires', async () => {
    let now = 1000;
    const replayStore = new MemoryReplayStore({ now: () => now });

    await expect(replayStore.claim('nonce-expiry', 100)).resolves.toBe(true);
    await expect(replayStore.claim('nonce-expiry', 100)).resolves.toBe(false);
    now += 100;
    await expect(replayStore.claim('nonce-expiry', 100)).resolves.toBe(true);
  });

  it('fails closed when the shared nonce store is unavailable', async () => {
    const replayStore = { claim: vi.fn().mockRejectedValue(new Error('redis unavailable')) };
    const body = '{}';
    const timestamp = String(Date.now());
    const nonce = 'nonce-unavailable';
    const secret = 'test-secret';

    const result = await verifyHmac(
      requestFor({
        'x-owox-timestamp': timestamp,
        'x-owox-nonce': nonce,
        'x-owox-body-sha256': bodyHash(body),
        'x-owox-signature': signRequest({ timestamp, nonce, body, secret }),
      }),
      body,
      secret,
      replayStore
    );

    expect(result).toEqual({
      ok: false,
      status: 503,
      message: 'Extractor replay protection is unavailable',
    });
  });

  it('does not connect an already-configured lazy Redis client until health or claim', async () => {
    const client = {
      status: 'wait',
      connect: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue('OK'),
    };
    const store = new RedisReplayStore({ client });

    await store.claim('lazy-redis', 600000);

    expect(client.connect).toHaveBeenCalledOnce();
  });
});
