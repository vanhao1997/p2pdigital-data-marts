import crypto from 'node:crypto';
import { MemoryReplayStore } from './replay-store.js';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const NONCE_TTL_MS = 10 * 60 * 1000;
const defaultReplayStore = new MemoryReplayStore();

export function bodyHash(rawBody) {
  return crypto
    .createHash('sha256')
    .update(rawBody ?? '')
    .digest('hex');
}

export function signRequest({ timestamp, nonce, body, secret }) {
  const hash = bodyHash(body);
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${nonce}.${hash}`).digest('hex')}`;
}

export async function verifyHmac(req, rawBody, secret, replayStore = defaultReplayStore) {
  if (!secret)
    return { ok: false, status: 503, message: 'Admicro extractor shared secret is not configured' };
  const timestamp = String(req.get('x-owox-timestamp') || '');
  const nonce = String(req.get('x-owox-nonce') || '');
  const suppliedHash = String(req.get('x-owox-body-sha256') || '');
  const signature = String(req.get('x-owox-signature') || '');
  const timestampNumber = Number(timestamp);
  const now = Date.now();
  if (!/^\d+$/.test(timestamp) || Math.abs(now - timestampNumber) > MAX_CLOCK_SKEW_MS)
    return { ok: false, status: 401, message: 'Invalid or expired extractor timestamp' };
  if (!/^[a-f0-9]{64}$/i.test(suppliedHash) || suppliedHash.toLowerCase() !== bodyHash(rawBody))
    return { ok: false, status: 401, message: 'Extractor body hash mismatch' };
  if (!nonce || nonce.length > 200)
    return { ok: false, status: 401, message: 'Invalid or replayed extractor nonce' };
  const expected = signRequest({ timestamp, nonce, body: rawBody, secret });
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return { ok: false, status: 401, message: 'Invalid extractor signature' };
  try {
    const claimed = await replayStore.claim(nonce, NONCE_TTL_MS);
    if (!claimed) return { ok: false, status: 401, message: 'Invalid or replayed extractor nonce' };
  } catch {
    return { ok: false, status: 503, message: 'Extractor replay protection is unavailable' };
  }
  return { ok: true };
}
