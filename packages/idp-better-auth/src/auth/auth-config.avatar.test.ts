import { describe, expect, it } from '@jest/globals';
import { validateAvatarUpdate } from './auth-config.js';

describe('avatar update validation', () => {
  it.each([null, undefined, 'https://cdn.example.com/photo.png', 'http://localhost/photo.png'])(
    'accepts supported avatar %s',
    image => {
      expect(() => validateAvatarUpdate({ path: '/update-user', body: { image } })).not.toThrow();
    }
  );
  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AA==',
    'invalid',
    12,
    '',
    'https://user:password@example.com/photo',
    'https://example.com/' + 'x'.repeat(2048),
  ])('returns a client error for invalid avatar %#', image => {
    try {
      validateAvatarUpdate({ path: '/update-user', body: { image } });
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toMatchObject({
        status: 'BAD_REQUEST',
        body: { message: 'Invalid avatar URL' },
      });
    }
  });
  it('leaves unrelated endpoints unchanged', () => {
    expect(() =>
      validateAvatarUpdate({ path: '/change-password', body: { image: 1 } })
    ).not.toThrow();
  });
});
