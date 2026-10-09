import { describe, expect, it } from '@jest/globals';
import { resolveSignInRedirect } from './sign-in-redirect.js';
describe('Sign-in continuation', () => {
  it('preserves local OAuth callback query exactly', () => {
    const value =
      '/oauth/authorize?client_id=native&redirect_uri=http%3A%2F%2F127.0.0.1%3A4000%2Fcallback&state=original';
    expect(resolveSignInRedirect(value)).toBe(value);
  });
  it.each([
    undefined,
    {},
    ['//evil.test'],
    '//evil.test',
    '/\\evil.test',
    'https://evil.test',
    '\n//evil.test',
    '/\r\nLocation: https://evil.test',
  ])('rejects unsafe continuation %j', value => {
    expect(resolveSignInRedirect(value)).toBe('/');
  });
});
