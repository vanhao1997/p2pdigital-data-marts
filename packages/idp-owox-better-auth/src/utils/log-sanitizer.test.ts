import { describe, expect, it } from '@jest/globals';
import { sanitizeLogMessage, sanitizeLogMeta, summarizeBetterAuthArgs } from './log-sanitizer.js';

describe('log-sanitizer', () => {
  it('redacts Better Auth args without forwarding raw tokens or PII', () => {
    const summary = summarizeBetterAuthArgs([
      {
        email: 'alice@example.com',
        accessToken: 'access-token-secret',
        nested: { refresh_token: 'refresh-token-secret' },
        safeField: 'safe',
      },
      new Error('Failed for bob@example.com with token=secret-token'),
    ]);
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain('alice@example.com');
    expect(serialized).not.toContain('access-token-secret');
    expect(serialized).not.toContain('refresh-token-secret');
    expect(serialized).not.toContain('secret-token');
    expect(summary.args).toEqual([
      {
        type: 'object',
        keys: ['email', 'nested', 'safeField'],
        omittedSensitiveKeys: 1,
      },
      {
        type: 'Error',
        name: 'Error',
      },
    ]);
  });

  it('summarizes Better Auth primitive args without forwarding opaque strings', () => {
    const opaqueToken = 'opaque-provider-token-without-key-name';
    const profileJson = JSON.stringify({
      email: 'profile@example.com',
      accessToken: 'json-access-token-secret',
      name: 'Profile User',
    });

    const summary = summarizeBetterAuthArgs([
      opaqueToken,
      profileJson,
      42,
      true,
      new Error(`provider failed with ${opaqueToken}`),
    ]);
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain(opaqueToken);
    expect(serialized).not.toContain(profileJson);
    expect(serialized).not.toContain('profile@example.com');
    expect(serialized).not.toContain('json-access-token-secret');
    expect(serialized).not.toContain('Profile User');
    expect(summary.args).toEqual([
      { type: 'string' },
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'Error', name: 'Error' },
    ]);
  });

  it('masks sensitive metadata values recursively', () => {
    expect(
      sanitizeLogMeta({
        AUTHORIZATION: 'Bearer secret-token',
        IDP_CLIENT_SECRET: 'client-secret-uppercase',
        APIKey: 'api-key-secret',
        userEmail: 'person@example.com',
        fullName: 'Person Example',
        refresh_token: 'refresh-secret',
        nested: {
          clientSecret: 'client-secret',
          callback:
            'https://app.example.test/callback?code=auth-code&state=state-1&token=secret-token',
        },
      })
    ).toEqual({
      AUTHORIZATION: '[REDACTED]',
      IDP_CLIENT_SECRET: '[REDACTED]',
      APIKey: '[REDACTED]',
      userEmail: 'pe**on@example.com',
      fullName: '[REDACTED]',
      refresh_token: '[REDACTED]',
      nested: {
        clientSecret: '[REDACTED]',
        callback:
          'https://app.example.test/callback?code=[REDACTED]&state=state-1&token=[REDACTED]',
      },
    });
  });

  it('masks emails and sensitive query params in messages', () => {
    expect(
      sanitizeLogMessage(
        'Failed user@example.com at https://app.test/callback?code=abc&state=ok&token=def'
      )
    ).toBe(
      'Failed us*r@example.com at https://app.test/callback?code=[REDACTED]&state=ok&token=[REDACTED]'
    );
  });
});
