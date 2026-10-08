import { describe, expect, it } from '@jest/globals';
import { summarizeGoogleProfileForLog } from './google-provider.js';
import { summarizeMicrosoftProfileForLog } from './microsoft-provider.js';

describe('social provider log summaries', () => {
  it('summarizes Google profiles without raw OAuth profile fields or secrets', () => {
    const summary = summarizeGoogleProfileForLog({
      sub: 'google-account-id',
      email: 'alice@example.com',
      name: 'Alice Example',
      given_name: 'Alice',
      picture: 'https://lh3.googleusercontent.com/avatar',
      email_verified: true,
      access_token: 'access-token-secret',
      refresh_token: 'refresh-token-secret',
    });
    const serialized = JSON.stringify(summary);

    expect(summary).toEqual({
      profile: {
        hasAccountId: true,
        hasEmail: true,
        hasName: true,
        hasGivenName: true,
        hasImage: true,
        emailVerified: true,
      },
    });
    expect(serialized).not.toContain('google-account-id');
    expect(serialized).not.toContain('alice@example.com');
    expect(serialized).not.toContain('Alice Example');
    expect(serialized).not.toContain('access-token-secret');
    expect(serialized).not.toContain('refresh-token-secret');
  });

  it('summarizes Microsoft profiles without raw tenant, user, or token values', () => {
    const summary = summarizeMicrosoftProfileForLog({
      oid: 'object-id',
      tid: 'tenant-id',
      email: 'alice@example.com',
      preferred_username: 'alice@example.com',
      name: 'Alice Example',
      id_token: 'id-token-secret',
    });
    const serialized = JSON.stringify(summary);

    expect(summary).toEqual({
      profile: {
        hasObjectId: true,
        hasTenantId: true,
        hasEmail: true,
        hasPreferredUsername: true,
        hasName: true,
      },
    });
    expect(serialized).not.toContain('object-id');
    expect(serialized).not.toContain('tenant-id');
    expect(serialized).not.toContain('alice@example.com');
    expect(serialized).not.toContain('Alice Example');
    expect(serialized).not.toContain('id-token-secret');
  });
});
