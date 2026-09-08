import { describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => {
  const post = vi.fn().mockResolvedValue({ data: {} });
  return { default: { create: vi.fn(() => ({ post, get: vi.fn() })) } };
});

describe('updateAvatar', () => {
  it('rejects non-http avatar URLs before making a request', async () => {
    const { updateAvatar } = await import('./auth-api.service');
    await expect(updateAvatar('javascript:alert(1)')).rejects.toThrow('Invalid avatar URL');
  });

  it('accepts clearing the avatar', async () => {
    const { updateAvatar } = await import('./auth-api.service');
    await expect(updateAvatar(null)).resolves.toBeUndefined();
  });
});
