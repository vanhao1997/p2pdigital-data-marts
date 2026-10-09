import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash, randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { getMigrations } from 'better-auth/db/migration';
import { AuthenticationError, type McpOAuthProjectMemberContext } from '@owox/idp-protocol';
import { createBetterAuthConfig } from '../auth/auth-config.js';
import { McpOAuthService } from './mcp-oauth-service.js';
import type { BetterAuthConfig } from '../types/index.js';

describe('McpOAuthService with native Better Auth verification persistence', () => {
  let db: InstanceType<typeof Database>;
  let service: McpOAuthService;
  let auth: Awaited<ReturnType<typeof createBetterAuthConfig>>;
  let member: McpOAuthProjectMemberContext | null;
  const resource = 'https://digitalreport.p2pdigital.io.vn/mcp';
  const context: McpOAuthProjectMemberContext = {
    userId: 'user-1',
    projectId: '0',
    roles: ['admin'],
    email: 'native@example.test',
  };
  const verifier = randomBytes(32).toString('base64url');
  const request = {
    clientId: 'native-client',
    redirectUri: 'http://127.0.0.1:4000/callback',
    resource,
    scopes: ['mcp:read', 'mcp:write'] as ('mcp:read' | 'mcp:write')[],
    state: 'state',
    codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
    codeChallengeMethod: 'S256' as const,
  };
  beforeEach(async () => {
    db = new Database(':memory:');
    auth = await createBetterAuthConfig(
      {
        baseURL: 'http://localhost:3000',
        secret: 'native-oauth-test-secret-32-characters',
        magicLinkTtl: 3600,
      } as BetterAuthConfig,
      { adapter: db }
    );
    await (await getMigrations(auth.options)).runMigrations();
    member = { ...context };
    service = new McpOAuthService(auth, async () => member);
  });
  afterEach(() => {
    db?.close();
    jest.restoreAllMocks();
  });
  const exchange = (code: string, overrides = {}) =>
    service.exchangeToken({
      grantType: 'authorization_code',
      code,
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      resource,
      codeVerifier: verifier,
      ...overrides,
    });
  async function issue() {
    return exchange((await service.createAuthorizationCode(request, context)).code);
  }

  it('stores only hashes and grant metadata, persists across service restart, and binds scopes/resource', async () => {
    const code = await service.createAuthorizationCode(request, context);
    const tokens = await exchange(code.code);
    expect(tokens.expires_in).toBe(900);
    const rows = JSON.stringify(db.prepare('SELECT identifier, value FROM verification').all());
    expect(rows).not.toContain(code.code);
    expect(rows).not.toContain(tokens.access_token);
    expect(rows).not.toContain(tokens.refresh_token!);
    const restarted = new McpOAuthService(auth, async () => member);
    expect(
      await restarted.verifyAccessToken(tokens.access_token, resource, ['mcp:read'])
    ).toMatchObject({
      userId: context.userId,
      projectId: '0',
      roles: ['admin'],
      authFlow: 'mcp',
    });
    expect(
      await restarted.verifyAccessToken(tokens.access_token, resource + '/other', ['mcp:read'])
    ).toBeNull();
    expect(
      await restarted.verifyAccessToken(tokens.refresh_token!, resource, ['mcp:read'])
    ).toBeNull();
    expect(await restarted.verifyAccessToken(code.code, resource, ['mcp:read'])).toBeNull();
  });

  it.each([
    { codeVerifier: randomBytes(32).toString('base64url') },
    { clientId: 'other-client' },
    { redirectUri: request.redirectUri + '/other' },
    { resource: resource + '/other' },
  ])('rejects mismatched code bindings and consumes codes once: %j', async overrides => {
    const code = await service.createAuthorizationCode(request, context);
    await expect(exchange(code.code, overrides)).rejects.toBeInstanceOf(AuthenticationError);
    await expect(exchange(code.code)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('permits exactly one concurrent authorization-code exchange', async () => {
    const code = await service.createAuthorizationCode(request, context);
    const results = await Promise.allSettled([exchange(code.code), exchange(code.code)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    await expect(exchange(code.code)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rotates refresh tokens with atomic single use and retains the original deadline', async () => {
    const original = await issue();
    const refresh = {
      grantType: 'refresh_token' as const,
      refreshToken: original.refresh_token!,
      clientId: request.clientId,
      resource,
    };
    const deadlinesBefore = db.prepare('SELECT value FROM verification').all() as {
      value: string;
    }[];
    const deadline = JSON.parse(deadlinesBefore[0]!.value).refreshExpiresAt;
    const results = await Promise.allSettled([
      service.exchangeToken(refresh),
      service.exchangeToken(refresh),
    ]);
    const successes = results.filter(result => result.status === 'fulfilled');
    expect(successes).toHaveLength(1);
    const rotated = (successes[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof issue>>>)
      .value;
    expect(rotated.refresh_token).not.toBe(original.refresh_token);
    await expect(service.exchangeToken(refresh)).rejects.toBeInstanceOf(AuthenticationError);
    const values = db.prepare('SELECT value FROM verification').all() as { value: string }[];
    expect(values.every(row => JSON.parse(row.value).refreshExpiresAt === deadline)).toBe(true);
  });

  it('rejects expired code/access/refresh grants', async () => {
    const code = await service.createAuthorizationCode(request, context);
    db.prepare('UPDATE verification SET expiresAt = 0').run();
    await expect(exchange(code.code)).rejects.toBeInstanceOf(AuthenticationError);
    const tokens = await issue();
    db.prepare('UPDATE verification SET expiresAt = 0').run();
    expect(await service.verifyAccessToken(tokens.access_token, resource, ['mcp:read'])).toBeNull();
    await expect(
      service.exchangeToken({
        grantType: 'refresh_token',
        refreshToken: tokens.refresh_token!,
        clientId: request.clientId,
        resource,
      })
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('denies read-only scope mutation and never raises role above the original ceiling', async () => {
    const readCode = await service.createAuthorizationCode(
      { ...request, scopes: ['mcp:read'] },
      { ...context, roles: ['viewer'] }
    );
    const readToken = await exchange(readCode.code);
    expect(
      await service.verifyAccessToken(readToken.access_token, resource, ['mcp:write'])
    ).toBeNull();
    expect(
      await service.verifyAccessToken(readToken.access_token, resource, ['mcp:read'])
    ).toMatchObject({ roles: ['viewer'] });
    member = { ...context, roles: ['editor'] };
    const tokens = await issue();
    member = { ...context, roles: ['viewer'] };
    expect(
      await service.verifyAccessToken(tokens.access_token, resource, ['mcp:read'])
    ).toMatchObject({ roles: ['viewer'] });
  });

  it('denies deleted/removed/archived membership on access and refresh', async () => {
    const tokens = await issue();
    member = null;
    expect(await service.verifyAccessToken(tokens.access_token, resource, ['mcp:read'])).toBeNull();
    await expect(
      service.exchangeToken({
        grantType: 'refresh_token',
        refreshToken: tokens.refresh_token!,
        clientId: request.clientId,
        resource,
      })
    ).rejects.toBeInstanceOf(AuthenticationError);
    await expect(service.createAuthorizationCode(request, context)).rejects.toBeInstanceOf(
      AuthenticationError
    );
  });

  it('rejects cross-project authority changes and revoked access tokens', async () => {
    const tokens = await issue();
    member = { ...context, projectId: 'other-project' };
    expect(await service.verifyAccessToken(tokens.access_token, resource, ['mcp:read'])).toBeNull();
    member = context;
    await service.revoke(tokens.access_token);
    expect(await service.verifyAccessToken(tokens.access_token, resource, ['mcp:read'])).toBeNull();
  });
});
